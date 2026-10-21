import { NextResponse } from 'next/server'
import { saveDownload } from '@/lib/db'

// TikWM API - FREE, no API key required
// https://www.tikwm.com/api/
// Rate limit: 1 request/second (free tier)

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
        { success: false, error: 'Unsupported platform. Supported: TikTok, Instagram, Facebook, Twitter/X, Threads, Pinterest, YouTube' },
        { status: 400 }
      )
    }

    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               'unknown'

    // Download based on platform
    let downloadData
    if (platform === 'tiktok') {
      downloadData = await downloadTikTok(url)
    } else {
      // For other platforms, try multiple APIs
      downloadData = await downloadMultiPlatform(url, platform)
    }

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
  
  if (urlLower.includes('tiktok.com') || urlLower.includes('vm.tiktok.com') || urlLower.includes('vt.tiktok.com')) {
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

// TikTok via TikWM API (FREE, no API key)
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
    throw new Error(data.msg || 'Failed to fetch TikTok video')
  }

  const video = data.data

  return {
    title: video.title || 'TikTok Video',
    thumbnail: video.cover || video.origin_cover || null,
    duration: video.duration || null,
    author: video.author?.nickname || video.author?.unique_id || null,
    authorAvatar: video.author?.avatar || null,
    playCount: video.play_count || 0,
    likeCount: video.digg_count || 0,
    downloads: [
      {
        quality: 'HD (No Watermark)',
        format: 'mp4',
        url: video.play,
        size: video.size || null
      },
      {
        quality: 'With Watermark',
        format: 'mp4',
        url: video.wmplay,
        size: video.wm_size || null
      }
    ],
    audio: video.music ? {
      title: video.music_info?.title || 'Audio',
      url: video.music,
      duration: video.music_info?.duration || video.duration || null
    } : null
  }
}

// Multi-platform downloader using various free APIs
async function downloadMultiPlatform(url, platform) {
  // Try different APIs based on platform
  const apis = getApisForPlatform(platform, url)
  
  let lastError = null
  
  for (const api of apis) {
    try {
      const result = await fetchFromApi(api, url, platform)
      if (result) return result
    } catch (error) {
      lastError = error
      console.error(`API ${api.name} failed:`, error.message)
      continue
    }
  }
  
  throw new Error(lastError?.message || `No working API found for ${platform}`)
}

function getApisForPlatform(platform, url) {
  const apis = {
    instagram: [
      {
        name: 'SaveIG',
        url: `https://saveig.app/api/ajaxSearch`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://saveig.app',
          'Referer': 'https://saveig.app/'
        },
        body: `q=${encodeURIComponent(url)}&t=media`
      }
    ],
    facebook: [
      {
        name: 'FDown',
        url: `https://fdown.app/api/ajaxSearch`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://fdown.app',
          'Referer': 'https://fdown.app/'
        },
        body: `q=${encodeURIComponent(url)}`
      }
    ],
    twitter: [
      {
        name: 'SSSTik Twitter',
        url: `https://ssstik.io/api/twitter`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `url=${encodeURIComponent(url)}`
      }
    ],
    threads: [
      {
        name: 'Threads Downloader',
        url: `https://api.threads.downloader.workers.dev/?url=${encodeURIComponent(url)}`,
        method: 'GET'
      }
    ],
    youtube: [
      {
        name: 'Y2Mate',
        url: `https://www.y2mate.com/mates/analyzeV2/ajax`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: `k_query=${encodeURIComponent(url)}&k_page=home&hl=en&q_auto=0`
      }
    ]
  }
  
  return apis[platform] || []
}

async function fetchFromApi(api, url, platform) {
  const options = {
    method: api.method,
    headers: api.headers || { 'Accept': 'application/json' }
  }
  
  if (api.body) {
    options.body = api.body
  }
  
  const response = await fetch(api.url, options)
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  
  const data = await response.json()
  
  // Parse response based on API
  return parseApiResponse(data, api.name, platform)
}

function parseApiResponse(data, apiName, platform) {
  // Handle different API response formats
  if (apiName === 'SaveIG' && data.data) {
    return {
      title: data.data?.title || 'Instagram Video',
      thumbnail: data.data?.thumbnail || null,
      downloads: (data.data?.url || []).map(item => ({
        quality: item.quality || 'HD',
        format: item.type === 'video' ? 'mp4' : 'jpg',
        url: item.url
      }))
    }
  }
  
  if (apiName === 'FDown' && data.data) {
    return {
      title: 'Facebook Video',
      thumbnail: data.data?.thumbnail || null,
      downloads: [
        { quality: 'HD', format: 'mp4', url: data.data?.hd },
        { quality: 'SD', format: 'mp4', url: data.data?.sd }
      ].filter(d => d.url)
    }
  }
  
  if (apiName === 'SSSTik Twitter' && data.data) {
    return {
      title: data.data?.text || 'Twitter Video',
      thumbnail: data.data?.thumbnail || null,
      downloads: (data.data?.videos || []).map(video => ({
        quality: video.quality || 'HD',
        format: 'mp4',
        url: video.url
      }))
    }
  }
  
  if (apiName === 'Threads Downloader' && data.data) {
    return {
      title: data.data?.text || 'Threads Video',
      thumbnail: data.data?.thumbnail || null,
      downloads: [
        { quality: 'HD', format: 'mp4', url: data.data?.video }
      ].filter(d => d.url)
    }
  }
  
  throw new Error(`Unable to parse response from ${apiName}`)
}
