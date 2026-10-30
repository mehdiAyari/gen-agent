// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk.generated.feedback;

import com.example.bankdesk.generated.privacy.PersonalData;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** A thumb up or down on an answer, and why. */
@RestController
@RequestMapping("/api/feedback")
class FeedbackController {

    /**
     * @param conversationId the conversation of the answer
     * @param rating UP or DOWN
     * @param comment what was wrong or right, optional
     */
    record FeedbackRequest(
        @NotBlank String conversationId,
        @NotNull Feedbacks.Rating rating,
        @Size(max = 2000) String comment
    ) {}

    private final Feedbacks feedbacks;

    private final PersonalData personalData;

    FeedbackController(Feedbacks feedbacks, PersonalData personalData) {
        this.feedbacks = feedbacks;
        this.personalData = personalData;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void rate(@Valid @RequestBody FeedbackRequest request, @AuthenticationPrincipal Jwt user) {
        // The comment is kept with its personal data masked, under a key of its own.
        String comment =
            request.comment() == null
                ? null
                : personalData.mask("feedback:" + request.conversationId(), request.comment());
        feedbacks.record(user.getSubject(), request.conversationId(), request.rating(), comment);
    }
}
