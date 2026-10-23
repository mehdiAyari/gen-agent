// Managed by gen-agent: changes here are overwritten.
package com.example.supportdesk.generated.security;

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

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // Health and metrics are served on the management port only, which stays inside the network.
        return http
            .authorizeHttpRequests(requests ->
                requests
                    .requestMatchers("/actuator/health", "/actuator/prometheus")
                    .permitAll()
                    .anyRequest()
                    .authenticated()
            )
            .oauth2ResourceServer(server -> server.jwt(Customizer.withDefaults()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .csrf(AbstractHttpConfigurer::disable)
            .build();
    }
}
