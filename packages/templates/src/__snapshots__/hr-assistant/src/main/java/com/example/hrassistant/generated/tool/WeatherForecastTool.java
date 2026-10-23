// Managed by gen-agent: changes here are overwritten. Edit the tool in agent.yaml and regenerate.
package com.example.hrassistant.generated.tool;

import java.util.Objects;
import java.util.Optional;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Calls {@code GET https://api.open-meteo.com/v1/forecast} for the model. */
@Component
public class WeatherForecastTool {

    private final RestClient restClient;

    private final int maxResponseChars;

    WeatherForecastTool(RestClient.Builder restClientBuilder, WeatherForecastToolProperties properties) {
        this.restClient = restClientBuilder.baseUrl(properties.url()).build();
        this.maxResponseChars = properties.maxResponseChars();
    }

    @Tool(description = "Weather forecast for a location")
    public String weatherForecast(
        @ToolParam(description = "Latitude in degrees") Double latitude,
        @ToolParam(description = "Longitude in degrees") Double longitude,
        @ToolParam(required = false, description = "Number of days to forecast") Long forecastDays
    ) {
        Objects.requireNonNull(latitude, "latitude is required");
        Objects.requireNonNull(longitude, "longitude is required");
        String body = restClient
            .get()
            .uri(uri ->
                uri
                    .queryParam("latitude", latitude)
                    .queryParam("longitude", longitude)
                    .queryParamIfPresent("forecast_days", Optional.ofNullable(forecastDays))
                    .build()
            )
            .retrieve()
            .body(String.class);
        return ToolResponses.limit(body, maxResponseChars);
    }
}
