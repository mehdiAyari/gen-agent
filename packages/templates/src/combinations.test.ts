import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import { unsupportedFeatures, validateAgentYaml, type AgentFile } from '@gen-agent/core';

import { generateProject } from './index.js';
import { arbitraryAgent } from './testing/arbitrary-agent.js';
import { problemsOf } from './testing/project-checks.js';

/** The agent, when core accepts it and this version generates all of it. */
function accepted(agent: object): AgentFile | undefined {
  const result = validateAgentYaml(stringify(agent));
  return result.ok && unsupportedFeatures(result.config).length === 0 ? result.config : undefined;
}

describe('any combination of options', () => {
  it('generates a consistent project', async () => {
    let tried = 0;
    await fc.assert(
      fc.asyncProperty(arbitraryAgent, async (agent) => {
        const config = accepted(agent);
        fc.pre(config !== undefined);
        tried++;
        const files = await generateProject(config, '0.0.0-test');
        expect(problemsOf(files), stringify(agent)).toEqual([]);
      }),
      { numRuns: 150, seed: Number(process.env.FC_SEED ?? Date.now() % 2 ** 31) },
    );
    expect(tried).toBeGreaterThan(50);
  }, 600_000);

  it('generates the same files every time', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryAgent, async (agent) => {
        const config = accepted(agent);
        fc.pre(config !== undefined);
        const [first, second] = await Promise.all([generateProject(config, 'v'), generateProject(config, 'v')]);
        expect(second).toEqual(first);
      }),
      { numRuns: 20 },
    );
  }, 600_000);
});
