// Kross-platforma test ishga tushirgich (Windows/Linux): NODE_ENV=test bilan server testlari
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['src/lib/parser.test.ts', 'src/db/memory.test.ts', 'src/services/flow.test.ts', 'src/services/weblogin.test.ts'];
const r = spawnSync(process.execPath, [join(root, 'node_modules/tsx/dist/cli.mjs'), '--test', ...files], {
  cwd: join(root, 'server'),
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'warn' },
});
process.exit(r.status ?? 1);
