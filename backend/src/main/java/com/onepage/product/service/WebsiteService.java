package com.onepage.product.service;

import com.onepage.product.dto.website.*;
import com.onepage.product.exception.BusinessException;
import com.onepage.product.model.Product;
import com.onepage.product.model.User;
import com.onepage.product.model.Website;
import com.onepage.product.model.WebsiteProduct;
import com.onepage.product.repository.ProductRepository;
import com.onepage.product.repository.UserRepository;
import com.onepage.product.repository.WebsiteProductRepository;
import com.onepage.product.repository.WebsiteRepository;
import com.onepage.product.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WebsiteService {

    private final WebsiteRepository websiteRepository;
    private final WebsiteProductRepository websiteProductRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    // REQ-034: RBAC data isolation
    @Transactional(readOnly = true)
    public List<WebsiteDTO> listWebsites() {
        if (SecurityUtils.isAdmin()) {
            return websiteRepository.findAll().stream()
                    .map(this::toDTO)
                    .collect(Collectors.toList());
        } else {
            String email = SecurityUtils.getCurrentUserEmail();
            User currentUser = findUserByEmailOrThrow(email);
            return websiteRepository.findByOwnerUserId(currentUser.getId()).stream()
                    .map(this::toDTO)
                    .collect(Collectors.toList());
        }
    }

    @Transactional
    public WebsiteDTO createWebsite(CreateWebsiteRequest request) {
        String email = SecurityUtils.getCurrentUserEmail();
        User currentUser = findUserByEmailOrThrow(email);

        Website website = Website.builder()
                .ownerUser(currentUser)
                .name(request.getName())
                .title(request.getTitle())
                .subtitle(request.getSubtitle())
                .browserTitle(request.getBrowserTitle())
                .footerTitle(request.getFooterTitle())
                .footerSubtitle(request.getFooterSubtitle())
                .subscriptionPlan(request.getSubscriptionPlan())
                .publishStartAt(request.getPublishStartAt())
                .publishEndAt(request.getPublishEndAt())
                .freeShippingThreshold(request.getFreeShippingThreshold() != null
                        ? request.getFreeShippingThreshold()
                        : new java.math.BigDecimal("1500.00"))
                .status(Website.WebsiteStatus.DRAFT)
                .build();

        if (request.getBannerImage() != null && !request.getBannerImage().isEmpty()) {
            website.setBannerImageUrl(storeWebsiteImage(request.getBannerImage()));
        }
        if (request.getPromoImage() != null && !request.getPromoImage().isEmpty()) {
            website.setPromoImageUrl(storeWebsiteImage(request.getPromoImage()));
        }

        return toDTO(websiteRepository.save(website));
    }

    @Transactional(readOnly = true)
    public WebsiteDTO getWebsite(Long websiteId) {
        Website website = findWebsiteOrThrow(websiteId);
        checkOwnerAccess(website);
        return toDTO(website);
    }

    @Transactional
    public WebsiteDTO updateWebsite(Long websiteId, UpdateWebsiteRequest request) {
        Website website = findWebsiteOrThrow(websiteId);
        checkOwnerAccess(website);

        website.setName(request.getName());
        website.setTitle(request.getTitle());
        website.setSubtitle(request.getSubtitle());
        website.setBrowserTitle(request.getBrowserTitle());
        website.setFooterTitle(request.getFooterTitle());
        website.setFooterSubtitle(request.getFooterSubtitle());
        website.setSubscriptionPlan(request.getSubscriptionPlan());
        website.setPublishStartAt(request.getPublishStartAt());
        website.setPublishEndAt(request.getPublishEndAt());
        if (request.getFreeShippingThreshold() != null) {
            website.setFreeShippingThreshold(request.getFreeShippingThreshold());
        }

        if (request.getBannerImage() != null && !request.getBannerImage().isEmpty()) {
            website.setBannerImageUrl(storeWebsiteImage(request.getBannerImage()));
        }
        if (request.getPromoImage() != null && !request.getPromoImage().isEmpty()) {
            website.setPromoImageUrl(storeWebsiteImage(request.getPromoImage()));
        }

        return toDTO(websiteRepository.save(website));
    }

    @Transactional
    public WebsiteDTO publishWebsite(Long websiteId) {
        Website website = findWebsiteOrThrow(websiteId);
        checkOwnerAccess(website);
        if (website.getStatus() != Website.WebsiteStatus.DRAFT) {
            throw new BusinessException("狀態轉換不合法", HttpStatus.BAD_REQUEST);
        }
        website.setStatus(Website.WebsiteStatus.PUBLISHED);
        return toDTO(websiteRepository.save(website));
    }

    @Transactional
    public WebsiteDTO unpublishWebsite(Long websiteId) {
        Website website = findWebsiteOrThrow(websiteId);
        checkOwnerAccess(website);
        if (website.getStatus() != Website.WebsiteStatus.PUBLISHED) {
            throw new BusinessException("狀態轉換不合法", HttpStatus.BAD_REQUEST);
        }
        website.setStatus(Website.WebsiteStatus.OFFLINE);
        return toDTO(websiteRepository.save(website));
    }

    // REQ-028: 重新上線（已下線 → 已上線）
    @Transactional
    public WebsiteDTO republishWebsite(Long websiteId) {
        Website website = findWebsiteOrThrow(websiteId);
        checkOwnerAccess(website);
        if (website.getStatus() != Website.WebsiteStatus.OFFLINE) {
            throw new BusinessException("狀態轉換不合法（僅已下線網站可重新上線）", HttpStatus.BAD_REQUEST);
        }
        website.setStatus(Website.WebsiteStatus.PUBLISHED);
        return toDTO(websiteRepository.save(website));
    }

    @Transactional(readOnly = true)
    public List<WebsiteProductDTO> listWebsiteProducts(Long websiteId) {
        Website website = findWebsiteOrThrow(websiteId);
        checkOwnerAccess(website);
        return websiteProductRepository.findByWebsiteId(websiteId).stream()
                .map(this::toWebsiteProductDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public List<WebsiteProductDTO> updateWebsiteProducts(Long websiteId, List<WebsiteProductInput> inputs) {
        Website website = findWebsiteOrThrow(websiteId);
        checkOwnerAccess(website);
        websiteProductRepository.deleteByWebsiteId(websiteId);
        websiteProductRepository.flush();

        List<WebsiteProduct> newProducts = inputs.stream().map(input -> {
            Product product = productRepository.findById(input.getProductId())
                    .orElseThrow(() -> new BusinessException("商品不存在", HttpStatus.BAD_REQUEST));
            if (product.getStatus() != Product.ProductStatus.ACTIVE) {
                throw new BusinessException("商品非已上架狀態", HttpStatus.BAD_REQUEST);
            }
            return WebsiteProduct.builder()
                    .website(website)
                    .product(product)
                    .publishAt(input.getPublishAt())
                    .build();
        }).collect(Collectors.toList());

        websiteProductRepository.saveAll(newProducts);

        return newProducts.stream().map(this::toWebsiteProductDTO).collect(Collectors.toList());
    }

    private Website findWebsiteOrThrow(Long websiteId) {
        return websiteRepository.findById(websiteId)
                .orElseThrow(() -> new BusinessException("網站不存在", HttpStatus.NOT_FOUND));
    }

    private User findUserByEmailOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("使用者不存在", HttpStatus.UNAUTHORIZED));
    }

    // REQ-034: check that general users can only access their own data
    private void checkOwnerAccess(Website website) {
        if (SecurityUtils.isAdmin()) return;
        String email = SecurityUtils.getCurrentUserEmail();
        if (website.getOwnerUser() == null || !website.getOwnerUser().getEmail().equals(email)) {
            throw new BusinessException("無權限", HttpStatus.FORBIDDEN);
        }
    }

    private String storeWebsiteImage(MultipartFile file) {
        fileStorageService.validateImage(file);
        return fileStorageService.storeImage(file);
    }

    private WebsiteDTO toDTO(Website website) {
        return WebsiteDTO.builder()
                .id(website.getId())
                .ownerUserId(website.getOwnerUser() != null ? website.getOwnerUser().getId() : null)
                .name(website.getName())
                .title(website.getTitle())
                .subtitle(website.getSubtitle())
                .browserTitle(website.getBrowserTitle())
                .footerTitle(website.getFooterTitle())
                .footerSubtitle(website.getFooterSubtitle())
                .subscriptionPlan(website.getSubscriptionPlan())
                .publishStartAt(website.getPublishStartAt())
                .publishEndAt(website.getPublishEndAt())
                .bannerImageUrl(website.getBannerImageUrl())
                .promoImageUrl(website.getPromoImageUrl())
                .freeShippingThreshold(website.getFreeShippingThreshold())
                .status(website.getStatus().name())
                .storefrontUrl("/project/" + website.getId())
                .createdAt(website.getCreatedAt())
                .updatedAt(website.getUpdatedAt())
                .build();
    }

    private WebsiteProductDTO toWebsiteProductDTO(WebsiteProduct wp) {
        return WebsiteProductDTO.builder()
                .websiteId(wp.getWebsite().getId())
                .productId(wp.getProduct().getId())
                .productName(wp.getProduct().getName())
                .productSlug(wp.getProduct().getSlug())
                .publishAt(wp.getPublishAt())
                .build();
    }
}
