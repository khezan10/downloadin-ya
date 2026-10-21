import { NextResponse } from 'next/server'
import { saveDownload } from '@/lib/db'

// RapidAPI configuration
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'social-media-video-downloader.p.rapidapi.com'
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY

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
    if (platform === 'unknown') {
      return NextResponse.json(
        { success: false, error: 'Unsupported platform' },
        { status: 400 }
      )
    }

    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               'unknown'

    // Call RapidAPI based on platform
    const downloadData = await fetchVideoFromRapidAPI(url, platform)

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
  
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch') || urlLower.includes('fb.com')) {
    return 'facebook'
  }
  if (urlLower.includes('tiktok.com') || urlLower.includes('vm.tiktok.com')) {
    return 'tiktok'
  }
  if (urlLower.includes('instagram.com') || urlLower.includes('instagr.am')) {
    return 'instagram'
  }
  if (urlLower.includes('threads.net')) {
    return 'threads'
  }
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com') || urlLower.includes('t.co')) {
    return 'twitter'
  }
  if (urlLower.includes('pixiv.net') || urlLower.includes('pximg.net')) {
    return 'pixiv'
  }
  
  return 'unknown'
}

async function fetchVideoFromRapidAPI(url, platform) {
  if (!RAPIDAPI_KEY) {
    throw new Error('RapidAPI key not configured. Please add RAPIDAPI_KEY to environment variables.')
  }

  // Different API endpoints for different platforms
  let endpoint, headers, body

  // Generic social media downloader API
  const baseUrl = `https://${RAPIDAPI_HOST}`
  
  // Most RapidAPI video downloaders use similar pattern
  // Adjust based on your chosen API
  const options = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': RAPIDAPI_HOST
    },
    body: JSON.stringify({ url })
  }

  const response = await fetch(`${baseUrl}/download`, options)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || data.error || 'API request failed')
  }

  // Normalize response format
  return normalizeResponse(data, platform)
}

function normalizeResponse(data, platform) {
  // Different APIs return different structures
  // Normalize to: { title, thumbnail, duration, downloads: [{quality, format, url}] }

  // Common response patterns
  const result = {
    title: data.title || data.filename || `Video from ${platform}`,
    thumbnail: data.thumbnail || data.thumb || data.image || null,
    duration: data.duration || null,
    downloads: []
  }

  // Handle various response formats
  if (data.url) {
    // Single URL format
    result.downloads.push({
      quality: 'default',
      format: 'mp4',
      url: data.url
    })
  } else if (data.downloads || data.formats || data.links) {
    // Multiple formats
    const formats = data.downloads || data.formats || data.links || []
    formats.forEach(fmt => {
      if (fmt.url) {
        result.downloads.push({
          quality: fmt.quality || fmt.qualityLabel || 'default',
          format: fmt.format || fmt.ext || 'mp4',
          url: fmt.url
        })
      }
    })
  } else if (data.medias && Array.isArray(data.medias)) {
    // TikWM/TikTok style response
    data.medias.forEach(media => {
      result.downloads.push({
        quality: media.quality || 'default',
        format: media.extension || 'mp4',
        url: media.url
      })
    })
    result.title = data.title || data.desc || result.title
    result.thumbnail = data.cover || data.thumbnail || result.thumbnail
  }

  // Ensure at least one download option
  if (result.downloads.length === 0 && data.video_url) {
    result.downloads.push({
      quality: 'default',
      format: 'mp4',
      url: data.video_url
    })
  }

  return result
}
