package com.example.hrassistant.tool;

import com.example.hrassistant.generated.tool.BookLeaveHandler;
import org.springframework.stereotype.Component;

@Component
class DefaultBookLeaveHandler implements BookLeaveHandler {

    @Override
    public String bookLeave(String date, Boolean halfDay) {
        // Implement book-leave here: the text you return is what the model reads.
        throw new UnsupportedOperationException("book-leave is not implemented yet");
    }
}
