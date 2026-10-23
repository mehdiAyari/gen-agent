// Managed by gen-agent: changes here are overwritten.
package com.example.ticketbot.generated.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
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

@RestClientTest(components = CreateTicketTool.class, properties = "agent.tools.create-ticket.token=test-token")
@EnableConfigurationProperties(CreateTicketToolProperties.class)
class CreateTicketToolTests {

    @Autowired
    CreateTicketTool tool;

    @Autowired
    MockRestServiceServer server;

    @Test
    void callsTheConfiguredEndpointAndReturnsItsBody() {
        server
            .expect(requestTo(startsWith("https://tickets.example.org/api/tickets")))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer test-token"))
            .andExpect(content().json("{\"title\":\"test\"}"))
            .andRespond(withSuccess("{\"ok\":true}", MediaType.APPLICATION_JSON));

        assertThat(tool.createTicket("test", null)).isEqualTo("{\"ok\":true}");
        server.verify();
    }

    @Test
    void tellsTheModelWhichRequiredArgumentIsMissing() {
        assertThatNullPointerException()
            .isThrownBy(() -> tool.createTicket(null, null))
            .withMessage("title is required");
    }
}
