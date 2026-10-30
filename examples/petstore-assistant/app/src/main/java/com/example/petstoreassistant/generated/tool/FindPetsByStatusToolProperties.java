// Managed by gen-agent: changes here are overwritten. Set the values in application.yml.
package com.example.petstoreassistant.generated.tool;

import java.net.URI;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings of the {@code find-pets-by-status} tool.
 *
 * @param url endpoint called by the tool
 * @param maxResponseChars longer responses are cut before they reach the model
 */
@ConfigurationProperties("agent.tools.find-pets-by-status")
public record FindPetsByStatusToolProperties(URI url, int maxResponseChars) {}
