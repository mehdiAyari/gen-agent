// Managed by gen-agent: changes here are overwritten. Set the values in application.yml.
package com.example.ticketbot.generated.tool;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings of the {@code add-comment} tool.
 *
 * @param url endpoint called by the tool; {@code {project}}, {@code {ticketId}} filled with the model's arguments
 * @param token sent in the {@code X-API-Key} header, from the {@code TICKETS_API_KEY} environment variable
 * @param maxResponseChars longer responses are cut before they reach the model
 */
@ConfigurationProperties("agent.tools.add-comment")
public record AddCommentToolProperties(String url, String token, int maxResponseChars) {}
