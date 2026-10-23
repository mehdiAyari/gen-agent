import { validateAgentYaml } from '@gen-agent/core';
import { describe, expect, it } from 'vitest';

import { defaultForm, emptyTool, formToYaml } from './agent-form';
import { addImportedTools, toolFormOf } from './openapi-tools';

const imported = {
  name: 'add-note',
  type: 'http' as const,
  description: 'Adds a note to an order',
  method: 'POST' as const,
  url: 'https://shop.example.org/orders/{orderId}/notes',
  auth: { type: 'header' as const, name: 'X-API-Key', env: 'SHOP_API_KEY' },
  params: [
    { name: 'orderId', type: 'string' as const, required: true as const },
    {
      name: 'noteText',
      apiName: 'note_text',
      type: 'string' as const,
      required: true as const,
      description: 'The note',
    },
    { name: 'notify', type: 'boolean' as const, in: 'query' as const },
  ],
};

describe('toolFormOf', () => {
  it('turns an imported tool into the form, every field kept', () => {
    expect(toolFormOf(imported)).toEqual({
      ...emptyTool(),
      name: 'add-note',
      description: 'Adds a note to an order',
      method: 'POST',
      url: 'https://shop.example.org/orders/{orderId}/notes',
      auth: { type: 'header', header: 'X-API-Key', env: 'SHOP_API_KEY' },
      params: [
        { name: 'orderId', type: 'string', required: true, description: '', in: 'auto', apiName: '' },
        { name: 'noteText', type: 'string', required: true, description: 'The note', in: 'auto', apiName: 'note_text' },
        { name: 'notify', type: 'boolean', required: false, description: '', in: 'query', apiName: '' },
      ],
    });
  });
});

describe('addImportedTools', () => {
  it('adds the tools after the existing ones, renaming those whose name is taken', () => {
    const form = { ...defaultForm(), tools: [{ ...emptyTool(), name: 'add-note', type: 'java' as const }] };

    const { form: updated, renamed } = addImportedTools(form, [imported]);

    expect(updated.tools.map((tool) => tool.name)).toEqual(['add-note', 'add-note-2']);
    expect(renamed).toEqual([{ from: 'add-note', to: 'add-note-2' }]);
    expect(validateAgentYaml(formToYaml(updated)).ok).toBe(true);
  });
});
