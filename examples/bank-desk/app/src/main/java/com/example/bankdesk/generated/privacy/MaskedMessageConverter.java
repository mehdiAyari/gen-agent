// Managed by gen-agent: changes here are overwritten.
package com.example.bankdesk.generated.privacy;

import ch.qos.logback.classic.pattern.MessageConverter;
import ch.qos.logback.classic.spi.ILoggingEvent;

/** The message of a log line with its personal data masked: see logback-spring.xml. */
public class MaskedMessageConverter extends MessageConverter {

    @Override
    public String convert(ILoggingEvent event) {
        return PersonalDataPatterns.maskForLogs(super.convert(event));
    }
}
