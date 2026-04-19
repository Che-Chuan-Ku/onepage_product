package com.onepage.product.service;

import com.onepage.product.dto.inventory.InventoryDTO;
import com.onepage.product.exception.BusinessException;
import com.onepage.product.model.LowStockAlert;
import com.onepage.product.model.Product;
import com.onepage.product.model.User;
import com.onepage.product.repository.LowStockAlertRepository;
import com.onepage.product.repository.ProductRepository;
import com.onepage.product.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryService {

    private final ProductRepository productRepository;
    private final LowStockAlertRepository lowStockAlertRepository;
    private final UserRepository userRepository;
    private final EmailNotificationService emailNotificationService;

    @Transactional(readOnly = true)
    public List<InventoryDTO> listInventory() {
        return productRepository.findAll().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public InventoryDTO updateInventory(Long productId, int stockQuantity) {
        Product product = findProductOrThrow(productId);

        int previousStock = product.getStockQuantity();
        product.setStockQuantity(stockQuantity);

        // If stock replenished above threshold, clear low stock alert
        if (previousStock <= product.getLowStockThreshold()
                && stockQuantity > product.getLowStockThreshold()
                && product.isLowStockAlerted()) {
            product.setLowStockAlerted(false);
            lowStockAlertRepository.findByProductIdAndResolvedAtIsNull(productId)
                    .ifPresent(alert -> {
                        alert.setResolvedAt(LocalDateTime.now());
                        lowStockAlertRepository.save(alert);
                    });
        }

        // Check if new stock triggers low stock alert
        if (stockQuantity <= product.getLowStockThreshold() && !product.isLowStockAlerted()) {
            triggerLowStockAlert(product, stockQuantity);
        }

        return toDTO(productRepository.save(product));
    }

    @Transactional
    public InventoryDTO updateLowStockThreshold(Long productId, int threshold) {
        Product product = findProductOrThrow(productId);
        product.setLowStockThreshold(threshold);

        // Check if current stock is now below new threshold
        if (product.getStockQuantity() <= threshold && !product.isLowStockAlerted()) {
            triggerLowStockAlert(product, product.getStockQuantity());
        }

        return toDTO(productRepository.save(product));
    }

    public void checkAndTriggerLowStockAlert(Product product) {
        if (product.getStockQuantity() <= product.getLowStockThreshold()
                && !product.isLowStockAlerted()) {
            triggerLowStockAlert(product, product.getStockQuantity());
            product.setLowStockAlerted(true);
            productRepository.save(product);
        }
    }

    private void triggerLowStockAlert(Product product, int currentStock) {
        LowStockAlert alert = LowStockAlert.builder()
                .product(product)
                .alertedAt(LocalDateTime.now())
                .stockAtAlert(currentStock)
                .thresholdAtAlert(product.getLowStockThreshold())
                .build();
        lowStockAlertRepository.save(alert);
        product.setLowStockAlerted(true);

        // Send alert email to all admins
        List<String> adminEmails = userRepository.findAll().stream()
                .filter(u -> u.getRole() == User.UserRole.ADMIN)
                .map(User::getEmail)
                .collect(Collectors.toList());
        emailNotificationService.sendLowStockAlert(product, adminEmails);
    }

    private Product findProductOrThrow(Long productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new BusinessException("商品不存在", HttpStatus.NOT_FOUND));
    }

    private InventoryDTO toDTO(Product product) {
        return InventoryDTO.builder()
                .productId(product.getId())
                .productName(product.getName())
                .productSlug(product.getSlug())
                .stockQuantity(product.getStockQuantity())
                .lowStockThreshold(product.getLowStockThreshold())
                .lowStockAlerted(product.isLowStockAlerted())
                .build();
    }
}
