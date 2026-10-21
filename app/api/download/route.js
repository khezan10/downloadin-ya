import { NextResponse } from 'next/server'
import { saveDownload } from '@/lib/db'

// TikWM API — free, no API key, no signup.
// https://www.tikwm.com/api/
// Free tier limit: 1 request per second (per client IP).
// Project scope: TikTok only. Other platforms are on the roadmap.

const TIKWM_ENDPOINT = 'https://www.tikwm.com/api/'
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

    if (!isTikTokUrl(url)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Only TikTok links are supported right now. Instagram, Facebook, X and the rest are coming soon.',
        },
        { status: 400 }
      )
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'

    const downloadData = await downloadTikTok(url)

    // Fire-and-forget so a database hiccup never fails the download.
    saveDownload({
      platform: 'tiktok',
      originalUrl: url,
      ip,
      title: downloadData.title,
      thumbnail: downloadData.thumbnail,
      success: true,
    }).catch((err) => console.error('saveDownload failed:', err?.message || err))

    return NextResponse.json({ success: true, data: downloadData })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process this video.' },
      { status: 500 }
    )
  }
}

export function isTikTokUrl(url) {
  const u = String(url).toLowerCase()
  return (
    u.includes('tiktok.com') ||
    u.includes('vm.tiktok.com') ||
    u.includes('vt.tiktok.com') ||
    u.includes('m.tiktok.com')
  )
}

async function downloadTikTok(url) {
  const response = await fetch(`${TIKWM_ENDPOINT}?url=${encodeURIComponent(url)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': UA,
    },
    // TikWM CDN links are short-lived; fail fast instead of hanging.
    signal: AbortSignal.timeout(20000),
  })

  if (!response.ok) {
    throw new Error(
      `Upstream service returned HTTP ${response.status}. Please try again in a moment.`
    )
  }

  const data = await response.json()

  if (data.code !== 0 || !data.data) {
    throw new Error(
      data.msg ||
        'Could not fetch this video. Make sure the link is correct and the video is public.'
    )
  }

  const video = data.data
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
    id: video.id || null,
    title: video.title || 'TikTok Video',
    thumbnail: video.cover || video.origin_cover || video.ai_dynamic_cover || null,
    duration: video.duration || null,
    author: video.author?.nickname || video.author?.unique_id || null,
    authorUsername: video.author?.unique_id || null,
    authorAvatar: video.author?.avatar || null,
    playCount: video.play_count || 0,
    likeCount: video.digg_count || 0,
    commentCount: video.comment_count || 0,
    shareCount: video.share_count || 0,
    downloads,
    audio: video.music
      ? {
          title: video.music_info?.title || 'Original Sound',
          author: video.music_info?.author || video.author?.nickname || null,
          url: video.music,
          duration: video.music_info?.duration || video.duration || null,
          cover: video.music_info?.cover || null,
        }
      : null,
  }
}
