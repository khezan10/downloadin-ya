# Downloadin Ya

A TikTok video downloader. Paste a link, get the video in HD without a watermark.
No login, no cookies, no API key.

**Live:** https://downloadin-ya.vercel.app
**Custom domain:** https://downloadin.mzg.my.id

## Supported Platforms

- **TikTok** — live now
- Instagram, Facebook, Threads, X (Twitter), YouTube — coming soon

## Features

- HD download, no watermark (plus a with-watermark fallback)
- MP3 audio download
- Title, author, duration, view and like counts
- Recent-downloads activity log with masked IP addresses
- Terminal-style dark theme with lime accent
- Staggered entrance animation matching the Zanara landing page
- Respects `prefers-reduced-motion`

## Tech Stack

- **Frontend**: Next.js 16, React 19 (App Router)
- **Database**: MongoDB Atlas (activity log only — downloads are never stored)
- **Hosting**: Vercel
- **Video API**: TikWM (`https://www.tikwm.com/api/`) — free, no API key, no signup

## About the TikWM API

The upstream is a public endpoint that needs no key and no account. Its free tier
allows roughly **1 request per second**, and that limit is applied per client IP —
so a shared server can serve many users at once. It only resolves TikTok links;
other platforms are handled by whatever API is wired in next.

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

### Build & Deploy

```bash
npm run build
```

Deploy to Vercel and set `MONGODB_URI` in the project's environment variables.
The value must be the **plaintext connection string** — Vercel encrypts it for you.

## Project Layout

```
app/
  api/download/route.js   TikTok resolve via TikWM, saves to MongoDB
  api/recent/route.js     last 5 downloads, never cached
  page.js                 hero, form, result, activity log
  globals.css             theme + staggered reveal animation
lib/
  db.js                   saveDownload / getRecentDownloads
  mongodb.js              optional MongoDB connection
```

## License

MIT © Khezan Amartya
