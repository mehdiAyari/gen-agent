// Managed by gen-agent: changes here are overwritten.
package com.example.petstoreassistant.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.restclient.test.autoconfigure.RestClientTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;

@RestClientTest(FindPetsByStatusTool.class)
@EnableConfigurationProperties(FindPetsByStatusToolProperties.class)
class FindPetsByStatusToolTests {

    @Autowired
    FindPetsByStatusTool tool;

    @Autowired
    MockRestServiceServer server;

    @Test
    void callsTheConfiguredEndpointAndReturnsItsBody() {
        server
            .expect(requestTo(startsWith("https://petstore3.swagger.io/api/v3/pet/findByStatus")))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("{\"ok\":true}", MediaType.APPLICATION_JSON));

        assertThat(tool.findPetsByStatus("test")).isEqualTo("{\"ok\":true}");
        server.verify();
    }

    @Test
    void tellsTheModelWhichRequiredArgumentIsMissing() {
        assertThatNullPointerException()
            .isThrownBy(() -> tool.findPetsByStatus(null))
            .withMessage("status is required");
    }
}
