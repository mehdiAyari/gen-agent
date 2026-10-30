// Managed by gen-agent: changes here are overwritten. Set the limits in application.yml.
package com.example.bankdesk.generated.limits;

import com.example.bankdesk.generated.AgentProperties;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.EstimationProbe;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import java.time.Duration;
import org.springframework.stereotype.Component;

/**
 * Limits each user to a number of requests and to a budget of model tokens per period, so that nobody can
 * exhaust the agent or its bill.
 */
@Component
public class UsageLimits {

    private final ProxyManager<String> buckets;

    private final AgentProperties.Limits limits;

    UsageLimits(ProxyManager<String> buckets, AgentProperties properties) {
        this.buckets = buckets;
        this.limits = properties.limits();
    }

    /** Throws {@link LimitExceededException} when the user may not send one more request now. */
    public void checkRequest(String userId) {
        ConsumptionProbe request = requests(userId).tryConsumeAndReturnRemaining(1);
        if (!request.isConsumed()) {
            throw new LimitExceededException(
                "Too many requests: wait before sending another message.",
                Duration.ofNanos(request.getNanosToWaitForRefill())
            );
        }
        EstimationProbe budget = tokens(userId).estimateAbilityToConsume(1);
        if (!budget.canBeConsumed()) {
            throw new LimitExceededException(
                "The token budget of this period is used up.",
                Duration.ofNanos(budget.getNanosToWaitForRefill())
            );
        }
    }

    /** Counts the tokens the model used for a reply; the budget may go below zero, and the next request waits. */
    public void recordTokens(String userId, long tokens) {
        tokens(userId).consumeIgnoringRateLimits(tokens);
    }

    public void forget(String userId) {
        buckets.removeProxy("requests:" + userId);
        buckets.removeProxy("tokens:" + userId);
    }

    private Bucket requests(String userId) {
        return buckets.builder().build("requests:" + userId, () ->
            BucketConfiguration.builder()
                .addLimit(limit ->
                    limit.capacity(limits.requests()).refillGreedy(limits.requests(), limits.requestsPeriod())
                )
                .build()
        );
    }

    private Bucket tokens(String userId) {
        return buckets.builder().build("tokens:" + userId, () ->
            BucketConfiguration.builder()
                // The whole budget comes back at once, at the end of each period.
                .addLimit(limit ->
                    limit.capacity(limits.tokens()).refillIntervally(limits.tokens(), limits.tokensPeriod())
                )
                .build()
        );
    }
}
