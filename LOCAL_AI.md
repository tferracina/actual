# Private local transaction categorization

This optional companion uses Actual AI at commit
`577078abb0eb9edc965162a235886a231c83e70e` (MIT) and a downloaded
Qwen3 4B model through Ollama. It runs alongside Actual, outside the browser.
It requires Node 24+, npm and Git. No paid AI API account is used.

## Use on this Mac

Actual must be running first. From the repository directory:

```sh
node bin/local-ai.mts preview
node bin/local-ai.mts apply
```

Preview examines up to 25 eligible transactions without changing them. Apply
first exports a budget backup and then processes all eligible uncategorized
transactions. Detailed reports stay in `data/local-ai/logs/` (private files).
Refresh/sync Actual after applying. Search transaction notes for `#local-ai` to
review suggestions, and `#local-ai-review` for uncertain or failed suggestions.
Correct categories normally in Actual. Those categorized transactions are skipped
on subsequent runs. The companion does not run periodically yet; invoke it after
bank syncing. Its default mode is preview.

The installed model/runtime are private local artifacts, not part of the Git fork.
The first run starts the local Ollama process if needed. It remains running after
the command; the model can be unloaded by Ollama when idle. It listens only on
127.0.0.1:11435, with `OLLAMA_NO_CLOUD=1`. This is separate from other Ollama installs.

## Privacy and behavior

- The launcher fixes the provider to Ollama and rejects cloud/remote model metadata.
- Web search and cloud fallback are disabled. Cloud-provider environment variables
  are not inherited, and an integration `.env` file is rejected.
- The prompt includes merchant text, income/expense direction and your categories.
  It omits dedicated fields for amounts, dates, notes, balances, account numbers and credentials.
  Merchant text may itself contain bank references.
- Actual AI itself reads a local budget copy; its private logs can include merchant
  names and notes. Protect the whole data directory and its backups.
- Inference does not train or fine-tune the model. No cloud AI request is configured.
  Software/model downloads require the internet; bank syncing is still a separate
  connection to Enable Banking and your banks. This is not an OS-level network firewall.
- Existing categories, identified transfers, opening balances, off-budget accounts,
  reconciled entries and split transactions are skipped. Unknown/unlinked transfers
  can still look like purchases: verify transfers in Actual before applying.
- A guess must refer to an existing category. New category creation is disabled.
  Conservative merchant-text guards leave likely transfers, repayments and command-like
  strings for review; these heuristics can also skip legitimate transactions.
  Model suggestions can be wrong; tags identify them for review. The model's
  apparent certainty is not treated as a calibrated accuracy score.
- Ambiguous entries are tagged for review and skipped on later runs. To retry an
  uncategorized entry, remove `#local-ai-review` from its notes first.
- Backups before apply are in `data/local-ai/backups/`. They can be imported as a
  separate budget through Actual if you need to recover a prior version.

## Reinstall the integration

```sh
./bin/install-local-ai
```

The installer checks out the pinned upstream source and applies local safeguards: keeping the API cache in your private data folder,
skipping reconciled/split entries, limiting previews, and requiring strict JSON
with an existing category (or abstention), without extracting guesses from prose.
It also installs a loopback-only model transport and conservative merchant review guards. It installs npm dependencies
and builds. No credentials are included in source code.

## Install the model/runtime on another machine

Install Ollama from its official distribution: https://ollama.com/download
On Windows, use the standalone CLI or quit the tray app before running the
separate local instance below. The Mac launcher uses the portable binary in
`data/local-ai/runtime/ollama`; Windows/Linux use `ollama` from PATH.

In PowerShell, from this repository, start a terminal with:

```powershell
$env:OLLAMA_HOST = '127.0.0.1:11435'
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_MODELS = "$PWD/data/local-ai/models"
ollama serve
```

In another PowerShell terminal:

```powershell
$env:OLLAMA_HOST = '127.0.0.1:11435'
ollama pull qwen3:4b
node bin/local-ai.mts preview
```

On Linux use equivalent shell environment assignments. The model download is
about 2.5 GB; runtime memory is higher. A GTX 1650 may need partial CPU offload;
benchmark on the actual machine before selecting a larger model.

## Migration with Actual

Keep source/configuration and model weights together, but reinstall platform-
specific dependencies and binaries. Do not copy Mac node_modules to Windows.

1. Stop Actual for a consistent backup and copy its full private data directory
   securely to the PC (including server files, credentials and AI model weights).
2. Set up the same Actual version on the PC. Keep model inference and Actual on
   the same host; the launcher intentionally accepts only loopback Actual URLs.
3. Update `data/personal/access.json` to the new local server URL/password and
   `data/personal/budgets.json` if the budget's sync ID changes. Do not commit them.
4. Reinstall the integration with `bin/install-local-ai` using Git Bash on Windows,
   or the normal shell on Linux; install the native Ollama runtime for that OS.
5. Run a preview and verify it before enabling automatic startup or scheduling.
6. Configure the separate HTTPS address used by your browsers and update Enable
   Banking's redirect URL. The AI worker can use loopback on the same server.

Never push `data/`, private logs, weights or credentials to GitHub.
