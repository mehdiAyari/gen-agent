// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.resilience;

/** No model could answer: the user gets the fallback answer of {@code agent.fallback-answer}. */
public class ModelUnavailableException extends RuntimeException {

    public ModelUnavailableException(Throwable cause) {
        super("No model could answer", cause);
    }
}
