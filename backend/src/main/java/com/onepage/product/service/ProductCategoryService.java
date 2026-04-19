package com.onepage.product.service;

import com.onepage.product.dto.product.CreateProductCategoryRequest;
import com.onepage.product.dto.product.ProductCategoryDTO;
import com.onepage.product.exception.BusinessException;
import com.onepage.product.model.ProductCategory;
import com.onepage.product.model.User;
import com.onepage.product.repository.ProductCategoryRepository;
import com.onepage.product.repository.UserRepository;
import com.onepage.product.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductCategoryService {

    private final ProductCategoryRepository categoryRepository;
    private final UserRepository userRepository;

    // REQ-034: RBAC data isolation
    @Transactional(readOnly = true)
    public List<ProductCategoryDTO> listCategories() {
        if (SecurityUtils.isAdmin()) {
            return categoryRepository.findAllRootCategories().stream()
                    .map(this::toDTO)
                    .collect(Collectors.toList());
        } else {
            String email = SecurityUtils.getCurrentUserEmail();
            User currentUser = findUserByEmailOrThrow(email);
            return categoryRepository.findAllRootCategoriesByOwnerUserId(currentUser.getId()).stream()
                    .map(this::toDTO)
                    .collect(Collectors.toList());
        }
    }

    @Transactional
    public ProductCategoryDTO createCategory(CreateProductCategoryRequest request) {
        String email = SecurityUtils.getCurrentUserEmail();
        User currentUser = findUserByEmailOrThrow(email);

        ProductCategory category = new ProductCategory();
        category.setOwnerUser(currentUser);
        category.setName(request.getName());

        if (request.getParentId() != null) {
            ProductCategory parent = categoryRepository.findById(request.getParentId())
                    .orElseThrow(() -> new BusinessException("父分類不存在", HttpStatus.BAD_REQUEST));
            category.setParent(parent);
        }

        return toDTO(categoryRepository.save(category));
    }

    @Transactional
    public ProductCategoryDTO updateCategory(Long categoryId, String name) {
        ProductCategory category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new BusinessException("分類不存在", HttpStatus.NOT_FOUND));
        category.setName(name);
        return toDTO(categoryRepository.save(category));
    }

    @Transactional
    public void deleteCategory(Long categoryId) {
        ProductCategory category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new BusinessException("分類不存在", HttpStatus.NOT_FOUND));
        if (!category.getChildren().isEmpty()) {
            throw new BusinessException("請先刪除子分類", HttpStatus.BAD_REQUEST);
        }
        categoryRepository.delete(category);
    }

    private ProductCategoryDTO toDTO(ProductCategory category) {
        return ProductCategoryDTO.builder()
                .id(category.getId())
                .ownerUserId(category.getOwnerUser() != null ? category.getOwnerUser().getId() : null)
                .name(category.getName())
                .parentId(category.getParent() != null ? category.getParent().getId() : null)
                .children(category.getChildren().stream().map(this::toDTO).collect(Collectors.toList()))
                .build();
    }

    private User findUserByEmailOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("使用者不存在", HttpStatus.UNAUTHORIZED));
    }
}
