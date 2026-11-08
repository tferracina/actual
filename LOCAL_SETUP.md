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

The server uses `https://localhost:5006`, binds only to `127.0.0.1`, and stores
its data in ignored `data/local/`. It requires a password and a trusted local TLS
certificate. Build after typechecking: the TypeScript project build can replace
the API and server bundles with unbundled files.

## Local HTTPS

The launcher requires `data/tls/localhost.key` and `data/tls/localhost.crt`.
Keep all TLS files out of Git. This installation uses a private local certificate
authority (`data/tls/local-ca.crt`) whose DNS name constraint permits only
`localhost`. The authority is trusted for SSL in the macOS user keychain. Its
private key stays in the protected `data/tls/` directory. The server certificate
is valid for one year and must be renewed before expiration.

For command-line clients, trust the CA explicitly rather than disabling TLS
verification:

```sh
curl --cacert data/tls/local-ca.crt https://localhost:5006/health
NODE_EXTRA_CA_CERTS="$PWD/data/tls/local-ca.crt" node your-local-api-script.cjs
```

A browser using a separate certificate store may need to import this CA. Never
use a global certificate-validation bypass. The browser's local storage is
separate for HTTP and HTTPS; sign in over HTTPS and open the existing server
budget rather than creating a duplicate.

To revoke this installation's user-keychain trust on macOS:

```sh
security remove-trusted-cert data/tls/local-ca.crt
```

Do not delete certificates or change hostnames while a bank authorization is
in progress.

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

For Enable Banking, register one Production application for your personal accounts
with this exact allowed redirect URL:

```text
https://localhost:5006/enablebanking/auth_callback
```

Local application notices are available at `/local-privacy.html` and
`/local-terms.html`. First activate the application by linking your own accounts
in Enable Banking. Then configure its application ID and private key in Actual,
authorize each bank, and map the returned accounts to the existing budget
accounts. Bank access requires the owner's consent and periodic renewal. These
source files contain no provider credentials or personal bank links. Coverage
must be verified for each bank and account type. Daily bank refresh runs while
Actual is open; no unattended scheduler is provisioned.

Off-budget accounts support investment valuations and net worth. This setup does
not add a holdings ledger, market-price feeds, cost basis, or performance returns.
Deposits must not be treated as investment gains. When cash and securities are
tracked separately, each account contains only its component of the total.

Keep profiles, credentials, statements, budgets, and backups out of Git. Export
budget backups through Actual, and stop the server before copying `data/local/`
for a full server backup.
