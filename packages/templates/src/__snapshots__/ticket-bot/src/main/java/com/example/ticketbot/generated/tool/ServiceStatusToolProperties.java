// Managed by gen-agent: changes here are overwritten. Set the values in application.yml.
package com.example.ticketbot.generated.tool;

import java.net.URI;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings of the {@code service-status} tool.
 *
 * @param url endpoint called by the tool
 * @param maxResponseChars longer responses are cut before they reach the model
 */
@ConfigurationProperties("agent.tools.service-status")
public record ServiceStatusToolProperties(URI url, int maxResponseChars) {}
