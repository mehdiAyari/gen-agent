// Writes schema/agent.schema.json from the built Zod schema. Run with "pnpm schema".
import { writeFileSync } from 'node:fs';

import { agentJsonSchema } from '../dist/index.js';

writeFileSync(
  new URL('../schema/agent.schema.json', import.meta.url),
  `${JSON.stringify(agentJsonSchema(), null, 2)}\n`,
);
