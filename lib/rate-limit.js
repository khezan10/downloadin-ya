/**
 * A small per-IP rate limiter.
 *
 * The upstreams are free and shared, so an unbounded amount of traffic from
 * one address would spend someone else's quota and get the whole site
 * throttled. This keeps a single client from doing that.
 *
 * The counters live in the memory of the running instance. On a serverless
 * deployment that means the limit is per instance rather than global — enough
 * to stop a runaway client, not enough to be a hard global quota. The limit is
 * deliberately generous: the point is to catch abuse, not to inconvenience a
 * person downloading a few videos.
 */

const WINDOW_MS = 60 * 1000
const MAX_REQUESTS = 20

/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map()

// Keep the map from growing without bound on a long-lived instance.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000
let lastSweep = Date.now()

function sweep(now) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

/**
 * Check whether an address may make another request.
 * @returns {{ allowed: boolean, remaining: number, retryAfter: number }}
 */
export function checkRateLimit(key, { windowMs = WINDOW_MS, max = MAX_REQUESTS } = {}) {
  const now = Date.now()
  sweep(now)

  const id = String(key || 'unknown')
  let bucket = buckets.get(id)

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(id, bucket)
  }

  bucket.count += 1

  if (bucket.count > max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }

  return { allowed: true, remaining: Math.max(0, max - bucket.count), retryAfter: 0 }
}

/** The address a request comes from, taken from the proxy headers Vercel sets. */
export function clientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || request.headers.get('x-vercel-forwarded-for') || 'unknown'
}
