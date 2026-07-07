package com.gomoku.repository;

import com.gomoku.domain.entity.PveShopOfferSlot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PveShopOfferSlotRepository extends JpaRepository<PveShopOfferSlot, String> {
    List<PveShopOfferSlot> findByShopVisitIdAndDeletedFalseOrderBySlotIndexAsc(String shopVisitId);
    Optional<PveShopOfferSlot> findByShopVisitIdAndSlotIndexAndDeletedFalse(String shopVisitId, int slotIndex);
}
