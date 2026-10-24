// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.limits;

import io.github.bucket4j.distributed.ExpirationAfterWriteStrategy;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import io.github.bucket4j.redis.lettuce.Bucket4jLettuce;
import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.boot.data.redis.autoconfigure.DataRedisConnectionDetails;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Keeps the limit counters of every user in Redis, so they hold across restarts and instances. */
@Configuration(proxyBeanMethods = false)
class LimitsConfiguration {

    @Bean(destroyMethod = "shutdown")
    RedisClient limitsRedisClient(DataRedisConnectionDetails connection) {
        DataRedisConnectionDetails.Standalone server = connection.getStandalone();
        RedisURI.Builder uri = RedisURI.builder()
            .withHost(server.getHost())
            .withPort(server.getPort())
            .withDatabase(server.getDatabase());
        if (connection.getPassword() != null) {
            uri.withPassword(connection.getPassword().toCharArray());
        }
        return RedisClient.create(uri.build());
    }

    @Bean
    ProxyManager<String> buckets(RedisClient limitsRedisClient) {
        return Bucket4jLettuce.casBasedBuilder(limitsRedisClient)
            // A counter left alone expires once full again: idle users cost nothing in Redis.
            .expirationAfterWrite(
                ExpirationAfterWriteStrategy.basedOnTimeForRefillingBucketUpToMax(Duration.ofMinutes(1))
            )
            .build()
            .withMapper((String key) -> key.getBytes(StandardCharsets.UTF_8));
    }
}
