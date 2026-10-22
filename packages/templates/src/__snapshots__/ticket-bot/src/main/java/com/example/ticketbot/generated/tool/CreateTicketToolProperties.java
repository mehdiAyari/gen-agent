// Managed by gen-agent: changes here are overwritten. Set the URL in application.yml.
package com.example.ticketbot.generated.tool;

import java.net.URI;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings of the {@code create-ticket} tool.
 *
 * @param url endpoint called by the tool
 */
@ConfigurationProperties("agent.tools.create-ticket")
public record CreateTicketToolProperties(URI url) {}
