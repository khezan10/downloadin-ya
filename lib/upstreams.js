/**
 * The download upstreams, in one place.
 *
 * The download route, the health endpoint and the UI all read this list, so
 * what the visitor sees can never drift from what the app actually calls.
 *
 * `role` is fixed by design: the first entry is the one every request tries
 * first, the rest are fallbacks in order.
 */
export const UPSTREAMS = [
  {
    id: 'savefrom',
    label: 'SaveFrom',
    host: 'api-wh.savefrom.co.id',
    role: 'primary',
    scope: 'all platforms',
    note: 'Signed request to SaveFrom’s own web API',
    // The signer self-heals from bundle rotations — see lib/savefrom.js.
    probeUrl: 'https://www.instagram.com/reel/DXNQ7uYjqDZ/',
  },
  {
    id: 'tikwm',
    label: 'TikWM',
    host: 'www.tikwm.com',
    role: 'fallback',
    scope: 'TikTok only',
    note: 'Public API, no key, ~1 req/sec per client IP',
    // TikWM only resolves TikTok, so it must be probed with a TikTok link or
    // it reports a false "down".
    probeUrl: 'https://www.tiktok.com/@reztechtok/video/7698850425125997831',
  },
  {
    id: 'socialdownloader',
    label: 'socialdownloader.space',
    host: 'www.socialdownloader.space',
    role: 'fallback',
    scope: 'IG, X, Threads, TikTok',
    note: 'Public instance of Vette1123/social-media-downloader (AGPL-3.0)',
    probeUrl: 'https://www.instagram.com/reel/DXNQ7uYjqDZ/',
  },
]

export const UPSTREAM_BY_ID = Object.fromEntries(UPSTREAMS.map((u) => [u.id, u]))

/**
 * Which upstream served the most recent request, and how often each one has
 * been used since this server instance warmed up.
 *
 * This is per-instance state: a cold start resets it. The authoritative
 * numbers for the UI come from the database (see lib/db.js), which is shared.
 */
const state = {
  lastUsed: null,
  lastUsedAt: null,
  counts: Object.fromEntries(UPSTREAMS.map((u) => [u.id, 0])),
}

export function recordUse(upstreamId) {
  if (!UPSTREAM_BY_ID[upstreamId]) return
  state.lastUsed = upstreamId
  state.lastUsedAt = new Date().toISOString()
  state.counts[upstreamId] = (state.counts[upstreamId] || 0) + 1
}

export function getUsage() {
  return {
    lastUsed: state.lastUsed,
    lastUsedAt: state.lastUsedAt,
    counts: { ...state.counts },
  }
}
