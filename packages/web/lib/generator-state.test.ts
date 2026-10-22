import { describe, expect, it } from 'vitest';

import { defaultForm, formToYaml } from './agent-form';
import { cliCommand, generatorReducer, initialGeneratorState } from './generator-state';

describe('generatorReducer', () => {
  it('starts from the default form and its YAML', () => {
    expect(initialGeneratorState()).toEqual({ form: defaultForm(), yaml: formToYaml(defaultForm()), yamlErrors: [] });
  });

  it('rewrites the YAML when the form changes', () => {
    const form = { ...defaultForm(), name: 'support-bot' };

    expect(generatorReducer(initialGeneratorState(), { type: 'form', form })).toEqual({
      form,
      yaml: formToYaml(form),
      yamlErrors: [],
    });
  });

  it('loads valid YAML into the form and keeps the text as typed', () => {
    const text = 'agent:\n  name: typed   # a comment\n  model: { provider: ollama, name: llama3.1 }\n';
    const state = generatorReducer(initialGeneratorState(), { type: 'yaml', text });

    expect(state.yaml).toBe(text);
    expect(state.form).toMatchObject({ name: 'typed', provider: 'ollama', model: 'llama3.1' });
    expect(state.yamlErrors).toEqual([]);
  });

  it('keeps the last valid form while the YAML is broken', () => {
    const start = initialGeneratorState();
    const state = generatorReducer(start, { type: 'yaml', text: 'agent:\n  name: Bad Name\n' });

    expect(state.form).toBe(start.form);
    expect(state.yamlErrors).not.toEqual([]);
  });
});

describe('cliCommand', () => {
  it('writes agent.yaml then generates the same project with the CLI', () => {
    expect(cliCommand('agent:\n  name: a\n')).toBe(
      "cat > agent.yaml <<'AGENT_YAML'\nagent:\n  name: a\nAGENT_YAML\nnpx gen-agent generate --from agent.yaml\n",
    );
  });
});
