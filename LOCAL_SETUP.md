# Local personal setup

This branch starts from Actual v26.11.0. It adds a loopback-only server launcher
and a repeatable starter-budget generator. The upstream budgeting UI is unchanged.

## Build and start

Use Node 24 and the repository's bundled Yarn, from the repository root:

```sh
node .yarn/releases/yarn-4.17.1.cjs install --immutable
node .yarn/releases/yarn-4.17.1.cjs typecheck
node .yarn/releases/yarn-4.17.1.cjs build:browser --skip-translations
node .yarn/releases/yarn-4.17.1.cjs workspace @actual-app/sync-server build
node .yarn/releases/yarn-4.17.1.cjs workspace @actual-app/api build
./bin/start-local
```

The server uses `http://127.0.0.1:5006`, stores its data in ignored `data/local/`,
and requires a password. Build after typechecking: the TypeScript project build
can replace the API's bundled output with unbundled files.

## Generate a starter budget

Save a private profile under `data/personal/profile.json`:

```json
{
  "name": "Personal finances",
  "accounts": [
    {
      "name": "Current account",
      "offbudget": false,
      "note": "Opening balance not set"
    },
    {
      "name": "Investments",
      "offbudget": true,
      "note": "Opening valuation not set"
    }
  ],
  "categories": [
    { "name": "Essentials", "categories": ["Housing", "Groceries"] }
  ]
}
```

```sh
node packages/api/bin/create-local-budget.mts data/personal/profile.json data/personal/starter-budget.zip
```

Import that ZIP in Actual. The generator refuses to overwrite an existing ZIP.
It creates a new budget, never edits an existing one, and checks that account
balances are zero before exporting. Zero is a placeholder until reconciliation;
it does not assert the balance of a real account. Monthly category amounts are
left unset. The profile enables EUR, tracking budgets, daily bank refresh while
the app is open, and the experimental Enable Banking option.

## Bank connections and investments

The local HTTP server supports manual statement imports. Enable Banking setup
additionally needs an HTTPS redirect URL and the account owner's authorization.
No provider credentials, bank links, or unattended scheduler are provisioned by
these scripts. Coverage must be verified for each bank and account type.

Off-budget accounts support investment valuations and net worth. This setup does
not add a holdings ledger, market-price feeds, cost basis, or performance returns.
Deposits must not be treated as investment gains. When cash and securities are
tracked separately, each account contains only its component of the total.

Keep profiles, credentials, statements, budgets, and backups out of Git. Export
budget backups through Actual, and stop the server before copying `data/local/`
for a full server backup.
