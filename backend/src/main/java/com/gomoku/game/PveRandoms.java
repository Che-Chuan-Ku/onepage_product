package com.gomoku.game;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Random;

/**
 * Seeded randomness derivation for PVE (FR-A3, NFR-1): every random decision
 * derives a purpose-scoped {@link Random} from the run seed, so the same seed
 * + the same operation sequence always yields the same result. Purposes keep
 * independent decisions from consuming each other's random stream.
 */
public final class PveRandoms {

    private PveRandoms() {
    }

    /** Deterministic 64-bit seed from the run seed + a purpose label. */
    public static long deriveSeed(String runSeed, String purpose) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((runSeed + "|" + purpose).getBytes(StandardCharsets.UTF_8));
            long value = 0;
            for (int i = 0; i < 8; i++) {
                value = (value << 8) | (hash[i] & 0xFF);
            }
            return value;
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    public static Random forPurpose(String runSeed, String purpose) {
        return new Random(deriveSeed(runSeed, purpose));
    }
}
