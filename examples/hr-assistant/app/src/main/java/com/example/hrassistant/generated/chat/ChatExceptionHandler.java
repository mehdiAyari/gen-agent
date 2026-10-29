// Managed by gen-agent: changes here are overwritten.
package com.example.hrassistant.generated.chat;

import com.example.hrassistant.generated.approval.ApprovalUnavailableException;
import com.example.hrassistant.generated.limits.LimitExceededException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
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

    @ExceptionHandler
    ProblemDetail handleUnknownConversation(UnknownConversationException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.NOT_FOUND,
            "No such conversation: start a new one without conversationId."
        );
        problem.setTitle("Unknown conversation");
        return problem;
    }

    @ExceptionHandler
    ResponseEntity<ProblemDetail> handleLimitExceeded(LimitExceededException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.TOO_MANY_REQUESTS, exception.getMessage());
        problem.setTitle("Limit reached");
        // Whole seconds, rounded up: a client that waits this long is served.
        long seconds = Math.max(
            1,
            exception.retryAfter().toSeconds() + (exception.retryAfter().toNanosPart() > 0 ? 1 : 0)
        );
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
            .header(HttpHeaders.RETRY_AFTER, String.valueOf(seconds))
            .body(problem);
    }

    @ExceptionHandler
    ProblemDetail handleApprovalUnavailable(ApprovalUnavailableException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(exception.status(), exception.getMessage());
        problem.setTitle("Approval unavailable");
        return problem;
    }

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
