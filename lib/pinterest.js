/**
 * Pinterest URL handling.
 *
 * Pinterest publishes a pin in more than one shape:
 *   - https://www.pinterest.com/pin/181199585001797964/   numeric id
 *   - https://www.pinterest.com/pin/pretty-slug--181199585001797964/  slug + id
 *   - https://uk.pinterest.com/pin/181199585001797964/    country domain
 *   - https://pin.it/abc123                              short link
 *
 * The upstream's platform matcher only recognises the numeric form, so the
 * slug form and country domains have to be rewritten before the request is
 * sent — otherwise they arrive classified as generic content and fail.
 *
 * Note on the opaque `e1_…` ids: Pinterest started publishing those in its
 * logged-out *search and board* results. A pin that a person shares or pastes
 * is still addressed by its numeric id, which is the form this handles.
 */

/** Rewrite a pin URL to the canonical numeric pinterest.com form. */
export function normalizePinterestUrl(rawUrl) {
  let url = String(rawUrl || '').trim()
  if (!url) return url

  // Drop tracking query strings and fragments — they confuse the matchers.
  url = url.split('#')[0]

  const pinMatch = url.match(/^https?:\/\/([a-z0-9.-]*pinterest\.[a-z.]+)\/pin\/([^/?#]+)/i)
  if (pinMatch) {
    let pinId = pinMatch[2]
    // Slug form: "pretty-slug--1234567890" -> "1234567890"
    const slug = pinId.match(/^(.*)--([A-Za-z0-9]+)$/)
    if (slug) pinId = slug[2]
    return `https://www.pinterest.com/pin/${pinId}/`
  }

  // Country domains: uk.pinterest.com / pinterest.co.uk / pinterest.de
  const country = url.match(/^https?:\/\/([a-z0-9.-]*\.)?pinterest\.[a-z.]+\/pin\//i)
  if (country) {
    const rest = url.replace(/^https?:\/\/[^/]+/i, '')
    return `https://www.pinterest.com${rest}`
  }

  // pin.it short links are resolved by the upstream itself — keep them.
  return url
}

export function isPinterestUrl(url) {
  const u = String(url || '').toLowerCase()
  return u.includes('pinterest.com') || u.includes('pinterest.') || u.includes('pin.it')
}
