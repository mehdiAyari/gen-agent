// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk.generated.approval;

import org.springframework.http.HttpStatus;

/** The call cannot be approved or denied: unknown to this user (404), already answered (409) or expired (410). */
public class ApprovalUnavailableException extends RuntimeException {

    private final HttpStatus status;

    ApprovalUnavailableException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
