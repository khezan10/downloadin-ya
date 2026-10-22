# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Single author across the whole history.** Every commit is now authored and
  committed by `Khezan Amartya <khezanamartya@gmail.com>`, the address that is
  verified on the `khezan10` account, so GitHub attributes all of them to that
  account instead of leaving them as an unlinked author. The `Co-authored-by:`
  and `Signed-off-by:` trailers that put bots into the contributor list were
  dropped, and the original commit dates were kept, so the history still reads
  as a timeline rather than a single burst.
- **The checks can be started by hand.** `CI` and `Secret scan` now also react
  to `workflow_dispatch`, so a run can be triggered from the Actions tab
  without pushing a commit.
- **The upstreams are watched.** A new scheduled workflow probes the deployed
  site and its three resolvers every six hours. When one of them stops
  answering it opens a single tracking issue, updates that issue on every
  later failure, and closes it once everything answers again.

## [1.0.0] — 2026-10-22

The first stable release. Seven platforms, three free upstreams, a test suite,
and CI on every push.

### Added

- **Pinterest support** — video pins (MP4) and image pins (full-resolution
  JPEG). All four published URL shapes are handled: the numeric id, the
  `slug--id` form, the country domains (`pinterest.co.uk`, `pinterest.de`, …)
  and `pin.it` short links.
- **Upstream status panel** — a live view of the three resolvers behind the
  site: which one is primary, which are fallbacks, whether each is online,
  how long it took, and what share of recent downloads it served.
- **Direct CDN links** — the upstreams hand back their own proxy and
  converter URLs, and those routes answer HTTP 403 to a visitor. Both are now
  unwrapped to the plain CDN link for the same file.
- **Tests** — 48 unit tests over the URL detection, Pinterest normalisation,
  link unwrapping and the upstream registry.
- **CI** — lint, tests and a production build on Node 20 and 22, plus a secret
  scan that fails the build if a connection string or token reaches a commit.
- **Dependabot** — weekly minor and patch updates for npm and GitHub Actions.
- **Rate limiting** — 20 download requests per minute per address, with a
  `Retry-After` header, so one client cannot spend the shared upstreams'
  quota.
- **`/api/health`** — a liveness probe reporting uptime and whether the
  optional database is reachable.
- **`robots.txt`, `sitemap.xml`, a themed 404 page and an error boundary.**
- **An Open Graph share card** at `public/og.png`.

### Fixed

- **Pinterest links were detected as Twitter.** The platform check matched on
  a substring of the whole URL, and `"t.co"` is a substring of
  `"pinterest.com"` — so every Pinterest link took the Twitter branch and the
  Pinterest resolver was never used. The check now works on the hostname.
- **The form rejected Pinterest links** even though the backend accepted
  them. The form and the API now share one detector.
- **Download links from two of the three upstreams returned HTTP 403** to
  visitors because the upstream's own proxy route was handed over unchanged.
  Both are now unwrapped to the direct CDN link.
- **TikWM was blocked by serverless egress.** It answers a request that does
  not look like a browser with an empty body. The client now tries a ladder
  of header sets, and the health probe uses the same one the download route
  does — so "ONLINE" in the status panel always means the fallback works.
- **Pinterest images were served as a 564px preview** even though the site
  promises full resolution. The original file (measured 1200x1680 against
  564x790) is now used.
- **A duplicate audio button** on Pinterest video pins, which wrapped the
  same MP4 as the video.
- **A leaked MongoDB connection string** was tracked in the repository. It has
  been removed from the working tree and from the whole git history, and the
  secret-scan workflow now fails the build if one reaches a commit.

### Security

- The MongoDB credential that was exposed in the repository history has been
  purged. **Rotate the database password** — the old one was public for a
  while and the history rewrite cannot un-publish it.

## [0.9.0]

- Multi-platform support (TikTok, Instagram, YouTube, Facebook, X, Threads)
  through three keyless upstreams.
- Recent downloads panel with masked IP addresses.
- The upstream status panel and the share improvements that followed it.

[1.0.0]: https://github.com/khezan10/downloadin-ya/releases/tag/v1.0.0
[0.9.0]: https://github.com/khezan10/downloadin-ya/releases/tag/v0.9.0
