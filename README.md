# ABVX Shortener

Self-hosted URL shortener on Cloudflare Workers + KV with operational control plane.

Current milestone: **v0.3**.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

---

## Содержание

- [Quick start (Worker)](#quick-start-worker)
- [Extension MV3](#extension-mv3)
- [API v0.3](#api-v03)
- [Trust / Security](#trust--security)
- [Настройка / vars](#настройка--vars)
- [Операционный запуск](#операционный-запуск)
- [Migration v0.1 -> v0.3+](#migration-v01--v03)

---

## Quick start (Worker)

```bash
cd worker
npm i
npx wrangler login
npx wrangler kv namespace create "LINKS"
npx wrangler secret put API_KEY
npx wrangler deploy
```

Для продакшена все переменные и секреты подхватятся из `wrangler.toml`/`wrangler`-конфига.

- health check: `GET /health`
- короткая ссылка: `POST /api/shorten`
- редирект: `GET /:slug`

---

## Extension MV3

В `extension/` реализован расширенный рабочий UX:

- popup: preview результата, copy/open, retry, история последних ссылок (10–20)
- настраиваемый endpoint API (`apiBaseUrl`) и API key
- background service worker с:
  - `contextMenus` — «Shorten this page» и «Shorten this link»
  - `commands`:
    - `Ctrl+Shift+S` — shorten текущей вкладки
    - `Alt+Shift+S` — открыть последний short
  - `omnibox` keyword `abvx`

---

## API v0.3

Сервис возвращает единый формат ошибок:

- `{ code, message, requestId, details? }`.

Успешные ответы содержат предметные payload-поля (`slug`, `shortUrl`, `items`, ...), плюс `requestId` в большинстве случаев.

### Core

- `GET /health`
- `GET /:slug` — redirect (авторизация применяется только для `private` ссылок)

### Сокращение ссылок

`POST /api/shorten`

Body:

- `url` (required)
- `customSlug`, `overwrite`, `force`
- `ttl` / `expiresAt`
- `redirectType` (`301`|`302`)
- `fallbackUrl`
- `private`, `privateTokenRequired`, `visibility`

Response:

- `slug`, `shortUrl`, `created`, `alreadyExisted`, `createdBy`, `expiresAt`, `disabled`, `customSlug`, `redirectType`, `visibility`, `requestId`

### Уровень управления ссылками

- `GET /api/link/:slug` — метаданные ссылки
- `PUT /api/link/:slug` — обновление `url`, `ttl/expiresAt`, `disabled`, `redirectType`, `fallbackUrl`, `private`
- `DELETE /api/link/:slug` — soft-delete по умолчанию, `?hard=true` для hard-delete

### Новые v0.3 endpoints

- `GET /api/links?cursor=...&limit=...`
  - фильтры: `disabled`, `expired`, `customSlug`, `createdBy`, `q`
- `POST /api/links/bulk`
  - `{ action: disable|restore|delete, slugs: [...], dryRun: true|false }`
- `GET /api/links/export?format=json|csv`
- `GET /api/stats?window=minute|hour|day`
  - агрегаты: `redirect_hit`, `redirect_miss`, `expired_hit`, `disabled_hit`, `api_conflict`, `rate_limited`, `created`, `updated`, `deleted`, `private_denied`
- `GET /api/events?cursor=...&type=create|update|delete|soft-delete|restore`

### Бонусные возможности ссылок

- настройка кода редиректа `301/302`
- fallback для disabled/expired/private сценариев
- soft-delete с последующим restore (через `bulk`/`events`)

---

## Trust / Security

### Endpoint hardening

- Rate limit для `POST /api/shorten` по IP и API key (`RL:ip`, `RL:key`)
- allowlist источников (`ALLOWED_ORIGINS`, `ALLOW_NO_ORIGIN`)
- URL canonicalization + allow/deny домены (`ALLOW_URL_DOMAINS`, `DENY_URL_DOMAINS`)
- опциональный precheck hook (`URL_PRECHECK_URL`)
- блок локальных/частных сетевых адресов и небезопасных схем

### Trust modes

- `TRUST_MODE=personal` — обычный режим
- `TRUST_MODE=readonly` — только чтение и статистика
- `TRUST_MODE=readonly-create` — только `POST /api/shorten` и редиректы

### API keys

- legacy: единый `API_KEY`
- phased rotation: `API_KEYS_JSON`
  - `[{ "id": "writer-1", "role": "writer", "secret": "...", "secret_hash": "..." }]`
  - роли: `reader`, `writer`, `admin`
- рекомендованная схема: сначала legacy `API_KEY`, затем `API_KEYS_JSON`

---

## Настройка / vars

| Variable | Default | Purpose |
|---|---|---|
| `BASE_URL` | `https://go.abvx.xyz` | base URL для returned short URL |
| `RATE_LIMIT_WINDOW_SEC` | `60` | окно throttling для `/api/shorten` |
| `RATE_LIMIT_MAX` | `30` | лимит в окне |
| `ALLOWED_ORIGINS` | `` | comma-separated allowlist |
| `ALLOW_NO_ORIGIN` | `false` | разрешить запросы без Origin |
| `STRIP_TRAILING_SLASH` | `true` | нормализация URL |
| `MAX_URL_LENGTH` | `2048` | жесткий лимит длины URL |
| `DEFAULT_TTL_SECONDS` | `0` | дефолтное TTL для новых ссылок |
| `TRUST_MODE` | `personal` | trust mode |
| `ALLOW_URL_DOMAINS` | `` | allowlist целевых доменов |
| `DENY_URL_DOMAINS` | `` | denylist целевых доменов |
| `URL_PRECHECK_URL` | `` | optional external precheck |
| `URL_PRECHECK_TIMEOUT_MS` | `1500` | timeout внешнего precheck |
| `URL_PRECHECK_FAIL_OPEN` | `false` | fallback при падении precheck |
| `DEFAULT_REDIRECT_TYPE` | `302` | дефолтный код редиректа |
| `STATS_RETENTION_DAYS` | `30` | метрики + события retention (days, approx) |
| `API_KEYS_JSON` | `` | JSON для phased key rotation |
| `LINKS_INDEX_D1_URL` | `` | опциональный путь к D1 для v0.4+ |

---

## Операционный запуск

- Runbook миграции: `docs/migration.md`
- Операционный гайд: `docs/ops.md`
- Чеклист релиза: `RELEASE_CHECKLIST.md`

### CLI

```bash
./bin/abvx-shorten shorten https://example.com --custom-slug promo
./bin/abvx-shorten stats --window hour
./bin/abvx-shorten list --limit 20 --disabled false
./bin/abvx-shorten bulk-disable abc123 old-link --dry-run true
```

Минимальная стратегия миграции KV:

```bash
cd worker
npm run migrate-kv:dry      # preview
npm run migrate-kv:canary   # canary + write
npm run migrate-kv          # controlled rollout
```

---

## Migration `v0.1 -> v0.3`

- v0.1 хранил plain URL в KV
- v0.3 работает с JSON `link-record` (metadata, TTL, audit-ready fields)

Смотрите `docs/migration.md` и `RELEASE_CHECKLIST.md` для incident checklist.

---

## Compatibility

- Worker: Cloudflare Workers
- Extension: Chrome MV3 (`chromium`-базированные браузеры)
- Operations: `docs/ops.md`
