/**
 * Helpers for the socialdownloader.space upstream.
 *
 * That service returns media as a *proxy path* of its own, e.g.
 *   /api/video?url=https%3A%2F%2Fscontent-fra3-2.cdninstagram.com%2Fo1%2F...
 * Those proxy routes answer HTTP 403 to a plain browser request, so handing
 * that URL to a visitor produces a broken download button. The real file sits
 * inside the `url` query parameter — unwrapping it gives a direct CDN link
 * that the browser can fetch on its own.
 */

export const SDD_BASE = 'https://www.socialdownloader.space'

/**
 * Turn an upstream proxy path into the direct CDN URL it points at.
 * Anything that is not a proxy path is returned unchanged.
 */
export function unwrapSddProxy(url) {
  if (!url || typeof url !== 'string') return url

  // The proxy path may still be relative (/api/video?url=...) or already
  // absolute (https://www.socialdownloader.space/api/video?url=...).
  let path = url
  if (url.startsWith('http')) {
    try {
      path = new URL(url).pathname + new URL(url).search
    } catch {
      return url
    }
  }
  if (!path.startsWith('/api/')) return url

  try {
    const query = new URL(path, SDD_BASE).searchParams.get('url')
    if (query && /^https?:\/\//i.test(query)) return query
  } catch {
    /* fall through and keep the original */
  }
  return url
}

/**
 * Pinterest serves images through i.pinimg.com with the size baked into the
 * path — `/564x/…` is a compressed preview. The same file at `/originals/…`
 * is the full-resolution version (measured: 1200x1680 / 136 KB versus
 * 564x790 / 65 KB), which is what a Pinterest downloader is expected to hand
 * over.
 */
export function toPinterestOriginal(url) {
  if (!url || typeof url !== 'string') return url
  if (!/i\.pinimg\.com\/\d+x\//i.test(url)) return url
  return url.replace(/i\.pinimg\.com\/\d+x\//i, 'i.pinimg.com/originals/')
}
