package com.onepage.product.repository;

import com.onepage.product.model.WebsiteProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WebsiteProductRepository extends JpaRepository<WebsiteProduct, Long> {

    List<WebsiteProduct> findByWebsiteId(Long websiteId);

    void deleteByWebsiteId(Long websiteId);

    boolean existsByWebsiteIdAndProductId(Long websiteId, Long productId);
}
