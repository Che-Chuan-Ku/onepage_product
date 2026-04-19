package com.onepage.product.repository;

import com.onepage.product.model.LowStockAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LowStockAlertRepository extends JpaRepository<LowStockAlert, Long> {

    Optional<LowStockAlert> findByProductIdAndResolvedAtIsNull(Long productId);

    List<LowStockAlert> findByProductId(Long productId);
}
