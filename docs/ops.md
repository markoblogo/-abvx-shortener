# ABVX Shortener Operations

## Operational runbook

### 1) Безопасный deploy

1. Проверить переменные окружения и secret-переменные.
2. Проверить `TRUST_MODE` по профилю сервиса.
3. Включить `ALLOW_NO_ORIGIN=false` в production, если не ожидаются интеграции без origin/referer.
4. Убедиться, что `BASE_URL` и endpoint соответствуют рабочему домену.
5. Deploy в staged через wrangler, затем production.

### 2) Smoke в deployed окружении

- `GET /health`
- `POST /api/shorten` (валидный/невалидный URL)
- `GET /:slug` обычный + expired/disabled
- `GET /api/stats?window=minute`
- `GET /api/events`

### 3) Операционные метрики

- `redirect_hit`/`redirect_miss`/`expired_hit`/`disabled_hit`
- `api_conflict`/`rate_limited`
- `created`/`updated`/`deleted`
- `private_denied`

### 4) Ошибки и инциденты

- Любые spike в `rate_limited` + рост `api_conflict` при массовой смене slug-коллизий.
- Резкий рост `redirect_miss` без ожидаемого трафика.
- Нехватка событий в `events` при включенном трафике.
- При инциденте сохранить логи в файл: `migration-*`, `worker-logs-*`, `audit-*`.

### 5) Массовая миграция KV (legacy string -> json)

- Использовать:
  - `npm run migrate-kv:dry`
  - `npm run migrate-kv:canary`
  - `npm run migrate-kv`
- Все команды уже настроены на JSON-логи и `DRY_RUN` режим.
- Подробно см. `docs/migration.md`.

### 6) CLI и интеграции

- Краткие проверки `bin/abvx-shorten`:
  - `./bin/abvx-shorten shorten https://example.com`
  - `./bin/abvx-shorten stats`
  - `./bin/abvx-shorten list --limit 20`
  - `./bin/abvx-shorten bulk-disable slug1 slug2 --dry-run`

### 7) Наблюдение за расширением

- Проверить доступность команд:
  - `Ctrl+Shift+S`
  - `Alt+Shift+S`
- Проверить omnibox: в адресную строку `abvx <url>`.
- Проверить историю popup и `Open last`.
