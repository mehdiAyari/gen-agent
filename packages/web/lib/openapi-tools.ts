import type { ImportedTool } from '@gen-agent/openapi';

import { emptyTool, type AgentForm } from './agent-form';

type ToolForm = AgentForm['tools'][number];

/** An imported tool as the form edits it. */
export function toolFormOf(tool: ImportedTool): ToolForm {
  return {
    ...emptyTool(),
    name: tool.name,
    description: tool.description ?? '',
    method: tool.method ?? 'GET',
    url: tool.url,
    auth:
      tool.auth === undefined
        ? { type: 'none', env: '', header: '' }
        : tool.auth.type === 'bearer'
          ? { type: 'bearer', env: tool.auth.env, header: '' }
          : { type: 'header', env: tool.auth.env, header: tool.auth.name },
    params: (tool.params ?? []).map((param) => ({
      name: param.name,
      type: param.type,
      required: param.required === true,
      description: param.description ?? '',
      in: param.in ?? 'auto',
      apiName: param.apiName ?? '',
    })),
  };
}

/** The form with the imported tools after its own; a name already taken gets a suffix, reported in `renamed`. */
export function addImportedTools(
  form: AgentForm,
  tools: ImportedTool[],
): { form: AgentForm; renamed: { from: string; to: string }[] } {
  const taken = new Set(form.tools.map((tool) => tool.name));
  const renamed: { from: string; to: string }[] = [];
  const added = tools.map((tool) => {
    let name = tool.name;
    for (let suffix = 2; taken.has(name); suffix++) name = `${tool.name}-${String(suffix)}`;
    if (name !== tool.name) renamed.push({ from: tool.name, to: name });
    taken.add(name);
    return { ...toolFormOf(tool), name };
  });
  return { form: { ...form, tools: [...form.tools, ...added] }, renamed };
}
