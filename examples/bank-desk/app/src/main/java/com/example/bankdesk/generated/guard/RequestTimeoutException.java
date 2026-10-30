// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk.generated.guard;

import java.time.Duration;

/** The request took longer than {@code agent.timeout}: answered with 504. */
public class RequestTimeoutException extends RuntimeException {

    public RequestTimeoutException(Duration timeout) {
        super(
            "The agent took longer than " + timeout.toSeconds() + "s to answer. Try again, or ask something narrower."
        );
    }
}
