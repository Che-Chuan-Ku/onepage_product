package com.onepage.product.repository;

import com.onepage.product.model.BundleItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BundleItemRepository extends JpaRepository<BundleItem, Long> {
}
