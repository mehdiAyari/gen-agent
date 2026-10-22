// Managed by gen-agent: changes here are overwritten. Implement it in DefaultBookLeaveHandler.
package com.example.hrassistant.generated.tool;

/**
 * Business logic of the {@code book-leave} tool; the returned text is sent back to the model.
 * Required arguments are checked before this method is called; optional ones may be {@code null}.
 */
public interface BookLeaveHandler {
    String bookLeave(String date, Boolean halfDay);
}
