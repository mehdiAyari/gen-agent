// Managed by gen-agent: changes here are overwritten.
package com.example.petstoreassistant.generated.chat;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Answers every error as an RFC 9457 problem detail. Spring MVC errors (validation…) keep their status; anything else
 * becomes a generic 500 whose details stay in the logs, never in the response.
 */
@RestControllerAdvice
class ChatExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ChatExceptionHandler.class);

    @ExceptionHandler(Exception.class)
    ProblemDetail handleUnexpected(Exception exception) {
        log.error("The agent could not answer", exception);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "The agent could not answer. Try again later."
        );
        problem.setTitle("Agent error");
        return problem;
    }
}
