import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

import type * as ActualApi from '../index';

type Profile = {
  name: string;
  accounts: { name: string; offbudget: boolean; note: string }[];
  categories: { name: string; categories: string[] }[];
};

function validateProfile(value: unknown): asserts value is Profile {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Expected a budget profile object');
  }
  if (
    !('name' in value) ||
    !('accounts' in value) ||
    !('categories' in value)
  ) {
    throw new Error('Missing name, accounts or categories');
  }
  const p = value;
  if (
    typeof p.name !== 'string' ||
    !p.name.trim() ||
    !Array.isArray(p.accounts) ||
    !p.accounts.length ||
    !Array.isArray(p.categories) ||
    !p.accounts.every(
      a =>
        a &&
        typeof a.name === 'string' &&
        a.name.trim() &&
        typeof a.offbudget === 'boolean' &&
        typeof a.note === 'string',
    ) ||
    !p.categories.every(
      g =>
        g &&
        typeof g.name === 'string' &&
        g.name.trim() &&
        Array.isArray(g.categories) &&
        g.categories.every((c: unknown) => typeof c === 'string' && c.trim()),
    )
  ) {
    throw new Error(
      'Invalid profile: name, accounts and category groups are required',
    );
  }
  if (new Set(p.accounts.map(a => a.name)).size !== p.accounts.length) {
    throw new Error('Account names must be unique');
  }
}

// Personal profiles and generated databases stay in ignored data/, outside source control.
const root = path.resolve(import.meta.dirname, '../../..');
const profilePath = process.argv[2];
const outputPath = process.argv[3];
if (!profilePath || !outputPath) {
  throw new Error(
    'Usage: node packages/api/bin/create-local-budget.mts PROFILE.json OUTPUT.zip',
  );
}
const profile: unknown = JSON.parse(await readFile(profilePath, 'utf8'));
validateProfile(profile);
const require = createRequire(import.meta.url);
const api: typeof ActualApi = require('../dist/index.js');
const staging = path.join(root, 'data', 'bootstrap');
await mkdir(staging, { recursive: true, mode: 0o700 });
const dataDir = await mkdtemp(path.join(staging, 'budget-'));
await api.init({ dataDir });
try {
  await api.runImport(profile.name, async () => {
    for (const account of profile.accounts) {
      // No invented opening balances. Reconcile against a real statement before use.
      const id = await api.createAccount({
        name: account.name,
        offbudget: account.offbudget,
      });
      await api.updateNote(id, account.note);
    }
    for (const group of profile.categories) {
      const id = await api.createCategoryGroup({ name: group.name });
      for (const name of group.categories) {
        await api.createCategory({ name, group_id: id });
      }
    }
    await api.setPreference('budgetType', 'tracking');
    await api.setPreference('defaultCurrencyCode', 'EUR');
    await api.setPreference('flags.currency', 'true');
    await api.setPreference('dateFormat', 'dd/MM/yyyy');
    await api.setPreference('firstDayOfWeekIdx', '1');
    await api.setPreference('bank-sync-interval', '1440');
    await api.setPreference('flags.enableBanking', 'true');
  });
  const accounts = await api.getAccounts();
  if (accounts.length !== profile.accounts.length) {
    throw new Error('Account verification failed');
  }
  for (const account of accounts) {
    if ((await api.getAccountBalance(account.id)) !== 0) {
      throw new Error('Unexpected opening balance');
    }
  }
  await writeFile(outputPath, await api.exportBudget(), {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(
    `Created ${accounts.length} unconnected accounts; opening balances and budget limits still need your input.`,
  );
} finally {
  await api.shutdown();
}
