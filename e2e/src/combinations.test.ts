import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import { buildModel, unsupportedFeatures, validateAgentYaml, type AgentFile } from '@gen-agent/core';
import { generateProject } from '@gen-agent/templates';

import { arbitraryAgent } from '../../packages/templates/src/testing/arbitrary-agent.js';

const output = fileURLToPath(new URL('../output/combinations/', import.meta.url));

/** What a project is made of, as name=value: two projects that share none of them exercise different code. */
function traitsOf(config: AgentFile): string[] {
  const model = buildModel(config);
  return [
    `build=${model.build.tool}`,
    `provider=${config.agent.model.provider}`,
    ...Object.entries(model.features).map(([name, on]) => `${name}=${String(on)}`),
    `tools=${String(Math.min(config.agent.tools.length, 2))}`,
  ];
}

/**
 * Agents drawn at random with a fixed seed, then chosen greedily so that together they hold as many pairs of traits
 * as possible: a bug that needs two options together shows up in one of them.
 */
function pairwiseSample(size: number): AgentFile[] {
  const candidates = fc
    .sample(arbitraryAgent, { numRuns: 1500, seed: Number(process.env.COMBINATIONS_SEED ?? 1030) })
    .map((agent) => validateAgentYaml(stringify(agent)))
    .flatMap((result) => (result.ok && unsupportedFeatures(result.config).length === 0 ? [result.config] : []));
  const pairsOf = (config: AgentFile): string[] => {
    const traits = traitsOf(config);
    return traits.flatMap((first, index) => traits.slice(index + 1).map((second) => `${first}&${second}`));
  };
  const covered = new Set<string>();
  const chosen: AgentFile[] = [];
  while (chosen.length < size) {
    let best: AgentFile | undefined;
    let gain = 0;
    for (const candidate of candidates) {
      const fresh = pairsOf(candidate).filter((pair) => !covered.has(pair)).length;
      if (fresh > gain) [best, gain] = [candidate, fresh];
    }
    if (best === undefined) break;
    chosen.push(best);
    for (const pair of pairsOf(best)) covered.add(pair);
  }
  return chosen;
}

const sample = pairwiseSample(Number(process.env.COMBINATIONS ?? 16));

describe.each(sample.map((config, index) => [index, config] as const))('combination %i', (index, config) => {
  // Every project compiles with its tests; a few run them too (they start Postgres and Redis in Docker).
  const goal = index % 5 === 0 ? 'verify' : 'test-compile';

  it(`passes ${goal}`, async () => {
    const project = join(output, String(index));
    rmSync(project, { recursive: true, force: true });
    for (const file of await generateProject(config, '0.0.0-e2e')) {
      mkdirSync(dirname(join(project, file.path)), { recursive: true });
      const bytes = file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content;
      writeFileSync(join(project, file.path), bytes, file.executable === true ? { mode: 0o755 } : {});
    }
    writeFileSync(join(project, 'agent.yaml'), stringify(config));
    const gradle = config.agent.build === 'gradle';
    const build = spawnSync(
      join(project, gradle ? 'gradlew' : 'mvnw'),
      gradle
        ? ['--no-daemon', '--quiet', goal === 'verify' ? 'build' : 'testClasses']
        : ['--batch-mode', '--no-transfer-progress', '--quiet', goal],
      { cwd: project, encoding: 'utf8' },
    );
    const log = `${build.stdout}${build.stderr}`;
    if (build.status !== 0) throw new Error(`${project}/agent.yaml:\n${stringify(config)}\n${log}`);
    // Generated code calls no API that is deprecated, nor one about to be removed.
    expect(log.split('\n').filter((line) => /deprecat|\[removal\]/i.test(line))).toEqual([]);
  });
});
