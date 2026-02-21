export interface Env {
  LINKS: KVNamespace;
  API_KEY: string;
  BASE_URL: string;
  RATE_LIMIT_WINDOW_SEC?: string;
  RATE_LIMIT_MAX?: string;
}

const encoder = new TextEncoder();

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function html(body: string, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(body, { ...init, headers });
}

function badRequest(message: string) {
  return json({ error: message }, { status: 400 });
}

function unauthorized() {
  return json({ error: "unauthorized" }, { status: 401 });
}

function notFound() {
  return json({ error: "not_found" }, { status: 404 });
}

function normalizeUrl(input: string): string {
  // Basic normalization: trim + require http/https.
  const raw = input.trim();
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }

  // Remove default ports
  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
    url.port = "";
  }

  // Drop hash fragment (usually not desired for sharing)
  url.hash = "";

  // Normalize hostname to lowercase
  url.hostname = url.hostname.toLowerCase();

  // Keep query as-is; keep trailing slash as-is.
  return url.toString();
}

async function sha256Base32(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  const bytes = new Uint8Array(digest);
  // base32 (RFC4648) without padding, lowercase
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += alphabet[(value << (5 - bits)) & 31];
  }
  return out;
}

function getClientIp(req: Request): string {
  // Cloudflare provides CF-Connecting-IP
  return req.headers.get("CF-Connecting-IP") || "unknown";
}

async function rateLimitOk(env: Env, ip: string): Promise<boolean> {
  const windowSec = Number(env.RATE_LIMIT_WINDOW_SEC ?? "60");
  const max = Number(env.RATE_LIMIT_MAX ?? "30");

  // KV isn't perfect for strict rate limiting, but good enough for personal use.
  const key = `rl:${ip}:${Math.floor(Date.now() / (windowSec * 1000))}`;
  const curStr = await env.LINKS.get(key);
  const cur = curStr ? Number(curStr) : 0;
  if (cur >= max) return false;
  const next = cur + 1;
  await env.LINKS.put(key, String(next), { expirationTtl: windowSec + 5 });
  return true;
}

const LANDING_HTML = `<!doctype html>
<html lang="en" data-style="default">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ABVX Shortener</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/markoblogo/AsciiTheme@0.1.0/dist/style.css" />
    <style>
      :root {
        --bg: #0b0c10;
        --panel: rgba(255, 255, 255, 0.08);
        --text: rgba(255, 255, 255, 0.92);
        --muted: rgba(255, 255, 255, 0.62);
        --border: rgba(255, 255, 255, 0.12);
        --shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
        --radius: 18px;
      }

      * { box-sizing: border-box; }
      html, body { height: 100%; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
        color: var(--text);
        background:
          radial-gradient(1200px 800px at 20% 20%, rgba(106, 255, 198, 0.16), transparent 60%),
          radial-gradient(1000px 700px at 80% 30%, rgba(108, 141, 255, 0.16), transparent 60%),
          radial-gradient(900px 700px at 55% 90%, rgba(255, 120, 180, 0.10), transparent 60%),
          var(--bg);
      }

      .wrap {
        min-height: 100%;
        display: grid;
        place-items: center;
        padding: 28px 16px;
      }

      .card {
        width: min(720px, 100%);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: linear-gradient(180deg, var(--panel), rgba(255, 255, 255, 0.04));
        box-shadow: var(--shadow);
        overflow: hidden;
      }

      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 18px 10px;
      }

      .head-main {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }

      .head-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
      }

      .logo {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(106,255,198,0.95), rgba(108,141,255,0.95));
        display: grid;
        place-items: center;
        box-shadow: 0 10px 25px rgba(0,0,0,0.35);
      }
      .logo svg { width: 22px; height: 22px; }

      h1 {
        font-size: 16px;
        line-height: 1.2;
        margin: 0;
        letter-spacing: 0.2px;
      }
      .sub { margin: 2px 0 0; font-size: 12px; color: var(--muted); }

      .content { padding: 8px 18px 18px; }

      label { display: block; font-size: 12px; color: var(--muted); margin: 10px 0 6px; }

      input {
        width: 100%;
        padding: 12px 12px;
        border-radius: 14px;
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.06);
        color: var(--text);
        outline: none;
      }
      input:focus {
        border-color: rgba(106,255,198,0.55);
        box-shadow: 0 0 0 4px rgba(106,255,198,0.12);
      }

      .row { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 12px; }

      button {
        appearance: none;
        border: 0;
        border-radius: 14px;
        padding: 12px 14px;
        font-weight: 600;
        color: #0b0c10;
        background: linear-gradient(135deg, rgba(106,255,198,1), rgba(108,141,255,1));
        cursor: pointer;
        box-shadow: 0 12px 30px rgba(0,0,0,0.35);
      }
      button:hover { filter: brightness(1.04); }
      button:active { transform: translateY(1px); }

      .out {
        margin-top: 12px;
        padding: 12px;
        border-radius: 14px;
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.06);
        color: var(--text);
        display: none;
        white-space: pre-wrap;
      }

      .out a { color: rgba(106,255,198,0.95); text-decoration: none; }
      .out a:hover { text-decoration: underline; }

      .footer {
        margin-top: 12px;
        font-size: 12px;
        color: var(--muted);
        display: flex;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .pill {
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.06);
        padding: 6px 10px;
        border-radius: 999px;
      }

      .head-actions .ascii-theme-toggle-group { display: inline-flex; gap: 8px; }
      .head-actions .ascii-theme-toggle-btn {
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.06);
        color: var(--text);
        border-radius: 999px;
        padding: 6px 10px;
        min-height: 30px;
        box-shadow: none;
        line-height: 1;
        font-size: 12px;
      }
      .head-actions .ascii-theme-toggle-btn:hover {
        filter: brightness(1.08);
      }

      .ascii-footnote {
        margin-top: 10px;
        font-size: 12px;
        color: var(--muted);
        white-space: normal;
      }
      .ascii-footnote a {
        color: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      :root[data-style="ascii"] .ascii-footnote a {
        color: currentColor;
      }

      :root[data-style="ascii"][data-ascii-mode="light"] {
        --text: #0b2a7a;
        --muted: rgba(11, 42, 122, 0.72);
        --border: rgba(11, 42, 122, 0.34);
        --panel: rgba(11, 42, 122, 0.04);
      }

      :root[data-style="ascii"][data-ascii-mode="light"] .card {
        background: rgba(11, 42, 122, 0.03);
      }

      :root[data-style="ascii"][data-ascii-mode="light"] input,
      :root[data-style="ascii"][data-ascii-mode="light"] .out,
      :root[data-style="ascii"][data-ascii-mode="light"] .pill {
        background: rgba(11, 42, 122, 0.03);
      }

      @media (max-width: 640px) {
        .head {
          flex-wrap: wrap;
          align-items: flex-start;
        }
      }
    </style>
  </head>

  <body>
    <div class="wrap">
      <div class="card">
        <div class="head">
          <div class="head-main">
            <div class="logo" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.5 13.5l3-3" stroke="#0b0c10" stroke-width="2.2" stroke-linecap="round"/>
                <path d="M8.2 14.8l-1.4 1.4a3.5 3.5 0 01-5-5l1.4-1.4" stroke="#0b0c10" stroke-width="2.2" stroke-linecap="round"/>
                <path d="M15.8 9.2l1.4-1.4a3.5 3.5 0 115 5l-1.4 1.4" stroke="#0b0c10" stroke-width="2.2" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <h1>ABVX Shortener</h1>
              <div class="sub">Paste a URL → get a short link on <b>go.abvx.xyz</b></div>
            </div>
          </div>
          <div class="head-actions">
            <div id="theme-controls"></div>
          </div>
        </div>

        <div class="content">
          <label for="url">URL</label>
          <input id="url" type="url" placeholder="https://…" autocomplete="off" />

          <label for="key">API key (stored only in your browser)</label>
          <input id="key" type="password" placeholder="Enter API key" autocomplete="off" />

          <div class="row">
            <button id="btn">Shorten & Copy</button>
          </div>

          <div id="out" class="out"></div>

          <div class="footer">
            <span class="pill">302 redirect</span>
            <span class="pill">deterministic slugs</span>
            <span class="pill">no analytics</span>
          </div>

          <div class="footer" style="margin-top: 14px; justify-content: flex-start; gap: 10px;">
            <a class="pill" href="https://abvcreative.medium.com" target="_blank" rel="noreferrer">Medium</a>
            <a class="pill" href="https://abvx.substack.com/" target="_blank" rel="noreferrer">Substack</a>
            <a class="pill" href="https://abvx.xyz" target="_blank" rel="noreferrer">abvx.xyz</a>
            <a class="pill" href="mailto:a.biletskiy@gmail.com">Email</a>
            <a class="pill" href="https://github.com/markoblogo/-abvx-shortener" target="_blank" rel="noreferrer">GitHub</a>
          </div>

          <div class="ascii-footnote">
            This landing uses an experimental ASCII theme mode (toggle in the header) · Source:
            <a href="https://github.com/markoblogo/AsciiTheme" target="_blank" rel="noreferrer">AsciiTheme</a>
          </div>

        </div>
      </div>
    </div>

    <script src="https://cdn.jsdelivr.net/gh/markoblogo/AsciiTheme@0.1.0/dist/ascii-theme.umd.js"></script>
    <script>
      if (window.AsciiTheme && typeof window.AsciiTheme.initAsciiTheme === "function") {
        window.AsciiTheme.initAsciiTheme({
          managedMode: true,
          defaultMode: "dark",
          defaultStyle: "default",
          addThemeToggle: true,
          addStyleToggle: true,
          mountSelector: "#theme-controls",
          mountPlacement: "append",
          storageKey: "go_abvx_theme_v1",
          icons: { sun: "☀", moon: "☾" }
        });
      }
    </script>

    <script>
      const $ = (id) => document.getElementById(id);
      const urlEl = $("url");
      const keyEl = $("key");
      const outEl = $("out");
      const btn = $("btn");

      try {
        const saved = localStorage.getItem("abvx_api_key");
        if (saved) keyEl.value = saved;
      } catch {}

      async function shorten() {
        const url = urlEl.value.trim();
        const key = keyEl.value.trim();
        if (!url) throw new Error("Paste a URL");
        if (!key) throw new Error("Enter API key");

        try { localStorage.setItem("abvx_api_key", key); } catch {}

        const res = await fetch("/api/shorten", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": key
          },
          body: JSON.stringify({ url })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error("Error " + res.status + ": " + (data && data.error ? data.error : "unknown"));
        return data.shortUrl;
      }

      async function copy(text) {
        await navigator.clipboard.writeText(text);
      }

      btn.addEventListener("click", async () => {
        outEl.style.display = "none";
        btn.disabled = true;
        btn.textContent = "Working…";
        try {
          const shortUrl = await shorten();
          await copy(shortUrl);
          outEl.innerHTML = "Copied: <a href=\"" + shortUrl + "\" target=\"_blank\" rel=\"noreferrer\">" + shortUrl + "</a>";
          outEl.style.display = "block";
          btn.textContent = "Shorten & Copy";
        } catch (e) {
          outEl.textContent = String(e);
          outEl.style.display = "block";
          btn.textContent = "Shorten & Copy";
        } finally {
          btn.disabled = false;
        }
      });
    </script>
  </body>
</html>
`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Landing
    if (url.pathname === "/" && (request.method === "GET" || request.method === "HEAD")) {
      // Replace base url placeholders if needed (future-proof)
      return html(LANDING_HTML.replaceAll("{{BASE_URL}}", env.BASE_URL || ""));
    }

    // Health
    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    // API: shorten
    if (url.pathname === "/api/shorten") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

      const key = request.headers.get("X-API-Key") || "";
      if (!env.API_KEY || key !== env.API_KEY) return unauthorized();

      const ip = getClientIp(request);
      if (!(await rateLimitOk(env, ip))) {
        return json({ error: "rate_limited" }, { status: 429 });
      }

      let body: any;
      try {
        body = await request.json();
      } catch {
        return badRequest("Invalid JSON");
      }

      const inputUrl = body?.url;
      if (typeof inputUrl !== "string" || inputUrl.trim().length === 0) {
        return badRequest("Missing 'url'");
      }

      let normalized: string;
      try {
        normalized = normalizeUrl(inputUrl);
      } catch (e: any) {
        return badRequest(e?.message || "Invalid URL");
      }

      // Deterministic slug: first 6 chars of base32(sha256(normalized))
      const hash = await sha256Base32(normalized);
      const slug = hash.slice(0, 6);

      const existing = await env.LINKS.get(slug);
      if (existing && existing !== normalized) {
        // Extremely unlikely collision; extend slug length to 10
        const slug10 = hash.slice(0, 10);
        await env.LINKS.put(slug10, normalized);
        return json({ slug: slug10, shortUrl: `${env.BASE_URL.replace(/\/$/, "")}/${slug10}` });
      }

      if (!existing) {
        await env.LINKS.put(slug, normalized);
      }

      return json({ slug, shortUrl: `${env.BASE_URL.replace(/\/$/, "")}/${slug}` });
    }

    // Redirect handler: /:slug
    if (request.method === "GET" || request.method === "HEAD") {
      const slug = url.pathname.replace(/^\//, "");
      if (!slug) return notFound();

      // disallow API paths
      if (slug.startsWith("api") || slug.startsWith("health")) {
        return notFound();
      }

      const target = await env.LINKS.get(slug);
      if (!target) return notFound();

      return Response.redirect(target, 302);
    }

    return new Response("Not Found", { status: 404 });
  }
};
