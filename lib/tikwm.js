/**
 * TikWM client.
 *
 * TikWM is a free, keyless API for TikTok. It answers most callers fine, but
 * some networks get an empty response body back — including serverless
 * egress, where it returned HTTP 200 with a zero-length body in ~30 ms while
 * the same request from a laptop returned 4.9 KB of JSON.
 *
 * The fix is to send a request that looks like a browser, and to try more than
 * one header set, because which one gets through is not stable.
 *
 * The download route and the health probe both go through `fetchTikwm`, so
 * "ONLINE" in the monitor always means the fallback really works.
 */

const ENDPOINT = 'https://www.tikwm.com/api/'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/**
 * Header sets to try, in order. Each is a complete set — a partial one is
 * what got blocked in the first place.
 */
export const TIKWM_VARIANTS = [
  {
    name: 'browser',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': UA,
      Referer: 'https://www.tikwm.com/',
      Origin: 'https://www.tikwm.com',
    },
  },
  {
    name: 'referer-only',
    headers: {
      Accept: 'application/json',
      'User-Agent': UA,
      Referer: 'https://www.tikwm.com/',
    },
  },
  {
    name: 'minimal',
    headers: {
      Accept: 'application/json',
      'User-Agent': UA,
    },
  },
]

/**
 * Call TikWM and return the parsed body.
 * Tries every header set in turn; the first that answers wins.
 */
export async function fetchTikwm(url, { timeout = 20000 } = {}) {
  const target = `${ENDPOINT}?url=${encodeURIComponent(url)}`
  const failures = []

  for (const variant of TIKWM_VARIANTS) {
    let res
    let text
    try {
      res = await fetch(target, {
        headers: variant.headers,
        signal: AbortSignal.timeout(timeout),
      })
      text = await res.text()
    } catch (e) {
      failures.push(`${variant.name}: ${e.message}`)
      continue
    }

    if (!text.trim()) {
      // A zero-length body is the block signature, not a parser problem.
      failures.push(`${variant.name}: empty body (HTTP ${res.status})`)
      continue
    }

    let body
    try {
      body = JSON.parse(text)
    } catch {
      failures.push(`${variant.name}: non-JSON response (HTTP ${res.status})`)
      continue
    }

    if (res.ok && body.code === 0) {
      return { body, variant: variant.name }
    }

    const reason = String(body.msg || `HTTP ${res.status}`).slice(0, 120)
    failures.push(`${variant.name}: ${reason}`)
    // A structured error (code !== 0) means TikWM understood us, so the
    // remaining variants will not do better.
    if (body.code !== undefined) {
      const err = new Error(reason)
      err.tikwmFailed = true
      throw err
    }
  }

  const err = new Error(failures.join(' | '))
  err.tikwmBlocked = true
  throw err
}
