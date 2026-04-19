package com.onepage.product.util;

import java.text.Normalizer;
import java.util.regex.Pattern;

public class SlugUtil {

    private static final Pattern NON_LATIN = Pattern.compile("[^\\w-]");
    private static final Pattern WHITESPACE = Pattern.compile("[\\s]");
    private static final Pattern MULTIPLE_DASH = Pattern.compile("-+");

    private SlugUtil() {}

    public static String toSlug(String input) {
        String noWhitespace = WHITESPACE.matcher(input).replaceAll("-");
        // Normalize unicode characters (Chinese characters become empty, so we keep original if empty)
        String normalized = Normalizer.normalize(noWhitespace, Normalizer.Form.NFD);
        String slug = NON_LATIN.matcher(normalized).replaceAll("");
        slug = MULTIPLE_DASH.matcher(slug).replaceAll("-");
        slug = slug.toLowerCase();

        // If slug is empty (e.g., all Chinese characters), use transliteration approach
        if (slug.isEmpty() || slug.equals("-")) {
            // Use hex encoding of the string as fallback
            StringBuilder sb = new StringBuilder();
            for (char c : input.toCharArray()) {
                if (Character.isLetterOrDigit(c)) {
                    sb.append(c);
                } else if (c == ' ' || c == '-') {
                    sb.append('-');
                } else {
                    sb.append(Integer.toHexString(c));
                }
            }
            slug = sb.toString().toLowerCase();
            slug = MULTIPLE_DASH.matcher(slug).replaceAll("-");
        }

        return slug;
    }

    public static String generateUniqueSlug(String name, java.util.function.Predicate<String> existsCheck) {
        String baseSlug = toSlug(name);
        String slug = baseSlug;
        int counter = 1;
        while (existsCheck.test(slug)) {
            slug = baseSlug + "-" + counter;
            counter++;
        }
        return slug;
    }
}
