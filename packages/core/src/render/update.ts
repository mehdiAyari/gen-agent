import { sha256 } from './hash.js';
import type { FileOwner, GeneratedFile } from './render.js';

/** The `files` of .gen-agent.json: who owns each file and the fingerprint of what gen-agent last wrote. */
export interface Manifest {
  files: Record<string, { owner: FileOwner; sha256: string }>;
}

export type UpdateAction =
  | { kind: 'write'; path: string; content: string; reason: 'new' | 'generated' | 'unchanged' }
  /** A generated file edited by hand anyway: rewritten, the hand-made version kept at `backupPath`. */
  | { kind: 'write'; path: string; content: string; reason: 'edited'; backupPath: string }
  /** `stale`: no longer generated, but changed by the user: theirs to delete or adapt. */
  | { kind: 'keep'; path: string; reason: 'user' | 'identical' | 'stale' }
  /** A shared file changed by its owner: the new version goes next to it, for them to merge. */
  | { kind: 'side'; path: string; sidePath: string; content: string }
  /** Generated before, no longer generated, and left as gen-agent wrote it, whoever owns it. */
  | { kind: 'delete'; path: string };

/**
 * What to do with each file when a project is generated again (docs/adr/0001): generated files are rewritten, user
 * files are never touched once they exist, and shared files are rewritten only when unchanged since gen-agent wrote
 * them; otherwise the new version is written next to them as `<file>.gen-agent-new`. A generated file edited by hand
 * is rewritten too, its hand-made version kept as `<file>.gen-agent-old`. What is no longer generated is deleted when
 * still as gen-agent wrote it, whoever owns it, and reported otherwise.
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
      const edited =
        previous.files[file.path] !== undefined && previous.files[file.path]?.sha256 !== (await sha256(onDisk));
      actions.push(
        edited
          ? {
              kind: 'write',
              path: file.path,
              content: file.content,
              reason: 'edited',
              backupPath: `${file.path}.gen-agent-old`,
            }
          : { kind: 'write', path: file.path, content: file.content, reason: 'generated' },
      );
    } else if (file.owner === 'user') {
      actions.push({ kind: 'keep', path: file.path, reason: 'user' });
    } else if (previous.files[file.path]?.sha256 === (await sha256(onDisk))) {
      actions.push({ kind: 'write', path: file.path, content: file.content, reason: 'unchanged' });
    } else {
      actions.push({ kind: 'side', path: file.path, sidePath: `${file.path}.gen-agent-new`, content: file.content });
    }
  }
  // What the previous generation wrote and this one does not: a tool removed from agent.yaml, a feature turned off.
  const generated = new Set(files.map((file) => file.path));
  for (const [path, { sha256: fingerprint }] of Object.entries(previous.files)) {
    const onDisk = current(path);
    if (generated.has(path) || onDisk === undefined) continue;
    actions.push(
      fingerprint === (await sha256(onDisk)) ? { kind: 'delete', path } : { kind: 'keep', path, reason: 'stale' },
    );
  }
  return actions;
}
