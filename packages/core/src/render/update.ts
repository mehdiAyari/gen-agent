import { sha256 } from './hash.js';
import type { FileOwner, GeneratedFile } from './render.js';

/** The `files` of .gen-agent.json: who owns each file and the fingerprint of what gen-agent last wrote. */
export interface Manifest {
  files: Record<string, { owner: FileOwner; sha256: string }>;
}

export type UpdateAction =
  | { kind: 'write'; path: string; content: string; reason: 'new' | 'generated' | 'unchanged' }
  | { kind: 'keep'; path: string; reason: 'user' | 'identical' }
  /** A shared file changed by its owner: the new version goes next to it, for them to merge. */
  | { kind: 'side'; path: string; sidePath: string; content: string };

/**
 * What to do with each file when a project is generated again (docs/adr/0001): generated files are rewritten, user
 * files are never touched once they exist, and shared files are rewritten only when unchanged since gen-agent wrote
 * them; otherwise the new version is written next to them as `<file>.gen-agent-new`.
 */
export async function planUpdate(
  files: GeneratedFile[],
  previous: Manifest,
  current: (path: string) => string | undefined,
): Promise<UpdateAction[]> {
  const actions: UpdateAction[] = [];
  for (const file of files) {
    const onDisk = current(file.path);
    if (onDisk === undefined) {
      actions.push({ kind: 'write', path: file.path, content: file.content, reason: 'new' });
    } else if (onDisk === file.content) {
      actions.push({ kind: 'keep', path: file.path, reason: 'identical' });
    } else if (file.owner === 'generated') {
      actions.push({ kind: 'write', path: file.path, content: file.content, reason: 'generated' });
    } else if (file.owner === 'user') {
      actions.push({ kind: 'keep', path: file.path, reason: 'user' });
    } else if (previous.files[file.path]?.sha256 === (await sha256(onDisk))) {
      actions.push({ kind: 'write', path: file.path, content: file.content, reason: 'unchanged' });
    } else {
      actions.push({ kind: 'side', path: file.path, sidePath: `${file.path}.gen-agent-new`, content: file.content });
    }
  }
  return actions;
}
