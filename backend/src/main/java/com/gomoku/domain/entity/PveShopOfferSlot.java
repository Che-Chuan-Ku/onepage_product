package com.gomoku.domain.entity;

import com.gomoku.domain.enums.PveRelicType;
import com.gomoku.domain.enums.PveShopOfferKind;
import com.gomoku.domain.enums.SkillType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** One shop display slot: 0,1 = relics, 2 = class-pool skill (FR-C4). */
@Entity
@Table(name = "pve_shop_offer_slots")
public class PveShopOfferSlot extends BaseEntity {

    @Column(name = "shop_visit_id", length = 36, nullable = false)
    private String shopVisitId;

    @Column(name = "slot_index", nullable = false)
    private int slotIndex;

    @Enumerated(EnumType.STRING)
    @Column(name = "offer_kind", length = 10, nullable = false)
    private PveShopOfferKind offerKind;

    @Enumerated(EnumType.STRING)
    @Column(name = "relic_type", length = 30)
    private PveRelicType relicType;

    @Enumerated(EnumType.STRING)
    @Column(name = "skill_type", length = 30)
    private SkillType skillType;

    @Column(name = "price", nullable = false)
    private int price;

    @Column(name = "purchased", nullable = false)
    private boolean purchased = false;

    public String getShopVisitId() { return shopVisitId; }
    public void setShopVisitId(String shopVisitId) { this.shopVisitId = shopVisitId; }

    public int getSlotIndex() { return slotIndex; }
    public void setSlotIndex(int slotIndex) { this.slotIndex = slotIndex; }

    public PveShopOfferKind getOfferKind() { return offerKind; }
    public void setOfferKind(PveShopOfferKind offerKind) { this.offerKind = offerKind; }

    public PveRelicType getRelicType() { return relicType; }
    public void setRelicType(PveRelicType relicType) { this.relicType = relicType; }

    public SkillType getSkillType() { return skillType; }
    public void setSkillType(SkillType skillType) { this.skillType = skillType; }

    public int getPrice() { return price; }
    public void setPrice(int price) { this.price = price; }

    public boolean isPurchased() { return purchased; }
    public void setPurchased(boolean purchased) { this.purchased = purchased; }
}
