package com.gomoku.game;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gomoku.domain.enums.BoardSide;
import com.gomoku.domain.enums.FieldCellKind;
import com.gomoku.domain.enums.PveEncounterType;
import com.gomoku.domain.enums.PveFieldType;
import com.gomoku.domain.enums.PveMinorDisruptionType;
import com.gomoku.domain.enums.PveMutationType;
import com.gomoku.domain.enums.PveOpeningScript;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/**
 * Pure, seed-deterministic encounter planning (FR-C1 FR-C2 FR-A3), rebuilt per
 * documents/PVE-關卡重設計-2026-07-08.md (2026-07-08 rework) and further revised
 * per documents/PVE-魔王對弈與策略引導設計-2026-07-09.md (2026-07-09 boss-duel rework):
 *  - sequences 4/8 are now DUEL encounters (BossAiPolicy, no HP/damage/shapes
 *    at all, see {@link #DUEL_SEQUENCES}); the remaining six PUZZLE sequences
 *    (1/2/3/5/6/7) got re-themed to one classic shape each with a fresh
 *    HP/budget curve — 50/90/100/-/180/212/315/- and 2/4/6/-/9/16/13/-
 *    (§3.1, '-' = unused DUEL sentinel slot);
 *  - each PUZZLE encounter starts with pre-placed black-stone "shapes" (TYPE_A
 *    "open-three-take-five" / TYPE_B "missing-one-take-five", 07-08 doc §0)
 *    loaded from resources/pve/level-templates.json, randomly picked between
 *    "Template A" (center row-band) and "Template B" (lower row-band) per FR-A3;
 *  - mutations fixed to sequences 3 (ONE_EYE) / 6 (RAGE) — ABYSS retired along
 *    with sequence 8 becoming a DUEL encounter (07-09 doc §3.1);
 *  - a single-shot "minor disruption" (PULSE_CLEAR/PULSE_PUSH/NONE) adds
 *    combinatorial variety on the non-mutation PUZZLE sequences 1/2/5/7 (§5);
 *  - fields: 1/3/6 PLAIN; 2/5/7 a seed-driven 50% VOLCANO or BEACH
 *    11x11 variant with 3-5 visible obstacles and at most 3 hidden cells,
 *    generated to exclude every shape's 5-cell window (§2 "場地生成排除規則").
 * Same seed + same sequence always yields the same plan (NFR-1).
 *
 * §5 board transforms (2026-07-08 D4 rework): every sequence's active shape
 * list is additionally run through a seed-derived D4 (dihedral-4) board
 * transform — 4 rotations + 4 mirrors, 8 total — before being turned into
 * planned cells, so the same Template A/B pool yields 8x the spatial variety
 * (rotated/mirrored coordinates) on top of the existing Template A/B and
 * minor-disruption axes. The 11x11 board is square, so every transform maps
 * [0,10]x[0,10] back onto itself (never out of bounds). One exception:
 * sequence 3 (ONE_EYE) only ever damages non-HORIZONTAL lines (see
 * PveChallengeService's completedLines filter), and this level's own
 * templates are deliberately all-VERTICAL so ONE_EYE is a no-op (§4 of the
 * design doc). A transform that swaps VERTICAL<->HORIZONTAL (the 4
 * "orientation-swapping" D4 elements: ROT90/ROT270/the two diagonal mirrors)
 * would turn a shape's line HORIZONTAL and make ONE_EYE silently zero its
 * damage, breaking that level's solvability — so sequence 3's transform draw
 * is folded into the 4 orientation-preserving elements only (still seed
 * varied, just a narrower pool for this one mutation-affected level).
 */
public final class PveFieldScheduler {

    // 2026-07-08 調校輪修訂（C8）: L4 HP 200→150 — 200 是全曲線唯一的「翻倍跳點」
    // （L3=100 直接跳到 L4=200），消除後 100→150→225 級距更平滑；dmg_full(L4)=200
    // 不變，新 margin=150/200=0.75，仍 < dmg_full 故無技能全清解依舊必勝，且與其餘
    // 關卡 margin<1 的既有模式（L2=0.9/L5=0.9/L6=0.85/L7=0.9/L8=0.8）一致。
    // 2026-07-09 魔王對弈與策略引導設計修訂: sequences 4/8 stop being PUZZLE
    // encounters (see DUEL_SEQUENCES below) — their curve slots are unused
    // sentinels (0), kept only so every other index (sequence-1) still lines
    // up positionally; DUEL levels use DUEL_MOVE_BUDGET instead and have no
    // boss HP concept at all (documents/PVE-魔王對弈與策略引導設計-2026-07-09.md
    // §1.0/§5.1). The remaining six PUZZLE levels were re-themed to one
    // classic shape each (§2.1/§3.1): L1衝四=50/2, L2活三→活四=90/4,
    // L3活三+ONE_EYE誘餌=100/6, L5死四活三=180/9, L6雙三+RAGE=212/16,
    // L7雙死四=315/13 — see level-templates.json for the matching (X,Y) pool.
    // 2026-07-10 全對弈階梯設計（documents/PVE-全對弈階梯設計-2026-07-10.md §8）:
    // every one of these PUZZLE-era constants/fields below this point is now
    // DEAD CODE — DUEL_SEQUENCES covers all 8 sequences (see below), so
    // plan()'s PUZZLE branch is unreachable and encounterTypeFor always
    // returns DUEL. Left in place (not deleted) ONLY because several other
    // still-referenced call sites (PveChallengeService's now-equally-
    // unreachable resolveLines/spawnAbyssObstacle/resolveRageEruption/
    // resolveMinorDisruption path, plus several orphaned PUZZLE-era Cucumber
    // step classes whose .feature files were retired per §8) still compile
    // against this surface — ripping it out is a separate, larger follow-up
    // pass the design doc itself flags as out of scope for this iteration
    // (§5.2 "遺物...需要另開查證任務").
    public static final int[] BOSS_HP_CURVE = {50, 90, 100, 0, 180, 212, 315, 0};
    public static final int[] MOVE_BUDGET_CURVE = {2, 4, 6, 0, 9, 16, 13, 0};
    public static final int ENCOUNTER_COUNT = 8;
    /**
     * All 8 sequences are DUEL encounters (documents/PVE-全對弈階梯設計-2026-07-10.md
     * §0/§1 使用者裁決: 全面改為八關對弈) — superseding the 2026-07-09 version's
     * {4, 8}-only set.
     */
    public static final Set<Integer> DUEL_SEQUENCES = Set.of(1, 2, 3, 4, 5, 6, 7, 8);
    /**
     * DUEL move budget, player-own-moves only — boss replies are free (§1
     * 八關階梯總覽). L2/L7 are the 07-09 文件已驗證定案值 (unchanged: 45/70);
     * every other slot is this文件's §1 DESIGN-PROPOSAL starting value,
     * subject to the §7 N=200 statistical calibration pass — see
     * Boss對弈統計驗證.feature.
     */
    // §7.6 致命骰禁令重校準: L1 35→50 — mandatory layers 2/3 make every game
    // structurally longer (single-line wins no longer exist; both sides need
    // forks), and the N=200 reference-player statistic was budget-bound
    // (movesUsed p90 == 35). L1 was a §1 design-proposal starting value, so
    // raising it IS the sanctioned calibration path.
    private static final Map<Integer, Integer> DUEL_MOVE_BUDGET = Map.of(
            1, 50, 2, 45, 3, 55, 4, 55, 5, 60, 6, 65, 7, 70, 8, 75);
    /** L5 火山靜態岩石數量下界/範圍 (§4.2: 5–8 格，開局一次性、全局確定性). */
    private static final int L5_VOLCANO_MIN_OBSTACLES = 5;
    private static final int L5_VOLCANO_OBSTACLE_SPREAD = 4; // 5..8 inclusive
    /** Sequences that may carry a minor disruption (never the mutation/DUEL sequences 3/4/6/8). */
    private static final Set<Integer> MINOR_DISRUPTION_SEQUENCES = Set.of(1, 2, 5, 7);
    /**
     * Sequences whose shape orientation must stay stable under the §5 board
     * transform (only sequence 3 / ONE_EYE today — see class javadoc). Their
     * transform draw is folded into {@link BoardTransform}'s first 4
     * (orientation-preserving) enum constants.
     */
    private static final Set<Integer> ORIENTATION_LOCKED_SEQUENCES = Set.of(3);

    public enum ShapeType { TYPE_A, TYPE_B }

    public enum ShapeOrientation { VERTICAL, HORIZONTAL }

    /**
     * The 8 elements of the D4 (dihedral group of order 8) symmetries of a
     * square board, applied to a (row, col) pair in [0, BOARD_SIZE-1]^2 (§5).
     * Declaration order matters: the first 4 constants are exactly the
     * orientation-preserving ones (a VERTICAL line stays VERTICAL, a
     * HORIZONTAL line stays HORIZONTAL); the last 4 swap VERTICAL<->
     * HORIZONTAL. {@link PveFieldScheduler#transformFor} relies on this order
     * to fold ORIENTATION_LOCKED_SEQUENCES draws into the safe prefix.
     */
    public enum BoardTransform {
        IDENTITY, ROT180, MIRROR_H, MIRROR_V,
        ROT90, ROT270, MIRROR_DIAG, MIRROR_ANTIDIAG;

        public int[] apply(int row, int col) {
            int max = PveFieldGeometry.BOARD_SIZE - 1;
            return switch (this) {
                case IDENTITY -> new int[]{row, col};
                case ROT180 -> new int[]{max - row, max - col};
                case MIRROR_H -> new int[]{row, max - col};
                case MIRROR_V -> new int[]{max - row, col};
                case ROT90 -> new int[]{col, max - row};
                case ROT270 -> new int[]{max - col, row};
                case MIRROR_DIAG -> new int[]{col, row};
                case MIRROR_ANTIDIAG -> new int[]{max - col, max - row};
            };
        }
    }

    /**
     * One 5-cell window along `orientation`'s axis: `line` is the fixed
     * column (VERTICAL) or fixed row (HORIZONTAL); `start` is the window's
     * first row (VERTICAL) or first col (HORIZONTAL) — window = [start,
     * start+4]. TYPE_A prefills offsets {1,2,3} (needs {0,4}, 2 moves);
     * TYPE_B prefills offsets {0,1,3,4} (needs {2}, 1 move). `backup` shapes
     * are extra insurance lines, not counted toward a level's target move
     * count T (only level 8 has one, per §2).
     */
    public record ShapeSpec(ShapeType type, ShapeOrientation orientation, int line, int start, boolean backup) {
        public List<int[]> windowCells() {
            List<int[]> cells = new ArrayList<>(5);
            for (int off = 0; off < 5; off++) {
                cells.add(cellAt(off));
            }
            return cells;
        }

        public List<int[]> filledCells() {
            int[] offsets = type == ShapeType.TYPE_A ? new int[]{1, 2, 3} : new int[]{0, 1, 3, 4};
            List<int[]> cells = new ArrayList<>(offsets.length);
            for (int off : offsets) {
                cells.add(cellAt(off));
            }
            return cells;
        }

        /** The move(s) still required to complete this shape into a 5-line. */
        public List<int[]> completionCells() {
            int[] offsets = type == ShapeType.TYPE_A ? new int[]{0, 4} : new int[]{2};
            List<int[]> cells = new ArrayList<>(offsets.length);
            for (int off : offsets) {
                cells.add(cellAt(off));
            }
            return cells;
        }

        private int[] cellAt(int offset) {
            return orientation == ShapeOrientation.VERTICAL
                    ? new int[]{start + offset, line}
                    : new int[]{line, start + offset};
        }

        /**
         * Applies a §5 D4 board transform to this shape's 5-cell window,
         * returning an equivalent ShapeSpec re-expressed in (orientation,
         * line, start) form. Safe because TYPE_A's filled/need offsets
         * ({1,2,3}/{0,4}) and TYPE_B's ({0,1,3,4}/{2}) are both palindromic,
         * so it never matters whether a transform reverses the window's
         * traversal direction — the same cell SET results either way.
         */
        public ShapeSpec transformed(BoardTransform t) {
            int[] c0 = t.apply(cellAt(0)[0], cellAt(0)[1]);
            int[] c4 = t.apply(cellAt(4)[0], cellAt(4)[1]);
            if (c0[1] == c4[1]) {
                return new ShapeSpec(type, ShapeOrientation.VERTICAL, c0[1], Math.min(c0[0], c4[0]), backup);
            }
            if (c0[0] == c4[0]) {
                return new ShapeSpec(type, ShapeOrientation.HORIZONTAL, c0[0], Math.min(c0[1], c4[1]), backup);
            }
            throw new IllegalStateException("D4 transform must preserve axis alignment, got " + t);
        }
    }

    public record PlannedCell(FieldCellKind kind, int row, int col, boolean visible) {
    }

    public record EncounterPlan(int sequence, PveFieldType fieldType, PveMutationType mutationType,
                                int bossHpMax, int moveBudget, BoardSide seaSide,
                                List<PlannedCell> cells, PveMinorDisruptionType minorDisruptionType,
                                PveEncounterType encounterType, PveOpeningScript openingScript) {
    }

    private record LevelTemplate(List<ShapeSpec> templateA, List<ShapeSpec> templateB) {
    }

    private static final Map<Integer, LevelTemplate> TEMPLATES = loadTemplates();

    private PveFieldScheduler() {
    }

    public static EncounterPlan plan(String runSeed, int sequence) {
        if (sequence < 1 || sequence > ENCOUNTER_COUNT) {
            throw new IllegalArgumentException("sequence must be 1..8, got " + sequence);
        }
        if (DUEL_SEQUENCES.contains(sequence)) {
            // §1/§4 全對弈階梯設計: every sequence is a DUEL encounter — no
            // HP/damage/mutation/pre-placed shapes at all, resolved purely by
            // BossAiPolicy + five-in-a-row scanning. L5 gets a one-time,
            // fully-deterministic set of static VOLCANO rocks (§4.2); L6 gets
            // a BEACH sea side so the existing WAVE_HANDS push cadence
            // applies (§4.3); every other sequence is plain PLAIN with no
            // field cells at all.
            PveFieldType fieldType = switch (sequence) {
                case 5 -> PveFieldType.VOLCANO;
                case 6 -> PveFieldType.BEACH;
                default -> PveFieldType.PLAIN;
            };
            List<PlannedCell> cells = sequence == 5 ? volcanoRocksForDuel(runSeed) : List.of();
            BoardSide seaSide = sequence == 6 ? seaSideForDuel(runSeed) : null;
            return new EncounterPlan(sequence, fieldType, PveMutationType.NONE,
                    0, DUEL_MOVE_BUDGET.get(sequence), seaSide, cells, PveMinorDisruptionType.NONE,
                    PveEncounterType.DUEL, BossAiPolicy.openingScriptFor(sequence));
        }
        PveFieldType fieldType = fieldTypeFor(runSeed, sequence);
        PveMutationType mutation = mutationFor(sequence);
        int hp = BOSS_HP_CURVE[sequence - 1];
        int budget = MOVE_BUDGET_CURVE[sequence - 1];

        List<ShapeSpec> shapes = activeShapes(runSeed, sequence);
        Set<Integer> excluded = new HashSet<>();
        List<PlannedCell> cells = new ArrayList<>();
        for (ShapeSpec shape : shapes) {
            for (int[] rc : shape.windowCells()) {
                excluded.add(encode(rc[0], rc[1]));
            }
        }
        for (ShapeSpec shape : shapes) {
            for (int[] rc : shape.filledCells()) {
                cells.add(new PlannedCell(FieldCellKind.INITIAL_BLACK, rc[0], rc[1], true));
            }
        }

        BoardSide seaSide = null;
        if (fieldType != PveFieldType.PLAIN) {
            Random rng = PveRandoms.forPurpose(runSeed, "field:" + sequence);
            // §2 場地生成排除規則: never place a visible/hidden field cell on a
            // shape's window (avoids blocking or contradicting the solve path).
            Set<Integer> taken = new HashSet<>(excluded);
            // B4 保底介入（2026-07-08 調校輪）: 玩家原本的抱怨是VOLCANO/BEACH「零
            // 介入」——障礙/隱藏格是純均勻隨機撒在11x11棋盤上，統計上常常離解謎
            // 路徑很遠，場地淪為皮膚。這裡強制其中一格落在某雛形5格窗的「相鄰2格
            // 環」內（Chebyshev距離1或2，且不落在任何窗格本身——安全性與§2排除
            // 規則相同，故不影響可解性）：障礙格visible=true本身就會被玩家看見，
            // 隱藏格則滿足「隱藏格出現在雛形附近」這個字面要求，即便要等玩家踩到
            // 才觸發。若環內候選格已被其他雛形佔滿（極端邊界情況），退化為原本的
            // 全盤隨機挑選，不強求。
            List<int[]> nearWindowRing = nearWindowRing(shapes, excluded);
            if (fieldType == PveFieldType.VOLCANO) {
                int obstacles = 3 + rng.nextInt(3); // 3..5 visible (FR-C2)
                List<int[]> chosen = new ArrayList<>();
                int[] guaranteed = pickOneFrom(rng, nearWindowRing, taken);
                if (guaranteed != null) {
                    chosen.add(guaranteed);
                    taken.add(encode(guaranteed[0], guaranteed[1]));
                }
                chosen.addAll(pickDistinct(rng, obstacles - chosen.size(), taken));
                for (int[] pos : chosen) {
                    cells.add(new PlannedCell(FieldCellKind.OBSTACLE, pos[0], pos[1], true));
                }
                int eruptions = 1 + rng.nextInt(3); // 1..3 hidden, at most 3
                for (int[] pos : pickDistinct(rng, eruptions, taken)) {
                    cells.add(new PlannedCell(FieldCellKind.ERUPTION, pos[0], pos[1], false));
                }
            } else { // BEACH
                seaSide = BoardSide.values()[rng.nextInt(BoardSide.values().length)];
                int tides = 1 + rng.nextInt(3); // 1..3 hidden, at most 3
                List<int[]> chosen = new ArrayList<>();
                int[] guaranteed = pickOneFrom(rng, nearWindowRing, taken);
                if (guaranteed != null) {
                    chosen.add(guaranteed);
                    taken.add(encode(guaranteed[0], guaranteed[1]));
                }
                chosen.addAll(pickDistinct(rng, tides - chosen.size(), taken));
                for (int[] pos : chosen) {
                    cells.add(new PlannedCell(FieldCellKind.TIDE, pos[0], pos[1], false));
                }
            }
        }

        PveMinorDisruptionType disruption = minorDisruptionFor(runSeed, sequence);
        return new EncounterPlan(sequence, fieldType, mutation, hp, budget, seaSide, cells, disruption,
                PveEncounterType.PUZZLE, PveOpeningScript.NONE);
    }

    /**
     * All 8 sequences are DUEL (documents/PVE-全對弈階梯設計-2026-07-10.md §0/§8):
     * {@code PveEncounterType.PUZZLE} is never produced anymore — the enum
     * value is kept only for replay compatibility with pre-cutover data.
     */
    public static PveEncounterType encounterTypeFor(int sequence) {
        return PveEncounterType.DUEL;
    }

    /**
     * §4.2 L5 火山: 5–8 一次性、全局確定性靜態岩石格（開局固定，無隱藏噴發）.
     *
     * <p>§7.6 岩石覆蓋下限 (2026-07-10 第二批 polish): the plain uniform draw
     * could cluster every rock on one side of the board, so the terrain only
     * ever constrained one player's half. The first two rocks are now drawn
     * one from each half (rows 0–4 vs rows 6–10, split at the middle row 5 —
     * "以中線分" symmetric lower bound: at least 1 rock strictly on each
     * side), the remainder uniformly; still a single seed-deterministic
     * "volcano-l5" RNG stream, count unchanged (5–8).
     */
    private static List<PlannedCell> volcanoRocksForDuel(String runSeed) {
        Random rng = PveRandoms.forPurpose(runSeed, "volcano-l5");
        int count = L5_VOLCANO_MIN_OBSTACLES + rng.nextInt(L5_VOLCANO_OBSTACLE_SPREAD);
        Set<Integer> taken = new HashSet<>();
        List<PlannedCell> cells = new ArrayList<>();
        int half = PveFieldGeometry.BOARD_SIZE / 2; // 5 — the middle row, in neither half
        // Guaranteed rock in the top half (rows 0..half-1) and bottom half (rows half+1..).
        int topR = rng.nextInt(half);
        int topC = rng.nextInt(PveFieldGeometry.BOARD_SIZE);
        taken.add(encode(topR, topC));
        cells.add(new PlannedCell(FieldCellKind.OBSTACLE, topR, topC, true));
        int botR = half + 1 + rng.nextInt(PveFieldGeometry.BOARD_SIZE - half - 1);
        int botC = rng.nextInt(PveFieldGeometry.BOARD_SIZE);
        taken.add(encode(botR, botC));
        cells.add(new PlannedCell(FieldCellKind.OBSTACLE, botR, botC, true));
        int guard = 0;
        while (cells.size() < count && guard++ < 10_000) {
            int r = rng.nextInt(PveFieldGeometry.BOARD_SIZE);
            int c = rng.nextInt(PveFieldGeometry.BOARD_SIZE);
            if (taken.add(encode(r, c))) {
                cells.add(new PlannedCell(FieldCellKind.OBSTACLE, r, c, true));
            }
        }
        return cells;
    }

    /** §4.3 L6 海浪: which board side the sea starts on (seed-deterministic, FR-A3). */
    private static BoardSide seaSideForDuel(String runSeed) {
        Random rng = PveRandoms.forPurpose(runSeed, "wave-l6-side");
        return BoardSide.values()[rng.nextInt(BoardSide.values().length)];
    }

    /** 1/3/4/6/8 PLAIN; 2/5/7 seed-driven 50% VOLCANO/BEACH (FR-C2). */
    public static PveFieldType fieldTypeFor(String runSeed, int sequence) {
        if (sequence == 2 || sequence == 5 || sequence == 7) {
            Random rng = PveRandoms.forPurpose(runSeed, "fieldtype:" + sequence);
            return rng.nextBoolean() ? PveFieldType.VOLCANO : PveFieldType.BEACH;
        }
        return PveFieldType.PLAIN;
    }

    /**
     * Fixed mutation schedule (FR-C6). 2026-07-09 修訂: sequence 8 is now a
     * DUEL encounter (ABYSS retired — no PUZZLE sequence uses it anymore, see
     * documents/PVE-魔王對弈與策略引導設計-2026-07-09.md §3.1); this method is only
     * ever called from the PUZZLE branch of {@link #plan}, so 8/DUEL never
     * reach it in practice, but the default case still returns NONE for it.
     */
    public static PveMutationType mutationFor(int sequence) {
        return switch (sequence) {
            case 3 -> PveMutationType.ONE_EYE;
            case 6 -> PveMutationType.RAGE;
            default -> PveMutationType.NONE;
        };
    }

    /** True when the seed-driven pool draw picked "Template A" (center row-band) for this sequence. */
    public static boolean isTemplateA(String runSeed, int sequence) {
        return PveRandoms.forPurpose(runSeed, "pool:" + sequence).nextBoolean();
    }

    /** The resolved shape list (Template A or B, seed-driven), with the §5 D4 board transform applied. */
    public static List<ShapeSpec> activeShapes(String runSeed, int sequence) {
        LevelTemplate level = TEMPLATES.get(sequence);
        if (level == null) {
            throw new IllegalArgumentException("no level template for sequence " + sequence);
        }
        List<ShapeSpec> pool = isTemplateA(runSeed, sequence) ? level.templateA() : level.templateB();
        BoardTransform transform = transformFor(runSeed, sequence);
        List<ShapeSpec> transformed = new ArrayList<>(pool.size());
        for (ShapeSpec shape : pool) {
            transformed.add(shape.transformed(transform));
        }
        return transformed;
    }

    /**
     * Raw seed-derived draw of one of the 8 {@link BoardTransform} indices
     * (0..7, in enum-declaration order) for this sequence — BEFORE any
     * per-sequence folding. Exposed (not just {@link #transformFor}) so
     * tests can request a specific nominal transform slot by searching for a
     * matching seed, the same pattern {@link #isTemplateA} already enables
     * for Template A/B (§2 / 關卡可解性.feature).
     */
    public static int transformIndexFor(String runSeed, int sequence) {
        return PveRandoms.forPurpose(runSeed, "transform:" + sequence).nextInt(BoardTransform.values().length);
    }

    /**
     * The §5 D4 board transform actually applied to sequence's shapes: the
     * raw {@link #transformIndexFor} draw, folded into the 4
     * orientation-preserving {@link BoardTransform} constants for
     * {@link #ORIENTATION_LOCKED_SEQUENCES} (sequence 3 / ONE_EYE — see class
     * javadoc) and used as-is otherwise.
     */
    public static BoardTransform transformFor(String runSeed, int sequence) {
        int idx = transformIndexFor(runSeed, sequence);
        if (ORIENTATION_LOCKED_SEQUENCES.contains(sequence)) {
            idx = idx % 4;
        }
        return BoardTransform.values()[idx];
    }

    /** Single-shot minor disruption draw (§5); NONE on mutation sequences 3/6/8. */
    public static PveMinorDisruptionType minorDisruptionFor(String runSeed, int sequence) {
        if (!MINOR_DISRUPTION_SEQUENCES.contains(sequence)) {
            return PveMinorDisruptionType.NONE;
        }
        Random rng = PveRandoms.forPurpose(runSeed, "disruption:" + sequence);
        PveMinorDisruptionType[] options = {
                PveMinorDisruptionType.NONE, PveMinorDisruptionType.PULSE_CLEAR, PveMinorDisruptionType.PULSE_PUSH,
        };
        return options[rng.nextInt(options.length)];
    }

    private static int encode(int row, int col) {
        return row * PveFieldGeometry.BOARD_SIZE + col;
    }

    /**
     * B4: cells within Chebyshev distance 1-2 of some shape's 5-cell window,
     * excluding the window cells themselves ({@code excludedWindowCells}) —
     * the pool a "guaranteed nearby field cell" is drawn from.
     */
    private static List<int[]> nearWindowRing(List<ShapeSpec> shapes, Set<Integer> excludedWindowCells) {
        Set<Integer> ring = new LinkedHashSet<>();
        for (ShapeSpec shape : shapes) {
            for (int[] rc : shape.windowCells()) {
                for (int dr = -2; dr <= 2; dr++) {
                    for (int dc = -2; dc <= 2; dc++) {
                        int r = rc[0] + dr;
                        int c = rc[1] + dc;
                        if (r < 0 || r >= PveFieldGeometry.BOARD_SIZE || c < 0 || c >= PveFieldGeometry.BOARD_SIZE) {
                            continue;
                        }
                        int key = encode(r, c);
                        if (!excludedWindowCells.contains(key)) {
                            ring.add(key);
                        }
                    }
                }
            }
        }
        List<int[]> cells = new ArrayList<>(ring.size());
        for (int key : ring) {
            cells.add(new int[]{key / PveFieldGeometry.BOARD_SIZE, key % PveFieldGeometry.BOARD_SIZE});
        }
        return cells;
    }

    /** One random not-yet-taken cell from {@code candidates}, or null if all are taken. */
    private static int[] pickOneFrom(Random rng, List<int[]> candidates, Set<Integer> taken) {
        List<int[]> available = new ArrayList<>();
        for (int[] c : candidates) {
            if (!taken.contains(encode(c[0], c[1]))) {
                available.add(c);
            }
        }
        if (available.isEmpty()) {
            return null;
        }
        return available.get(rng.nextInt(available.size()));
    }

    private static List<int[]> pickDistinct(Random rng, int count, Set<Integer> taken) {
        List<int[]> picked = new ArrayList<>(count);
        int guard = 0;
        while (picked.size() < count && guard < 10_000) {
            guard++;
            int r = rng.nextInt(PveFieldGeometry.BOARD_SIZE);
            int c = rng.nextInt(PveFieldGeometry.BOARD_SIZE);
            int key = encode(r, c);
            if (taken.add(key)) {
                picked.add(new int[]{r, c});
            }
        }
        return picked;
    }

    // ────────────────────────── level-templates.json loading ─────────────────

    @SuppressWarnings("unchecked")
    private static Map<Integer, LevelTemplate> loadTemplates() {
        ObjectMapper mapper = new ObjectMapper();
        try (InputStream in = PveFieldScheduler.class.getResourceAsStream("/pve/level-templates.json")) {
            if (in == null) {
                throw new IllegalStateException("resources/pve/level-templates.json not found on classpath");
            }
            Map<String, Object> root = mapper.readValue(in, Map.class);
            List<Map<String, Object>> levels = (List<Map<String, Object>>) root.get("levels");
            Map<Integer, LevelTemplate> result = new HashMap<>();
            for (Map<String, Object> level : levels) {
                int sequence = ((Number) level.get("sequence")).intValue();
                List<ShapeSpec> a = parseShapes((List<Map<String, Object>>) level.get("templateA"));
                List<ShapeSpec> b = parseShapes((List<Map<String, Object>>) level.get("templateB"));
                result.put(sequence, new LevelTemplate(a, b));
            }
            return result;
        } catch (IOException e) {
            throw new UncheckedIOException("failed to load pve/level-templates.json", e);
        }
    }

    private static List<ShapeSpec> parseShapes(List<Map<String, Object>> raw) {
        List<ShapeSpec> shapes = new ArrayList<>(raw.size());
        for (Map<String, Object> s : raw) {
            ShapeType type = ShapeType.valueOf((String) s.get("type"));
            ShapeOrientation orientation = ShapeOrientation.valueOf((String) s.get("orientation"));
            int line = ((Number) s.get("line")).intValue();
            int start = ((Number) s.get("start")).intValue();
            boolean backup = Boolean.TRUE.equals(s.get("backup"));
            shapes.add(new ShapeSpec(type, orientation, line, start, backup));
        }
        return shapes;
    }
}
