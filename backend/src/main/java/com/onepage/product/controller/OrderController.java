package com.onepage.product.controller;

import com.onepage.product.dto.order.CreateOrderRequest;
import com.onepage.product.dto.order.OrderDTO;
import com.onepage.product.dto.order.PagedOrders;
import com.onepage.product.model.Order;
import com.onepage.product.service.OrderService;
import com.opencsv.CSVWriter;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequiredArgsConstructor
@Slf4j
public class OrderController {

    private final OrderService orderService;

    @PostMapping("/storefront/orders")
    public ResponseEntity<OrderDTO> createOrder(@Valid @RequestBody CreateOrderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(orderService.createOrder(request));
    }

    @GetMapping("/orders")
    public ResponseEntity<PagedOrders> listOrders(
            @RequestParam(required = false) Long websiteId,
            @RequestParam(required = false) String orderNumber,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(orderService.listOrders(
                websiteId, orderNumber, startDate, endDate, status, page, size));
    }

    @GetMapping("/orders/export")
    public void exportOrdersCsv(
            @RequestParam(required = false) Long websiteId,
            @RequestParam(required = false) String orderNumber,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String status,
            HttpServletResponse response) throws IOException {

        List<Order> orders = orderService.listOrdersForExport(
                websiteId, orderNumber, startDate, endDate, status);

        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=\"orders.csv\"");

        // Write UTF-8 BOM
        response.getOutputStream().write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF});

        try (CSVWriter writer = new CSVWriter(
                new OutputStreamWriter(response.getOutputStream(), StandardCharsets.UTF_8))) {
            // Header
            writer.writeNext(new String[]{
                    "訂單編號", "網站ID", "顧客姓名", "顧客電話", "顧客Email",
                    "運送方式", "運費", "商品小計", "訂單總金額", "狀態", "建立時間"
            });
            // Data
            for (Order order : orders) {
                writer.writeNext(new String[]{
                        order.getOrderNumber(),
                        String.valueOf(order.getWebsite().getId()),
                        order.getCustomerName(),
                        order.getCustomerPhone(),
                        order.getCustomerEmail(),
                        order.getShippingMethod().name(),
                        order.getShippingFee().toString(),
                        order.getSubtotal().toString(),
                        order.getTotalAmount().toString(),
                        order.getStatus().name(),
                        order.getCreatedAt().toString()
                });
            }
        }
    }

    @PostMapping("/orders/{orderId}/ship")
    public ResponseEntity<OrderDTO> markShipped(@PathVariable Long orderId) {
        return ResponseEntity.ok(orderService.markShipped(orderId));
    }

    @PostMapping("/orders/{orderId}/return")
    public ResponseEntity<OrderDTO> markReturned(@PathVariable Long orderId) {
        return ResponseEntity.ok(orderService.markReturned(orderId));
    }
}
