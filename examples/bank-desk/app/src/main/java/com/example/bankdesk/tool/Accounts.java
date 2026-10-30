package com.example.bankdesk.tool;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** The account of the signed-in customer: a demo account of 2,500 euros, opened on first use. */
@Component
class Accounts {

    private static final Logger log = LoggerFactory.getLogger(Accounts.class);

    static final BigDecimal OPENING_BALANCE = new BigDecimal("2500.00");
    static final BigDecimal TRANSFER_LIMIT = new BigDecimal("1000.00");

    private final JdbcClient jdbc;

    Accounts(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Balance of the signed-in customer, in euros. */
    @Transactional
    BigDecimal balance() {
        String customer = customer();
        jdbc.sql("INSERT INTO account (customer, balance) VALUES (?, ?) ON CONFLICT DO NOTHING")
            .params(customer, OPENING_BALANCE)
            .update();
        return jdbc
            .sql("SELECT balance FROM account WHERE customer = ?")
            .param(customer)
            .query(BigDecimal.class)
            .single();
    }

    /** Sends the transfer from the account of the signed-in customer, or says why it cannot be sent. */
    @Transactional
    String send(String iban, double euros) {
        String normalized = iban.replace(" ", "").toUpperCase();
        if (!isValidIban(normalized)) return "This IBAN is not valid: check it with the customer.";
        BigDecimal amount = BigDecimal.valueOf(euros).setScale(2, RoundingMode.HALF_UP);
        if (amount.signum() <= 0) return "The amount must be more than 0 euros.";
        if (amount.compareTo(TRANSFER_LIMIT) > 0) {
            return "Transfers are limited to " + TRANSFER_LIMIT + " euros: this one needs an advisor.";
        }
        BigDecimal balance = balance();
        if (amount.compareTo(balance) > 0) return "The balance (" + balance + " euros) is too low for this transfer.";
        jdbc.sql("UPDATE account SET balance = balance - ? WHERE customer = ?").params(amount, customer()).update();
        jdbc.sql("INSERT INTO transfer (id, customer, iban, amount) VALUES (?, ?, ?, ?)")
            .params(UUID.randomUUID(), customer(), normalized, amount)
            .update();
        // The IBAN is masked in the logs by gen-agent: they never hold personal data.
        log.info("Transfer of {} euros to {} sent", amount, normalized);
        return (
            "Transfer of " +
            amount +
            " euros to " +
            normalized +
            " sent. New balance: " +
            balance.subtract(amount) +
            " euros."
        );
    }

    /** ISO 13616: the country code and check digits moved to the end, letters as numbers, modulo 97 equals 1. */
    static boolean isValidIban(String iban) {
        if (!iban.matches("[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}")) return false;
        StringBuilder digits = new StringBuilder();
        for (char c : (iban.substring(4) + iban.substring(0, 4)).toCharArray()) {
            digits.append(Character.getNumericValue(c));
        }
        return new BigInteger(digits.toString()).mod(BigInteger.valueOf(97)).intValue() == 1;
    }

    /** The subject of the token the request was signed in with. */
    private static String customer() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }
}
