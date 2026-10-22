// Managed by gen-agent: changes here are overwritten. Implement the tool in DefaultBookLeaveHandler.
package com.example.hrassistant.generated.tool;

import java.util.Objects;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

/** Exposes {@code book-leave} to the model and delegates the work to {@link BookLeaveHandler}. */
@Component
public class BookLeaveTool {

    private final BookLeaveHandler handler;

    BookLeaveTool(BookLeaveHandler handler) {
        this.handler = handler;
    }

    @Tool(description = "Books a day off for the current employee")
    public String bookLeave(
        @ToolParam(description = "Day off, ISO-8601") String date,
        @ToolParam(required = false) Boolean halfDay
    ) {
        Objects.requireNonNull(date, "date is required");
        return handler.bookLeave(date, halfDay);
    }
}
