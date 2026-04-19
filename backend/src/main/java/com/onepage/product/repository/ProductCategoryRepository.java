package com.onepage.product.repository;

import com.onepage.product.model.ProductCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductCategoryRepository extends JpaRepository<ProductCategory, Long> {

    @Query("SELECT c FROM ProductCategory c WHERE c.parent IS NULL")
    List<ProductCategory> findAllRootCategories();

    List<ProductCategory> findByParentId(Long parentId);

    // REQ-034 RBAC: owner-scoped queries
    @Query("SELECT c FROM ProductCategory c WHERE c.parent IS NULL AND c.ownerUser.id = :ownerUserId")
    List<ProductCategory> findAllRootCategoriesByOwnerUserId(Long ownerUserId);

    List<ProductCategory> findByOwnerUserId(Long ownerUserId);
}
