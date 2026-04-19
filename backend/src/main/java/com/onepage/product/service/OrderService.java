package com.onepage.product.service;

import com.onepage.product.dto.order.CreateOrderRequest;
import com.onepage.product.dto.order.OrderDTO;
import com.onepage.product.dto.order.PagedOrders;
import com.onepage.product.exception.BusinessException;
import com.onepage.product.model.*;
import com.onepage.product.repository.*;
import com.onepage.product.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private static final int MAX_RETRY_ATTEMPTS = 3;

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final WebsiteRepository websiteRepository;
    private final UserRepository userRepository;
    private final EmailNotificationService emailNotificationService;

    @Transactional
    public OrderDTO createOrder(CreateOrderRequest request) {
        return createOrderWithRetry(request, 0);
    }

    private OrderDTO createOrderWithRetry(CreateOrderRequest request, int attempt) {
        try {
            return doCreateOrder(request);
        } catch (ObjectOptimisticLockingFailureException ex) {
            if (attempt < MAX_RETRY_ATTEMPTS) {
                log.info("Optimistic lock conflict, retrying attempt {}", attempt + 1);
                return createOrderWithRetry(request, attempt + 1);
            }
            throw new BusinessException("訂單建立衝突，請稍後再試", HttpStatus.CONFLICT);
        }
    }

    private OrderDTO doCreateOrder(CreateOrderRequest request) {
        Website website = websiteRepository.findById(request.getWebsiteId())
                .orElseThrow(() -> new BusinessException("網站不存在", HttpStatus.BAD_REQUEST));

        Order.ShippingMethod shippingMethod = Order.ShippingMethod.valueOf(request.getShippingMethod());

        // Load and lock products, check stock
        List<OrderItem> orderItems = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        boolean isPreorder = false;

        for (CreateOrderRequest.OrderItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new BusinessException("商品不存在", HttpStatus.BAD_REQUEST));

            if (product.getStockQuantity() < itemReq.getQuantity()) {
                throw new BusinessException("庫存不足，無法完成訂單", HttpStatus.BAD_REQUEST);
            }

            // Calculate discount
            BigDecimal price = product.getPrice();
            BigDecimal discountAmount = BigDecimal.ZERO;

            if (product.isPreorder() && product.getPreorderDiscountPercent() != null) {
                discountAmount = price
                        .multiply(product.getPreorderDiscountPercent())
                        .divide(BigDecimal.valueOf(100))
                        .multiply(BigDecimal.valueOf(itemReq.getQuantity()))
                        .setScale(2, java.math.RoundingMode.HALF_UP);
                isPreorder = true;
            } else if (product.isBundle() && product.getBundleDiscountPercent() != null) {
                discountAmount = price
                        .multiply(product.getBundleDiscountPercent())
                        .divide(BigDecimal.valueOf(100))
                        .multiply(BigDecimal.valueOf(itemReq.getQuantity()))
                        .setScale(2, java.math.RoundingMode.HALF_UP);
            }

            BigDecimal itemSubtotal = price
                    .multiply(BigDecimal.valueOf(itemReq.getQuantity()))
                    .subtract(discountAmount)
                    .setScale(2, java.math.RoundingMode.HALF_UP);

            subtotal = subtotal.add(itemSubtotal);

            OrderItem orderItem = OrderItem.builder()
                    .product(product)
                    .productName(product.getName())
                    .productPrice(price)
                    .quantity(itemReq.getQuantity())
                    .discountAmount(discountAmount)
                    .subtotal(itemSubtotal)
                    .build();
            orderItems.add(orderItem);

            // Deduct stock (triggers optimistic lock check)
            product.setStockQuantity(product.getStockQuantity() - itemReq.getQuantity());
            productRepository.save(product);
        }

        // Calculate shipping fee
        BigDecimal shippingFee = calculateShippingFee(shippingMethod, subtotal, website.getFreeShippingThreshold());

        BigDecimal totalAmount = subtotal.add(shippingFee);

        // Generate order number
        String orderNumber = generateOrderNumber();

        Order order = Order.builder()
                .orderNumber(orderNumber)
                .website(website)
                .customerName(request.getCustomerName())
                .customerPhone(request.getCustomerPhone())
                .customerEmail(request.getCustomerEmail())
                .shippingAddress(request.getShippingAddress())
                .shippingMethod(shippingMethod)
                .shippingFee(shippingFee)
                .subtotal(subtotal)
                .totalAmount(totalAmount)
                .note(request.getNote())
                .taxId(request.getTaxId())
                .status(Order.OrderStatus.PENDING_PAYMENT)
                .preorder(isPreorder)
                .build();

        order = orderRepository.save(order);

        final Order savedOrder = order;
        for (OrderItem item : orderItems) {
            item.setOrder(savedOrder);
        }
        order.getOrderItems().addAll(orderItems);
        order = orderRepository.save(order);

        // Check low stock after deduction (handled separately)
        emailNotificationService.sendOrderConfirmed(order);

        return toDTO(order);
    }

    // REQ-034: RBAC data isolation for orders
    @Transactional(readOnly = true)
    public PagedOrders listOrders(Long websiteId, String orderNumber,
                                   String startDate, String endDate,
                                   String status, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        Specification<Order> spec = buildOrderSpec(websiteId, orderNumber, startDate, endDate, status);

        // Apply owner filter for general users
        if (!SecurityUtils.isAdmin()) {
            String email = SecurityUtils.getCurrentUserEmail();
            User currentUser = userRepository.findByEmail(email)
                    .orElseThrow(() -> new BusinessException("使用者不存在", HttpStatus.UNAUTHORIZED));
            final Long ownerId = currentUser.getId();
            Specification<Order> ownerSpec = (root, query, cb) ->
                    cb.equal(root.get("website").get("ownerUser").get("id"), ownerId);
            spec = spec.and(ownerSpec);
        }

        Page<Order> result = orderRepository.findAll(spec, pageable);

        return PagedOrders.builder()
                .content(result.getContent().stream().map(this::toDTO).collect(Collectors.toList()))
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .page(page)
                .size(size)
                .build();
    }

    @Transactional(readOnly = true)
    public List<Order> listOrdersForExport(Long websiteId, String orderNumber,
                                            String startDate, String endDate, String status) {
        Specification<Order> spec = buildOrderSpec(websiteId, orderNumber, startDate, endDate, status);

        // Apply owner filter for general users
        if (!SecurityUtils.isAdmin()) {
            String email = SecurityUtils.getCurrentUserEmail();
            User currentUser = userRepository.findByEmail(email)
                    .orElseThrow(() -> new BusinessException("使用者不存在", HttpStatus.UNAUTHORIZED));
            final Long ownerId = currentUser.getId();
            Specification<Order> ownerSpec = (root, query, cb) ->
                    cb.equal(root.get("website").get("ownerUser").get("id"), ownerId);
            spec = spec.and(ownerSpec);
        }

        return orderRepository.findAll(spec);
    }

    @Transactional
    public OrderDTO markShipped(Long orderId) {
        Order order = findOrderOrThrow(orderId);
        if (order.getStatus() != Order.OrderStatus.PAID) {
            throw new BusinessException("僅已付款訂單可標註出貨", HttpStatus.BAD_REQUEST);
        }
        order.setStatus(Order.OrderStatus.SHIPPED);
        order = orderRepository.save(order);
        emailNotificationService.sendShipped(order);
        return toDTO(order);
    }

    @Transactional
    public OrderDTO markReturned(Long orderId) {
        Order order = findOrderOrThrow(orderId);
        if (order.getStatus() != Order.OrderStatus.PAID) {
            throw new BusinessException("僅已付款訂單可標註退貨", HttpStatus.BAD_REQUEST);
        }
        order.setStatus(Order.OrderStatus.RETURNED);
        return toDTO(orderRepository.save(order));
    }

    private Order findOrderOrThrow(Long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException("訂單不存在", HttpStatus.NOT_FOUND));
    }

    private BigDecimal calculateShippingFee(Order.ShippingMethod method, BigDecimal subtotal, BigDecimal threshold) {
        if (method == Order.ShippingMethod.PICKUP) {
            return BigDecimal.ZERO;
        }
        if (subtotal.compareTo(threshold) >= 0) {
            return BigDecimal.ZERO;
        }
        return new BigDecimal("150");
    }

    private String generateOrderNumber() {
        String date = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String seq = String.format("%03d", System.currentTimeMillis() % 1000);
        return "ORD-" + date + "-" + seq;
    }

    private Specification<Order> buildOrderSpec(Long websiteId, String orderNumber,
                                                  String startDate, String endDate, String status) {
        return (root, query, cb) -> {
            var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
            if (websiteId != null) predicates.add(cb.equal(root.get("website").get("id"), websiteId));
            if (orderNumber != null) predicates.add(cb.like(root.get("orderNumber"), "%" + orderNumber + "%"));
            if (status != null) predicates.add(cb.equal(root.get("status"), Order.OrderStatus.valueOf(status)));
            if (startDate != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"),
                    LocalDate.parse(startDate).atStartOfDay()));
            if (endDate != null) predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"),
                    LocalDate.parse(endDate).atTime(23, 59, 59)));
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    public OrderDTO toDTO(Order order) {
        return OrderDTO.builder()
                .id(order.getId())
                .orderNumber(order.getOrderNumber())
                .websiteId(order.getWebsite().getId())
                .websiteName(order.getWebsite().getName())
                .customerName(order.getCustomerName())
                .customerPhone(order.getCustomerPhone())
                .customerEmail(order.getCustomerEmail())
                .shippingAddress(order.getShippingAddress())
                .shippingMethod(order.getShippingMethod().name())
                .shippingFee(order.getShippingFee())
                .subtotal(order.getSubtotal())
                .totalAmount(order.getTotalAmount())
                .note(order.getNote())
                .taxId(order.getTaxId())
                .status(order.getStatus().name())
                .isPreorder(order.isPreorder())
                .orderItems(order.getOrderItems().stream()
                        .map(item -> OrderDTO.OrderItemDTO.builder()
                                .id(item.getId())
                                .productId(item.getProduct().getId())
                                .productName(item.getProductName())
                                .productPrice(item.getProductPrice())
                                .quantity(item.getQuantity())
                                .discountAmount(item.getDiscountAmount())
                                .subtotal(item.getSubtotal())
                                .build())
                        .collect(Collectors.toList()))
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }
}
