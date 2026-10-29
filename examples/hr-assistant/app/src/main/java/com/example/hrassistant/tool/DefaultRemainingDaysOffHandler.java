package com.example.hrassistant.tool;

import com.example.hrassistant.generated.tool.RemainingDaysOffHandler;
import org.springframework.stereotype.Component;

@Component
class DefaultRemainingDaysOffHandler implements RemainingDaysOffHandler {

    private final DaysOff daysOff;

    DefaultRemainingDaysOffHandler(DaysOff daysOff) {
        this.daysOff = daysOff;
    }

    @Override
    public String remainingDaysOff() {
        return daysOff.remaining() + " days off left this year, out of " + DaysOff.PER_YEAR + ".";
    }
}
