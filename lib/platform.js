/**
 * Platform detection.
 *
 * Match on the hostname, never on a substring of the whole URL. A plain
 * `url.includes('t.co')` also matches "pinterest.com", because "t.co" is a
 * substring of it — that silently sent every Pinterest link to the Twitter
 * branch, and the Pinterest resolver was never used.
 */

export const SUPPORTED_PLATFORMS = [
  'tiktok',
  'instagram',
  'youtube',
  'twitter',
  'threads',
  'facebook',
  'pinterest',
]

/** The hostname of a URL, lower-cased. Empty string when there is none. */
export function hostnameOf(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`)
    return parsed.hostname.toLowerCase()
  } catch {
    return ''
  }
}

export function detectPlatform(url) {
  const host = hostnameOf(url)
  if (!host) return 'unknown'

  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok'

  if (host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am') {
    return 'instagram'
  }

  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') {
    return 'youtube'
  }

  if (host === 'threads.net' || host.endsWith('.threads.net') || host === 'threads.com') {
    return 'threads'
  }

  if (
    host === 'twitter.com' ||
    host.endsWith('.twitter.com') ||
    host === 'x.com' ||
    host.endsWith('.x.com') ||
    host === 't.co'
  ) {
    return 'twitter'
  }

  if (
    host === 'facebook.com' ||
    host.endsWith('.facebook.com') ||
    host === 'fb.watch' ||
    host === 'fb.com'
  ) {
    return 'facebook'
  }

  if (host === 'pin.it') return 'pinterest'
  if (host === 'pinterest.com' || host.endsWith('.pinterest.com')) return 'pinterest'
  // Country domains: pinterest.co.uk, pinterest.de, …
  if (/^([a-z0-9-]+\.)*pinterest\.[a-z.]{2,}$/.test(host)) return 'pinterest'

  return 'unknown'
}
