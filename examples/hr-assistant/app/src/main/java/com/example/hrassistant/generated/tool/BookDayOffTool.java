// Managed by gen-agent: changes here are overwritten. Implement the tool in DefaultBookDayOffHandler.
package com.example.hrassistant.generated.tool;

import java.util.Objects;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

/** Exposes {@code book-day-off} to the model and delegates the work to {@link BookDayOffHandler}. */
@Component
public class BookDayOffTool {

    private final BookDayOffHandler handler;

    BookDayOffTool(BookDayOffHandler handler) {
        this.handler = handler;
    }

    @Tool(description = "Books a day off for the signed-in employee, on a date written YYYY-MM-DD")
    public String bookDayOff(String date) {
        Objects.requireNonNull(date, "date is required");
        return handler.bookDayOff(date);
    }
}
