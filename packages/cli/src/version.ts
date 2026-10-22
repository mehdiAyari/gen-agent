import { readFileSync } from 'node:fs';

/** Version of the gen-agent CLI, recorded in the .gen-agent.json of every generated project. */
export const VERSION = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
).version;
