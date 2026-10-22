/**
 * The agent being edited, kept for this tab only: survives a reload or a language switch, never leaves the browser.
 * Storage may be unavailable (private mode, blocked site data): the generator then simply starts from scratch.
 */
const KEY = 'gen-agent:draft';

export function readDraft(): string | undefined {
  try {
    return sessionStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function writeDraft(yaml: string): void {
  try {
    sessionStorage.setItem(KEY, yaml);
  } catch {
    // Not kept: nothing else depends on it.
  }
}
