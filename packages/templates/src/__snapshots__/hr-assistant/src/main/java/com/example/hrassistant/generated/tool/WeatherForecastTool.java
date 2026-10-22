// Managed by gen-agent: changes here are overwritten. Edit the tool in agent.yaml and regenerate.
package com.example.hrassistant.generated.tool;

import java.util.Optional;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Calls {@code GET https://api.open-meteo.com/v1/forecast} for the model. */
@Component
public class WeatherForecastTool {

    private final RestClient restClient;

    WeatherForecastTool(RestClient.Builder restClientBuilder, WeatherForecastToolProperties properties) {
        this.restClient = restClientBuilder.baseUrl(properties.url()).build();
    }

    @Tool(description = "Weather forecast for a location")
    public String weatherForecast(
        @ToolParam(description = "Latitude in degrees") double latitude,
        @ToolParam(description = "Longitude in degrees") double longitude,
        @ToolParam(required = false, description = "Number of days to forecast") Long forecastDays
    ) {
        return restClient
            .get()
            .uri(uri ->
                uri
                    .queryParam("latitude", latitude)
                    .queryParam("longitude", longitude)
                    .queryParamIfPresent("forecastDays", Optional.ofNullable(forecastDays))
                    .build()
            )
            .retrieve()
            .body(String.class);
    }
}
