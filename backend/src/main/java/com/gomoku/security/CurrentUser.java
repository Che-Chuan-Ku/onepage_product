package com.gomoku.security;

import com.gomoku.exception.BusinessException;
import com.gomoku.exception.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Resolves the authenticated player id from the security context.
 */
@Component
public class CurrentUser {

    /** @return authenticated playerId, or null if anonymous. */
    public String idOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal() == null) {
            return null;
        }
        Object principal = auth.getPrincipal();
        if ("anonymousUser".equals(principal)) {
            return null;
        }
        return principal.toString();
    }

    /** @return authenticated playerId, or throws 401. */
    public String requireId() {
        String id = idOrNull();
        if (id == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return id;
    }
}
