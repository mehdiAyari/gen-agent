package com.example.supportdesk.tool;

import com.example.supportdesk.generated.tool.RefundHandler;
import org.springframework.stereotype.Component;

@Component
class DefaultRefundHandler implements RefundHandler {

    @Override
    public String refund(String orderId) {
        // Implement refund here: the text you return is what the model reads.
        throw new UnsupportedOperationException("refund is not implemented yet");
    }
}
