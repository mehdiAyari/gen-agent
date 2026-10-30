// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk.generated.privacy;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** The right to erasure: users erase their own data; an administrator ({@code agent-admin} role) erases anyone's. */
@RestController
class ErasureController {

    private final DataEraser eraser;

    ErasureController(DataEraser eraser) {
        this.eraser = eraser;
    }

    @DeleteMapping("/api/me")
    ResponseEntity<Void> eraseMe(@AuthenticationPrincipal Jwt user) {
        eraser.erase(user.getSubject());
        return ResponseEntity.noContent().build();
    }

    /** Only for the agent-admin role: see SecurityConfiguration. */
    @DeleteMapping("/api/users/{userId}")
    ResponseEntity<Void> eraseUser(@PathVariable String userId) {
        eraser.erase(userId);
        return ResponseEntity.noContent().build();
    }
}
