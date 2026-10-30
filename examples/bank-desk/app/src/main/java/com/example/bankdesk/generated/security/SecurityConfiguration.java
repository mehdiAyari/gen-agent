// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk.generated.security;

import java.net.URI;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.CrossOriginEmbedderPolicyHeaderWriter;
import org.springframework.security.web.header.writers.CrossOriginOpenerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.CrossOriginResourcePolicyHeaderWriter;

/**
 * Every request needs a JWT from the OIDC issuer of {@code application.yml}. No session and no cookie: the token is
 * sent with each request, so there is nothing for a cross-site request to forge.
 */
@Configuration(proxyBeanMethods = false)
public class SecurityConfiguration {

    /** The chat page and its settings are public; the page talks only to the agent and to the OIDC provider. */
    private static final String[] CHAT_PAGE = {
        "/",
        "/index.html",
        "/chat.js",
        "/approval-text.js",
        "/chat.css",
        "/chat-config.json",
    };

    @Bean
    SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuer,
        @Value("${agent.security.roles-claim}") String rolesClaim
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
                    .requestMatchers(HttpMethod.DELETE, "/api/users/**")
                    .hasRole("agent-admin")
                    .requestMatchers("/api/admin/**")
                    .hasRole("agent-admin")
                    .anyRequest()
                    .authenticated()
            )
            .oauth2ResourceServer(server -> server.jwt(jwt -> jwt.jwtAuthenticationConverter(withRoles(rolesClaim))))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .csrf(AbstractHttpConfigurer::disable)
            // Nothing of the agent can be framed, embedded or opened by another site.
            .headers(headers ->
                headers
                    .contentSecurityPolicy(csp ->
                        csp.policyDirectives(
                            "default-src 'self'; img-src 'self' data:; connect-src 'self' " +
                                providerOrigin +
                                "; frame-ancestors 'none'; form-action 'self' " +
                                providerOrigin
                        )
                    )
                    .crossOriginOpenerPolicy(policy ->
                        policy.policy(CrossOriginOpenerPolicyHeaderWriter.CrossOriginOpenerPolicy.SAME_ORIGIN)
                    )
                    .crossOriginEmbedderPolicy(policy ->
                        policy.policy(CrossOriginEmbedderPolicyHeaderWriter.CrossOriginEmbedderPolicy.REQUIRE_CORP)
                    )
                    .crossOriginResourcePolicy(policy ->
                        policy.policy(CrossOriginResourcePolicyHeaderWriter.CrossOriginResourcePolicy.SAME_ORIGIN)
                    )
                    .permissionsPolicyHeader(policy -> policy.policy("camera=(), microphone=(), geolocation=()"))
            )
            .build();
    }

    /**
     * Roles from the claim at {@code rolesClaim}, a path such as realm_access.roles (Keycloak) or roles (Entra ID),
     * become ROLE_ authorities: agent-admin gives ROLE_agent-admin.
     */
    static Converter<Jwt, AbstractAuthenticationToken> withRoles(String rolesClaim) {
        return jwt -> {
            Object claim = jwt.getClaims();
            for (String name : rolesClaim.split("\\.")) {
                claim = claim instanceof Map<?, ?> map ? map.get(name) : null;
            }
            List<GrantedAuthority> roles =
                claim instanceof Collection<?> names
                    ? names
                          .stream()
                          .map(role -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + role))
                          .toList()
                    : List.of();
            return new JwtAuthenticationToken(jwt, roles, jwt.getSubject());
        };
    }
}
