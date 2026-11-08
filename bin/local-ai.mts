/** Local-only Actual AI launcher. No cloud provider or web-search configuration. */
import { spawn, spawnSync } from 'node:child_process';
import { chmod, mkdir, open, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const privateDir = path.join(root, 'data/local-ai');
const integration = path.join(privateDir, 'integration');
const endpoint = 'http://127.0.0.1:11435';
const model = 'qwen3:4b';
const mode = process.argv[2] ?? 'preview';
if (!['preview', 'apply'].includes(mode)) {
  throw new Error('Usage: node bin/local-ai.mts [preview|apply]');
}
process.umask(0o077);
await mkdir(path.join(privateDir, 'logs'), { recursive: true, mode: 0o700 });
await chmod(privateDir, 0o700);

// Only pass runtime essentials. Never inherit provider keys, feature flags or .env overrides.
const baseEnv: NodeJS.ProcessEnv = {};
for (const key of [
  'PATH',
  'HOME',
  'USERPROFILE',
  'SYSTEMROOT',
  'TEMP',
  'TMP',
  'TMPDIR',
]) {
  if (process.env[key]) baseEnv[key] = process.env[key];
}
const runtimeEnv = {
  ...baseEnv,
  OLLAMA_HOST: '127.0.0.1:11435',
  OLLAMA_NO_CLOUD: '1',
  OLLAMA_MODELS: path.join(privateDir, 'models'),
  OLLAMA_CONTEXT_LENGTH: '4096',
  OLLAMA_NUM_PARALLEL: '1',
};
async function healthy() {
  try {
    return (
      await fetch(`${endpoint}/api/version`, {
        signal: AbortSignal.timeout(1500),
      })
    ).ok;
  } catch {
    return false;
  }
}
if (!(await healthy())) {
  const executable =
    process.platform === 'darwin'
      ? path.join(privateDir, 'runtime/ollama')
      : 'ollama';
  const log = await open(path.join(privateDir, 'logs/ollama.log'), 'a', 0o600);
  const daemon = spawn(executable, ['serve'], {
    env: runtimeEnv,
    detached: true,
    stdio: ['ignore', log.fd, log.fd],
    windowsHide: true,
  });
  let launchError = false;
  daemon.once('error', () => {
    launchError = true;
  });
  daemon.unref();
  await log.close();
  for (let attempt = 0; attempt < 30 && !(await healthy()); attempt++) {
    if (launchError) {
      throw new Error('Ollama could not start. See LOCAL_AI.md.');
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!(await healthy())) {
    throw new Error('Local model server did not start. See its private log.');
  }
}
const modelResult = await fetch(`${endpoint}/api/show`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model }),
  signal: AbortSignal.timeout(5000),
});
if (!modelResult.ok) {
  throw new Error('Local model is missing. Follow LOCAL_AI.md to download it.');
}
const modelInfo = await modelResult.json();
if (modelInfo.remote_host || modelInfo.remote_model || !modelInfo.model_info) {
  throw new Error(
    'Refusing a remote/cloud model. A downloaded local model is required.',
  );
}
const { serverURL, password } = JSON.parse(
  await readFile(path.join(root, 'data/personal/access.json'), 'utf8'),
);
const url = new URL(serverURL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
  throw new Error(
    'This launcher requires Actual on the same machine. See migration instructions.',
  );
}
const budgets = JSON.parse(
  await readFile(path.join(root, 'data/personal/budgets.json'), 'utf8'),
);
const ids = [
  ...new Set(
    budgets
      .map((budget: { groupId?: string }) => budget.groupId)
      .filter(Boolean),
  ),
];
if (ids.length !== 1) {
  throw new Error('Expected one budget sync ID in data/personal/budgets.json.');
}
// Abort if the pinned upstream checkout is replaced with another version.
const revision = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: integration,
  encoding: 'utf8',
});
if (revision.stdout.trim() !== '577078abb0eb9edc965162a235886a231c83e70e') {
  throw new Error('Unexpected Actual AI revision. Run bin/install-local-ai.');
}
const prompt = await readFile(path.join(root, 'local-ai/prompt.hbs'), 'utf8');
const env: NodeJS.ProcessEnv = {
  ...baseEnv,
  ACTUAL_SERVER_URL: serverURL,
  ACTUAL_PASSWORD: password,
  ACTUAL_BUDGET_ID: String(ids[0]),
  LOCAL_AI_DATA_DIR: path.join(privateDir, 'budget-cache'),
  // Limit an initial preview; apply runs process all eligible transactions.
  LOCAL_AI_LIMIT: mode === 'preview' ? '25' : '0',
  NODE_EXTRA_CA_CERTS: path.join(root, 'data/tls/local-ca.crt'),
  LLM_PROVIDER: 'ollama',
  OLLAMA_BASE_URL: `${endpoint}/api`,
  OLLAMA_MODEL: model,
  OLLAMA_NO_CLOUD: '1',
  LLM_TIMEOUT_MS: '180000',
  LLM_TEMPERATURE: '0',
  FEATURES: JSON.stringify([
    'classifyOnStartup',
    'disableRateLimiter',
    ...(mode === 'preview' ? ['dryRun'] : []),
  ]),
  PROMPT_TEMPLATE: prompt,
  CLASSIFICATION_SCHEDULE_CRON: '',
  DOTENV_CONFIG_PATH: path.join(privateDir, 'unused.env'),
  NOT_GUESSED_TAG: '#local-ai-review',
  GUESSED_TAG: '#local-ai',
};
// dotenv must not be able to introduce a web-search key or cloud defaults.
try {
  await readFile(path.join(integration, '.env'));
  throw new Error(
    'Remove integration/.env; configuration comes from this local-only launcher.',
  );
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
    throw error;
  }
}
const logPath = path.join(
  privateDir,
  'logs',
  `${mode}-${new Date().toISOString().replaceAll(':', '-')}.log`,
);
const log = await open(logPath, 'wx', 0o600);
console.log(
  `Local categorization ${mode}: ${mode === 'preview' ? 'up to 25 transactions, no edits' : 'eligible uncategorized transactions; suggestions tagged #local-ai'}.`,
);
console.log(
  'Detailed results stay in the private local log. No cloud model or web search is enabled.',
);
if (mode === 'apply') {
  const backup = spawnSync(
    process.execPath,
    [path.join(root, 'local-ai/backup.mts')],
    {
      cwd: root,
      env,
      stdio: ['ignore', log.fd, log.fd],
    },
  );
  if (backup.status !== 0) {
    await log.close();
    throw new Error(
      'Backup failed; no categorization was started. See ' + logPath,
    );
  }
}
const child = spawn(process.execPath, ['dist/app.js'], {
  cwd: integration,
  env,
  stdio: ['ignore', log.fd, log.fd],
});
const code = await new Promise<number | null>((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', resolve);
});
await log.close();
const output = await readFile(logPath, 'utf8');
const failed =
  code !== 0 ||
  /An error occurred|Error processing transaction|Error during API shutdown|Error during LLM request/.test(
    output,
  );
console.log(
  `Finished ${failed ? 'with errors' : 'successfully'}. Report: ${logPath}`,
);
for (const line of output.split('\n')) {
  if (
    /^(Found \d+ uncategorized|All transactions count:|Already has a category|Is a transfer|Is starting balance|Account is not budget|Protected transactions|Local preview limit)/.test(
      line,
    )
  ) {
    console.log(line);
  }
}
if (failed) process.exitCode = 1;

// A readable local report. Escape all merchant/model text; no scripts or remote assets.
const rows: { merchant: string; category: string }[] = [];
for (const line of output.split('\n')) {
  const merchant = /^\d+\/\d+ Processing transaction '(.*)'$/.exec(line);
  if (merchant) {
    rows.push({
      merchant: merchant[1],
      category: 'Needs review / no suggestion',
    });
  }
  const category = /^Using existing category: (.*)$/.exec(line);
  if (category && rows.length) rows[rows.length - 1].category = category[1];
}
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    char =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char] ?? char,
  );
const reportDir = path.join(privateDir, 'reports');
await mkdir(reportDir, { recursive: true, mode: 0o700 });
const report = path.join(reportDir, `latest-${mode}.html`);
await writeFile(
  report,
  `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Local category ${mode}</title><style>
body{font:16px system-ui,sans-serif;max-width:900px;margin:50px auto;padding:0 24px;color:#172534;background:#f6f8fa}
h1{font-size:30px}p{line-height:1.6}table{width:100%;border-collapse:collapse;background:white}
th,td{padding:14px;text-align:left;border-bottom:1px solid #dce3ea}th{background:#e8eef3}
</style><h1>Local category ${mode}</h1>
<p>${mode === 'preview' ? 'Preview only — your transactions have not been changed.' : 'Categorization run completed. Sync Actual and review entries tagged #local-ai.'}
${failed ? 'Some errors occurred; check the private log before applying anything.' : ''}</p>
<p>Qwen3 4B · processed on this computer · ${rows.length} entries shown · ${new Date().toLocaleString()}</p>
<table><thead><tr><th>Imported merchant</th><th>${mode === 'preview' ? 'Suggested category' : 'Category'}</th></tr></thead>
<tbody>${rows.map(row => `<tr><td>${escapeHtml(row.merchant)}</td><td>${escapeHtml(row.category)}</td></tr>`).join('')}</tbody></table>
<p>Uncertain entries remain for manual review. This model can make mistakes. Detailed results are in the private log.</p>
</html>`,
  { mode: 0o600 },
);
console.log(`Readable report: ${report}`);
