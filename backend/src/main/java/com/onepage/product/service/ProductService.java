package com.onepage.product.service;

import com.onepage.product.dto.product.*;
import com.onepage.product.exception.BusinessException;
import com.onepage.product.model.*;
import com.onepage.product.repository.*;
import com.onepage.product.security.SecurityUtils;
import com.onepage.product.util.SlugUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductCategoryRepository categoryRepository;
    private final BundleItemRepository bundleItemRepository;
    private final FileStorageService fileStorageService;
    private final UserRepository userRepository;

    // REQ-034: RBAC data isolation
    @Transactional(readOnly = true)
    public PagedProducts listProducts(String status, Long categoryId, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        Page<Product> result;

        if (SecurityUtils.isAdmin()) {
            // Admin sees all products
            if (status != null && categoryId != null) {
                result = productRepository.findByStatusAndCategoryId(
                        Product.ProductStatus.valueOf(status), categoryId, pageable);
            } else if (status != null) {
                result = productRepository.findByStatus(Product.ProductStatus.valueOf(status), pageable);
            } else if (categoryId != null) {
                result = productRepository.findByCategoryId(categoryId, pageable);
            } else {
                result = productRepository.findAll(pageable);
            }
        } else {
            // General user sees only their own products
            String email = SecurityUtils.getCurrentUserEmail();
            User currentUser = findUserByEmailOrThrow(email);
            Long ownerId = currentUser.getId();

            if (status != null && categoryId != null) {
                result = productRepository.findByOwnerUserIdAndStatusAndCategoryId(
                        ownerId, Product.ProductStatus.valueOf(status), categoryId, pageable);
            } else if (status != null) {
                result = productRepository.findByOwnerUserIdAndStatus(
                        ownerId, Product.ProductStatus.valueOf(status), pageable);
            } else if (categoryId != null) {
                result = productRepository.findByOwnerUserIdAndCategoryId(ownerId, categoryId, pageable);
            } else {
                result = productRepository.findByOwnerUserId(ownerId, pageable);
            }
        }

        return PagedProducts.builder()
                .content(result.getContent().stream().map(this::toDTO).collect(Collectors.toList()))
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .page(page)
                .size(size)
                .build();
    }

    @Transactional
    public ProductDTO createProduct(CreateProductRequest request) {
        if (request.getName() == null || request.getName().isBlank()) {
            throw new BusinessException("商品名稱為必填", HttpStatus.BAD_REQUEST);
        }
        if (request.getPrice() == null || request.getPrice().compareTo(java.math.BigDecimal.ZERO) <= 0) {
            throw new BusinessException("商品價格必須大於 0", HttpStatus.BAD_REQUEST);
        }
        if (request.getStockQuantity() < 0) {
            throw new BusinessException("庫存數量必須 >= 0", HttpStatus.BAD_REQUEST);
        }

        List<MultipartFile> images = request.getImages();
        if (images != null && images.size() > 5) {
            throw new BusinessException("商品圖片最多 5 張", HttpStatus.BAD_REQUEST);
        }

        // Validate each image before saving anything
        if (images != null) {
            for (MultipartFile file : images) {
                if (file != null && !file.isEmpty()) {
                    fileStorageService.validateImage(file);
                }
            }
        }

        ProductCategory category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new BusinessException("商品分類不存在", HttpStatus.BAD_REQUEST));

        String email = SecurityUtils.getCurrentUserEmail();
        User currentUser = findUserByEmailOrThrow(email);

        String slug = SlugUtil.generateUniqueSlug(request.getName(), productRepository::existsBySlug);

        Product product = Product.builder()
                .ownerUser(currentUser)
                .name(request.getName())
                .slug(slug)
                .description(request.getDescription())
                .price(request.getPrice())
                .priceUnit(Product.PriceUnit.valueOf(request.getPriceUnit()))
                .packaging(request.getPackaging())
                .category(category)
                .stockQuantity(request.getStockQuantity())
                .status(Product.ProductStatus.ACTIVE)
                .bundle(request.isBundle())
                .bundleDiscountPercent(request.getBundleDiscountPercent())
                .preorder(request.isPreorder())
                .preorderStartDate(request.getPreorderStartDate())
                .preorderEndDate(request.getPreorderEndDate())
                .preorderDiscountPercent(request.getPreorderDiscountPercent())
                .build();

        product = productRepository.save(product);

        // Handle bundle items
        List<Long> bundleProductIds = request.getBundleProductIds();
        if (request.isBundle() && bundleProductIds != null && !bundleProductIds.isEmpty()) {
            for (Long includedProductId : bundleProductIds) {
                Product includedProduct = productRepository.findById(includedProductId)
                        .orElseThrow(() -> new BusinessException("組合商品不存在: " + includedProductId, HttpStatus.BAD_REQUEST));
                BundleItem bundleItem = BundleItem.builder()
                        .bundleProduct(product)
                        .includedProduct(includedProduct)
                        .build();
                bundleItemRepository.save(bundleItem);
            }
        }

        // Handle images
        if (images != null && !images.isEmpty()) {
            List<ProductImage> productImages = new ArrayList<>();
            for (int i = 0; i < images.size(); i++) {
                MultipartFile file = images.get(i);
                if (file != null && !file.isEmpty()) {
                    String imageUrl = fileStorageService.storeImage(file);
                    ProductImage img = ProductImage.builder()
                            .product(product)
                            .imageUrl(imageUrl)
                            .sortOrder(i)
                            .build();
                    productImages.add(img);
                }
            }
            product.getImages().addAll(productImages);
            product = productRepository.save(product);
        }

        // Reload to get updated collections (bundle items, images)
        product = productRepository.findById(product.getId()).orElse(product);
        return toDTO(product);
    }

    @Transactional(readOnly = true)
    public ProductDTO getProduct(Long productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new BusinessException("商品不存在", HttpStatus.NOT_FOUND));
        return toDTO(product);
    }

    @Transactional
    public ProductDTO updateProduct(Long productId, UpdateProductRequest request) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new BusinessException("商品不存在", HttpStatus.NOT_FOUND));

        if (request.getName() == null || request.getName().isBlank()) {
            throw new BusinessException("商品名稱為必填", HttpStatus.BAD_REQUEST);
        }

        ProductCategory category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new BusinessException("商品分類不存在", HttpStatus.BAD_REQUEST));

        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setPrice(request.getPrice());
        product.setPriceUnit(Product.PriceUnit.valueOf(request.getPriceUnit()));
        product.setPackaging(request.getPackaging());
        product.setCategory(category);

        if (request.getIsBundle() != null) product.setBundle(request.getIsBundle());
        if (request.getBundleDiscountPercent() != null) product.setBundleDiscountPercent(request.getBundleDiscountPercent());
        if (request.getIsPreorder() != null) product.setPreorder(request.getIsPreorder());
        if (request.getPreorderStartDate() != null) product.setPreorderStartDate(request.getPreorderStartDate());
        if (request.getPreorderEndDate() != null) product.setPreorderEndDate(request.getPreorderEndDate());
        if (request.getPreorderDiscountPercent() != null) product.setPreorderDiscountPercent(request.getPreorderDiscountPercent());
        if (request.getShippingDeadline() != null) product.setShippingDeadline(request.getShippingDeadline());

        return toDTO(productRepository.save(product));
    }

    @Transactional
    public ProductDTO deactivateProduct(Long productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new BusinessException("商品不存在", HttpStatus.NOT_FOUND));

        if (product.getStatus() != Product.ProductStatus.ACTIVE) {
            throw new BusinessException("僅已上架商品可被下架", HttpStatus.BAD_REQUEST);
        }

        product.setStatus(Product.ProductStatus.INACTIVE);
        return toDTO(productRepository.save(product));
    }

    // REQ-026: 商品圖片上傳（POST /products/{id}/images）
    @Transactional
    public List<ProductImageDTO> uploadProductImages(Long productId, List<MultipartFile> files) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new BusinessException("商品不存在", HttpStatus.NOT_FOUND));

        int currentCount = product.getImages().size();
        if (files == null || files.isEmpty()) {
            throw new BusinessException("請選擇要上傳的圖片", HttpStatus.BAD_REQUEST);
        }

        // Count non-empty files
        long newCount = files.stream().filter(f -> f != null && !f.isEmpty()).count();
        if (currentCount + newCount > 5) {
            throw new BusinessException("商品圖片最多 5 張", HttpStatus.BAD_REQUEST);
        }

        // Validate all files first
        for (MultipartFile file : files) {
            if (file != null && !file.isEmpty()) {
                fileStorageService.validateImage(file);
            }
        }

        // Store and attach images
        int sortOrder = currentCount;
        for (MultipartFile file : files) {
            if (file != null && !file.isEmpty()) {
                String imageUrl = fileStorageService.storeImage(file);
                ProductImage img = ProductImage.builder()
                        .product(product)
                        .imageUrl(imageUrl)
                        .sortOrder(sortOrder++)
                        .build();
                product.getImages().add(img);
            }
        }

        product = productRepository.save(product);

        return product.getImages().stream()
                .map(img -> ProductImageDTO.builder()
                        .id(img.getId())
                        .imageUrl(img.getImageUrl())
                        .sortOrder(img.getSortOrder())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteProductImage(Long productId, Long imageId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new BusinessException("商品不存在", HttpStatus.NOT_FOUND));

        boolean removed = product.getImages().removeIf(img -> img.getId().equals(imageId));
        if (!removed) {
            throw new BusinessException("圖片不存在", HttpStatus.NOT_FOUND);
        }

        productRepository.save(product);
    }

    public ProductDTO toDTO(Product product) {
        return ProductDTO.builder()
                .id(product.getId())
                .ownerUserId(product.getOwnerUser() != null ? product.getOwnerUser().getId() : null)
                .name(product.getName())
                .slug(product.getSlug())
                .description(product.getDescription())
                .price(product.getPrice())
                .priceUnit(product.getPriceUnit().name())
                .packaging(product.getPackaging())
                .categoryId(product.getCategory().getId())
                .categoryName(product.getCategory().getName())
                .status(product.getStatus().name())
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
                .preorderStartDate(product.getPreorderStartDate())
                .preorderEndDate(product.getPreorderEndDate())
                .preorderDiscountPercent(product.getPreorderDiscountPercent())
                .shippingDeadline(product.getShippingDeadline())
                .stockQuantity(product.getStockQuantity())
                .images(product.getImages().stream()
                        .map(img -> ProductImageDTO.builder()
                                .id(img.getId())
                                .imageUrl(img.getImageUrl())
                                .sortOrder(img.getSortOrder())
                                .build())
                        .collect(Collectors.toList()))
                .createdAt(product.getCreatedAt())
                .updatedAt(product.getUpdatedAt())
                .build();
    }

    private User findUserByEmailOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("使用者不存在", HttpStatus.UNAUTHORIZED));
    }
}
