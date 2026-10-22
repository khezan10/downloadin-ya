import { NextResponse } from 'next/server'
import { resolveViaSaveFrom, normalizeSaveFrom } from '@/lib/savefrom'

// A public link that is stable and public on every platform we support.
const PROBE_URL = 'https://www.instagram.com/reel/DXNQ7uYjqDZ/'

// TikWM only resolves TikTok, so it gets a TikTok link. Probing it with an
// Instagram URL would report a false "down".
const TIKTOK_PROBE_URL =
  'https://www.tiktok.com/@reztechtok/video/7698850425125997831'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Probe the download upstreams and report which ones are alive right now.
 *
 * The SaveFrom signer self-heals from most bundle rotations, but not from a
 * change to the signing algorithm itself. This endpoint makes that visible
 * without waiting for a user to report a broken download.
 */
export async function GET() {
  const checkedAt = new Date().toISOString()
  const upstreams = []

  // 1. SaveFrom
  const started = Date.now()
  try {
    const data = normalizeSaveFrom(await resolveViaSaveFrom(PROBE_URL))
    upstreams.push({
      name: 'savefrom',
      status: 'ok',
      ms: Date.now() - started,
      downloads: data.downloads.length,
      note: data.downloads.map((d) => d.quality).join(', '),
    })
  } catch (e) {
    upstreams.push({
      name: 'savefrom',
      status: 'down',
      ms: Date.now() - started,
      error: e.message.slice(0, 160),
    })
  }

  // 2. TikWM
  const t2 = Date.now()
  try {
    const res = await fetch(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(TIKTOK_PROBE_URL)}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(20000),
      }
    )
    const body = await res.json()
    upstreams.push({
      name: 'tikwm',
      status: res.ok && body.code === 0 ? 'ok' : 'down',
      ms: Date.now() - t2,
      note: res.ok ? String(body.msg || '').slice(0, 60) : `HTTP ${res.status}`,
    })
  } catch (e) {
    upstreams.push({
      name: 'tikwm',
      status: 'down',
      ms: Date.now() - t2,
      error: e.message.slice(0, 160),
    })
  }

  // 3. socialdownloader
  const t3 = Date.now()
  try {
    const res = await fetch('https://www.socialdownloader.space/api/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Origin: 'https://www.socialdownloader.space',
        Referer: 'https://www.socialdownloader.space/',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
      },
      body: JSON.stringify({ url: PROBE_URL }),
      signal: AbortSignal.timeout(30000),
    })
    const text = await res.text()
    let ok = false
    try {
      ok = JSON.parse(text).success === true
    } catch {
      ok = false
    }
    upstreams.push({
      name: 'socialdownloader',
      status: res.ok && ok ? 'ok' : 'down',
      ms: Date.now() - t3,
      note: ok ? 'resolved' : `HTTP ${res.status}`,
    })
  } catch (e) {
    upstreams.push({
      name: 'socialdownloader',
      status: 'down',
      ms: Date.now() - t3,
      error: e.message.slice(0, 160),
    })
  }

  const healthy = upstreams.filter((u) => u.status === 'ok')
  return NextResponse.json(
    {
      success: healthy.length > 0,
      checkedAt,
      healthy: healthy.length,
      total: upstreams.length,
      upstreams,
    },
    {
      status: healthy.length > 0 ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
