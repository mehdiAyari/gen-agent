import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const examples = join(repository, 'examples');
const cli = join(repository, 'packages/cli/dist/bin.js');
const output = fileURLToPath(new URL('../output/examples/', import.meta.url));

/** Every file under the directory, relative to it. */
function allFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(directory, join(entry.parentPath, entry.name)));
}

/** The files of a committed project as git sees them, build output left out. */
function filesOf(directory: string): string[] {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '.'], {
    cwd: directory,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
}

const names = readdirSync(examples, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(examples, entry.name, 'make.sh')))
  .map((entry) => entry.name);

describe.each(names)('example %s', (name) => {
  const app = join(examples, name, 'app');

  it('is what its make.sh generates, plus the files written by hand', () => {
    const fresh = join(mkdtempSync(join(tmpdir(), `gen-agent-${name}-`)), 'app');
    // Offline: the specs come from the copy kept in the project, as make.sh saved them.
    execFileSync(join(examples, name, 'make.sh'), [fresh], {
      cwd: join(examples, name),
      env: { ...process.env, GEN_AGENT: `node ${cli}`, SPECS: join(app, 'specs') },
      stdio: 'pipe',
    });

    const owners = (
      JSON.parse(readFileSync(join(fresh, '.gen-agent.json'), 'utf8')) as { files: Record<string, { owner: string }> }
    ).files;
    const committed = filesOf(app);
    const generated = allFiles(fresh);
    // Files added by hand are the user's own: gen-agent knows nothing of them.
    expect(generated.filter((file) => !committed.includes(file))).toEqual([]);
    // Only user-owned files may differ: gen-agent update would leave them as they are.
    const changed = generated.filter((file) => !readFileSync(join(app, file)).equals(readFileSync(join(fresh, file))));
    for (const file of changed) expect(owners[file]?.owner, relative(examples, join(app, file))).toBe('user');
  });

  it('passes its build with the code written by hand', () => {
    const project = join(output, name);
    rmSync(project, { recursive: true, force: true });
    cpSync(app, project, { recursive: true, filter: (source) => !source.includes('/target') });
    const gradle = existsSync(join(project, 'gradlew'));
    execFileSync(
      join(project, gradle ? 'gradlew' : 'mvnw'),
      gradle ? ['--no-daemon', 'build'] : ['--batch-mode', '--no-transfer-progress', 'verify'],
      { cwd: project, stdio: 'pipe', encoding: 'utf8' },
    );
  });
});
