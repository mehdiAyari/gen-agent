import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import type { GeneratedFile } from './render.js';
import { planUpdate, type Manifest } from './update.js';

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

/** What gen-agent wrote last time: the fingerprints of .gen-agent.json. */
const previous: Manifest = {
  files: {
    'Generated.java': { owner: 'generated', sha256: sha256('generated v1') },
    'README.md': { owner: 'merged', sha256: sha256('readme v1') },
    'pom.xml': { owner: 'merged', sha256: sha256('pom v1') },
    'Handler.java': { owner: 'user', sha256: sha256('handler v1') },
  },
};

const file = (path: string, owner: GeneratedFile['owner'], content: string): GeneratedFile => ({
  path,
  owner,
  content,
});

describe('planUpdate', () => {
  it('rewrites generated files, never touches user files, and rewrites shared files only when unchanged', async () => {
    const onDisk: Record<string, string> = {
      'Generated.java': 'generated v1, edited by hand anyway',
      'README.md': 'readme v1 with my notes',
      'pom.xml': 'pom v1',
      'Handler.java': 'my implementation',
    };

    const actions = await planUpdate(
      [
        file('Generated.java', 'generated', 'generated v2'),
        file('README.md', 'merged', 'readme v2'),
        file('pom.xml', 'merged', 'pom v2'),
        file('Handler.java', 'user', 'handler v2'),
        file('NewTool.java', 'generated', 'new tool'),
        file('NewHandler.java', 'user', 'new handler'),
      ],
      previous,
      (path) => onDisk[path],
    );

    expect(actions).toEqual([
      { kind: 'write', path: 'Generated.java', content: 'generated v2', reason: 'generated' },
      { kind: 'side', path: 'README.md', sidePath: 'README.md.gen-agent-new', content: 'readme v2' },
      { kind: 'write', path: 'pom.xml', content: 'pom v2', reason: 'unchanged' },
      { kind: 'keep', path: 'Handler.java', reason: 'user' },
      { kind: 'write', path: 'NewTool.java', content: 'new tool', reason: 'new' },
      { kind: 'write', path: 'NewHandler.java', content: 'new handler', reason: 'new' },
    ]);
  });

  it('leaves alone a file that is already up to date', async () => {
    const actions = await planUpdate([file('pom.xml', 'merged', 'pom v1')], previous, () => 'pom v1');

    expect(actions).toEqual([{ kind: 'keep', path: 'pom.xml', reason: 'identical' }]);
  });

  it('keeps a shared file it has no fingerprint for: it may hold changes', async () => {
    const actions = await planUpdate([file('compose.yaml', 'merged', 'v2')], { files: {} }, () => 'mine');

    expect(actions).toEqual([
      { kind: 'side', path: 'compose.yaml', sidePath: 'compose.yaml.gen-agent-new', content: 'v2' },
    ]);
  });
});
