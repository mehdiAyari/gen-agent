package com.example.bankdesk.tool;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.bankdesk.generated.TestcontainersConfiguration;
import java.math.BigDecimal;
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
class AccountsTests {

    // A valid IBAN of the ECBS examples.
    private static final String IBAN = "DE89 3704 0044 0532 0130 00";

    @Autowired
    JdbcClient jdbc;

    @Autowired
    Accounts accounts;

    @BeforeEach
    void setUp() {
        jdbc.sql("DELETE FROM transfer").update();
        jdbc.sql("DELETE FROM account").update();
    }

    @Test
    void opensTheAccountOnFirstUse() {
        assertThat(accounts.balance()).isEqualByComparingTo("2500.00");
    }

    @Test
    void sendsATransferAndKeepsIt() {
        assertThat(accounts.send(IBAN, 120.5)).isEqualTo(
            "Transfer of 120.50 euros to DE89370400440532013000 sent. New balance: 2379.50 euros."
        );
        assertThat(accounts.balance()).isEqualByComparingTo("2379.50");
        assertThat(jdbc.sql("SELECT iban FROM transfer").query(String.class).single()).isEqualTo(
            "DE89370400440532013000"
        );
    }

    @Test
    void refusesAnInvalidIbanAnAmountAboveTheLimitOrTheBalance() {
        assertThat(accounts.send("DE89 3704 0044 0532 0130 01", 10)).startsWith("This IBAN is not valid");
        assertThat(accounts.send(IBAN, 1500)).startsWith("Transfers are limited to 1000.00 euros");
        assertThat(accounts.send(IBAN, -5)).isEqualTo("The amount must be more than 0 euros.");
        for (int i = 0; i < 2; i++) accounts.send(IBAN, 1000);
        assertThat(accounts.send(IBAN, 600)).isEqualTo("The balance (500.00 euros) is too low for this transfer.");
        assertThat(accounts.balance()).isEqualByComparingTo(new BigDecimal("500.00"));
    }

    @Test
    void checksIbansWithTheirCheckDigits() {
        assertThat(Accounts.isValidIban("FR7630006000011234567890189")).isTrue();
        assertThat(Accounts.isValidIban("FR7630006000011234567890188")).isFalse();
        assertThat(Accounts.isValidIban("hello")).isFalse();
    }
}
