import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const api = require('../data/local-ai/integration/node_modules/@actual-app/api');
const dataDir = path.join(root, 'data/local-ai/backup-cache');
const backups = path.join(root, 'data/local-ai/backups');
await mkdir(dataDir, { recursive: true, mode: 0o700 });
await mkdir(backups, { recursive: true, mode: 0o700 });
await api.init({
  dataDir,
  serverURL: process.env.ACTUAL_SERVER_URL,
  password: process.env.ACTUAL_PASSWORD,
});
try {
  await api.downloadBudget(process.env.ACTUAL_BUDGET_ID);
  const buffer = await api.exportBudget();
  const file = path.join(
    backups,
    `before-categorization-${new Date().toISOString().replaceAll(':', '-')}.zip`,
  );
  await writeFile(file, buffer, { mode: 0o600, flag: 'wx' });
  console.log('Pre-categorization budget backup saved.');
} finally {
  await api.shutdown();
}
