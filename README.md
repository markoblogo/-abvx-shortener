# abvx-shortener

Minimal, self-hosted short-link service for your own domain (Cloudflare Workers + KV) + a Chrome extension that shortens the current tab URL and copies it.

Designed for personal use (no analytics).

## Features
- `https://abvx.xyz/<slug>` → **302** redirect
- `POST /api/shorten` → deterministic slug (same URL → same slug)
- Cloudflare KV storage (slug → url)
- Simple auth via `X-API-Key`
- Chrome extension (Manifest V3) → “Shorten & Copy”

## Repo structure
- `worker/` — Cloudflare Worker
- `extension/` — Chrome extension

## Worker setup (Cloudflare)
### 1) Install deps
```bash
cd worker
npm i
```

### 2) Login to Cloudflare
```bash
npx wrangler login
```

### 3) Create KV namespace
```bash
npx wrangler kv namespace create "LINKS"
# Copy the id into worker/wrangler.toml (kv_namespaces[].id)
```

### 4) Set the API key secret
```bash
cd worker
npx wrangler secret put API_KEY
```

### 5) Deploy
```bash
cd worker
npx wrangler deploy
```

### 6) Bind a custom domain
In Cloudflare dashboard: **Workers & Pages → your worker → Triggers → Custom Domains**.
Attach `abvx.xyz` (or a subdomain like `go.abvx.xyz`).

## Chrome extension setup
1) Open `chrome://extensions`
2) Enable **Developer mode**
3) Click **Load unpacked**
4) Select the `extension/` folder

Then click the extension button → it will shorten the current tab URL and copy the short link.

## API
### Create/resolve short link
```bash
curl -X POST "https://abvx.xyz/api/shorten" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <your-key>" \
  -d '{"url":"https://example.com/some/long/path?x=1"}'
```

Response:
```json
{"slug":"k3v9p2","shortUrl":"https://abvx.xyz/k3v9p2"}
```

## Notes / caveats
- Deterministic slugs are made from a stable hash of the canonicalized URL.
- No analytics by design.
- API key is stored in the extension, so treat it as “good enough for personal use”, not bank-grade security.

## License
MIT
