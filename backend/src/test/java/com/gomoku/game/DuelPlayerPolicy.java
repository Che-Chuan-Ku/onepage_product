package com.gomoku.game;

import com.gomoku.domain.enums.StoneColor;

/**
 * Test-only functional interface shared by every DUEL player-side policy
 * ({@link ReferencePlayerPolicy}, {@link OrdinaryPlayerPolicy}) so the
 * statistics harness ({@code BossDuelStatisticsSteps}) and generic playthrough
 * helper ({@code PveCommonSteps#playDuelToCompletion}) can drive either
 * opponent through the exact same real-API loop without duplicating it per
 * policy (documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §6.4 "普通玩家"
 * statistical baseline).
 */
@FunctionalInterface
public interface DuelPlayerPolicy {
    /**
     * {@code horizontalDisabled} (documents/PVE-全對弈階梯設計-2026-07-10.md §4.1,
     * L3-only "不可橫向" twist): true only when playing sequence 3 — every
     * policy must steer its own five/threat detection away from the
     * horizontal direction the same way {@link BossAiPolicy} does, otherwise
     * a policy could "declare victory" on a horizontal five that the real API
     * will not actually recognize as a win, desyncing the harness from the
     * server's own judgement.
     */
    int[] nextMove(SeriousBoard board, StoneColor color, boolean horizontalDisabled);
}
