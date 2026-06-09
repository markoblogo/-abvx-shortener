# KV migration runbook (v0.1 -> v0.2/v0.3)

This runbook describes safe production execution of
`worker/scripts/migrate-kv.mjs` for migrating legacy string KV values
into normalized JSON records.

## What changed in v0.2 migration

- Old payloads are plain strings (legacy URL values).
- v0.2/v0.3 payloads are JSON records with `slug`, `url`, timestamps and metadata.
- Migration is idempotent: already-normalized entries are skipped on re-run.

## Prerequisites

```bash
cd worker

export KV_NAMESPACE_ID=<your-kv-namespace-id>
export CLOUDFLARE_ACCOUNT_ID=<your-cloudflare-account-id>
export CLOUDFLARE_API_TOKEN=<api-token-with-kv-edit>
export MIGRATE_CREATED_BY="v0.2-migration"
export DEFAULT_TTL_SECONDS=0
```

## Run profiles (copy-paste)

```bash
npm run migrate-kv:dry      # DRY RUN, JSON logs, canary window
npm run migrate-kv:canary   # canary window with writes, JSON logs
npm run migrate-kv           # manual full run with explicit MAX_KEYS/LIMIT
```

### Recommended one-shot full run command

```bash
cd worker
DRY_RUN=false \
LOG_FORMAT=json \
MAX_KEYS=10000 \
LIMIT=1000 \
MIGRATION_RUN_ID=$(date +%s) \
node ./scripts/migrate-kv.mjs \
  2>&1 | tee migration-prod-$(date +%F_%H%M%S).log
```

## Incident checklist

### 1) Pre-flight

- Confirm env vars exist and are correct.
- Confirm `LOG_FORMAT=json` is set for machine-readability.
- For first run in a cluster use
  `npm run migrate-kv:dry` and inspect summary counters.

### 2) Controlled canary

- Run `npm run migrate-kv:canary`.
- Expect summary with `migrated > 0`.
- If `errors > 0`, stop and inspect `key_error` events.

### 3) Full rollout

- Run controlled windows using `MAX_KEYS` and `LIMIT`.
- Keep `MIGRATION_RUN_ID` stable for a rollout window.
- Store logs in centralized storage (CI artifact or S3)
  and keep immutable retention until migration is verified.

### 4) Monitoring and rollback checks

- Verify redirect path still works for sample migrated slugs.
- If a partial migration fails:
  - collect all `key_error` events
  - review Cloudflare API error details from the script output
  - rerun with smaller `MAX_KEYS` to isolate the failing key range
- Because migration only changes string -> JSON structure and skips already-normalized values,
  reruns are safe.

### 5) Log parsing

- Parse summary:

```bash
jq -R 'fromjson | select(.event=="migration_summary")' migration-*.log
```

- Parse failed keys:

```bash
jq -R 'fromjson | select(.event=="key_error")' migration-*.log
```

```bash
jq -R 'fromjson | select(.event=="key_migrated")' migration-*.log
```
