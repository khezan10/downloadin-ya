import { NextResponse } from 'next/server'
import { saveDownload } from '@/lib/db'
import { resolveViaSaveFrom, normalizeSaveFrom } from '@/lib/savefrom'
import { recordUse } from '@/lib/upstreams'
import { fetchTikwm } from '@/lib/tikwm'
import { SDD_BASE, unwrapSddProxy, toPinterestOriginal } from '@/lib/sdd'
import { normalizePinterestUrl, isPinterestUrl } from '@/lib/pinterest'
import { detectPlatform, SUPPORTED_PLATFORMS } from '@/lib/platform'
import { checkRateLimit, clientKey } from '@/lib/rate-limit'

// Three free upstreams. None needs an API key, an account, or a credit card:
//   1. SaveFrom's signed converter — multi-platform (TikTok, IG, X, Threads,
//      YouTube, Facebook, Pinterest), no key, no signup. The request is signed
//      with the routine from SaveFrom's own bundle; see lib/savefrom.js.
//   2. TikWM — https://www.tikwm.com/api/ (TikTok, 1 req/sec per client IP)
//   3. socialdownloader.space — a public instance of
//      Vette1123/social-media-downloader (AGPL-3.0). It returns a relative
//      proxy path, so we rewrite it to an absolute URL the browser can fetch.
//
// Order matters: SaveFrom resolves the most platforms and the most qualities,
// so it goes first. The others are fallbacks for when its signature goes stale.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export async function POST(request) {
  try {
    const body = await request.json()
    const url = String(body?.url || '').trim()

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      )
    }

    // Optional override: force a specific upstream. Used to verify that a
    // fallback still works when the primary is healthy and never gets used.
    const forced = String(body?.upstream || request.nextUrl?.searchParams?.get('upstream') || '')
      .trim()
      .toLowerCase()

    // The upstreams are free and shared, so one address must not be able to
    // spend everyone else's quota.
    const limit = checkRateLimit(clientKey(request))
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many requests. Try again in ${limit.retryAfter} seconds.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfter) },
        }
      )
    }

    const platform = detectPlatform(url)
    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Unsupported platform. Supported: TikTok, Instagram, YouTube, X (Twitter), Threads, Facebook, Pinterest.',
        },
        { status: 400 }
      )
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'

    // Pinterest pins arrive in several shapes; rewrite them to the canonical
    // numeric form the upstream recognises before asking it to resolve them.
    const target = platform === 'pinterest' ? normalizePinterestUrl(url) : url

    const { upstream, data: downloadData } = forced
      ? await resolveWith(target, platform, forced)
      : await resolveMedia(target, platform)

    // A forced upstream is a diagnostic request, not real traffic. Keep it
    // out of the public activity log and out of the serving-share numbers, so
    // what visitors see stays honest.
    if (!forced) {
      recordUse(upstream)

      saveDownload({
        platform,
        originalUrl: url,
        ip,
        title: downloadData.title,
        thumbnail: downloadData.thumbnail,
        upstream,
        success: true,
      }).catch((err) => console.error('saveDownload failed:', err?.message || err))
    }

    return NextResponse.json({ success: true, data: { ...downloadData, upstream } })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process this link.' },
      { status: 500 }
    )
  }
}

/**
 * Resolve using exactly one named upstream. Throws if it is not a known one.
 */
async function resolveWith(url, platform, upstreamId) {
  if (upstreamId === 'savefrom') {
    return { upstream: 'savefrom', data: normalizeSaveFrom(await resolveViaSaveFrom(url)) }
  }
  if (upstreamId === 'tikwm') {
    return { upstream: 'tikwm', data: await viaTikwm(url) }
  }
  if (upstreamId === 'socialdownloader') {
    return { upstream: 'socialdownloader', data: await viaSocialDownloader(url) }
  }
  throw new Error(`Unknown upstream "${upstreamId}".`)
}

/**
 * Check that a resolved media URL is worth handing to a visitor.
 *
 * Returns 'ok', 'dead' (the file is gone), 'blocked' (the CDN refuses to
 * serve it) or 'unknown' (rate limited, temporary error).
 *
 * A blocked verdict is trusted because it was confirmed from three
 * unrelated addresses — the server, a laptop and a third-party proxy all
 * got the same 403 for the same link, so it is the upstream refusing
 * everyone rather than our own address being throttled.
 */
async function verifyMediaUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1023', 'User-Agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    })
    await res.arrayBuffer().catch(() => {})

    if (res.status < 400) return 'ok'
    if (res.status === 404 || res.status === 410 || res.status === 451) return 'dead'
    if (res.status === 401 || res.status === 403) return 'blocked'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Try each upstream in order until one resolves the URL.
 * TikWM goes first for TikTok because it returns direct CDN links with known
 * quality labels; the socialdownloader instance covers everything else.
 */
async function resolveMedia(url, platform) {
  // Each entry is "upstream: reason" so a failure says which backend tried and
  // why, instead of a bare sentence.
  const errors = []
  const fail = (upstream, e) => errors.push(`${upstream}: ${e.message}`)
  let lastResult = null

  // Resolve with an upstream, then confirm the link it produced is usable.
  // If the link is dead the upstream is treated as failed and the chain moves
  // on to the next one.
  const attempt = async (upstream, data) => {
    lastResult = { upstream, data }
    const probe = data?.downloads?.[0]?.url
    if (probe) {
      let verdict = await verifyMediaUrl(probe)
      // One retry: a single flaky response should not throw away a good link.
      if (verdict !== 'ok') {
        await sleep(1200)
        verdict = await verifyMediaUrl(probe)
      }
      if (verdict === 'dead' || verdict === 'blocked') {
        throw new Error(
          verdict === 'blocked'
            ? 'the media link it returned is being refused'
            : 'the media link it returned is no longer available'
        )
      }
    }
    return { upstream, data }
  }

  // Pinterest first goes through socialdownloader: it distinguishes an image
  // pin from a video pin and returns the full-resolution image, where
  // SaveFrom hands back a single generic MP4 for either.
  if (platform === 'pinterest') {
    try {
      return await attempt('socialdownloader', await viaSocialDownloader(url))
    } catch (e) {
      fail('socialdownloader', e)
    }
  }

  // SaveFrom first for the rest — it covers the most platforms and returns
  // quality labels.
  try {
    return await attempt('savefrom', normalizeSaveFrom(await resolveViaSaveFrom(url)))
  } catch (e) {
    fail('savefrom', e)
  }

  if (platform === 'tiktok') {
    try {
      return await attempt('tikwm', await viaTikwm(url))
    } catch (e) {
      fail('tikwm', e)
    }
  }

  try {
    return await attempt('socialdownloader', await viaSocialDownloader(url))
  } catch (e) {
    fail('socialdownloader', e)
  }

  // The upstream occasionally answers with a Cloudflare challenge page instead
  // of JSON. One retry with the same headers clears it.
  try {
    await sleep(1200)
    return await attempt('socialdownloader', await viaSocialDownloader(url))
  } catch (e) {
    fail('socialdownloader (retry)', e)
  }

  // TikTok can still fall back to the other upstream.
  if (platform === 'tiktok') {
    try {
      return await attempt('socialdownloader', await viaSocialDownloader(url))
    } catch (e) {
      fail('socialdownloader', e)
    }
  }

  if (lastResult) {
    // Every upstream produced a link that would not serve. Hand over the last
    // one anyway: the CDN may be refusing our address only, and a link that
    // works for the visitor beats an error message.
    return lastResult
  }

  const meaningful = errors.find(
    (e) => !/signer|chunk|app\.js|HTTP 4\d\d|rate/i.test(e)
  )
  const detail = meaningful || errors[0] || 'Could not resolve this link.'
  console.error('resolveMedia failed:', errors)
  throw new Error(detail)
}

// --- Upstream 1: TikWM (TikTok) -------------------------------------------

async function viaTikwm(url) {
  // The header ladder lives in lib/tikwm.js so the health probe exercises
  // exactly the same request this fallback uses.
  const { body } = await fetchTikwm(url)
  const video = body.data

  const downloads = []

  if (video.play) {
    downloads.push({
      quality: 'HD — No Watermark',
      format: 'mp4',
      url: video.play,
      size: video.size || null,
    })
  }
  if (video.wmplay) {
    downloads.push({
      quality: 'With Watermark',
      format: 'mp4',
      url: video.wmplay,
      size: video.wm_size || null,
    })
  }
  if (downloads.length === 0) {
    throw new Error('No downloadable media was returned for this video.')
  }

  return {
    title: video.title || 'TikTok Video',
    thumbnail: video.cover || video.origin_cover || video.ai_dynamic_cover || null,
    duration: video.duration || null,
    author: video.author?.nickname || video.author?.unique_id || null,
    authorUsername: video.author?.unique_id || null,
    playCount: video.play_count || 0,
    likeCount: video.digg_count || 0,
    downloads,
    audio: video.music
      ? {
          title: video.music_info?.title || 'Original Sound',
          url: video.music,
          format: 'mp3',
        }
      : null,
  }
}

// --- Upstream 2: socialdownloader.space (multi-platform) -------------------

async function viaSocialDownloader(url) {
  // The host sits behind Cloudflare, which serves a JS challenge unless the
  // request looks like a real same-origin browser fetch. Sending the full
  // Sec-Fetch-* trio plus Accept-Language gets through reliably.
  const response = await fetch(`${SDD_BASE}/api/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': UA,
      Origin: SDD_BASE,
      Referer: `${SDD_BASE}/`,
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
    },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(45000),
  })

  if (!response.ok) {
    throw new Error(
      response.status === 422
        ? 'This link could not be resolved. The post may be private, deleted, or region-locked.'
        : `Upstream returned HTTP ${response.status}. Please try again shortly.`
    )
  }

  // Cloudflare's challenge page arrives with HTTP 200 and an HTML body.
  const text = await response.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('The upstream service is busy right now. Please try again in a moment.')
  }

  if (!data.success) {
    throw new Error(data.error || 'This link could not be resolved.')
  }

  const meta = data.metadata || {}
  const downloads = []

  // The upstream returns its own proxy path for videos. That route answers
  // HTTP 403 to a plain browser request, so hand over the direct CDN URL it
  // wraps instead — otherwise the download button does nothing.
  if (data.downloadUrl) {
    downloads.push({
      quality: 'Video',
      format: 'mp4',
      url: absolute(unwrapSddProxy(data.downloadUrl)),
      size: meta.sizeBytes || null,
    })
  }

  // Image posts (X carousels, IG photo posts) come back as `images[]`.
  const images = Array.isArray(meta.images) ? meta.images : []
  const isPinterest = meta.platform === 'pinterest' || isPinterestUrl(url)
  images.forEach((img, i) => {
    if (!img || !img.url) return
    downloads.push({
      quality: images.length > 1 ? `Image ${i + 1}/${images.length}` : 'Image',
      format: 'jpg',
      // Pinterest hands over a /564x/ preview; /originals/ is the full file.
      url: isPinterest ? toPinterestOriginal(img.url) : img.url,
      size: null,
    })
  })

  // YouTube can resolve audio only (no video stream) — surface it.
  let audio = null
  if (data.audioUrl) {
    const audioUrl = absolute(unwrapSddProxy(data.audioUrl))
    // For a Pinterest video pin the "audio" endpoint wraps the very same MP4
    // as the video one. Offering it again would be a second button for the
    // same file, so leave it out.
    const isDuplicate = downloads.some((d) => d.url === audioUrl)
    if (!isDuplicate) {
      audio = { title: 'Audio', url: audioUrl, format: 'mp3' }
    }
  } else if (meta.rawMusicUrl) {
    audio = { title: 'Audio', url: meta.rawMusicUrl, format: 'mp4' }
  }

  if (downloads.length === 0 && !audio) {
    throw new Error('No downloadable media was returned for this link.')
  }

  return {
    title: meta.title || 'Downloaded Media',
    thumbnail: meta.thumbnail || null,
    duration: meta.duration || null,
    author: meta.author || null,
    platform: meta.platform || null,
    isPhoto: images.length > 0 && !data.downloadUrl,
    downloads,
    audio,
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Turn the upstream's relative proxy path into an absolute URL. */
function absolute(u) {
  if (!u) return u
  if (u.startsWith('http')) return u
  return `${SDD_BASE}${u.startsWith('/') ? '' : '/'}${u}`
}
