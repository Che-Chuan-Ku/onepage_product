package com.gomoku.domain.enums;

/**
 * Serious Duel skills (req #36 #42 #43).
 * Normal skills attach to the turn's stone placement; ultimates replace it.
 */
public enum SkillType {
    HORIZONTAL_SLASH(ClassType.WARRIOR, false),
    VERTICAL_SLASH(ClassType.WARRIOR, false),
    HEAVEN_EARTH_REVERSAL(ClassType.WARRIOR, true),
    PRECISION_SNIPE(ClassType.ARCHER, false),
    SCATTER_SHOT(ClassType.ARCHER, false),
    PIONEER_STAR(ClassType.ARCHER, true);

    private final ClassType classType;
    private final boolean ultimate;

    SkillType(ClassType classType, boolean ultimate) {
        this.classType = classType;
        this.ultimate = ultimate;
    }

    public ClassType getClassType() { return classType; }
    public boolean isUltimate() { return ultimate; }
}
