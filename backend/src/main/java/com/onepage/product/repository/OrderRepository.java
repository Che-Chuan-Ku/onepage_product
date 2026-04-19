package com.onepage.product.repository;

import com.onepage.product.model.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long>, JpaSpecificationExecutor<Order> {

    Optional<Order> findByOrderNumber(String orderNumber);

    boolean existsByOrderNumber(String orderNumber);

    Page<Order> findByWebsiteId(Long websiteId, Pageable pageable);

    // REQ-034 RBAC: owner-scoped queries (filter by website owner)
    @Query("SELECT o FROM Order o WHERE o.website.ownerUser.id = :ownerUserId")
    Page<Order> findByWebsiteOwnerUserId(Long ownerUserId, Pageable pageable);
}
