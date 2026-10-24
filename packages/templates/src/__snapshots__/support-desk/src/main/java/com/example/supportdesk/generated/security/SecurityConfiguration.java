// Managed by gen-agent: changes here are overwritten.
package com.example.supportdesk.generated.security;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Every request needs a JWT from the OIDC issuer of {@code application.yml}. No session and no cookie: the token is
 * sent with each request, so there is nothing for a cross-site request to forge.
 */
@Configuration(proxyBeanMethods = false)
public class SecurityConfiguration {

    /** The chat page and its settings are public; the page talks only to the agent and to the OIDC provider. */
    private static final String[] CHAT_PAGE = { "/", "/index.html", "/chat.js", "/chat.css", "/chat-config.json" };

    @Bean
    SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuer
    ) throws Exception {
        URI provider = URI.create(issuer);
        String providerOrigin = provider.getScheme() + "://" + provider.getAuthority();
        return http
            .authorizeHttpRequests(requests ->
                requests // Health and metrics are served on the management port only, which stays inside the network.
                    .requestMatchers("/actuator/health", "/actuator/prometheus")
                    .permitAll()
                    .requestMatchers(CHAT_PAGE)
                    .permitAll()
                    .anyRequest()
                    .authenticated()
            )
            .oauth2ResourceServer(server -> server.jwt(Customizer.withDefaults()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .csrf(AbstractHttpConfigurer::disable)
            .headers(headers ->
                headers.contentSecurityPolicy(csp ->
                    csp.policyDirectives(
                        "default-src 'self'; img-src 'self' data:; connect-src 'self' " +
                            providerOrigin +
                            "; frame-ancestors 'none'; form-action 'self' " +
                            providerOrigin
                    )
                )
            )
            .build();
    }
}
