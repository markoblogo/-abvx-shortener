# Changelog

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
