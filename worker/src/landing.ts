export const LANDING_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ABVX Shortener</title>
    <style>
      :root {
        --bg: #09090b;
        --surface: #15181d;
        --text: #eef0f2;
        --muted: #9ca3af;
        --link: #8ad9ff;
      }
      html, body {
        margin: 0;
        min-height: 100%;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        color: var(--text);
        background: var(--bg);
      }
      body {
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: min(840px, 100%);
        border: 1px solid #2f343e;
        border-radius: 16px;
        padding: 24px;
        background: linear-gradient(180deg, var(--surface), #10131a);
      }
      h1 {
        margin-top: 0;
        font-size: 1.45rem;
      }
      a {
        color: var(--link);
      }
      p {
        color: var(--muted);
      }
      .grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }
      .tile {
        border: 1px solid #2f343e;
        border-radius: 12px;
        padding: 12px;
      }
      h2 {
        margin-top: 0;
        font-size: 1rem;
      }
      code {
        color: #c6e4ff;
        word-break: break-all;
      }
      .badge {
        display: inline-block;
        border: 1px solid #304;
        background: #1d2a22;
        border-radius: 999px;
        padding: 3px 8px;
        font-size: 0.8rem;
        color: #a8e6bf;
      }
      .footer {
        margin-top: 16px;
        color: var(--muted);
        font-size: 0.9rem;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>ABVX Shortener <span class="badge">v0.3</span></h1>
      <p>
        Self-hosted URL shortener on Cloudflare Workers + KV with operational controls: API management,
        trust modes, metrics, audit events and Chrome extension UX.
      </p>

      <div class="grid">
        <div class="tile">
          <h2>Core API</h2>
          <ul>
            <li><a href="/health">GET /health</a></li>
            <li><a href="javascript:void(0)">POST /api/shorten</a> — create or fetch short URL</li>
            <li><code>GET /:slug</code> — redirect</li>
          </ul>
        </div>

        <div class="tile">
          <h2>Management</h2>
          <ul>
            <li><code>GET /api/link/:slug</code> — metadata</li>
            <li><code>PUT /api/link/:slug</code> — update settings</li>
            <li><code>DELETE /api/link/:slug</code> — soft delete / hard delete</li>
            <li><code>GET /api/links</code> — list + filters</li>
            <li><code>POST /api/links/bulk</code> — bulk disable/restore/delete</li>
          </ul>
        </div>

        <div class="tile">
          <h2>Observability</h2>
          <ul>
            <li><code>GET /api/stats</code> — redirect/API counters</li>
            <li><code>GET /api/events</code> — immutable audit trail</li>
            <li><code>GET /api/links/export</code> — json/csv export</li>
          </ul>
        </div>
      </div>

      <p class="footer">
        API controls: origin allowlist, rate limiting, URL allow/deny domains, optional precheck hook,
        private links and key-rotation support (&#96;API_KEY&#96; + &#96;API_KEYS_JSON&#96;).
      </p>
    </div>
  </body>
</html>`;
