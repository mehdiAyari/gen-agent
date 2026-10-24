// Managed by gen-agent: changes here are overwritten.
package com.example.vaultdesk.generated.privacy;

import ch.qos.logback.classic.spi.ILoggingEvent;
import org.springframework.boot.logging.logback.ExtendedWhitespaceThrowableProxyConverter;

/** The stack trace of a log line with its personal data masked: exception messages often quote their input. */
public class MaskedThrowableConverter extends ExtendedWhitespaceThrowableProxyConverter {

    @Override
    public String convert(ILoggingEvent event) {
        return PersonalDataPatterns.maskForLogs(super.convert(event));
    }
}
