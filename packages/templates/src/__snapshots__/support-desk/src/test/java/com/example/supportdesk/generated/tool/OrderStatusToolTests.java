// Managed by gen-agent: changes here are overwritten.
package com.example.supportdesk.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.restclient.test.autoconfigure.RestClientTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;

@RestClientTest(
    components = { OrderStatusTool.class, ToolCalls.class },
    properties = "agent.tools.order-status.token=test-token"
)
@EnableConfigurationProperties(OrderStatusToolProperties.class)
class OrderStatusToolTests {

    @Autowired
    OrderStatusTool tool;

    @Autowired
    MockRestServiceServer server;

    @Test
    void callsTheConfiguredEndpointAndReturnsItsBody() {
        server
            .expect(requestTo(startsWith("https://shop.example.org/api/orders/test")))
            .andExpect(method(HttpMethod.GET))
            .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer test-token"))
            .andRespond(withSuccess("{\"ok\":true}", MediaType.APPLICATION_JSON));

        assertThat(tool.orderStatus("test")).isEqualTo("{\"ok\":true}");
        server.verify();
    }

    @Test
    void encodesPathValuesSoTheModelCannotChangeThePath() {
        server
            .expect(requestTo(startsWith("https://shop.example.org/api/orders/..%2Fadmin")))
            .andRespond(withSuccess("{\"ok\":true}", MediaType.APPLICATION_JSON));

        tool.orderStatus("../admin");
        server.verify();
    }

    @Test
    void tellsTheModelWhichRequiredArgumentIsMissing() {
        assertThatNullPointerException()
            .isThrownBy(() -> tool.orderStatus(null))
            .withMessage("orderId is required");
    }
}
