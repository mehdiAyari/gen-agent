// Serves the static export of packages/web, as any static host would: /en/generator/ → en/generator/index.html.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../packages/web/out/', import.meta.url));
const port = Number(process.env.PORT ?? 4322);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

function fileFor(url) {
  const path = join(root, normalize(decodeURIComponent(new URL(url, 'http://localhost').pathname)));
  if (!path.startsWith(root)) return undefined;
  for (const candidate of [path, join(path, 'index.html')]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // Not there: try the next candidate.
    }
  }
  return undefined;
}

createServer((request, response) => {
  const file = fileFor(request.url ?? '/');
  if (file === undefined) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
}).listen(port, () => {
  console.log(`Serving ${root} on http://localhost:${String(port)}`);
});
