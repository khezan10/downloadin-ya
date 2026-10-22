# Downloadin Ya

A social media video downloader. Paste a link from TikTok, Instagram, YouTube,
Facebook, X (Twitter), Threads or Pinterest and get the media — up to six
quality options, plus MP3 audio. No login, no cookies, no API key.

[![CI](https://github.com/khezan10/downloadin-ya/actions/workflows/ci.yml/badge.svg)](https://github.com/khezan10/downloadin-ya/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/khezan10/downloadin-ya.svg)](https://github.com/khezan10/downloadin-ya/releases/latest)
[![Upstream watch](https://github.com/khezan10/downloadin-ya/actions/workflows/upstream-watch.yml/badge.svg)](https://github.com/khezan10/downloadin-ya/actions/workflows/upstream-watch.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-b4ff2b.svg)](LICENSE)

**Live:** https://downloadin.mzg.my.id
**Vercel alias:** https://downloadin-ya.vercel.app

## Supported Platforms

Live now:

| Platform | Formats |
|----------|---------|
| **TikTok** | up to 5 qualities, MP3 audio, HD without watermark |
| **Instagram** | reels, posts, carousels — video + MP3 audio |
| **YouTube** | up to 6 qualities (720p down) |
| **Facebook** | reels and videos — HD + SD |
| **X (Twitter)** | video posts and image posts |
| **Threads** | video posts and MP3 audio |
| **Pinterest** | video pins (MP4) and image pins (full-resolution JPEG) |

Coming soon: Pixiv

Pinterest accepts `pinterest.com/pin/…` in every shape it is published in —
the numeric id, the `slug--id` form, the country domains (`pinterest.co.uk`,
`pinterest.de`, …) and `pin.it` short links. All of them are rewritten to the
canonical numeric form before the request goes out.

## API

`POST /api/download` with `{ "url": "<social url>" }`.

Optional `upstream` field (or `?upstream=` query param) forces one specific
resolver — useful for verifying that a fallback still works when the primary
is healthy and never gets used. Forced requests are diagnostics: they are not
written to the activity log and do not count towards the serving share.

`GET /api/upstream-health` reports each upstream's live status, its role
(primary or fallback) and the share of recent downloads it served.

`GET /api/health` is a liveness probe: uptime and whether the optional
database is reachable.

Download requests are limited to 20 per minute per address; a request over the
limit gets `429` with a `Retry-After` header.

## Features

- HD download, no watermark (plus a with-watermark fallback)
- MP3 audio download
- Title, author, duration, view and like counts
- Recent-downloads activity log with masked IP addresses
- **Live upstream panel** — which resolver is primary, which are fallbacks,
  whether each is online, and what share of recent downloads it served
- **Direct CDN links** — the upstreams' own proxy routes are unwrapped, so the
  file is served by the CDN rather than through a third-party proxy
- Terminal-style dark theme with lime accent
- Staggered entrance animation matching the Zanara landing page
- Respects `prefers-reduced-motion`
- Rate limited, so one visitor cannot spend the shared upstreams' quota

## Tech Stack

- **Frontend**: Next.js 16, React 19 (App Router)
- **Database**: MongoDB Atlas (activity log only — downloads are never stored)
- **Hosting**: Vercel
- **Video APIs**: three free upstreams, none needs an API key or an account
  - **SaveFrom's signed converter** — TikTok, Instagram, YouTube, Facebook, X,
    Threads. The request is signed with the routine from SaveFrom's own web
    bundle (`lib/savefrom.js`), so no key is needed. This is a client of a
    public web API, not a documented one, so it can change without notice.
  - `TikWM` (`https://www.tikwm.com/api/`) — TikTok, ~1 request/second per client IP
  - `socialdownloader.space` — Instagram, X, Threads, Pinterest (public instance of
    [Vette1123/social-media-downloader](https://github.com/Vette1123/social-media-downloader), AGPL-3.0)

## About the free upstreams

No upstream needs a key, a signup, or a credit card, and none charges per
request. TikWM's free tier allows roughly **1 request per second**, applied per
client IP — so one Vercel function can serve many users at once.

The multi-platform upstream sits behind Cloudflare, which serves a JavaScript
challenge unless the request looks like a same-origin browser fetch. The route sends
the full `Sec-Fetch-*` header trio plus `Accept-Language`, and retries once, which
clears the challenge reliably.

The SaveFrom signer is cached in module scope for 10 minutes. A cold start costs
about 700 ms (fetch the chunk, evaluate it in a `node:vm` sandbox); a warm start
costs about 5 ms to sign. The chunk id, its content hash, and the module id inside
it are all discovered at runtime, so a SaveFrom redeploy does not break the site.

Both upstreams only reach what a logged-out visitor can already see: public posts
only, no private accounts, no paywalled content.

## Setup

### Prerequisites

- Node.js 20+
- A MongoDB Atlas account (optional — the site still works without it, the
  activity log is just empty)

### Environment Variables

Create `.env.local`:

```env
# Optional. Without it the activity log stays empty but downloads still work.
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/downloadin-ya?retryWrites=true&w=majority
```

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Checks

```bash
npm run check      # lint + unit tests + production build
```

`npm run lint` and `npm test` run on their own too. The test suite uses
Node's built-in runner, so it needs no extra dependency.

### Build & Deploy

```bash
npm run build
```

Deploy to Vercel and set `MONGODB_URI` in the project's environment variables.
The value must be the **plaintext connection string** — Vercel encrypts it for you.

## Project Layout

```
app/
  api/download/route.js     resolve a link, verify the link, save to MongoDB
  api/recent/route.js       last 5 downloads, never cached
  api/upstream-health/      live status of each resolver
  api/health/               liveness probe
  error.js                  error boundary
  not-found.js              404 page
  robots.js / sitemap.js    metadata routes
  page.js                   hero, form, result, activity log, upstream panel
  globals.css               theme + staggered reveal animation
lib/
  platform.js               hostname-based platform detection
  pinterest.js              Pinterest URL normalisation
  sdd.js                    unwrap the multi-platform upstream's proxy URLs
  savefrom.js               signed converter client + URL unwrapping
  tikwm.js                  TikWM client with a header ladder
  upstreams.js              the upstream registry (role, scope, probe URL)
  rate-limit.js             per-address rate limiter
  db.js / mongodb.js        optional MongoDB connection
tests/                      unit tests (node --test, no dependencies)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: `npm run check` has
to pass, and a new platform needs a public URL that resolves plus a test.

## Security

Report a vulnerability privately — see [SECURITY.md](SECURITY.md).

## License

MIT © Khezan Amartya
