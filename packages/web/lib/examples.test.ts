import { unsupportedFeatures, validateAgentYaml } from '@gen-agent/core';
import { describe, expect, it } from 'vitest';

import { formFromYaml } from './agent-form';
import { EXAMPLES, exampleById } from './examples';

describe.each(EXAMPLES)('example $id', ({ id, yaml }) => {
  it('is a valid agent the generator supports, warned only about side effects', () => {
    const result = validateAgentYaml(yaml);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));

    // POST and DELETE tools without human approval are warned about; the examples keep them simple.
    for (const warning of result.warnings) expect(warning.message).toMatch(/has side effects/);
    expect(unsupportedFeatures(result.config)).toEqual([]);
    expect(result.config.agent.name).toBe(id);
  });

  it('opens in the form', () => {
    expect(formFromYaml(yaml).ok).toBe(true);
  });
});

it('finds an example by id, and nothing for an unknown one', () => {
  expect(exampleById('weather-agent')?.id).toBe('weather-agent');
  expect(exampleById('nope')).toBeUndefined();
  expect(exampleById(null)).toBeUndefined();
});
