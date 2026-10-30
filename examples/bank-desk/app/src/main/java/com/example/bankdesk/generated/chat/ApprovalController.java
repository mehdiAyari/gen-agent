// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk.generated.chat;

import com.example.bankdesk.generated.approval.PendingApproval;
import com.example.bankdesk.generated.guard.RequestTimeout;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The tool calls that wait for the approval of the signed-in user, and their decision on each. */
@RestController
@RequestMapping("/api/approvals")
class ApprovalController {

    record ApprovalDecision(@NotNull Boolean approved) {}

    private final ChatService chatService;

    private final RequestTimeout requestTimeout;

    ApprovalController(ChatService chatService, RequestTimeout requestTimeout) {
        this.chatService = chatService;
        this.requestTimeout = requestTimeout;
    }

    @GetMapping
    List<PendingApproval> pending(@AuthenticationPrincipal Jwt user) {
        return chatService.pendingApprovals(user.getSubject());
    }

    /** Makes the call or not, tells the model, and returns its next answer. */
    @PostMapping("/{id}")
    ChatMessageResponse decide(
        @PathVariable UUID id,
        @Valid @RequestBody ApprovalDecision decision,
        @AuthenticationPrincipal Jwt user
    ) {
        return requestTimeout.call(() -> chatService.decide(id, decision.approved(), user.getSubject()));
    }
}
