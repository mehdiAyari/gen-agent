// Managed by gen-agent: changes here are overwritten. Set the values in application.yml.
package com.example.petstoreassistant.generated.tool;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings of the {@code get-pet-by-id} tool.
 *
 * @param url endpoint called by the tool; {@code {petId}} filled with the model's arguments
 * @param token sent in the {@code api_key} header, from the {@code PETSTORE_API_KEY} environment variable
 * @param maxResponseChars longer responses are cut before they reach the model
 */
@ConfigurationProperties("agent.tools.get-pet-by-id")
public record GetPetByIdToolProperties(String url, String token, int maxResponseChars) {}
