// The published gen-agent package embeds core and templates (bundled by esbuild); the template files travel next to it.
import { cpSync, rmSync } from 'node:fs';

const target = new URL('../minimal/', import.meta.url);
rmSync(target, { recursive: true, force: true });
cpSync(new URL('../../templates/minimal/', import.meta.url), target, { recursive: true });
