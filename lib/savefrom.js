/**
 * SaveFrom's signed converter API — free, no API key, multi-platform.
 *
 * SaveFrom resolves media through its own web API and signs every request with a
 * routine that ships in its JS bundle. We reproduce that routine so the endpoint
 * can be called without an account. This is a client of a public web API, not a
 * documented public API, so expect it to change without notice.
 *
 * ── Self-healing ────────────────────────────────────────────────────────────
 * SaveFrom redeploys its bundle regularly, which changes the chunk filename, the
 * chunk content hash, the module id inside the chunk, and the API path. Rather
 * than pinning any of those, everything is discovered at runtime:
 *
 *   - the chunk is found by parsing the id→name and id→hash maps out of app.js
 *     and trying every candidate until one yields a working signer
 *   - the signer is found by evaluating every module the chunk registers and
 *     keeping the one whose default export resolves to a function
 *   - the API host comes from the page's own `__CONFIG__.API_URL`
 *   - the API path is read out of the bundle, falling back to `/api/convert`
 *   - a failed signature invalidates the cache and triggers an immediate
 *     re-discovery, so a rotation that lands between two requests self-heals
 *
 * The only change that cannot be self-healed from the client is a change to the
 * signing algorithm itself — that needs a code change and a deploy.
 */

import { createHash } from 'node:crypto'
import { createContext, runInContext } from 'node:vm'

const SITE = 'https://savefrom.co.id'
const FALLBACK_API_URL = 'https://api-wh.savefrom.co.id'
const FALLBACK_API_PATH = '/api/convert'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const CACHE_TTL_MS = 10 * 60 * 1000
let cache = { at: 0, sign: null, apiUrl: FALLBACK_API_URL, apiPaths: [FALLBACK_API_PATH] }

/** Evaluate a webpack chunk in a sandbox and return every module it registers. */
function evaluateChunk(code) {
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
    JSON,
    URLSearchParams,
    URL,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Promise,
    RegExp,
    Error,
    TypeError,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    AbortController,
    AbortSignal,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    ArrayBuffer,
    Map,
    Set,
    WeakMap,
    Symbol,
    Proxy,
    Reflect,
    Intl,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    // The chunk fetches a secret endpoint; the secret is embedded and the fetch
    // failure is swallowed, so a stub is enough.
    fetch: async () => ({ json: async () => ({}), ok: true, status: 200 }),
  }
  sandbox.window = sandbox
  sandbox.self = sandbox
  sandbox.globalThis = sandbox
  sandbox.navigator = { userAgent: UA }
  sandbox.location = { href: `${SITE}/`, hostname: 'savefrom.co.id', protocol: 'https:', reload() {} }
  sandbox.document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    addEventListener() {},
    cookie: '',
    documentElement: { style: {} },
    body: { appendChild() {}, classList: { add() {}, remove() {} } },
  }
  sandbox.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  sandbox.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  sandbox.XMLHttpRequest = function () {
    return { open() {}, send() {}, setRequestHeader() {}, addEventListener() {} }
  }
  sandbox.crypto = {
    subtle: {
      digest: async (algo, data) =>
        new Uint8Array(createHash('sha256').update(Buffer.from(data)).digest()),
    },
  }

  const captured = {}
  sandbox.webpackChunk = []
  sandbox.webpackChunk.push = (arr) => {
    if (arr && arr[1]) for (const k of Object.keys(arr[1])) captured[k] = arr[1][k]
  }

  createContext(sandbox)
  runInContext(code, sandbox, { timeout: 20000 })

  const modCache = {}
  function wr(id) {
    if (modCache[id]) return modCache[id].exports
    const mod = { exports: {} }
    modCache[id] = mod
    if (captured[id]) captured[id](wr, mod.exports, wr)
    return mod.exports
  }
  // Load-bearing: webpack's ES-module getter helper. Without it the chunk's
  // `default` export is invisible and the module appears to export nothing.
  wr.d = (exports, definition) => {
    for (const k in definition) {
      if (!Object.prototype.hasOwnProperty.call(exports, k)) {
        Object.defineProperty(exports, k, { enumerable: true, get: definition[k] })
      }
    }
  }
  wr.r = (e) => {
    Object.defineProperty(e, '__esModule', { value: true })
    Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' })
  }
  wr.n = (id) => wr(id)
  wr.o = (o, p) => Object.prototype.hasOwnProperty.call(o, p)
  wr.t = (v) => v
  wr.p = ''

  // Return every registered module — the signer lives under a module id that
  // is neither the chunk id nor stable across deploys, so the caller picks the
  // one that actually exports a function.
  return Object.keys(captured)
    .map(Number)
    .map((id) => ({ id, exports: wr(id) }))
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } })
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`)
  return res.text()
}

/**
 * Parse every chunk the app could load out of app.js.
 *
 * webpack emits two parallel maps: one id→filename, one id→content hash.
 * We intersect their keys and keep the names that look like chunk files, so a
 * renumbered chunk is still found.
 */
function discoverChunkCandidates(appJs) {
  const nameMap = new Map()
  const hashMap = new Map()

  for (const m of appJs.matchAll(/\{([0-9]{1,4}):"([a-zA-Z0-9._-]+)"/g)) {
    const [, id, value] = m
    if (/^[0-9a-f]{8,}$/i.test(value)) {
      hashMap.set(id, value)
    } else if (/[a-zA-Z]/.test(value)) {
      nameMap.set(id, value)
    }
  }

  const candidates = []
  for (const [id, name] of nameMap) {
    const hash = hashMap.get(id)
    if (!hash) continue
    // A chunk file is referenced as "js/<name>.js?ch=<hash>.js".
    candidates.push({ id: Number(id), name, hash })
  }

  // Prefer the chunk whose name mentions the link/converter flow, then the rest.
  candidates.sort((a, b) => {
    const score = (c) => (/link|convert|api/i.test(c.name) ? 0 : 1)
    return score(a) - score(b) || a.id - b.id
  })
  return candidates
}

/**
 * Find the API paths the bundle talks to, best guess first.
 *
 * The signed request goes to one specific endpoint, and the bundle builds it
 * as `this.baseUrl + "/api/<path>"` inside the function that also handles
 * `subscribeSignedRequestBody`. So: collect every `/api/...` literal, score it
 * by how close it sits to the signed-request markers, and prefer the one that
 * mentions "convert" as a tie-break.
 *
 * The list is returned rather than a single path because the caller can try
 * each one — a renamed endpoint then heals itself instead of 404ing forever.
 */
function discoverApiPaths(appJs) {
  const SIGNED_MARKERS = [
    'subscribeSignedRequestBody',
    'sf_url',
    '_tsc',
    'baseUrl',
  ]

  const found = new Map()
  for (const m of appJs.matchAll(/["'`](\/api\/[a-zA-Z0-9/_-]+)["'`]/g)) {
    const path = m[1]
    const start = Math.max(0, m.index - 700)
    const context = appJs.slice(start, m.index + 700)

    let score = 0
    for (const marker of SIGNED_MARKERS) {
      if (context.includes(marker)) score++
    }
    if (/convert/i.test(path)) score += 3
    // De-prioritise endpoints that clearly take a different shape.
    if (/\/ig\/|\/v1\//i.test(path)) score -= 3

    if (!found.has(path) || found.get(path).score < score) {
      found.set(path, { path, score })
    }
  }

  const ranked = [...found.values()].sort((a, b) => b.score - a.score).map((x) => x.path)
  // The known-good path is always in the list, as a safety net.
  if (!ranked.includes(FALLBACK_API_PATH)) ranked.push(FALLBACK_API_PATH)
  return ranked
}

/**
 * Pick the module whose default export resolves to the signing function.
 *
 * Every module's export is raced against a timeout: a module whose default
 * export is a promise that never settles would otherwise hang the request
 * forever, which is worse than a clean failure.
 */
async function pickSigner(modules) {
  for (const mod of modules) {
    const exported = mod.exports && mod.exports.default
    if (!exported) continue

    let resolved = exported
    if (typeof resolved.then === 'function') {
      try {
        resolved = await Promise.race([
          resolved,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('module export timed out')), 5000)
          ),
        ])
      } catch {
        continue
      }
    }
    if (typeof resolved === 'function') return resolved
  }
  return null
}

async function loadSigner() {
  const html = await fetchText(`${SITE}/`)
  const apiUrl = (html.match(/API_URL\s*:\s*"([^"]+)"/) || [])[1] || FALLBACK_API_URL

  const appJsUrl = (html.match(/<script[^>]+src="(\/js\/app\.js[^"]*)"/) || [])[1]
  if (!appJsUrl) throw new Error('app.js script tag not found')
  const appJs = await fetchText(new URL(appJsUrl, SITE).href)

  const apiPaths = discoverApiPaths(appJs)
  const candidates = discoverChunkCandidates(appJs)
  if (candidates.length === 0) {
    throw new Error('no signing chunk could be discovered in app.js')
  }

  const failures = []
  for (const cand of candidates) {
    try {
      const code = await fetchText(`${SITE}/js/${cand.name}.js?ch=${cand.hash}.js`)
      const modules = evaluateChunk(code)
      const sign = await pickSigner(modules)
      if (sign) return { sign, apiUrl, apiPaths, chunk: cand }
      failures.push(`chunk ${cand.id} (${cand.name}): no module exported a function`)
    } catch (e) {
      failures.push(`chunk ${cand.id} (${cand.name}): ${e.message}`)
    }
  }

  throw new Error(`signer discovery failed — ${failures.join('; ')}`)
}

async function getSigner() {
  if (cache.sign && Date.now() - cache.at < CACHE_TTL_MS) return cache
  const loaded = await loadSigner()
  cache = { at: Date.now(), ...loaded }
  return cache
}

/** Drop the cached signer so the next call re-discovers it from scratch. */
function bustCache() {
  cache = { at: 0, sign: null, apiUrl: FALLBACK_API_URL, apiPaths: [FALLBACK_API_PATH] }
}

/**
 * Try each candidate API path until one answers.
 *
 * A renamed endpoint is not a fatal error: the previous path 404s, the next
 * candidate is tried, and the winner is cached. Only when every path fails
 * does the caller fall back to re-discovering the whole bundle.
 */
async function callConvert(sign, apiUrl, apiPaths, url) {
  const signed = await sign(url)
  const body = new URLSearchParams(signed).toString()
  let lastError = null

  for (const apiPath of apiPaths) {
    const res = await fetch(`${apiUrl}${apiPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: SITE,
        Referer: `${SITE}/`,
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': UA,
      },
      // Form-encoded, not JSON — JSON silently becomes URL_IS_EMPTY.
      body,
      signal: AbortSignal.timeout(45000),
    })

    const text = await res.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      // Not JSON at all: this path is not the API. Try the next candidate.
      lastError = new Error('The resolver returned an unexpected response. Please try again.')
      continue
    }

    const media = Array.isArray(data.url) ? data.url : []
    if (media.length === 0) {
      const reason =
        data.message || data.response_type || data.code || 'no media returned for this link'
      const lower = String(reason).toLowerCase()
      if (lower.includes('not found')) {
        throw new Error(
          'This link could not be resolved. The post may be private, deleted, or region-locked.'
        )
      }
      const err = new Error(`The resolver could not handle this link (${reason}).`)
      err.code = data.code
      throw err
    }

    // Remember the path that worked so the next call tries it first.
    if (apiPaths[0] !== apiPath) {
      apiPaths.splice(apiPaths.indexOf(apiPath), 1)
      apiPaths.unshift(apiPath)
    }
    return data
  }

  throw lastError || new Error('The resolver could not handle this link.')
}

/**
 * Resolve a media URL through SaveFrom.
 * Returns the raw upstream payload.
 *
 * If the signature is rejected or the signer cannot be loaded, the cached
 * signer is dropped and the whole discovery runs again once — a bundle
 * rotation that lands between two requests heals itself.
 */
export async function resolveViaSaveFrom(url) {
  let signer
  try {
    signer = await getSigner()
  } catch {
    bustCache()
    signer = await loadSigner() // one clean retry
  }

  try {
    return await callConvert(signer.sign, signer.apiUrl, signer.apiPaths, url)
  } catch (e) {
    // A rejected signature or a stale signer means the bundle moved under us.
    // Re-discover once and retry before giving up.
    const recoverable =
      /signer|chunk|discovery|invalid_request|signature/i.test(e.message) ||
      e.code === 'invalid_request'
    if (!recoverable) throw e

    bustCache()
    const fresh = await loadSigner()
    return await callConvert(fresh.sign, fresh.apiUrl, fresh.apiPaths, url)
  }
}

/**
 * Normalize a SaveFrom payload into the app's common shape.
 * `url[].ext` carries the file extension; `url[].subname` carries the quality.
 */
/**
 * Unwrap a SaveFrom converter URL to the real CDN link it points at.
 *
 * SaveFrom hands out `https://media.sf-converter.com/get?__sig=…&uri=<encoded
 * real url>&filename=…`. The converter route answers HTTP 403 for a large
 * part of the time — confirmed from three unrelated addresses — while the
 * `uri` inside it is the plain CDN link for the same file and serves fine.
 * So the visitor gets the direct link, and the download does not depend on
 * the converter staying up.
 */
export function unwrapSaveFromConverter(url) {
  if (!url || typeof url !== 'string') return url
  if (!/sf-converter\.com\/get/i.test(url)) return url

  try {
    const direct = new URL(url).searchParams.get('uri')
    if (direct && /^https?:\/\//i.test(direct)) return direct
  } catch {
    /* not a URL we can parse — keep the original */
  }
  return url
}

export function normalizeSaveFrom(data) {
  const media = Array.isArray(data.url) ? data.url : []
  const meta = data.meta || {}

  const videos = media
    .filter((m) => m && m.ext === 'mp4' && m.url)
    .map((m) => ({
      // subname is inconsistent: "1080", "1080p", "HD", "SD". Only append the
      // "p" to bare numeric resolutions, so labels never read "1080pp" or "HDp".
      quality: formatQuality(m.subname) || m.name || 'Video',
      format: 'mp4',
      url: unwrapSaveFromConverter(m.url),
      size: null,
    }))

  // Keep the best few, highest first, and drop duplicate quality labels.
  const seen = new Set()
  const downloads = []
  for (const v of videos) {
    if (seen.has(v.quality)) continue
    seen.add(v.quality)
    downloads.push(v)
    if (downloads.length >= 8) break
  }

  const audioMedia = media.find((m) => m && m.ext === 'mp3' && m.url)
  const audio = audioMedia
    ? { title: 'Audio', url: unwrapSaveFromConverter(audioMedia.url), format: 'mp3' }
    : null

  // Direct CDN links (hd/sd) have no payload wrapper and live longer than the
  // `sf-converter.com/get?payload=` links, so prefer them when present.
  if (data.hd && data.hd.url) {
    const hdUrl = unwrapSaveFromConverter(data.hd.url)
    if (!downloads.some((d) => d.url === hdUrl)) {
      downloads.unshift({ quality: 'HD', format: 'mp4', url: hdUrl, size: null })
    }
  }

  // An image-only post (an X photo, an Instagram photo carousel) has no mp4.
  // Signal that so the caller can try the next upstream instead of returning
  // an empty download list to the user.
  if (downloads.length === 0 && !audio) {
    throw new Error('No video or audio stream was returned for this link.')
  }

  return {
    title: meta.title || 'Downloaded Media',
    thumbnail: data.thumb || null,
    duration: parseDuration(meta.duration),
    author: meta.author?.unique_id || meta.author?.nickname || null,
    platform: data.hosting || null,
    isPhoto: false,
    downloads,
    audio,
  }
}

function formatQuality(subname) {
  if (!subname) return null
  const value = String(subname).trim()
  if (/^\d+$/.test(value)) return `${value}p`
  if (/^\d+p$/i.test(value)) return value.toLowerCase()
  // Named tiers like HD, SD, 4K, FHD - pass through unchanged.
  return value
}

function parseDuration(value) {
  if (value == null) return null
  if (typeof value === 'number') return value
  const parts = String(value).split(':').map((n) => parseInt(n, 10))
  if (parts.some(Number.isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] || null
}
