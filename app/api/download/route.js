import { NextResponse } from 'next/server'
import { saveDownload } from '@/lib/db'

// RapidAPI configuration - Social Download All In One
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'social-download-all-in-one.p.rapidapi.com'
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
  if (!RAPIDAPI_KEY || RAPIDAPI_KEY === 'needs-setup') {
    throw new Error('RapidAPI key not configured. Please add RAPIDAPI_KEY to environment variables.')
  }

  // Social Download All In One API
  const baseUrl = `https://${RAPIDAPI_HOST}`
  
  // This API uses GET with url parameter
  const options = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': RAPIDAPI_HOST
    }
  }

  // Encode URL for query parameter
  const encodedUrl = encodeURIComponent(url)
  const response = await fetch(`${baseUrl}/download?url=${encodedUrl}`, options)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || data.error || 'API request failed')
  }

  // Normalize response format
  return normalizeResponse(data, platform)
}

function normalizeResponse(data, platform) {
  // Social Download All In One API response format
  // Normalize to: { title, thumbnail, duration, downloads: [{quality, format, url}] }

  const result = {
    title: data.title || data.filename || `Video from ${platform}`,
    thumbnail: null,
    duration: data.duration || null,
    downloads: []
  }

  // Handle Social Download All In One response
  // Common patterns: data.url, data.medias, data.downloads
  if (data.url) {
    result.downloads.push({
      quality: 'HD',
      format: 'mp4',
      url: data.url
    })
    result.thumbnail = data.thumbnail || data.thumb || null
    result.title = data.title || data.filename || result.title
  }

  // Multiple media formats
  if (data.medias && Array.isArray(data.medias)) {
    data.medias.forEach(media => {
      if (media.url) {
        result.downloads.push({
          quality: media.quality || media.type || 'default',
          format: media.extension || 'mp4',
          url: media.url
        })
      }
    })
    result.thumbnail = data.thumbnail || data.cover || null
  }

  // Downloads array format
  if (data.downloads && Array.isArray(data.downloads)) {
    data.downloads.forEach(dl => {
      if (dl.url) {
        result.downloads.push({
          quality: dl.quality || dl.type || 'default',
          format: dl.format || 'mp4',
          url: dl.url
        })
      }
    })
  }

  // Instagram/TikTok specific
  if (data.video_url) {
    result.downloads.push({
      quality: 'HD',
      format: 'mp4',
      url: data.video_url
    })
  }

  if (data.image_url || data.thumbnail) {
    result.thumbnail = data.image_url || data.thumbnail
  }

  if (data.desc || data.description) {
    result.title = data.desc || data.description
  }

  // Ensure at least one download
  if (result.downloads.length === 0) {
    throw new Error('No downloadable media found')
  }

  return result
}
