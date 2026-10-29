// Managed by gen-agent: changes here are overwritten.
package com.example.hrassistant.generated.limits;

import java.time.Duration;

/** A user sent too many requests, or used up the tokens of the period: answered with 429 and Retry-After. */
public class LimitExceededException extends RuntimeException {

    private final Duration retryAfter;

    public LimitExceededException(String message, Duration retryAfter) {
        super(message);
        this.retryAfter = retryAfter;
    }

    public Duration retryAfter() {
        return retryAfter;
    }
}
