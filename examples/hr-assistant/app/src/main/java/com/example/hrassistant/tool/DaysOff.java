package com.example.hrassistant.tool;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/** The days off of the signed-in employee: 25 a year, booked one working day at a time. */
@Component
class DaysOff {

    static final int PER_YEAR = 25;

    private final JdbcClient jdbc;
    private final Clock clock;

    @Autowired
    DaysOff(JdbcClient jdbc) {
        this(jdbc, Clock.systemDefaultZone());
    }

    /** With a fixed clock, for the tests. */
    DaysOff(JdbcClient jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    /** Days off left this year to the signed-in employee. */
    int remaining() {
        int year = LocalDate.now(clock).getYear();
        int booked = jdbc
            .sql("SELECT count(*) FROM day_off WHERE employee = ? AND EXTRACT(YEAR FROM day) = ?")
            .params(employee(), year)
            .query(Integer.class)
            .single();
        return PER_YEAR - booked;
    }

    /** Books the day for the signed-in employee, or says why it cannot be booked. */
    String book(String date) {
        LocalDate day;
        try {
            day = LocalDate.parse(date);
        } catch (DateTimeParseException e) {
            return date + " is not a date: write it YYYY-MM-DD.";
        }
        LocalDate today = LocalDate.now(clock);
        if (!day.isAfter(today)) return day + " is not in the future: only coming days can be booked.";
        if (day.getYear() != today.getYear()) return "Only days of " + today.getYear() + " can be booked.";
        if (day.getDayOfWeek() == DayOfWeek.SATURDAY || day.getDayOfWeek() == DayOfWeek.SUNDAY) {
            return day + " is a " + day.getDayOfWeek().toString().toLowerCase() + ": it is already off.";
        }
        if (remaining() <= 0) return "No day off left this year.";
        int added = jdbc
            .sql("INSERT INTO day_off (employee, day) VALUES (?, ?) ON CONFLICT DO NOTHING")
            .params(employee(), day)
            .update();
        if (added == 0) return day + " is already booked.";
        return "Day off booked on " + day + ". Days off left this year: " + remaining() + ".";
    }

    /** The subject of the token the request was signed in with. */
    private static String employee() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }
}
