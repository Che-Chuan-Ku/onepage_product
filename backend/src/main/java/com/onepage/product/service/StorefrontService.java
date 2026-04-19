package com.onepage.product.service;

import com.onepage.product.dto.product.BundleItemDTO;
import com.onepage.product.dto.product.ProductImageDTO;
import com.onepage.product.dto.shipping.ShippingCalculateRequest;
import com.onepage.product.dto.shipping.ShippingCalculateResponse;
import com.onepage.product.dto.storefront.StorefrontProductCardDTO;
import com.onepage.product.dto.storefront.StorefrontProductDTO;
import com.onepage.product.dto.storefront.StorefrontWebsiteDTO;
import com.onepage.product.exception.BusinessException;
import com.onepage.product.model.Order;
import com.onepage.product.model.Product;
import com.onepage.product.model.Website;
import com.onepage.product.model.WebsiteProduct;
import com.onepage.product.repository.ProductRepository;
import com.onepage.product.repository.WebsiteProductRepository;
import com.onepage.product.repository.WebsiteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StorefrontService {

    private static final List<String> OUTER_ISLANDS = Arrays.asList(
            "澎湖縣", "金門縣", "連江縣");
    private static final BigDecimal OUTER_ISLAND_SHIPPING = new BigDecimal("1000");

    private final WebsiteRepository websiteRepository;
    private final WebsiteProductRepository websiteProductRepository;
    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    public StorefrontWebsiteDTO getStorefrontWebsite(Long websiteId) {
        Website website = websiteRepository.findById(websiteId)
                .filter(w -> w.getStatus() == Website.WebsiteStatus.PUBLISHED)
                .orElseThrow(() -> new BusinessException("網站不存在或未上線", HttpStatus.NOT_FOUND));

        List<WebsiteProduct> wps = websiteProductRepository.findByWebsiteId(websiteId);
        List<StorefrontProductCardDTO> cards = wps.stream()
                .map(wp -> toProductCard(wp.getProduct()))
                .collect(Collectors.toList());

        return StorefrontWebsiteDTO.builder()
                .id(website.getId())
                .name(website.getName())
                .title(website.getTitle())
                .subtitle(website.getSubtitle())
                .browserTitle(website.getBrowserTitle())
                .footerTitle(website.getFooterTitle())
                .footerSubtitle(website.getFooterSubtitle())
                .bannerImageUrl(website.getBannerImageUrl())
                .promoImageUrl(website.getPromoImageUrl())
                .freeShippingThreshold(website.getFreeShippingThreshold())
                .products(cards)
                .build();
    }

    @Transactional(readOnly = true)
    public StorefrontProductDTO getStorefrontProduct(Long websiteId, String productSlug) {
        websiteRepository.findById(websiteId)
                .filter(w -> w.getStatus() == Website.WebsiteStatus.PUBLISHED)
                .orElseThrow(() -> new BusinessException("網站不存在或未上線", HttpStatus.NOT_FOUND));

        Product product = productRepository.findBySlug(productSlug)
                .orElseThrow(() -> new BusinessException("商品不存在", HttpStatus.NOT_FOUND));

        boolean isOnWebsite = websiteProductRepository.existsByWebsiteIdAndProductId(websiteId, product.getId());
        if (!isOnWebsite || product.getStatus() != Product.ProductStatus.ACTIVE) {
            throw new BusinessException("商品不存在或未上架至此網站", HttpStatus.NOT_FOUND);
        }

        return toStorefrontProduct(product);
    }

    @Transactional(readOnly = true)
    public boolean checkProductStock(Long productId, int quantity) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new BusinessException("商品不存在", HttpStatus.NOT_FOUND));
        return product.getStockQuantity() >= quantity;
    }

    @Transactional(readOnly = true)
    public ShippingCalculateResponse calculateShipping(ShippingCalculateRequest request) {
        if ("PICKUP".equals(request.getShippingMethod())) {
            return ShippingCalculateResponse.builder()
                    .shippingFee(BigDecimal.ZERO)
                    .freeShipping(true)
                    .reason("自取免運費")
                    .build();
        }

        // Check outer islands
        if (request.getRecipientCity() != null && OUTER_ISLANDS.contains(request.getRecipientCity())) {
            return ShippingCalculateResponse.builder()
                    .shippingFee(null)
                    .freeShipping(false)
                    .reason("外島地區暫不支援配送")
                    .build();
        }

        // Check if website exists
        Website website = websiteRepository.findById(request.getWebsiteId())
                .orElseThrow(() -> new BusinessException("網站不存在", HttpStatus.NOT_FOUND));

        BigDecimal threshold = website.getFreeShippingThreshold();
        if (request.getSubtotal().compareTo(threshold) >= 0) {
            return ShippingCalculateResponse.builder()
                    .shippingFee(BigDecimal.ZERO)
                    .freeShipping(true)
                    .reason("滿額免運")
                    .build();
        }

        return ShippingCalculateResponse.builder()
                .shippingFee(new BigDecimal("150"))
                .freeShipping(false)
                .reason("一般運費")
                .build();
    }

    private StorefrontProductCardDTO toProductCard(Product product) {
        String imageUrl = product.getImages().isEmpty()
                ? null
                : product.getImages().get(0).getImageUrl();
        return StorefrontProductCardDTO.builder()
                .id(product.getId())
                .name(product.getName())
                .slug(product.getSlug())
                .price(product.getPrice())
                .imageUrl(imageUrl)
                .isPreorder(product.isPreorder())
                .preorderDiscountPercent(product.getPreorderDiscountPercent())
                .build();
    }

    private StorefrontProductDTO toStorefrontProduct(Product product) {
        return StorefrontProductDTO.builder()
                .id(product.getId())
                .name(product.getName())
                .slug(product.getSlug())
                .description(product.getDescription())
                .price(product.getPrice())
                .priceUnit(product.getPriceUnit().name())
                .packaging(product.getPackaging())
                .categoryName(product.getCategory().getName())
                .isBundle(product.isBundle())
                .bundleDiscountPercent(product.getBundleDiscountPercent())
                .bundleItems(product.getBundleItems().stream()
                        .map(bi -> BundleItemDTO.builder()
                                .productId(bi.getIncludedProduct().getId())
                                .productName(bi.getIncludedProduct().getName())
                                .price(bi.getIncludedProduct().getPrice())
                                .build())
                        .collect(Collectors.toList()))
                .isPreorder(product.isPreorder())
                .preorderEndDate(product.getPreorderEndDate())
                .preorderDiscountPercent(product.getPreorderDiscountPercent())
                .stockQuantity(product.getStockQuantity())
                .images(product.getImages().stream()
                        .map(img -> ProductImageDTO.builder()
                                .id(img.getId())
                                .imageUrl(img.getImageUrl())
                                .sortOrder(img.getSortOrder())
                                .build())
                        .collect(Collectors.toList()))
                .build();
    }
}
