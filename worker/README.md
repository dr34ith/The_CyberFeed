# CyberFeed AI Analyst — Worker (scaffold, not deployed)

This folder is a **scaffold only**. Nothing in the main app (`index.html`/`app.js`)
calls this Worker — there is no live endpoint, no `ai.js`, and no "Ask AI" buttons in
the UI. It exists so the request/response contract for each planned AI feature
(`/explain`, `/ask`, `/study-card`, `/investigate`, `/compare-sources`,
`/daily-brief`) is settled ahead of time, documented in `index.js`.

## What's here

- `index.js` — Worker routing skeleton. Each route validates its input, has a
  placeholder call to the Anthropic Messages API (`callAnthropic()`), and returns
  the documented JSON contract with empty/placeholder fields. The actual prompts
  and response parsing are `TODO`s — they were deliberately not built out, since
  there's nowhere for a live app to call them yet.
- `wrangler.toml` — Worker config. `ALLOWED_ORIGIN` is a plain var (no secret
  committed) for CORS; `ANTHROPIC_API_KEY` is referenced in code but **not**
  declared with a value anywhere in this repo.

## Deploying this for real (not done as part of this pass)

1. Install Wrangler if you haven't: `npm install -g wrangler` (or use `npx wrangler`).
2. From this `worker/` folder, authenticate: `wrangler login`.
3. Set the Anthropic API key as a secret (never commit it):
   ```bash
   wrangler secret put ANTHROPIC_API_KEY
   ```
   You'll be prompted to paste the key; it's stored encrypted in Cloudflare, not in
   this repo.
4. Edit `wrangler.toml` and set `ALLOWED_ORIGIN` to your GitHub Pages origin, e.g.
   `https://yourname.github.io` (no trailing slash, no path). This is the only
   origin the Worker's CORS headers will allow — anything else gets no
   `Access-Control-Allow-Origin` header and the browser blocks the response.
5. Deploy:
   ```bash
   wrangler deploy
   ```
   This prints the Worker's URL (`https://cyberfeed-ai-analyst.<your-subdomain>.workers.dev`).
6. Only after that URL exists and actually answers requests should the main app add
   a client (`ai.js`) and UI buttons that call it. Shipping those buttons before the
   Worker is live and reachable would just be dead UI.

## Notes

- The routes are intentionally dumb placeholders right now — they call the model
  with a generic system prompt and return empty fields. Writing real prompts and
  response parsing per route is follow-up work once this is actually going to be
  deployed and used.
- Rate limiting / abuse protection (e.g. Cloudflare's built-in rate limiting rules,
  or a simple per-IP counter in a KV namespace) is not set up here and should be
  added before this is exposed to the public internet with a real API key behind it.
