export const LANDING_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ABVX Shortener</title>
    <style>
      :root {
        --bg: #0b0c10;
        --text: #eef0f2;
        --muted: #9ca3af;
      }
      html, body {
        margin: 0;
        min-height: 100%;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        color: var(--text);
        background: #09090b;
      }
      body {
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: min(720px, 100%);
        border: 1px solid #2f343e;
        border-radius: 16px;
        padding: 24px;
        background: linear-gradient(180deg, #15181d, #10131a);
      }
      h1 {
        margin-top: 0;
      }
      a {
        color: #8ad9ff;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>ABVX Shortener</h1>
      <p>Minimal, personal URL shortener built on Cloudflare Workers + KV.</p>
      <ul>
        <li><a href="/health">health</a></li>
        <li><code>POST /api/shorten</code> — create or lookup short links</li>
        <li><code>GET /:slug</code> — redirect</li>
        <li><code>GET /api/link/:slug</code> — link metadata (auth required)</li>
        <li><code>PUT /api/link/:slug</code> — update target, ttl, disable</li>
        <li><code>DELETE /api/link/:slug</code> — soft delete</li>
      </ul>
    </div>
  </body>
</html>`;
