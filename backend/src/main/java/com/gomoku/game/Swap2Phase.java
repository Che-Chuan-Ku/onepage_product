package com.gomoku.game;

/**
 * Swap2 strict-standard opening phases (黑·白·黑 + 假後方三選項).
 *
 * Sequence of opening stones placed by the tentative-first player:
 *   seq 1 = BLACK, seq 2 = WHITE, seq 3 = BLACK   (FIRST_THREE)
 * Then the tentative-second player chooses:
 *   TAKE_BLACK / TAKE_WHITE        -> colors finalized, opening done
 *   PLACE_TWO_MORE                 -> tentative-second places 2 more:
 *       seq 4 = WHITE, seq 5 = BLACK (SECOND_TWO), then tentative-first chooses
 *       a color (TAKE_BLACK / TAKE_WHITE) -> finalized.
 */
public enum Swap2Phase {
    /** Tentative-first is placing the initial 3 stones. */
    PLACING_FIRST_THREE,
    /** Tentative-second must make the 3-way choice. */
    AWAIT_SECOND_CHOICE,
    /** Tentative-second is placing 2 more stones (after PLACE_TWO_MORE). */
    PLACING_SECOND_TWO,
    /** Tentative-first must pick a color (TAKE_BLACK / TAKE_WHITE). */
    AWAIT_FIRST_COLOR,
    /** Opening complete; colors finalized; normal play may begin. */
    COMPLETE;

    /** Expected stone color for the next opening stone given how many already placed. */
    public static com.gomoku.domain.enums.StoneColor expectedColor(int alreadyPlaced) {
        // seq 1 BLACK, 2 WHITE, 3 BLACK, 4 WHITE, 5 BLACK
        return (alreadyPlaced % 2 == 0)
                ? com.gomoku.domain.enums.StoneColor.BLACK
                : com.gomoku.domain.enums.StoneColor.WHITE;
    }

    /**
     * Phase derived from placed-stone count + finalized flag.
     * Stone count > 3 implies PLACE_TWO_MORE was already chosen (4th/5th stones exist).
     */
    public static Swap2Phase fromState(int placedStones, boolean finalized) {
        return fromState(placedStones, false, finalized);
    }

    /**
     * Phase including the persisted PLACE_TWO_MORE choice: at exactly 3 placed
     * stones the count alone cannot distinguish AWAIT_SECOND_CHOICE from
     * PLACING_SECOND_TWO — the choice adds no stone, so it must be carried in
     * (Game.swap2TwoMoreChosen).
     */
    public static Swap2Phase fromState(int placedStones, boolean twoMoreChosen, boolean finalized) {
        if (finalized) {
            return COMPLETE;
        }
        if (placedStones < 3) {
            return PLACING_FIRST_THREE;
        }
        if (placedStones == 3) {
            return twoMoreChosen ? PLACING_SECOND_TWO : AWAIT_SECOND_CHOICE;
        }
        if (placedStones < 5) {
            return PLACING_SECOND_TWO; // 4 placed, one more to go
        }
        return AWAIT_FIRST_COLOR; // 5 placed, tentative-first picks color
    }
}
