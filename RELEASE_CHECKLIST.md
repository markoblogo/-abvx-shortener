# ABVX Shortener v0.2 Release Checklist

- [ ] Update `worker/wrangler.toml` variables and secrets.
- [ ] Verify `API_KEY` in Cloudflare secrets.
- [ ] Configure optional origin allowlist and non-browser policy.
- [ ] Deploy Worker and validate:
  - [ ] `GET /health`
  - [ ] `POST /api/shorten` for valid/invalid URLs
  - [ ] `GET /api/link/:slug`
  - [ ] `PUT /api/link/:slug`
  - [ ] `DELETE /api/link/:slug`
  - [ ] `GET /:slug` redirect behavior
- [ ] Pack and publish Chrome extension with updated popup permissions.
- [ ] Add note to `CHANGELOG.md` and tag release.
