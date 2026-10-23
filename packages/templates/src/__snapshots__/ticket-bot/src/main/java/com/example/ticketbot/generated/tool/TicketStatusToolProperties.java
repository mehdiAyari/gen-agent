// Managed by gen-agent: changes here are overwritten. Set the values in application.yml.
package com.example.ticketbot.generated.tool;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings of the {@code ticket-status} tool.
 *
 * @param url endpoint called by the tool; {@code {ticketId}} filled with the model's arguments
 * @param token sent in the {@code Authorization} header, from the {@code TICKETS_API_TOKEN} environment variable
 * @param maxResponseChars longer responses are cut before they reach the model
 */
@ConfigurationProperties("agent.tools.ticket-status")
public record TicketStatusToolProperties(String url, String token, int maxResponseChars) {}
