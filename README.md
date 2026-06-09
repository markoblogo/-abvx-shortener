# ABVX Shortener

Minimal self-hosted URL shortener on Cloudflare Workers + KV, now with operational controls.

Current milestone: **v0.3**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

---

## Быстрое содержание

- [Quick start (Worker)](#quick-start-worker)
- [Extension MV3](#extension-mv3)
- [API v0.3](#api-v03)
- [Trust / Security](#trust--security)
- [Настройка / vars](#настройка--vars)
- [Операционный запуск](#операционный-запуск)
- [Migration v0.1 -> v0.3](#migration-v01--v03)

---

## Quick start (Worker)

```bash
cd worker
npm i
npm run test
npx wrangler login
npx wrangler kv namespace create "LINKS"
npx wrangler secret put API_KEY
npx wrangler deploy
```

В `wrangler.toml` уже есть базовая конфигурация и переменные.

---

## Extension MV3

В папке `extension/` уже есть popup + background service worker:

- popup с preview, copy/open/retry и историей сокращений
- `quick menu` для страницы и ссылок
- команды:
  - `Ctrl+Shift+S` — shorten текущей вкладки
  - `Alt+Shift+S` — открыть последний short
- `omnibox` keyword `abvx`

---

## API v0.3

Все API-ответы используют JSON envelope:
`{ code, message, requestId, details? }`.

### Core

- `GET /health`
- `GET /:slug` — redirect

### Shortening

`POST /api/shorten`

Body:

- `url` (required)
- `customSlug`, `overwrite`, `force`
- `ttl` / `expiresAt`
- `redirectType` (`301`|`302`)
- `fallbackUrl`
- `private`, `privateTokenRequired`, `visibility`

Response:

- `slug`, `shortUrl`, `created`, `alreadyExisted`, `createdBy`, `expiresAt`, `disabled`, `customSlug`, `redirectType`, `visibility`

### Link management

- `GET /api/link/:slug`
- `PUT /api/link/:slug`
- `DELETE /api/link/:slug` (soft-delete по умолчанию, `?hard=true` для hard-delete)

### New v0.3 operations

- `GET /api/links?cursor=...&limit=...` — список с фильтрами (`disabled`, `expired`, `customSlug`, `createdBy`, `q`)
- `POST /api/links/bulk`
  - `{ action: disable|restore|delete, slugs: [...], dryRun: true|false }`
- `GET /api/links/export?format=json|csv`
- `GET /api/stats?window=minute|hour|day`
- `GET /api/events?cursor=...&type=create|update|delete|soft-delete|restore`

---

## Trust / Security

### Endpoint hardening

- Rate limit на `POST /api/shorten` по IP + API key
- CORS/Origin allowlist (`ALLOWED_ORIGINS`, `ALLOW_NO_ORIGIN`)
- URL canonicalize + deny/allow домены (`ALLOW_URL_DOMAINS`, `DENY_URL_DOMAINS`)
- opt-in URL precheck hook (`URL_PRECHECK_URL`)

### Trust modes

- `TRUST_MODE=personal` — полный доступ (по авторизации)
- `TRUST_MODE=readonly` — только чтение
- `TRUST_MODE=readonly-create` — только `POST /api/shorten` + редирект

### API keys

- legacy: единый `API_KEY`
- phased rotation: `API_KEYS_JSON`
  - `[{ "id": "writer-1", "role": "writer", "secret": "..." }]`
  - роли: `reader`, `writer`, `admin`

---

## Настройка / vars

| Variable | Default | Purpose |
|---|---|---|
| `BASE_URL` | `https://go.abvx.xyz` | base URL для returned short URL |
| `RATE_LIMIT_WINDOW_SEC` | `60` | window for shorten |
| `RATE_LIMIT_MAX` | `30` | max in window |
| `ALLOWED_ORIGINS` | `` | comma-separated allowlist |
| `ALLOW_NO_ORIGIN` | `false` | allow requests without Origin |
| `STRIP_TRAILING_SLASH` | `true` | canonicalize slash |
| `MAX_URL_LENGTH` | `2048` | hard length limit |
| `DEFAULT_TTL_SECONDS` | `0` | default TTL for new links |
| `TRUST_MODE` | `personal` | trust mode |
| `ALLOW_URL_DOMAINS` | `` | allowed target-domain suffixes |
| `DENY_URL_DOMAINS` | `` | blocked target-domain suffixes |
| `URL_PRECHECK_URL` | `` | optional external URL policy endpoint |
| `URL_PRECHECK_TIMEOUT_MS` | `1500` | precheck timeout |
| `URL_PRECHECK_FAIL_OPEN` | `false` | fallback on hook fail |
| `DEFAULT_REDIRECT_TYPE` | `302` | default redirect type |
| `STATS_RETENTION_DAYS` | `30` | metrics/events retention approximation |
| `API_KEYS_JSON` | `` | JSON role key list |
| `LINKS_INDEX_D1_URL` | `` | optional D1 index migration path (v0.4+) |

---

## Операционный запуск

- Runbook миграции: `docs/migration.md`
- Операционная документация v0.3: `docs/v0.3.md`
- Ops чеклист: `docs/ops.md`
- Release checklist: `RELEASE_CHECKLIST.md`

### CLI

```bash
./bin/abvx-shorten shorten https://example.com --custom-slug promo
./bin/abvx-shorten stats --window hour
./bin/abvx-shorten list --limit 20 --disabled false
./bin/abvx-shorten bulk-disable abc123 old-link --dry-run true
```

### Bookmarklet

`javascript:(function(){window.prompt("ABVX URL", "https://go.abvx.xyz")&&window.open((()=>{const e=window.prompt("ABVX URL","https://go.abvx.xyz");const k=window.prompt("ABVX API key","your-api-key");if(!e||!k)return null;return e.replace(/\/$/,"")+"/api/shorten";})(),"_self")})();`

> Для production лучше отдавать ссылку от вашей domain и хранить API key в защищённом клиенте.

---

## Migration `v0.1 -> v0.3`

- v0.1 хранил plain URL в KV
- v0.2 + v0.3 перешли на JSON запись link-record с метаданными
- миграция v0.1 -> v0.2 по одному и тому же скрипту `worker/scripts/migrate-kv.mjs`

```bash
cd worker
npm run migrate-kv:dry
npm run migrate-kv:canary
npm run migrate-kv
```

Смотрите `docs/migration.md` и `RELEASE_CHECKLIST.md` для incident checklist.

---

## Compatibility

- Worker: Cloudflare Workers
- Extension: Chrome MV3 (Chromium-варианты тоже)
