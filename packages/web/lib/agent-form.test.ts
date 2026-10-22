import { validateAgentYaml } from '@gen-agent/core';
import { describe, expect, it } from 'vitest';

import { defaultForm, formFromYaml, formToYaml, validateForm, type AgentForm } from './agent-form';

const currentWeather: AgentForm['tools'][number] = {
  name: 'current-weather',
  type: 'http',
  description: 'Current temperature at a location',
  method: 'GET',
  url: 'https://api.open-meteo.com/v1/forecast',
  params: [{ name: 'latitude', type: 'number', required: true, description: 'Latitude' }],
};

const weather: AgentForm = {
  ...defaultForm(),
  name: 'weather-agent',
  description: 'Tells the current weather',
  provider: 'ollama',
  model: 'qwen2.5:3b',
  temperature: '0',
  tools: [currentWeather],
};

describe('formToYaml', () => {
  it('writes only what the user chose: defaults stay implicit, like a hand-written file', () => {
    expect(formToYaml(defaultForm())).toBe(`agent:
  name: my-agent
  model:
    provider: mistral
    name: mistral-small-latest
`);
  });

  it('writes a complete agent that core validates', () => {
    const yaml = formToYaml(weather);

    expect(yaml).toContain('temperature: 0');
    expect(validateAgentYaml(yaml)).toMatchObject({ ok: true, warnings: [] });
  });
});

describe('formFromYaml', () => {
  it('reads back what formToYaml wrote', () => {
    expect(formFromYaml(formToYaml(weather))).toEqual({ ok: true, form: weather });
  });

  it('explains what the web generator cannot handle yet', () => {
    const result = formFromYaml(
      'agent:\n  name: big\n  profile: production\n  model: { provider: mistral, name: m }\n',
    );

    expect(result).toEqual({
      ok: false,
      errors: ['agent.profile: "production" arrives in V5 (V1 generates the minimal profile)'],
    });
  });

  it('reports invalid files with their line', () => {
    const result = formFromYaml('agent:\n  name: Bad Name\n  model: { provider: mistral, name: m }\n');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/^line 2: agent.name: /);
  });
});

describe('validateForm', () => {
  it('maps core errors to form fields', () => {
    const errors = validateForm({ ...weather, temperature: '5', tools: [{ ...currentWeather, url: 'not a url' }] });

    expect(Object.keys(errors.errors)).toEqual(['temperature', 'tools.0.url']);
  });

  it('keeps warnings apart from errors', () => {
    const errors = validateForm({ ...weather, tools: [{ ...currentWeather, method: 'POST' }] });

    expect(errors.errors).toEqual({});
    expect(errors.warnings).toEqual([expect.stringMatching(/POST has side effects/)]);
  });

  it('rejects a number that is not a number', () => {
    expect(Object.keys(validateForm({ ...weather, temperature: 'warm' }).errors)).toEqual(['temperature']);
  });
});
