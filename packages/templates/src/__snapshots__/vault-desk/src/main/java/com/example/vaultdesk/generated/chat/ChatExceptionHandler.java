// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.chat;

import com.example.vaultdesk.generated.approval.ApprovalUnavailableException;
import com.example.vaultdesk.generated.guard.RequestTimeoutException;
import com.example.vaultdesk.generated.limits.LimitExceededException;
import com.example.vaultdesk.generated.switches.AgentSwitchedOffException;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.model.tool.ToolCallLimitExceededException;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
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
    ProblemDetail handleTimeout(RequestTimeoutException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.GATEWAY_TIMEOUT, exception.getMessage());
        problem.setTitle("Too slow");
        return problem;
    }

    @ExceptionHandler
    ProblemDetail handleToolCallLimit(ToolCallLimitExceededException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.UNPROCESSABLE_CONTENT,
            "The agent needed more than " + exception.getLimit() + " tool calls to answer. Ask something narrower."
        );
        problem.setTitle("Too many tool calls");
        return problem;
    }

    @ExceptionHandler
    ProblemDetail handleApprovalUnavailable(ApprovalUnavailableException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(exception.status(), exception.getMessage());
        problem.setTitle("Approval unavailable");
        return problem;
    }

    @ExceptionHandler
    ProblemDetail handleSwitchedOff(AgentSwitchedOffException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.SERVICE_UNAVAILABLE,
            exception.getMessage()
        );
        problem.setTitle("Switched off");
        return problem;
    }

    /** Says which field is wrong and why: "message: must not be blank". */
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
        MethodArgumentNotValidException exception,
        HttpHeaders headers,
        HttpStatusCode status,
        WebRequest request
    ) {
        exception.getBody().setDetail(
            exception
                .getFieldErrors()
                .stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .sorted()
                .collect(Collectors.joining("; "))
        );
        return super.handleMethodArgumentNotValid(exception, headers, status, request);
    }

    /** A database the agent needs is down or too slow: the client may try again soon, and learns nothing more. */
    @ExceptionHandler({ DataAccessResourceFailureException.class, QueryTimeoutException.class })
    ResponseEntity<ProblemDetail> handleUnavailable(DataAccessException exception) {
        log.warn("A service the agent needs is unavailable: {}", exception.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.SERVICE_UNAVAILABLE,
            "A service the agent needs is unavailable. Try again in a moment."
        );
        problem.setTitle("Temporarily unavailable");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .header(HttpHeaders.RETRY_AFTER, "30")
            .body(problem);
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
