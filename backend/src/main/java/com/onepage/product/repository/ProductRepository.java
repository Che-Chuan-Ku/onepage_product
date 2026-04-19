package com.onepage.product.repository;

import com.onepage.product.model.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {

    Optional<Product> findBySlug(String slug);

    boolean existsBySlug(String slug);

    Page<Product> findByStatus(Product.ProductStatus status, Pageable pageable);

    Page<Product> findByCategoryId(Long categoryId, Pageable pageable);

    Page<Product> findByStatusAndCategoryId(Product.ProductStatus status, Long categoryId, Pageable pageable);

    // REQ-034 RBAC: owner-scoped queries
    Page<Product> findByOwnerUserId(Long ownerUserId, Pageable pageable);

    Page<Product> findByOwnerUserIdAndStatus(Long ownerUserId, Product.ProductStatus status, Pageable pageable);

    Page<Product> findByOwnerUserIdAndCategoryId(Long ownerUserId, Long categoryId, Pageable pageable);

    Page<Product> findByOwnerUserIdAndStatusAndCategoryId(Long ownerUserId, Product.ProductStatus status, Long categoryId, Pageable pageable);
}
