package com.example.hrassistant.tool;

import com.example.hrassistant.generated.tool.BookDayOffHandler;
import org.springframework.stereotype.Component;

/** Runs once the employee approved the call in the chat page: the model alone never books a day. */
@Component
class DefaultBookDayOffHandler implements BookDayOffHandler {

    private final DaysOff daysOff;

    DefaultBookDayOffHandler(DaysOff daysOff) {
        this.daysOff = daysOff;
    }

    @Override
    public String bookDayOff(String date) {
        return daysOff.book(date);
    }
}
