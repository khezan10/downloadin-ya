import { NextResponse } from 'next/server'
import { saveDownload } from '@/lib/db'

// OmegaTech API - FREE forever, no API key required
// https://api.omegatech.app
const OMEGATECH_HOST = 'api.omegatech.app'

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
        { success: false, error: 'Unsupported platform. Supported: Facebook, TikTok, Instagram, Threads, X/Twitter, Pinterest, YouTube' },
        { status: 400 }
      )
    }

    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               'unknown'

    // Call OmegaTech API (FREE, no API key)
    const downloadData = await fetchFromOmegaTech(url, platform)

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
  if (urlLower.includes('tiktok.com') || urlLower.includes('vm.tiktok.com') || urlLower.includes('vt.tiktok.com')) {
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
  if (urlLower.includes('pinterest.com') || urlLower.includes('pin.it')) {
    return 'pinterest'
  }
  if (urlLower.includes('pixiv.net') || urlLower.includes('pximg.net')) {
    return 'pixiv'
  }
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return 'youtube'
  }
  
  return 'unknown'
}

async function fetchFromOmegaTech(url, platform) {
  let endpoint = ''
  let params = new URLSearchParams()
  
  // Choose endpoint based on platform
  if (platform === 'facebook') {
    endpoint = '/api/download/Facebook'
    params.append('action', 'resolve')
    params.append('url', url)
    params.append('quality', 'hd')
  } else if (platform === 'pinterest') {
    endpoint = '/api/download/Pinterest'
    params.append('action', 'download')
    params.append('url', url)
  } else {
    // All-in-one for TikTok, Instagram, Threads, Twitter, etc
    endpoint = '/api/download/aio'
    params.append('action', 'resolve')
    params.append('url', url)
  }

  const apiUrl = `https://${OMEGATECH_HOST}${endpoint}?${params.toString()}`
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  })

  const data = await response.json()

  if (!response.ok || data.error) {
    throw new Error(data.error || data.message || 'Failed to fetch from API')
  }

  return normalizeResponse(data, platform)
}

function normalizeResponse(data, platform) {
  const result = {
    title: data.title || data.filename || `Video from ${platform}`,
    thumbnail: null,
    duration: data.duration || null,
    downloads: []
  }

  // Direct URL format
  if (data.url || data.downloadUrl || data.videoUrl) {
    const videoUrl = data.url || data.downloadUrl || data.videoUrl
    result.downloads.push({
      quality: 'HD',
      format: 'mp4',
      url: videoUrl
    })
    result.thumbnail = data.thumbnail || data.thumb || null
  }

  // Medias array format
  if (data.medias && Array.isArray(data.medias)) {
    data.medias.forEach(media => {
      if (media.url) {
        result.downloads.push({
          quality: media.quality || media.type || 'HD',
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
          quality: dl.quality || 'HD',
          format: dl.format || 'mp4',
          url: dl.url
        })
      }
    })
  }

  // Quality variants (hd/sd)
  if (data.hd || data.sd) {
    if (data.hd) {
      result.downloads.push({ quality: 'HD', format: 'mp4', url: data.hd })
    }
    if (data.sd) {
      result.downloads.push({ quality: 'SD', format: 'mp4', url: data.sd })
    }
  }

  // Audio only
  if (data.audio || data.audioUrl) {
    result.downloads.push({
      quality: 'Audio',
      format: 'mp3',
      url: data.audio || data.audioUrl
    })
  }

  // Set title and thumbnail
  if (data.title) result.title = data.title
  if (data.desc || data.description) result.title = data.desc || data.description
  if (data.thumbnail || data.thumb || data.cover) {
    result.thumbnail = data.thumbnail || data.thumb || data.cover
  }

  // Ensure at least one download
  if (result.downloads.length === 0) {
    throw new Error('No downloadable media found')
  }

  return result
}
