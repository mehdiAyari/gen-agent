package com.example.vaultdesk.tool;

import com.example.vaultdesk.generated.tool.BlockCardHandler;
import org.springframework.stereotype.Component;

@Component
class DefaultBlockCardHandler implements BlockCardHandler {

    @Override
    public String blockCard() {
        // Implement block-card here: the text you return is what the model reads.
        throw new UnsupportedOperationException("block-card is not implemented yet");
    }
}
