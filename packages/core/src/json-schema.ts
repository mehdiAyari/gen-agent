import { z } from 'zod';

import { agentFileSchema } from './schema.js';

/** JSON Schema of `agent.yaml`, for editor validation and autocompletion. Generated from the Zod schema. */
export function agentJsonSchema(): Record<string, unknown> {
  return {
    title: 'gen-agent agent.yaml',
    ...z.toJSONSchema(agentFileSchema, { io: 'input', target: 'draft-2020-12' }),
  };
}
