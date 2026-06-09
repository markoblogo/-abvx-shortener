# Changelog

## v0.3.0

- Added operational APIs:
  - `GET /api/stats`
  - `GET /api/links`
  - `POST /api/links/bulk`
  - `GET /api/links/export`
  - `GET /api/events`
- Added private link support in redirect flow:
  - `private`, `privateTokenRequired`, `redirectType`, `fallbackUrl`
- Added trust model:
  - `TRUST_MODE=personal|readonly|readonly-create`
  - `API_KEYS_JSON` role support (`admin`/`writer`/`reader`)
- Extended allow/deny policy and optional URL precheck hook.
- Added URL-level observability and lightweight KV audit trail:
  - redirect + API + conflict metrics
  - immutable `events` records
- Added extension operational UX:
  - command palette and shortcuts (`Ctrl+Shift+S`, `Alt+Shift+S`)
  - context menu and omnibox (`abvx`)
  - history quick actions in popup and "open last"
- Added production-safe KV migration tooling:
  - `migrate-kv:dry` and `migrate-kv:canary` npm scripts
  - JSON structured logs and migration incident checklist
- Added CLI entrypoint `bin/abvx-shorten` and `docs/v0.3.md`, `docs/ops.md`

## v0.2.0

- Added secure-by-default API defaults and configurable API allowlisting
- Added `POST /api/shorten`, `GET/PUT/DELETE /api/link/:slug`
- Added URL canonicalization + expanded validation (`javascript:`, private/local host blocks, credentials)
- Added TTL / disabled soft-delete support in KV records
- Added custom slug support with reserved slug protection and conflict handling
- Added MV3 extension UX upgrade: configurable endpoint, preview, copy/open/retry, history
- Added project CI (`.github/workflows/ci.yml`) with lint/typecheck/test
- Added unit/integration tests and test matrix for core flows
- Added migration path notes for legacy v0.1 KV values
