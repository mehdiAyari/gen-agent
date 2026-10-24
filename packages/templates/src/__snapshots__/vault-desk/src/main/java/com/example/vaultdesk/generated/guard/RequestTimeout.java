// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.guard;

import com.example.vaultdesk.generated.AgentProperties;
import io.micrometer.context.ContextSnapshotFactory;
import java.time.Duration;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.stereotype.Component;

/**
 * Bounds a whole request, model calls and tools included, by {@code agent.timeout}. Past it the work is interrupted,
 * which cancels the call in flight, and the client gets 504.
 */
@Component
public class RequestTimeout implements DisposableBean {

    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    // Traces and the correlation id of the logs follow the work to its thread.
    private final ContextSnapshotFactory contextSnapshots = ContextSnapshotFactory.builder().build();

    private final Duration timeout;

    RequestTimeout(AgentProperties properties) {
        this.timeout = properties.timeout();
    }

    public <T> T call(Callable<T> work) {
        Future<T> result = executor.submit(contextSnapshots.captureAll().wrap(work));
        try {
            return result.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException exception) {
            result.cancel(true);
            throw new RequestTimeoutException(timeout);
        } catch (ExecutionException exception) {
            // The errors of the work as they are: unknown conversation, limit reached…
            if (exception.getCause() instanceof RuntimeException cause) {
                throw cause;
            }
            throw new IllegalStateException(exception.getCause());
        } catch (InterruptedException exception) {
            result.cancel(true);
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }

    @Override
    public void destroy() {
        executor.shutdownNow();
    }
}
