import { NextResponse } from 'next/server'
import { saveDownload } from '@/lib/db'
import { resolveViaSaveFrom, normalizeSaveFrom } from '@/lib/savefrom'
import { recordUse } from '@/lib/upstreams'
import { fetchTikwm } from '@/lib/tikwm'

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

const TIKWM_ENDPOINT = 'https://www.tikwm.com/api/'
const SDD_BASE = 'https://www.socialdownloader.space'
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

    const { upstream, data: downloadData } = forced
      ? await resolveWith(url, platform, forced)
      : await resolveMedia(url, platform)
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

    return NextResponse.json({ success: true, data: { ...downloadData, upstream } })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process this link.' },
      { status: 500 }
    )
  }
}

export const SUPPORTED_PLATFORMS = [
  'tiktok',
  'instagram',
  'youtube',
  'twitter',
  'threads',
  'facebook',
  'pinterest',
]

export function detectPlatform(url) {
  const u = String(url).toLowerCase()
  if (u.includes('tiktok.com')) return 'tiktok'
  if (u.includes('instagram.com') || u.includes('instagr.am')) return 'instagram'
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
  if (u.includes('threads.net') || u.includes('threads.com')) return 'threads'
  if (u.includes('twitter.com') || u.includes('x.com') || u.includes('t.co')) return 'twitter'
  if (u.includes('facebook.com') || u.includes('fb.watch') || u.includes('fb.com')) return 'facebook'
  if (u.includes('pinterest.com') || u.includes('pin.it')) return 'pinterest'
  return 'unknown'
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
 * Try each upstream in order until one resolves the URL.
 * TikWM goes first for TikTok because it returns direct CDN links with known
 * quality labels; the socialdownloader instance covers everything else.
 */
async function resolveMedia(url, platform) {
  const errors = []

  // SaveFrom first — it covers the most platforms and returns quality labels.
  try {
    return { upstream: 'savefrom', data: normalizeSaveFrom(await resolveViaSaveFrom(url)) }
  } catch (e) {
    errors.push(e.message)
  }

  if (platform === 'tiktok') {
    try {
      return { upstream: 'tikwm', data: await viaTikwm(url) }
    } catch (e) {
      errors.push(e.message)
    }
  }

  try {
    return { upstream: 'socialdownloader', data: await viaSocialDownloader(url) }
  } catch (e) {
    errors.push(e.message)
  }

  // The upstream occasionally answers with a Cloudflare challenge page instead
  // of JSON. One retry with the same headers clears it.
  try {
    await sleep(1200)
    return { upstream: 'socialdownloader', data: await viaSocialDownloader(url) }
  } catch (e) {
    errors.push(e.message)
  }

  // TikTok can still fall back to the other upstream.
  if (platform === 'tiktok') {
    try {
      return { upstream: 'socialdownloader', data: await viaSocialDownloader(url) }
    } catch (e) {
      errors.push(e.message)
    }
  }

  throw new Error(
    errors.find((e) => !/signer|chunk|app\.js|HTTP 4\d\d/i.test(e)) ||
      errors[0] ||
      'Could not resolve this link.'
  )
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

  if (data.downloadUrl) {
    downloads.push({
      quality: 'Video',
      format: 'mp4',
      url: absolute(data.downloadUrl),
      size: meta.sizeBytes || null,
    })
  }

  // Image posts (X carousels, IG photo posts) come back as `images[]`.
  const images = Array.isArray(meta.images) ? meta.images : []
  images.forEach((img, i) => {
    if (!img || !img.url) return
    downloads.push({
      quality: images.length > 1 ? `Image ${i + 1}/${images.length}` : 'Image',
      format: 'jpg',
      url: img.url,
      size: null,
    })
  })

  // YouTube can resolve audio only (no video stream) — surface it.
  let audio = null
  if (data.audioUrl) {
    audio = { title: 'Audio', url: absolute(data.audioUrl), format: 'mp3' }
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
