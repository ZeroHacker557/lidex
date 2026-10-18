import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// dev: server/src/paths.ts | prod: server/dist/index.js (bundle) — ikkalasi ham server/ ichida bir daraja pastda
export const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT_DIR = resolve(SERVER_DIR, '..');
export const WEB_DIST_DIR = join(ROOT_DIR, 'web', 'dist');
