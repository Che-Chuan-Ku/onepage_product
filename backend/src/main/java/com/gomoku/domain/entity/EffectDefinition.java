package com.gomoku.domain.entity;

import com.gomoku.domain.enums.BattleContext;
import com.gomoku.domain.enums.EffectActionType;
import com.gomoku.domain.enums.EffectUsageLimitType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Data-driven effect declaration (PVE increment A, FR-A1 FR-A2): the same
 * effect_key carries a different action/usage declaration per battle context,
 * so PVP and PVE behaviour differences live in data, not code.
 */
@Entity
@Table(name = "effect_definitions")
public class EffectDefinition extends BaseEntity {

    @Column(name = "effect_key", length = 50, nullable = false)
    private String effectKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "applicable_mode", length = 10, nullable = false)
    private BattleContext applicableMode;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", length = 20, nullable = false)
    private EffectActionType actionType;

    @Enumerated(EnumType.STRING)
    @Column(name = "usage_limit_type", length = 20, nullable = false)
    private EffectUsageLimitType usageLimitType;

    @Column(name = "trigger", length = 100, nullable = false)
    private String trigger;

    @Column(name = "condition")
    private String condition;

    @Column(name = "ops", nullable = false)
    private String ops;

    @Column(name = "params")
    private String params;

    public String getEffectKey() { return effectKey; }
    public void setEffectKey(String effectKey) { this.effectKey = effectKey; }

    public BattleContext getApplicableMode() { return applicableMode; }
    public void setApplicableMode(BattleContext applicableMode) { this.applicableMode = applicableMode; }

    public EffectActionType getActionType() { return actionType; }
    public void setActionType(EffectActionType actionType) { this.actionType = actionType; }

    public EffectUsageLimitType getUsageLimitType() { return usageLimitType; }
    public void setUsageLimitType(EffectUsageLimitType usageLimitType) { this.usageLimitType = usageLimitType; }

    public String getTrigger() { return trigger; }
    public void setTrigger(String trigger) { this.trigger = trigger; }

    public String getCondition() { return condition; }
    public void setCondition(String condition) { this.condition = condition; }

    public String getOps() { return ops; }
    public void setOps(String ops) { this.ops = ops; }

    public String getParams() { return params; }
    public void setParams(String params) { this.params = params; }
}
