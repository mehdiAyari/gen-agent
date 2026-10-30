// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk.generated.privacy;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class PersonalDataPatternsTests {

    @ParameterizedTest
    @CsvSource(
        delimiter = '|',
        textBlock = """
        Write to ada@example.org today       | EMAIL | ada@example.org
        Pay to FR76 3000 6000 0112 3456 7890 189 | IBAN | FR76 3000 6000 0112 3456 7890 189
        My card is 4111 1111 1111 1111       | CARD  | 4111 1111 1111 1111
        Call 06 12 34 56 78 tonight          | PHONE | 06 12 34 56 78
        Call +33 6 12 34 56 78 tonight       | PHONE | +33 6 12 34 56 78
        Number 1 85 05 78 006 084 36         | SSN   | 1 85 05 78 006 084 36
        """
    )
    void findsPersonalData(String text, String kind, String value) {
        assertThat(PersonalDataPatterns.find(text))
            .singleElement()
            .satisfies(found -> {
                assertThat(found.kind()).isEqualTo(kind);
                assertThat(found.value()).isEqualTo(value);
            });
    }

    @ParameterizedTest
    @ValueSource(
        strings = {
            "Order 12345 was shipped",
            "Card 4111 1111 1111 1112 fails the Luhn check",
            "FR76 3000 6000 0112 3456 7890 188 has a wrong checksum",
            "Version 2026.10.19 is out",
        }
    )
    void leavesOrdinaryNumbersAlone(String text) {
        assertThat(PersonalDataPatterns.find(text)).isEmpty();
    }

    @Test
    void masksTheLogsWithTheKindOfEachValue() {
        assertThat(PersonalDataPatterns.maskForLogs("Mail ada@example.org or call 06 12 34 56 78")).isEqualTo(
            "Mail [EMAIL] or call [PHONE]"
        );
    }
}
