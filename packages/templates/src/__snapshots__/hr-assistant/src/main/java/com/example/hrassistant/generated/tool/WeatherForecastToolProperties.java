// Managed by gen-agent: changes here are overwritten. Set the values in application.yml.
package com.example.hrassistant.generated.tool;

import java.net.URI;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings of the {@code weather-forecast} tool.
 *
 * @param url endpoint called by the tool
 * @param maxResponseChars longer responses are cut before they reach the model
 */
@ConfigurationProperties("agent.tools.weather-forecast")
public record WeatherForecastToolProperties(URI url, int maxResponseChars) {}
