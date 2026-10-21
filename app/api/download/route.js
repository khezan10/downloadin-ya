import { NextResponse } from 'next/server'
import { saveDownload } from '@/lib/db'

// TikWM API - FREE, no API key required
// https://www.tikwm.com/api/
// Rate limit: 1 request/second (per client IP)
// Currently supports: TikTok only (other platforms coming soon)

export async function POST(request) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      )
    }

    // Detect platform
    const platform = detectPlatform(url)
    
    // Currently only TikTok is supported
    if (platform !== 'tiktok') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Currently only TikTok is supported. Instagram, Facebook, Twitter/X, and other platforms coming soon!' 
        },
        { status: 400 }
      )
    }

    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               'unknown'

    // Download TikTok video
    const downloadData = await downloadTikTok(url)

    // Save to database (fire and forget)
    saveDownload({
      platform,
      originalUrl: url,
      ip,
      title: downloadData.title,
      thumbnail: downloadData.thumbnail,
      success: true
    }).catch(console.error)

    return NextResponse.json({
      success: true,
      data: downloadData
    })

  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process video' },
      { status: 500 }
    )
  }
}

function detectPlatform(url) {
  const urlLower = url.toLowerCase()
  
  if (urlLower.includes('tiktok.com') || urlLower.includes('vm.tiktok.com') || urlLower.includes('vt.tiktok.com') || urlLower.includes('m.tiktok.com')) {
    return 'tiktok'
  }
  if (urlLower.includes('instagram.com') || urlLower.includes('instagr.am')) {
    return 'instagram'
  }
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch') || urlLower.includes('fb.com')) {
    return 'facebook'
  }
  if (urlLower.includes('threads.net')) {
    return 'threads'
  }
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com') || urlLower.includes('t.co')) {
    return 'twitter'
  }
  if (urlLower.includes('pinterest.com') || urlLower.includes('pin.it')) {
    return 'pinterest'
  }
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return 'youtube'
  }
  if (urlLower.includes('pixiv.net') || urlLower.includes('pximg.net')) {
    return 'pixiv'
  }
  
  return 'unknown'
}

// TikTok via TikWM API (FREE, no API key, confirmed working)
async function downloadTikTok(url) {
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })

  const data = await response.json()

  if (data.code !== 0 || !data.data) {
    throw new Error(data.msg || 'Failed to fetch TikTok video. Make sure the video is public and the URL is correct.')
  }

  const video = data.data

  // Build downloads array with available qualities
  const downloads = []
  
  // HD without watermark (preferred)
  if (video.play) {
    downloads.push({
      quality: 'HD (No Watermark)',
      format: 'mp4',
      url: video.play,
      size: video.size || null
    })
  }
  
  // With watermark (fallback)
  if (video.wmplay) {
    downloads.push({
      quality: 'With Watermark',
      format: 'mp4',
      url: video.wmplay,
      size: video.wm_size || null
    })
  }

  return {
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
    audio: video.music ? {
      title: video.music_info?.title || 'Original Sound',
      author: video.music_info?.author || video.author?.nickname || null,
      url: video.music,
      duration: video.music_info?.duration || video.duration || null,
      cover: video.music_info?.cover || null
    } : null
  }
}
