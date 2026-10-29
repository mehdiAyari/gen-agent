package com.example.hrassistant.tool;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.hrassistant.generated.TestcontainersConfiguration;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.test.context.support.WithMockUser;

@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://issuer.example.org")
@Import(TestcontainersConfiguration.class)
@WithMockUser("alice")
class DaysOffTests {

    // Wednesday 14 October 2026.
    private static final Clock TODAY = Clock.fixed(Instant.parse("2026-10-14T09:00:00Z"), ZoneOffset.UTC);

    @Autowired
    JdbcClient jdbc;

    DaysOff daysOff;

    @BeforeEach
    void setUp() {
        jdbc.sql("DELETE FROM day_off").update();
        daysOff = new DaysOff(jdbc, TODAY);
    }

    @Test
    void booksAComingWorkingDay() {
        assertThat(daysOff.book("2026-10-16")).isEqualTo("Day off booked on 2026-10-16. Days off left this year: 24.");
        assertThat(daysOff.remaining()).isEqualTo(24);
    }

    @Test
    void booksADayOnlyOnce() {
        daysOff.book("2026-10-16");

        assertThat(daysOff.book("2026-10-16")).isEqualTo("2026-10-16 is already booked.");
        assertThat(daysOff.remaining()).isEqualTo(24);
    }

    @Test
    void refusesWeekendsPastDaysAndOtherYears() {
        assertThat(daysOff.book("2026-10-17")).isEqualTo("2026-10-17 is a saturday: it is already off.");
        assertThat(daysOff.book("2026-10-13")).contains("not in the future");
        assertThat(daysOff.book("2027-01-04")).isEqualTo("Only days of 2026 can be booked.");
        assertThat(daysOff.book("next friday")).isEqualTo("next friday is not a date: write it YYYY-MM-DD.");
        assertThat(daysOff.remaining()).isEqualTo(DaysOff.PER_YEAR);
    }

    @Test
    void refusesOnceTheYearIsUsedUp() {
        for (int day = 1; day <= DaysOff.PER_YEAR; day++) {
            jdbc.sql("INSERT INTO day_off (employee, day) VALUES ('alice', ?)")
                .param(LocalDate.of(2026, 1, 1).plusDays(day))
                .update();
        }

        assertThat(daysOff.book("2026-10-16")).isEqualTo("No day off left this year.");
    }

    @Test
    void keepsEachEmployeeApart() {
        jdbc.sql("INSERT INTO day_off (employee, day) VALUES ('bob', DATE '2026-10-16')").update();

        assertThat(daysOff.remaining()).isEqualTo(DaysOff.PER_YEAR);
        assertThat(daysOff.book("2026-10-16")).startsWith("Day off booked");
    }
}
