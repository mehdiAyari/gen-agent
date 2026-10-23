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
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;

@RestClientTest(components = AddCommentTool.class, properties = "agent.tools.add-comment.token=test-token")
@EnableConfigurationProperties(AddCommentToolProperties.class)
class AddCommentToolTests {

    @Autowired
    AddCommentTool tool;

    @Autowired
    MockRestServiceServer server;

    @Test
    void callsTheConfiguredEndpointAndReturnsItsBody() {
        server
            .expect(requestTo(startsWith("https://tickets.example.org/api/projects/test/tickets/1/comments")))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("X-API-Key", "test-token"))
            .andExpect(content().json("{\"text\":\"test\",\"author_email\":\"test\"}"))
            .andRespond(withSuccess("{\"ok\":true}", MediaType.APPLICATION_JSON));

        assertThat(tool.addComment(1L, "test", "test", "test")).isEqualTo("{\"ok\":true}");
        server.verify();
    }

    @Test
    void encodesPathValuesSoTheModelCannotChangeThePath() {
        server
            .expect(requestTo(startsWith("https://tickets.example.org/api/projects/..%2Fadmin/tickets/1/comments")))
            .andRespond(withSuccess("{\"ok\":true}", MediaType.APPLICATION_JSON));

        tool.addComment(1L, "../admin", "test", "test");
        server.verify();
    }

    @Test
    void tellsTheModelWhichRequiredArgumentIsMissing() {
        assertThatNullPointerException()
            .isThrownBy(() -> tool.addComment(null, "test", "test", "test"))
            .withMessage("ticketId is required");
    }
}
