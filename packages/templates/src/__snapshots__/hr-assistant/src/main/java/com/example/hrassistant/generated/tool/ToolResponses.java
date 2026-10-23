// Managed by gen-agent: changes here are overwritten.
package com.example.hrassistant.generated.tool;

/** What HTTP tools send back to the model. */
final class ToolResponses {

    private ToolResponses() {}

    /** The response body, cut to {@code maxChars} so that a large answer does not fill the model's context. */
    static String limit(String body, int maxChars) {
        if (body == null || body.isEmpty()) {
            return "The API returned an empty response.";
        }
        if (body.length() <= maxChars) {
            return body;
        }
        return body.substring(0, maxChars) + "\n[Truncated: " + (body.length() - maxChars) + " more characters.]";
    }
}
