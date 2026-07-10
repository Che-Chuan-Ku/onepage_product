package com.gomoku.game;

import com.gomoku.domain.enums.PveOpeningScript;
import com.gomoku.domain.enums.SkillDirection;
import com.gomoku.domain.enums.SkillType;
import com.gomoku.domain.enums.StoneColor;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Random;

/**
 * Boss AI for DUEL encounters (documents/PVE-全對弈階梯設計-2026-07-10.md §2 four-
 * tier decision table, superseding the 2-tier 2026-07-09 version this class
 * javadoc used to describe): a pure, seed-deterministic, non-search heuristic
 * — up to 8 priority layers evaluated top-down, first match wins, plus (L8
 * SKILL_DEMON only) 3 skill-cast insertion points. Player = BLACK, boss =
 * WHITE.
 *
 * Layers (§2.1 決策表, structure unchanged from the 2026-07-09 version, only
 * the per-layer probability knobs differ per tier — see {@link Profile}):
 *  1. own five (win)                                          — always
 *  2. block player's already-formed four (any color-BLACK cell that would
 *     itself immediately win for the player)                  — always, MUST
 *  3. prevent player forming an open four (block BEFORE it forms) — always, MUST
 *  4. own open four                                            — always
 *  5. own double threat (>=2 simultaneous open-three/four)      — doubleThreatChance
 *  6. block player's open three                                — skipOpenThreeChance
 *     (boosted further when the threat is diagonal-only, diagonalOpenThreeSkipBonus)
 *  7. extend own longest line, preferring cells that also open a new threat,
 *     tie-broken toward the board center with a small random pick among the
 *     closest tied candidates; singleLineOnlyChance occasionally throws away a
 *     diagonal-crossing multi-line top pick in favor of a plain single-line one
 *  8. center fallback (only reachable if the candidate pool itself is empty)
 *
 * L3-only "不可橫向" twist (§4.1): every {@link PveDuelThreatScanner#evaluate}
 * call here takes a {@code horizontalDisabled} flag threaded in from the
 * caller (sequence==3) so the horizontal direction never contributes to any
 * layer's threat detection — the AI naturally stops wasting moves defending
 * an unwinnable horizontal threat.
 *
 * <p>致命骰禁令 (§7.6 2026-07-10 第二批 polish, core design principle): the
 * probabilistic "leniency" dice (skip/手滑) must NEVER apply to a LETHAL
 * situation — a candidate that lets the player complete a five (layer 2), or
 * form an open four out of an existing open three (layer 3). Both layers are
 * now unconditional MUSTs for EVERY tier; the old {@code blockSlipChance}
 * (layer-2 手滑) and {@code preventOpenFourChance} (layer-3 dice) knobs were
 * removed outright — their entire domain was lethal by definition. Leniency
 * dice remain only on NON-lethal layers: 6 (a lone open-three FORMATION,
 * skipOpenThreeChance + diagonal bonus), 5 (own double threat) and 7 (own
 * extension shaping). L1 NOVICE additionally gets a scripted teaching beat:
 * the first {@code NOVICE_TEACHING_FORCED_BLOCKS} times per encounter the
 * boss faces a player open-three formation it MUST block (the caller derives
 * the count from the persisted {@link MoveAudit} flags), and only afterwards
 * does the 45% leniency start — the beginner first SEES the block before
 * being handed the breakthrough.
 */
public final class BossAiPolicy {

    /**
     * Four AI tiers (§2.3), 致命骰禁令 rework (§7.6): only NON-lethal knobs
     * remain — the old {@code preventOpenFourChance}/{@code blockSlipChance}
     * fields were removed because layers 2/3 are now unconditional MUSTs for
     * every tier (lethal situations may never be diced away).
     */
    public enum Profile {
        // NOVICE (L1, new, 教學定位): every remaining (non-lethal) knob
        // deliberately more lenient than APPRENTICE's own calibrated values
        // (§2.3 NOVICE 論證). §7.6 致命骰禁令補償: mandatory layers 2/3 killed
        // every single-line win path (a lone three can never become an open
        // four anymore) — the only remaining player win route is a DOUBLE
        // threat, while the boss's own layer-7 offense (which an ordinary
        // player never pre-empts) suddenly wins races it used to lose. Two
        // non-lethal compensations, both in the task's own sanctioned domain
        // ("單三、延伸等"): skip 45%→70% (more coexisting player threes = fork
        // ingredients) and a NEW extendDitherChance (layer-7 "延伸" leniency —
        // the boss sometimes plays a harmless non-threat developing move
        // instead of its best extension, slowing its own offense).
        NOVICE(0.70, 0.0, 0.15, 0.60, 0.75),
        // APPRENTICE (L2/L3): surviving non-lethal knobs unchanged; moderate
        // extend dither keeps the tier's identity ("學會做活三" — beatable by
        // a drilled player, still ahead of NOVICE) under the lethal-dice ban.
        APPRENTICE(0.22, 0.0, 0.08, 0.30, 0.30),
        // ELITE (L4/L5/L6): surviving non-lethal knobs unchanged; token dither.
        ELITE(0.08, 0.50, 0.03, 0.12, 0.10),
        // TRUE_DEMON (L7/L8 base, 沿用校準定案值 — it never had leniency).
        TRUE_DEMON(0.0, 1.0, 0.0, 0.0, 0.0);

        private final double skipOpenThreeChance;
        private final double doubleThreatChance;
        private final double diagonalOpenThreeSkipBonus;
        private final double singleLineOnlyChance;
        private final double extendDitherChance;

        Profile(double skipOpenThreeChance, double doubleThreatChance,
                double diagonalOpenThreeSkipBonus, double singleLineOnlyChance,
                double extendDitherChance) {
            this.skipOpenThreeChance = skipOpenThreeChance;
            this.doubleThreatChance = doubleThreatChance;
            this.diagonalOpenThreeSkipBonus = diagonalOpenThreeSkipBonus;
            this.singleLineOnlyChance = singleLineOnlyChance;
            this.extendDitherChance = extendDitherChance;
        }

        public double skipOpenThreeChance() { return skipOpenThreeChance; }
        /** §2.2 全對弈階梯設計: replaces the old boolean allowDoubleThreat — 0.0=never, 1.0=unconditional (TRUE_DEMON), 0.5=ELITE's middle tier. */
        public double doubleThreatChance() { return doubleThreatChance; }
        public double diagonalOpenThreeSkipBonus() { return diagonalOpenThreeSkipBonus; }
        public double singleLineOnlyChance() { return singleLineOnlyChance; }
        /** §7.6 致命骰禁令補償: layer-7 "延伸" leniency — chance to play a non-threat developing move instead of the best extension. */
        public double extendDitherChance() { return extendDitherChance; }
    }

    /**
     * §7.6 L1 NOVICE 腳本化教學漏擋: how many times per encounter the boss must
     * hard-block a faced player open-three formation before the 45% leniency
     * dice are allowed to start. The per-encounter count is derived by the
     * caller from persisted {@link MoveAudit#facedOpenThree()} flags.
     */
    public static final int NOVICE_TEACHING_FORCED_BLOCKS = 2;

    /** How many of the nearest-to-center tied top candidates layer 7 randomizes among (§1.2 layer 7). */
    private static final int LAYER7_TOP_K = 3;

    /**
     * §7 N=200 calibration finding (documents/PVE-全對弈階梯設計-2026-07-10.md
     * §3.3): PRECISION_SNIPE/SCATTER_SHOT gated to only become available from
     * the boss's Nth reply onward. Root cause of the earlier uncalibrated
     * measurement (L8 vs SkillAwareReferencePlayerPolicy 0% — TRUE_DEMON alone
     * measures 100% player-win at L7): a VCF/VCT forcing search is an
     * all-or-nothing chain — disrupting even ONE link anywhere kills the
     * whole forced win, and TRUE_DEMON's OWN layer-5 double-threat offense
     * (100% unconditional) is ALSO winning-quality, just normally too slow to
     * matter against a player who forces a faster win first. Any early
     * disruption hands TRUE_DEMON's own offense enough extra tempo to
     * complete ITS win instead — a race-condition dynamic, not merely "the
     * boss defended better". Gating the snipe/scatter to only fire once the
     * game is already reasonably deep narrows how much extra runway a
     * successful disruption can hand back to the boss's own offense.
     */
    private static final int MIN_SKILL_TRIGGER_TURN = 10;

    /**
     * §7 N=200 calibration finding, round 2 (2026-07-10): minimum spacing (in
     * boss turns) between ANY two skill casts. Isolation experiments measured
     * each skill ALONE as fully recoverable for the reference player (sniper-
     * only 98%, scatter-only 100%, pioneer-only 96% player win) while all
     * three together measured 0% — the lethal pattern is CHAINED disruption:
     * each interruption stretches the game deeper into the next skill's
     * trigger window, and the cumulative tempo swing lets TRUE_DEMON's own
     * always-on layer-5 offense finish first (the "賽跑時間差" race dynamic).
     * A cooldown directly forbids the chain while leaving each individual
     * cast exactly as strong as the (proven recoverable) single-skill case.
     *
     * <p>§7.6 冷卻再議 (2026-07-10 第二批 polish): with the 狙擊閉四 combo
     * defense stretching games longer, the shared-8 lock was re-examined
     * against a fully independent per-skill 6-turn cooldown (each skill gated
     * only by ITS OWN last cast — with one charge each that means no
     * inter-skill lock at all). See {@link #independentCooldowns} for the
     * measured outcome and which policy this build ships.
     */
    private static final int SKILL_COOLDOWN_TURNS = 8;

    /** §7.6 candidate policy under re-evaluation: per-skill independent 6-turn cooldown. */
    private static final int INDEPENDENT_SKILL_COOLDOWN_TURNS = 6;

    /**
     * §7.6 冷卻再議 experiment toggle: {@code true} = 各技能獨立冷卻
     * ({@link #INDEPENDENT_SKILL_COOLDOWN_TURNS} against each skill's OWN last
     * cast only), {@code false} = 共用冷卻 ({@link #SKILL_COOLDOWN_TURNS}
     * against the most recent cast of ANY skill).
     *
     * <p>N=200 verdict (2026-07-10, recorded in documents/PVE-全對弈階梯設計-
     * 2026-07-10.md §7.6): independent-6 measured L8 vs
     * SkillAwareReferencePlayerPolicy at 0% (0/200; avg casts 2.13/game) —
     * with one charge per skill, an independent cooldown never gates a
     * DIFFERENT skill, so the chained-disruption pattern the shared cooldown
     * was built to forbid (see {@link #SKILL_COOLDOWN_TURNS}) returned in
     * full. Reverted to the shared-8 policy per the task's own fallback rule
     * (回退共用8手並記錄取捨); kept {@code false}.
     */
    private static final boolean INDEPENDENT_COOLDOWNS_ENABLED = false;

    /**
     * Per-skill boss-turn distances since each skill's own most recent cast
     * PLUS the distance since the most recent cast of any skill —
     * {@code Integer.MAX_VALUE} where never cast. Lets {@link #nextAction}
     * evaluate either cooldown policy (§7.6 冷卻再議) from one input shape.
     */
    public record SkillCooldowns(int sinceAnyCast, int sincePioneerCast, int sinceSniperCast, int sinceScatterCast) {
        public static final SkillCooldowns NEVER_CAST =
                new SkillCooldowns(Integer.MAX_VALUE, Integer.MAX_VALUE, Integer.MAX_VALUE, Integer.MAX_VALUE);
    }

    private static boolean cooledDown(int sinceAnyCast, int sinceOwnCast) {
        return INDEPENDENT_COOLDOWNS_ENABLED
                ? sinceOwnCast >= INDEPENDENT_SKILL_COOLDOWN_TURNS
                : sinceAnyCast >= SKILL_COOLDOWN_TURNS;
    }

    /**
     * AI-decision audit flags for one boss move (§7.6 統計可稽核): persisted
     * additively into the BOSS_MOVE_PLACED event detail (debug/replay only).
     * {@code facedOpenThree} doubles as the persistence for the NOVICE
     * teaching counter ("每局前2次玩家活三必擋" — the caller counts prior
     * faced-open-three events to decide when the leniency dice may start).
     */
    public record MoveAudit(boolean facedOpenThree, boolean openThreeSkipRolled, boolean teachingForcedBlock) {
        public static final MoveAudit NONE = new MoveAudit(false, false, false);

        public boolean any() {
            return facedOpenThree || openThreeSkipRolled || teachingForcedBlock;
        }
    }

    /** A boss move plus its audit flags (§7.6 統計可稽核). */
    public record Decision(int[] move, MoveAudit audit) {
    }

    /** A boss action (move or skill cast) plus audit flags (null audit for casts). */
    public record ActionDecision(BossAction action, MoveAudit audit) {
    }

    /** §3.3 the 3 one-shot L8 "SKILL_DEMON" skills, plus a plain board placement. */
    public sealed interface BossAction {
        record PlaceStone(int row, int col) implements BossAction { }

        /**
         * A boss skill cast (§3.1–3.3): {@code targets} carries explicit cell(s)
         * for PRECISION_SNIPE (1 cell: the existing player stone to convert) and
         * SCATTER_SHOT (2 cells: the two empty cells to place boss stones on);
         * PIONEER_STAR instead uses {@code anchorRow}/{@code anchorCol}/
         * {@code direction} (mirrors the ultimate-cast request shape) and leaves
         * {@code targets} null (the caller derives the swept zone via
         * {@code FieldGeometry.ultimateZone}).
         */
        record CastSkill(SkillType skillType, List<int[]> targets,
                          Integer anchorRow, Integer anchorCol, SkillDirection direction) implements BossAction {
        }
    }

    /** Which of the 3 one-shot L8 skills the boss still has a charge for (§3.2: each only once, no recharge). */
    public record SkillCharges(boolean pioneerAvailable, boolean sniperAvailable, boolean scatterAvailable) {
        public static final SkillCharges NONE = new SkillCharges(false, false, false);
    }

    private BossAiPolicy() {
    }

    /** L1→NOVICE, L2/L3→APPRENTICE, L4/L5/L6→ELITE, L7/L8→TRUE_DEMON (§1 八關階梯總覽, §9.1). */
    public static Profile profileFor(int sequence) {
        return switch (sequence) {
            case 1 -> Profile.NOVICE;
            case 2, 3 -> Profile.APPRENTICE;
            case 4, 5, 6 -> Profile.ELITE;
            case 7, 8 -> Profile.TRUE_DEMON;
            default -> throw new IllegalArgumentException("no duel profile for sequence " + sequence);
        };
    }

    /** L2→HUAYUE; L7/L8→PUYUE (L8 reuses L7's script per §1 一句定位 "同L7浦月"); every other level scripts NONE (§1). */
    public static PveOpeningScript openingScriptFor(int sequence) {
        return switch (sequence) {
            case 2 -> PveOpeningScript.HUAYUE;
            case 7, 8 -> PveOpeningScript.PUYUE;
            default -> PveOpeningScript.NONE;
        };
    }

    /**
     * The boss's scripted first move (§1.4), derived from the player's own
     * first move — HUAYUE = orthogonal-adjacent "直指" (playerRow+1, playerCol);
     * PUYUE = diagonal-adjacent "斜指" (playerRow+1, playerCol+1). Either axis
     * mirrors to -1 on overflow (row/col == BOARD_SIZE-1), independently.
     */
    public static int[] openingMove(PveOpeningScript script, int playerRow, int playerCol) {
        int max = PveFieldGeometry.BOARD_SIZE - 1;
        int row = playerRow == max ? playerRow - 1 : playerRow + 1;
        int col = switch (script) {
            case HUAYUE -> playerCol;
            case PUYUE -> playerCol == max ? playerCol - 1 : playerCol + 1;
            case NONE -> throw new IllegalArgumentException("NONE has no opening move");
        };
        return new int[]{row, col};
    }

    /**
     * The boss's next AI-policy move (post-opening-script, §2), NOT skill-
     * aware — used by every sequence except L8 (whose skill-aware decisions go
     * through {@link #nextAction}). {@code horizontalDisabled} is the L3-only
     * "不可橫向" twist (§4.1); false for every other sequence. Equivalent to
     * {@link #nextMove(SeriousBoard, Profile, String, int, int, boolean, boolean)}
     * with {@code skillAwareDefense=false} (every caller other than L7 keeps
     * the pre-existing behavior unchanged).
     */
    public static int[] nextMove(SeriousBoard board, Profile profile, String runSeed, int sequence,
                                 int bossMoveNumber, boolean horizontalDisabled) {
        return nextMove(board, profile, runSeed, sequence, bossMoveNumber, horizontalDisabled, false);
    }

    /** As the 7-arg {@link #nextMove}, dropping the audit — kept for unit tests and non-audit callers. */
    public static int[] nextMove(SeriousBoard board, Profile profile, String runSeed, int sequence,
                                 int bossMoveNumber, boolean horizontalDisabled, boolean skillAwareDefense) {
        return decideMove(board, profile, runSeed, sequence, bossMoveNumber, horizontalDisabled,
                skillAwareDefense, false).move();
    }

    /**
     * §1 全對弈平衡修正（狙擊閉四 combo）: {@code skillAwareDefense} — when true
     * (caller's responsibility: ONLY TRUE_DEMON/SKILL_DEMON, i.e. L7/L8, AND
     * only while the player still holds an unused PRECISION_SNIPE charge —
     * NOVICE/APPRENTICE/ELITE, L1-L6, must never receive true here, by design
     * decision "L1–L6 不感知"), layer 3's "prevent forming" pre-emptive block
     * additionally treats a candidate that would let the player complete a
     * CLOSED four (not just an open four) as MUST-prevent.
     *
     * <p>Why: normally a closed four's single winning gap only gets blocked
     * REACTIVELY, after it has already formed, by layer 2's unconditional
     * (all-tiers) mandatory block — but that gap is then, structurally, the
     * exact one cell whose color-flip (PRECISION_SNIPE, "目標須為現存敵方棋子，
     * 直接轉為己方色" — no adjacency/recency constraint, see
     * {@code PveChallengeService.executeSkill}'s PRECISION_SNIPE branch) turns
     * the four into an outright five. This is the discovered exploit ("做閉四
     * →魔王擋單端→狙擊轉色擋子→成五"): it wins against every AI tier because
     * layer 2's block is unconditional everywhere, and the fatal spot is
     * created by the BOSS'S OWN reactive move, not the player's.
     *
     * <p>The fix intervenes one stage earlier: a closed four can only ever
     * form by playing the one open flank of an EXISTING closed three (run==3,
     * opens==1) — {@link PveDuelThreatScanner.Shape#closedFour} on a candidate
     * cell is exactly "this candidate would complete that flank". Blocking
     * THAT candidate pre-emptively (layer-3 priority, before the four ever
     * exists) means the boss's stone lands there while the shape is still a
     * dead 3-stone run, not a live single-gap four — even if the player later
     * snipes that exact stone back to black, the result is only a FRESH four
     * (still needing one more move, and by then almost certainly past the
     * one-shot snipe's own dwindling relevance), never an instant five.
     *
     * <p>{@code teachingForceBlock} (§7.6 L1 NOVICE 腳本化教學漏擋): when true,
     * layer 6's skip dice are suppressed for THIS move — the boss must block a
     * faced player open-three formation. The caller (PveChallengeService)
     * passes true only for sequence 1 while the persisted faced-open-three
     * count is still below {@link #NOVICE_TEACHING_FORCED_BLOCKS}.
     */
    public static Decision decideMove(SeriousBoard board, Profile profile, String runSeed, int sequence,
                                      int bossMoveNumber, boolean horizontalDisabled, boolean skillAwareDefense,
                                      boolean teachingForceBlock) {
        List<int[]> candidates = PveDuelCandidates.cells(board);
        if (candidates.isEmpty()) {
            return new Decision(PveDuelCandidates.centerOrNearestEmpty(board), MoveAudit.NONE);
        }
        // Single evolving RNG stream for this whole decision (layers 5/6/7 all
        // draw from it in sequence) — §2.2 全對弈階梯設計: reuse the one
        // "boss-ai:" purpose rather than opening a new one per layer.
        Random rng = PveRandoms.forPurpose(runSeed, "boss-ai:" + sequence + ":" + bossMoveNumber);

        // Layer 1: own five.
        for (int[] c : candidates) {
            if (PveDuelThreatScanner.evaluate(board, c[0], c[1], StoneColor.WHITE, horizontalDisabled).five()) {
                return new Decision(c, MoveAudit.NONE);
            }
        }

        // Layer 2 (LETHAL — 致命骰禁令 §7.6): block the player's already-formed
        // four unconditionally, for EVERY tier. The old blockSlipChance 手滑
        // dice were removed outright — this layer's entire domain is lethal.
        List<int[]> blockFive = filter(board, candidates, StoneColor.BLACK, s -> s.five(), horizontalDisabled);
        if (!blockFive.isEmpty()) {
            return new Decision(pickCentered(blockFive), MoveAudit.NONE);
        }

        // Layer 3 (LETHAL — 致命骰禁令 §7.6): prevent the player from forming an
        // open four (an existing open three's flank play), unconditionally for
        // EVERY tier — the old preventOpenFourChance dice were removed. When
        // skillAwareDefense is active (§1 狙擊閉四combo修正; internally gated
        // to TRUE_DEMON so "L1–L6 不感知" cannot be bypassed by a mistaken
        // caller), a CLOSED four is pre-empted too, since a closed four's
        // single gap is exactly what PRECISION_SNIPE can flip into a five.
        boolean effectiveSkillAware = skillAwareDefense && profile == Profile.TRUE_DEMON;
        List<int[]> preventFour = filter(board, candidates, StoneColor.BLACK,
                effectiveSkillAware
                        ? shape -> shape.openFour() || shape.closedFour()
                        : PveDuelThreatScanner.Shape::openFour,
                horizontalDisabled);
        if (!preventFour.isEmpty()) {
            return new Decision(pickCentered(preventFour), MoveAudit.NONE);
        }

        // Layer 4: own open four.
        List<int[]> ownOpenFour = filter(board, candidates, StoneColor.WHITE,
                PveDuelThreatScanner.Shape::openFour, horizontalDisabled);
        if (!ownOpenFour.isEmpty()) {
            return new Decision(pickCentered(ownOpenFour), MoveAudit.NONE);
        }

        // Layer 5: own double threat — probabilistic since §2.2 (was TRUE_DEMON-only boolean).
        if (profile.doubleThreatChance() > 0) {
            boolean execute = profile.doubleThreatChance() >= 1.0 || rng.nextDouble() < profile.doubleThreatChance();
            if (execute) {
                List<int[]> doubleThreat = filter(board, candidates, StoneColor.WHITE,
                        PveDuelThreatScanner.Shape::doubleThreat, horizontalDisabled);
                if (!doubleThreat.isEmpty()) {
                    return new Decision(pickCentered(doubleThreat), MoveAudit.NONE);
                }
            }
        }

        // Layer 6 (NON-lethal — the leniency dice live here): block player's
        // open-three FORMATION — skip chance boosted further when diagonal-
        // only; §7.6 L1 NOVICE teaching beat suppresses the dice entirely for
        // the encounter's first NOVICE_TEACHING_FORCED_BLOCKS faced threats.
        boolean facedOpenThree = false;
        boolean skipRolled = false;
        List<int[]> blockOpenThree = filter(board, candidates, StoneColor.BLACK,
                PveDuelThreatScanner.Shape::openThree, horizontalDisabled);
        if (!blockOpenThree.isEmpty()) {
            facedOpenThree = true;
            int[] chosen = pickCentered(blockOpenThree);
            if (teachingForceBlock) {
                return new Decision(chosen, new MoveAudit(true, false, true));
            }
            double skipChance = profile.skipOpenThreeChance();
            if (PveDuelThreatScanner.evaluate(board, chosen[0], chosen[1], StoneColor.BLACK, horizontalDisabled)
                    .diagonalContributesThreat()) {
                skipChance = Math.min(0.75, skipChance + profile.diagonalOpenThreeSkipBonus());
            }
            boolean skip = rng.nextDouble() < skipChance;
            if (!skip) {
                return new Decision(chosen, new MoveAudit(true, false, false));
            }
            skipRolled = true;
        }
        MoveAudit audit = new MoveAudit(facedOpenThree, skipRolled, false);

        // Layer 7a (§7.6 致命骰禁令補償, NON-lethal "延伸" dither): with
        // extendDitherChance, deliberately play a harmless developing move
        // that creates NO new threat, instead of the best-scoring extension —
        // the offense-side leniency that keeps the weaker tiers' race winnable
        // for players who cannot fork deliberately, now that layers 2/3 are
        // unconditional.
        //
        // §7.6 校準紀錄 — the dither PLACEMENT is tier-specific and was tuned
        // against BOTH reference AND ordinary players (they pull opposite ways):
        //  - APPRENTICE/ELITE (still meant to beat an ordinary player): pick
        //    RANDOMLY among harmless cells — an early center-preferring draft
        //    piled dithered stones around the center and physically clogged the
        //    fork space the reference player needs (measured its win-rate down
        //    to 60%). Random placement keeps games short and the reference
        //    win-rate high.
        //  - NOVICE (L1, must LOSE to even an ordinary player, ≥60% ordinary
        //    win-rate is a hard task constraint): pick the CENTER-most harmless
        //    cell on purpose. Clustering NOVICE's harmless moves near the
        //    center both (a) starves its own layer-7 offense of the incidental
        //    forks that otherwise crush the non-forking ordinary player and (b)
        //    the clogging that hurts a *forcing* reference player is irrelevant
        //    here because NOVICE is the tutorial tier — measured N=200: ordinary
        //    win 72.5% (≥60 ✓), reference win 60% (a movable floor, §7.6.4).
        if (profile.extendDitherChance() > 0 && rng.nextDouble() < profile.extendDitherChance()) {
            List<int[]> harmless = new ArrayList<>();
            for (int[] c : candidates) {
                if (extendScore(board, c, horizontalDisabled) < 100) {
                    harmless.add(c);
                }
            }
            if (!harmless.isEmpty()) {
                if (profile == Profile.NOVICE) {
                    return new Decision(pickCentered(harmless), audit);
                }
                return new Decision(harmless.get(rng.nextInt(harmless.size())), audit);
            }
        }

        // Layer 7: extend own line — score = (new threat ? 100 : 0) + longest resulting run.
        int bestScore = Integer.MIN_VALUE;
        for (int[] c : candidates) {
            bestScore = Math.max(bestScore, extendScore(board, c, horizontalDisabled));
        }
        final int finalBest = bestScore;
        List<int[]> topScored = new ArrayList<>();
        for (int[] c : candidates) {
            if (extendScore(board, c, horizontalDisabled) == finalBest) {
                topScored.add(c);
            }
        }
        if (profile.singleLineOnlyChance() > 0) {
            boolean topIsDiagonalMultiLine = topScored.stream().anyMatch(c -> {
                PveDuelThreatScanner.Shape shape = PveDuelThreatScanner.evaluate(board, c[0], c[1], StoneColor.WHITE, horizontalDisabled);
                return shape.doubleThreat() && shape.diagonalContributesThreat();
            });
            if (topIsDiagonalMultiLine && rng.nextDouble() < profile.singleLineOnlyChance()) {
                int bestSingleLineScore = Integer.MIN_VALUE;
                for (int[] c : candidates) {
                    PveDuelThreatScanner.Shape shape = PveDuelThreatScanner.evaluate(board, c[0], c[1], StoneColor.WHITE, horizontalDisabled);
                    if (shape.doubleThreat() && shape.diagonalContributesThreat()) {
                        continue;
                    }
                    bestSingleLineScore = Math.max(bestSingleLineScore, extendScore(board, c, horizontalDisabled));
                }
                if (bestSingleLineScore != Integer.MIN_VALUE) {
                    final int finalSingleLineBest = bestSingleLineScore;
                    List<int[]> singleLineTop = new ArrayList<>();
                    for (int[] c : candidates) {
                        PveDuelThreatScanner.Shape shape = PveDuelThreatScanner.evaluate(board, c[0], c[1], StoneColor.WHITE, horizontalDisabled);
                        if (shape.doubleThreat() && shape.diagonalContributesThreat()) {
                            continue;
                        }
                        if (extendScore(board, c, horizontalDisabled) == finalSingleLineBest) {
                            singleLineTop.add(c);
                        }
                    }
                    singleLineTop.sort(Comparator.comparingInt(BossAiPolicy::chebyshevToCenter));
                    int singleLinePoolSize = Math.min(LAYER7_TOP_K, singleLineTop.size());
                    return new Decision(singleLineTop.get(rng.nextInt(singleLinePoolSize)), audit);
                }
            }
        }

        topScored.sort(Comparator.comparingInt(BossAiPolicy::chebyshevToCenter));
        int poolSize = Math.min(LAYER7_TOP_K, topScored.size());
        return new Decision(topScored.get(rng.nextInt(poolSize)), audit);
        // Layer 8 (center fallback) is unreachable here: `candidates` is
        // non-empty (checked above) and layer 7 always yields a max.
    }

    /**
     * L8 "SKILL_DEMON" skill-aware decision (§3.3): checks the 3 skill
     * insertion points (②a開拓之星 before layer 2's block-five delegation;
     * ⑥前精準狙擊 right after layer 2, ahead of layer 3 — see the inline
     * comment at that check for why; ⑦前散射 after layer 6 finds nothing) and
     * otherwise delegates entirely to {@link #nextMove}. {@code
     * horizontalDisabled} is always false for L8 (the twist is L3-exclusive)
     * but threaded through for symmetry/future-proofing.
     *
     * <p>{@code cooldowns} (§7.6 冷卻再議): per-skill and any-cast boss-turn
     * distances since the boss's most recent cast(s) this encounter — each
     * skill insertion point additionally requires {@link #cooledDown} for its
     * own clocks (which of the two cooldown policies applies is decided by
     * {@link #INDEPENDENT_COOLDOWNS_ENABLED}; the shared-8 evidence trail is
     * on {@link #SKILL_COOLDOWN_TURNS}'s javadoc).
     *
     * <p>{@code skillAwareDefense} (§1 狙擊閉四combo修正): see
     * {@link #nextMove(SeriousBoard, Profile, String, int, int, boolean, boolean)}'s
     * javadoc — threaded through to every plain-move delegation below so L8's
     * skill-cast decision tree and its plain-move fallback apply the exact
     * same closed-four pre-emption.
     */
    public static ActionDecision nextAction(SeriousBoard board, Profile profile, String runSeed, int sequence,
                                            int bossMoveNumber, boolean horizontalDisabled, SkillCharges charges,
                                            SkillCooldowns cooldowns, boolean skillAwareDefense) {
        List<int[]> candidates = PveDuelCandidates.cells(board);
        if (candidates.isEmpty()) {
            return placeDecision(board, profile, runSeed, sequence, bossMoveNumber, horizontalDisabled, skillAwareDefense);
        }

        // Layer 1 (own five) always wins outright — never trade it for a skill.
        for (int[] c : candidates) {
            if (PveDuelThreatScanner.evaluate(board, c[0], c[1], StoneColor.WHITE, horizontalDisabled).five()) {
                return new ActionDecision(new BossAction.PlaceStone(c[0], c[1]), MoveAudit.NONE);
            }
        }

        // §3.3 ②a 開拓之星: ONLY when the player already has a genuinely
        // unstoppable already-formed four (>=2 independent cells that would
        // each immediately complete a five — layer 2 can only block ONE of
        // them). §7 N=200 calibration finding: an earlier draft ALSO fired
        // this on "some candidate would hypothetically create a double
        // threat" (a one-ply-lookahead, not an existing board state) — that
        // condition is true far too often in a normal developing game (any
        // two crossing partial lines qualify), which measured L8 vs
        // SkillAwareReferencePlayerPolicy at 3.5% (target >=45%) despite the
        // SAME TRUE_DEMON base alone measuring 100% at L7 — i.e. it turned an
        // already-crushing boss into a near-unbeatable one. Narrowed to match
        // the design's own "唯一補救層／原本必輸局面" framing: only an
        // ALREADY-existing, genuinely un-defensible situation, not a
        // speculative one-move-away one.
        if (charges.pioneerAvailable() && cooledDown(cooldowns.sinceAnyCast(), cooldowns.sincePioneerCast())) {
            List<int[]> blockFive = filter(board, candidates, StoneColor.BLACK, s -> s.five(), horizontalDisabled);
            if (blockFive.size() >= 2) {
                PioneerTarget target = findBestPioneerTarget(board);
                if (target != null) {
                    return new ActionDecision(new BossAction.CastSkill(SkillType.PIONEER_STAR, null,
                            target.anchorRow, target.anchorCol, target.direction), null);
                }
            }
        }

        // Layer 2 (unmodified, hard MUST): if it has a candidate, take the plain move.
        List<int[]> blockFive = filter(board, candidates, StoneColor.BLACK, s -> s.five(), horizontalDisabled);
        if (!blockFive.isEmpty()) {
            return placeDecision(board, profile, runSeed, sequence, bossMoveNumber, horizontalDisabled, skillAwareDefense);
        }

        // §3.3 ⑥前 精準狙擊 — deliberately checked BEFORE layer 3's delegation
        // (not strictly after layer ⑤ per a literal reading of the priority
        // list text): extending an isolated existing open three to either
        // flank is STRUCTURALLY always also an "prevent open four" candidate
        // (layer 3's own domain), so a literal ⑤→⑥前 ordering would make this
        // insertion point dead code for the overwhelmingly common case — layer
        // 3 (an unconditional MUST for every tier since the §7.6 致命骰禁令)
        // would always pre-empt it first. The design's own prose for this
        // skill ("狙擊同時完成『拆解』與『己方增加一子』雙重效果，優先於純
        // 防守") reads as intending the snipe to win exactly this comparison,
        // so it is evaluated here, ahead of layer 3's plain single-flank block.
        if (charges.sniperAvailable() && cooledDown(cooldowns.sinceAnyCast(), cooldowns.sinceSniperCast())
                && bossMoveNumber >= MIN_SKILL_TRIGGER_TURN) {
            List<PveDuelThreatScanner.ExistingOpenThree> threes =
                    PveDuelThreatScanner.findExistingOpenThrees(board, StoneColor.BLACK, horizontalDisabled);
            if (!threes.isEmpty()) {
                PveDuelThreatScanner.ExistingOpenThree chosen = threes.stream()
                        .min(Comparator.comparingInt(t -> chebyshevToCenter(t.middle())))
                        .orElseThrow();
                int[] target = board.stoneAt(chosen.middle()[0], chosen.middle()[1]) == StoneColor.BLACK
                        ? chosen.middle() : chosen.flankA();
                return new ActionDecision(
                        new BossAction.CastSkill(SkillType.PRECISION_SNIPE, List.of(target), null, null, null), null);
            }
        }

        // Layers 3/4/5 — if any of them has a candidate, take the plain move;
        // only fall through to the ⑦前 skill check once they've ALL found
        // nothing (mirrors decideMove's own layer order). Layer 3 is now an
        // unconditional MUST for every tier (致命骰禁令 §7.6), and its predicate
        // mirrors decideMove's own skillAwareDefense extension (§1 狙擊閉四
        // combo修正, internally TRUE_DEMON-gated) so this pre-check and the
        // eventual decideMove delegation never disagree about whether layer 3
        // would fire.
        boolean effectiveSkillAware = skillAwareDefense && profile == Profile.TRUE_DEMON;
        List<int[]> preventFour = filter(board, candidates, StoneColor.BLACK,
                effectiveSkillAware
                        ? shape -> shape.openFour() || shape.closedFour()
                        : PveDuelThreatScanner.Shape::openFour,
                horizontalDisabled);
        if (!preventFour.isEmpty()) {
            return placeDecision(board, profile, runSeed, sequence, bossMoveNumber, horizontalDisabled, skillAwareDefense);
        }
        List<int[]> ownOpenFour = filter(board, candidates, StoneColor.WHITE,
                PveDuelThreatScanner.Shape::openFour, horizontalDisabled);
        if (!ownOpenFour.isEmpty()) {
            return placeDecision(board, profile, runSeed, sequence, bossMoveNumber, horizontalDisabled, skillAwareDefense);
        }
        List<int[]> doubleThreat = filter(board, candidates, StoneColor.WHITE,
                PveDuelThreatScanner.Shape::doubleThreat, horizontalDisabled);
        boolean layer5WouldFire = !doubleThreat.isEmpty() && profile.doubleThreatChance() >= 1.0;
        if (layer5WouldFire) {
            return placeDecision(board, profile, runSeed, sequence, bossMoveNumber, horizontalDisabled, skillAwareDefense);
        }

        // Layer 6 (unmodified): if it would fire, take the plain move.
        List<int[]> blockOpenThree = filter(board, candidates, StoneColor.BLACK,
                PveDuelThreatScanner.Shape::openThree, horizontalDisabled);
        if (!blockOpenThree.isEmpty() && profile.skipOpenThreeChance() <= 0) {
            return placeDecision(board, profile, runSeed, sequence, bossMoveNumber, horizontalDisabled, skillAwareDefense);
        }

        // §3.3 ⑦前 散射: two independent candidates that each open a new threat, Chebyshev distance >= 2 apart.
        if (charges.scatterAvailable() && cooledDown(cooldowns.sinceAnyCast(), cooldowns.sinceScatterCast())
                && bossMoveNumber >= MIN_SKILL_TRIGGER_TURN) {
            List<int[]> goodCells = new ArrayList<>();
            for (int[] c : candidates) {
                PveDuelThreatScanner.Shape shape = PveDuelThreatScanner.evaluate(board, c[0], c[1], StoneColor.WHITE, horizontalDisabled);
                if (shape.openThree() || shape.closedFour() || shape.openFour() || shape.doubleThreat()) {
                    goodCells.add(c);
                }
            }
            goodCells.sort(Comparator.comparingInt(BossAiPolicy::chebyshevToCenter));
            for (int i = 0; i < goodCells.size(); i++) {
                for (int j = i + 1; j < goodCells.size(); j++) {
                    int[] a = goodCells.get(i);
                    int[] b = goodCells.get(j);
                    if (Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) >= 2) {
                        return new ActionDecision(
                                new BossAction.CastSkill(SkillType.SCATTER_SHOT, List.of(a, b), null, null, null), null);
                    }
                }
            }
        }

        return placeDecision(board, profile, runSeed, sequence, bossMoveNumber, horizontalDisabled, skillAwareDefense);
    }

    /** Plain-move delegation shared by every non-cast branch of {@link #nextAction}. */
    private static ActionDecision placeDecision(SeriousBoard board, Profile profile, String runSeed, int sequence,
                                                int bossMoveNumber, boolean horizontalDisabled, boolean skillAwareDefense) {
        Decision decision = decideMove(board, profile, runSeed, sequence, bossMoveNumber, horizontalDisabled,
                skillAwareDefense, false);
        return new ActionDecision(new BossAction.PlaceStone(decision.move()[0], decision.move()[1]), decision.audit());
    }

    private record PioneerTarget(int anchorRow, int anchorCol, SkillDirection direction, int netValue) {
    }

    /** §3.3/§3.4: the (anchor,direction) zone maximizing (玩家棋子數 − 己方棋子數), requiring net >= 2. */
    private static PioneerTarget findBestPioneerTarget(SeriousBoard board) {
        int size = board.size();
        PioneerTarget best = null;
        for (int r = 0; r < size; r++) {
            for (int c = 0; c < size; c++) {
                if (!board.isEmptyPlayable(r, c)) {
                    continue;
                }
                for (SkillDirection dir : new SkillDirection[]{
                        SkillDirection.UP, SkillDirection.DOWN, SkillDirection.LEFT, SkillDirection.RIGHT}) {
                    List<int[]> zone = FieldGeometry.ultimateZone(r, c, dir, size);
                    int black = 0;
                    int white = 0;
                    for (int[] cell : zone) {
                        StoneColor color = board.stoneAt(cell[0], cell[1]);
                        if (color == StoneColor.BLACK) {
                            black++;
                        } else if (color == StoneColor.WHITE) {
                            white++;
                        }
                    }
                    int net = black - white;
                    if (net < 2) {
                        continue;
                    }
                    if (best == null || net > best.netValue()
                            || (net == best.netValue() && chebyshevToCenter(new int[]{r, c}) < chebyshevToCenter(new int[]{best.anchorRow(), best.anchorCol()}))) {
                        best = new PioneerTarget(r, c, dir, net);
                    }
                }
            }
        }
        return best;
    }

    private static int extendScore(SeriousBoard board, int[] c, boolean horizontalDisabled) {
        PveDuelThreatScanner.Shape shape = PveDuelThreatScanner.evaluate(board, c[0], c[1], StoneColor.WHITE, horizontalDisabled);
        boolean newThreat = shape.openFour() || shape.closedFour() || shape.openThree() || shape.doubleThreat();
        return (newThreat ? 100 : 0) + shape.longestRun();
    }

    private static List<int[]> filter(SeriousBoard board, List<int[]> candidates, StoneColor color,
                                      java.util.function.Predicate<PveDuelThreatScanner.Shape> predicate,
                                      boolean horizontalDisabled) {
        List<int[]> matched = new ArrayList<>();
        for (int[] c : candidates) {
            if (predicate.test(PveDuelThreatScanner.evaluate(board, c[0], c[1], color, horizontalDisabled))) {
                matched.add(c);
            }
        }
        return matched;
    }

    /** §1.2 layer 8 tie-break: nearest to board center among the matches. */
    private static int[] pickCentered(List<int[]> matches) {
        int[] best = matches.get(0);
        int bestDist = chebyshevToCenter(best);
        for (int[] c : matches) {
            int dist = chebyshevToCenter(c);
            if (dist < bestDist) {
                best = c;
                bestDist = dist;
            }
        }
        return best;
    }

    private static int chebyshevToCenter(int[] cell) {
        int center = PveFieldGeometry.BOARD_SIZE / 2;
        return Math.max(Math.abs(cell[0] - center), Math.abs(cell[1] - center));
    }
}
