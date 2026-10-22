import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { agentJsonSchema } from './json-schema.js';

describe('agentJsonSchema', () => {
  it('matches the committed schema/agent.schema.json (run "pnpm schema" after changing the Zod schema)', () => {
    const committed: unknown = JSON.parse(
      readFileSync(new URL('../schema/agent.schema.json', import.meta.url), 'utf8'),
    );

    expect(committed).toEqual(agentJsonSchema());
  });

  it('describes the input file: defaulted fields are optional, unknown keys are refused', () => {
    const schema = agentJsonSchema() as {
      properties: { agent: { required: string[]; additionalProperties: boolean } };
    };

    expect(schema.properties.agent.required).toEqual(['name', 'model']);
    expect(schema.properties.agent.additionalProperties).toBe(false);
  });
});
