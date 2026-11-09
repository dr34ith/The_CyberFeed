# CyberFeed

A personal cybersecurity intelligence dashboard: news, vulnerability tracking, videos, courses
and a reading library in one static site. **No backend server, no build step, no paid services.**

![Uploading Untitled design.gif…]()

---

## Table of contents

1. [Quick start](#quick-start)
2. [How it works](#how-it-works)
3. [Views and features](#views-and-features)
4. [Project structure](#project-structure)
5. [Data files](#data-files)
6. [Sources](#sources)
7. [Automation (GitHub Actions)](#automation-github-actions)
8. [Security model](#security-model)
9. [Privacy and storage](#privacy-and-storage)
10. [AI Analyst worker (scaffold)](#ai-analyst-worker-scaffold)
11. [Customizing](#customizing)
12. [Troubleshooting](#troubleshooting)
13. [Known limitations](#known-limitations)
14. [Roadmap](#roadmap)

---

## Quick start

Requirements: Python 3.9+ (standard library only, no `pip install`) and any modern browser.

```bash
# 1. Fetch the latest articles, videos and CVE enrichment
python fetch_feeds.py

# 2. Serve the folder locally
python -m http.server 8000

# 3. Open http://localhost:8000/index.html
```

The page reads `feeds.json` first. If it is missing or stale (for example you opened
`index.html` without ever running the fetcher), the page falls back to fetching the same
sources live, in the browser, through public CORS proxies.

> Serve over HTTP rather than opening the file directly (`file://`). IndexedDB, the CSP and
> `fetch()` behave differently, or not at all, on `file://`.

## How it works

```
 RSS / Atom feeds ─┐
 YouTube channels ─┼─► fetch_feeds.py ─► feeds.json, videos.json, cve_cache.json
 CISA KEV catalog ─┤     (dedupe, cluster,        │
 NVD CVSS API ─────┘      tag, enrich)             ▼
                                         index.html + JS modules
                                         (render, filter, track state)
                                                    │
                                   localStorage + IndexedDB (your data)
```

1. **Fetcher** (`fetch_feeds.py`) pulls every source, normalizes items, clusters near-duplicate
   stories across sources (title-token Jaccard similarity within a 72-hour window), extracts and
   tags CVEs, flags CISA Known Exploited Vulnerabilities, and looks up CVSS scores from NVD
   (cached, rate-limited).
2. **Front end** is plain HTML/CSS/JS loaded as separate scripts. All user state (bookmarks, read
   marks, custom feeds, books) stays in your browser.
3. **GitHub Actions** can run the fetcher on a schedule and commit the refreshed JSON, so a
   Pages-hosted copy stays current without a server.

## Views and features

### Landing
Editorial landing screen with animated wireframe-wave bands (`ui.js`) that leads into the app.

### News
- Aggregates 18 cybersecurity RSS/Atom sources (news, advisories, vendor research blogs).
- Hero briefing with a live stats strip: total articles, unread, bookmarks, sources and
  reading time today.
- Search, time filter (24h / 7d / 30d), and category / source / tag filters.
- Auto-tagging (ransomware, malware, phishing, vulnerability, CVE extraction and more).
- **Cross-source dedupe**: the same story from several outlets is grouped into one cluster.
- **CISA KEV flagging** and **NVD CVSS** scores shown on CVE-bearing articles.
- Trending topics panel and a **Critical Watch** banner for high-severity keyword matches.
- Per-article cover images: the feed's own thumbnail when it provides one (`media:thumbnail`,
  `enclosure`, `itunes:image`, or the first `<img>` in the body), otherwise a locally generated
  gradient cover. Never a broken image, never a random stock photo.
- Bookmarks and read/unread tracking, persisted in `localStorage`.
- Card / compact view toggle and light (default) / dark theme.
- Export / import of bookmarks, read state and custom feeds as JSON.

### Intelligence (`intel.js`)
- **Daily brief**: a digest of the day's most relevant stories.
- **CVE tracker**: searchable, sortable list of CVEs seen in the feeds, with a KEV-only filter
  and paged results.
- **CVE lookup**: query any `CVE-YYYY-NNNN` ID against NVD (best effort, browser-side).

### Videos (`videos.js`)
- Latest cybersecurity news and education videos from YouTube channel feeds, written to
  `videos.json` by the fetcher.
- Topic and text filters; plays in-app via a `youtube-nocookie.com` iframe.
- Video IDs are validated against `^[\w-]{11}$` before use.

### Library
- **Books** (`books.js`): upload a PDF and read it in-page. Parsed and rendered entirely in your
  browser with [pdf.js](https://mozilla.github.io/pdf.js/) (cdnjs, pinned to `3.11.174`, loaded
  only when you open the reader). Page navigation, zoom 50%–300%, last page and zoom remembered
  per book, and a reading timer that pauses when the tab is hidden (Page Visibility API).
- **Shelves** (`shelves.js`, `trending-books.js`): an animated bookshelf. Your uploads appear on
  a "Your reads" shelf; a curated list of must-read books across Programming, Networking,
  Self-Help, Productivity, Mindset and Cyber & Career fills the rest. Spines are drawn in CSS,
  so no images or network are needed.
- **Courses** (`courses.js`): YouTube courses that play inside the app, grouped by topic, with
  support for adding your own custom videos/playlists.
- **Investigations**: create / list / delete case notes.

### Resources
Curated reference links for tools, learning and practice.

### Keyboard shortcuts (News view)

| Key | Action |
|-----|--------|
| `/` | Focus search |
| `j` / `k` | Next / previous article |
| `o` | Open selected article |
| `b` | Bookmark selected article |
| `t` | Toggle theme |

## Project structure

```
index.html            Page shell, markup, CSP, view containers
theme.css             Editorial theme (yellow frame, white sheet, black rules); overrides inline tokens
render-helpers.js     Shared DOM/format helpers (window.CF, incl. CF.el); loaded first
app.js                News logic: fetch/parse, render, filters, tags, state
intel.js              Daily brief, CVE tracker, CVE lookup
videos.js             Videos tab
books.js              PDF reader: IndexedDB storage, pdf.js lazy-load, reading timer
shelves.js            Animated bookshelf for the Library
trending-books.js     Curated book list (static data)
courses.js            YouTube courses mode
ui.js                 Decorative wave bands
fetch_feeds.py        Stdlib-only fetcher (writes the JSON data files)
feeds.json            Generated article snapshot
videos.json           Generated video snapshot
cve_cache.json        Cached NVD CVSS lookups
channel_ids.json      Cached YouTube channel-ID resolutions
favicon.svg           Icon
worker/               Cloudflare Worker scaffold for the AI Analyst (not deployed)
.github/workflows/    Scheduled feed refresh
```

## Data files

| File | Written by | Purpose |
|------|-----------|---------|
| `feeds.json` | `fetch_feeds.py` | Normalized, deduped, tagged, KEV/CVSS-enriched articles |
| `videos.json` | `fetch_feeds.py` | Recent videos from configured YouTube channels |
| `cve_cache.json` | `fetch_feeds.py` | CVE → CVSS cache so NVD is not re-queried every run |
| `channel_ids.json` | `fetch_feeds.py` | Resolved channel IDs, so a typo or YouTube hiccup never breaks a run |

## Sources

Defined in `SOURCES` in `fetch_feeds.py`:

| Category | Sources |
|----------|---------|
| News | The Hacker News, BleepingComputer, Krebs on Security, Dark Reading, SecurityWeek, The Record, The Register Security, Security Affairs |
| Analysis | Schneier on Security |
| Advisory | CISA Advisories |
| Research | Cisco Talos, Unit 42 (Palo Alto), SANS Internet Storm Center, Google Project Zero |
| Vendor | Sophos News, Microsoft Security Blog, CrowdStrike Blog, Malwarebytes Labs |

Enrichment sources: the [CISA KEV catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
and the [NVD CVE API 2.0](https://nvd.nist.gov/developers/vulnerabilities) (no API key; the fetcher
sleeps 6 seconds between calls to respect the unauthenticated rate limit).

Three originally planned sources had dead feeds and were swapped: Sophos (trailing-slash fix),
MSRC (replaced by Microsoft Security Blog) and Google Cloud/Mandiant (replaced by Cisco Talos).

## Automation (GitHub Actions)

`.github/workflows/update-feeds.yml` runs `python fetch_feeds.py` on a schedule and via manual
`workflow_dispatch`, then commits `feeds.json`, `cve_cache.json`, `videos.json` and
`channel_ids.json` only if something changed (commit message `Update feeds.json [automated]`).

- Python 3.12, no dependencies to install.
- `concurrency: update-feeds` prevents overlapping runs.
- GitHub's scheduler may delay or skip very frequent crons; treat the interval as best effort.
  Consider relaxing it (for example every 15–30 minutes) to save Actions minutes.

To publish: push to GitHub and enable **Settings → Pages** on the `main` branch root.

## Security model

- **No raw feed HTML ever reaches the DOM.** Content is sanitized, and newer modules build the
  DOM with `CF.el` rather than `innerHTML`.
- Links are restricted to `http(s)`. A link that fails validation renders as a visibly disabled
  "⚠ link unavailable" title instead of a silent dead link.
- YouTube video and playlist IDs are validated by regex before being placed in an iframe.
- Uploaded book titles (user-controlled filenames) are always rendered as text.

### Content Security Policy

```
default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; worker-src 'self' blob: https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src https: data: blob:; connect-src *; base-uri 'self'; form-action 'none'
```

- `script-src` / `worker-src` allow exactly one external host (cdnjs) for pdf.js and its worker,
  the one approved third-party dependency.
- `img-src` allows `https:` (feed thumbnails), `data:` (generated covers) and `blob:` (pdf.js
  page rendering).
- `connect-src *` is open deliberately for the CORS-proxy live-feed fallback.
- YouTube embeds use `youtube-nocookie.com`; if you tighten the CSP, make sure `frame-src` still
  permits it.

## Privacy and storage

| Data | Where | Synced? |
|------|-------|---------|
| Bookmarks, read state, custom feeds/tags, watchlist, theme | `localStorage` | No |
| Uploaded PDFs, reading time, investigations, study cards | IndexedDB | No |

Nothing you add is uploaded anywhere. Clearing site data erases it, so use **Export** regularly.
The only outbound requests are to feed sources, CORS proxies (fallback only), NVD (CVE lookup),
cdnjs (pdf.js) and YouTube (playing videos).

## AI Analyst worker (scaffold)

`worker/` contains a Cloudflare Worker skeleton for planned AI features (`/explain`, `/ask`,
`/study-card`, `/investigate`, `/compare-sources`, `/daily-brief`) backed by the Anthropic
Messages API. **It is not deployed and nothing in the app calls it.** The request/response
contracts are documented in `worker/index.js`; prompts are `TODO`s. See
[worker/README.md](worker/README.md) for the deployment steps (`wrangler login`,
`wrangler secret put ANTHROPIC_API_KEY`, set `ALLOWED_ORIGIN`). Never commit an API key.

## Customizing

- **Add or remove a news source**: edit `SOURCES` in `fetch_feeds.py` (`id`, `name`, `url`,
  `category`), then re-run the fetcher.
- **Add a YouTube channel**: edit `VIDEO_CHANNELS` in `fetch_feeds.py`.
- **Add a book to the shelves**: append to `window.CF_TRENDING_BOOKS` in `trending-books.js`
  (`title`, `author`, `category`, `why`). Bundle a PDF via `CF_BUILTIN_BOOKS`.
- **Add a course**: edit `window.CF_COURSES` / `CF_COURSE_TOPICS`, or add one at runtime from the
  Courses UI (stored in `localStorage` under `cf_courses_custom`).
- **Restyle**: change the design tokens at the top of `theme.css`.
- **Tune dedupe**: `CLUSTER_WINDOW_SECONDS` and `CLUSTER_JACCARD_THRESHOLD` in `fetch_feeds.py`.

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| Page shows old or no articles | Run `python fetch_feeds.py`; hard-refresh the browser |
| Books tab does nothing offline | pdf.js loads from cdnjs; connect once, or vendor it locally and update the CSP |
| CVE scores missing | NVD is rate limited; they fill in over subsequent runs via `cve_cache.json` |
| A feed is empty | Its URL may have died; check the fetcher output for that source ID |
| Works on `localhost` but not by double-click | Serve over HTTP, not `file://` |
| Lost bookmarks/books | Browser data was clear
ed; restore bookmarks from an export (books are not exported) |

## Known limitations

- Locally you refresh `feeds.json` manually; the GitHub Action does it for a hosted copy.
- No PWA / offline support.
- The article list renders at most 300 items (no virtualization yet).
- Books: no in-PDF text search, annotations/highlights or metadata-derived titles.
- Investigations are create/list/delete only. AI-assisted IOC/technique extraction depends on the
  undeployed worker.
- Study cards have a data layer (IndexedDB `study_cards`) but no generation UI.
- Export/import covers bookmarks, read state, custom feeds/tags, watchlist and
  study/investigate/watch intents. **Books and Investigations are not exported** (PDF blobs are a
  bigger lift).

## Roadmap

- `sources.json`-driven fetcher and OPML source management
- Watchlist alerts, scoring and emailed/daily digest
- Charts and trend views
- PWA with offline reading
- Deploy the AI Analyst worker and wire up "Ask AI" actions
- Export/import for Books and Investigations
