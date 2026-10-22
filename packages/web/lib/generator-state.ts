import { defaultForm, formFromYaml, formToYaml, type AgentForm } from './agent-form';

/** The form and the YAML editor show the same agent: each edit on one side updates the other. */
export interface GeneratorState {
  form: AgentForm;
  yaml: string;
  /** Why the YAML being typed cannot be loaded; the form keeps its last valid version meanwhile. */
  yamlErrors: string[];
}

export type GeneratorAction = { type: 'form'; form: AgentForm } | { type: 'yaml'; text: string };

export function initialGeneratorState(): GeneratorState {
  const form = defaultForm();
  return { form, yaml: formToYaml(form), yamlErrors: [] };
}

export function generatorReducer(state: GeneratorState, action: GeneratorAction): GeneratorState {
  switch (action.type) {
    case 'form':
      return { form: action.form, yaml: formToYaml(action.form), yamlErrors: [] };
    case 'yaml': {
      const result = formFromYaml(action.text);
      return result.ok
        ? { form: result.form, yaml: action.text, yamlErrors: [] }
        : { form: state.form, yaml: action.text, yamlErrors: result.errors };
    }
  }
}

/** Shell commands that write this agent.yaml and generate the project with the CLI: the same files as the zip. */
export function cliCommand(yaml: string): string {
  return `cat > agent.yaml <<'AGENT_YAML'\n${yaml}AGENT_YAML\nnpx gen-agent generate --from agent.yaml\n`;
}
