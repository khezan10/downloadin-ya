/**
 * SaveFrom's signed converter API — free, no API key, multi-platform.
 *
 * SaveFrom resolves media through its own web API and signs every request with a
 * routine that ships in its JS bundle. We reproduce that routine so the endpoint
 * can be called without an account. This is a client of a public web API, not a
 * documented public API, so expect it to change.
 *
 * The signer lives in a webpack chunk that SaveFrom redeploys with a new hash.
 * The chunk id and hash are discovered at runtime; the module id inside the
 * chunk is discovered by looking at what the chunk registers.
 *
 * Cold path is ~700ms (fetch + eval); warm path is ~5ms to sign.
 */

import { createHash } from 'node:crypto'
import { createContext, runInContext } from 'node:vm'

const SITE = 'https://savefrom.co.id'
const FALLBACK_API_URL = 'https://api-wh.savefrom.co.id'
const CHUNK_ID = 54
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const CACHE_TTL_MS = 10 * 60 * 1000
let cache = { at: 0, sign: null, apiUrl: FALLBACK_API_URL }

/** Evaluate a webpack chunk in a sandbox and return the signer's default export. */
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

  // The chunk registers the signer under its own module id, which is not the
  // chunk id. The chunk registers exactly one module, so use that one.
  const ids = Object.keys(captured).map(Number)
  if (ids.length === 0) throw new Error('no modules captured from the signing chunk')
  return wr(ids[0]).default
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } })
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`)
  return res.text()
}

async function loadSigner() {
  const html = await fetchText(`${SITE}/`)
  const apiUrl = (html.match(/API_URL\s*:\s*"([^"]+)"/) || [])[1] || FALLBACK_API_URL

  const appJsUrl = (html.match(/<script[^>]+src="(\/js\/app\.js[^"]*)"/) || [])[1]
  if (!appJsUrl) throw new Error('app.js script tag not found')
  const appJs = await fetchText(new URL(appJsUrl, SITE).href)

  // Both maps are needed: one holds the filename, one holds the content hash.
  const name = (appJs.match(new RegExp(`\\{${CHUNK_ID}:"([^"]+)"`)) || [])[1]
  const hash = (appJs.match(new RegExp(`\\{${CHUNK_ID}:"([0-9a-f]{8,})"`)) || [])[1]
  if (!name || !hash) throw new Error(`chunk ${CHUNK_ID} not found in app.js`)

  const code = await fetchText(`${SITE}/js/${name}.js?ch=${hash}.js`)
  const exported = evaluateChunk(code)
  const sign = await exported // the default export is a Promise
  if (typeof sign !== 'function') throw new Error('signer did not resolve to a function')
  return { sign, apiUrl }
}

async function getSigner() {
  if (cache.sign && Date.now() - cache.at < CACHE_TTL_MS) return cache
  const loaded = await loadSigner()
  cache = { at: Date.now(), ...loaded }
  return cache
}

/**
 * Resolve a media URL through SaveFrom.
 * Returns the raw upstream payload.
 */
export async function resolveViaSaveFrom(url) {
  const { sign, apiUrl } = await getSigner()
  const signed = await sign(url)

  const res = await fetch(`${apiUrl}/api/convert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: SITE,
      Referer: `${SITE}/`,
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': UA,
    },
    // Form-encoded, not JSON — JSON silently becomes URL_IS_EMPTY.
    body: new URLSearchParams(signed).toString(),
    signal: AbortSignal.timeout(45000),
  })

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('The resolver returned an unexpected response. Please try again.')
  }

  const media = Array.isArray(data.url) ? data.url : []
  if (media.length === 0) {
    const reason =
      data.message || data.response_type || data.code || 'no media returned for this link'
    throw new Error(
      String(reason).toLowerCase().includes('not found')
        ? 'This link could not be resolved. The post may be private, deleted, or region-locked.'
        : `The resolver could not handle this link (${reason}).`
    )
  }

  return data
}

/**
 * Normalize a SaveFrom payload into the app's common shape.
 * `url[].ext` carries the file extension; `url[].subname` carries the quality.
 */
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
      url: m.url,
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
    ? { title: 'Audio', url: audioMedia.url, format: 'mp3' }
    : null

  // Direct CDN links (hd/sd) have no payload wrapper and live longer than the
  // `sf-converter.com/get?payload=` links, so prefer them when present.
  if (data.hd && data.hd.url && !downloads.some((d) => d.url === data.hd.url)) {
    downloads.unshift({ quality: 'HD', format: 'mp4', url: data.hd.url, size: null })
  }

  // An image-only post (an X photo, an Instagram photo carousel) has no mp4.
  // Signal that so the caller can try the next upstream instead of returning
  // an empty download list.
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
