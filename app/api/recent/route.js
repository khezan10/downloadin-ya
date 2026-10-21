import { NextResponse } from 'next/server'
import { getRecentDownloads } from '@/lib/db'

export async function GET() {
  try {
    const result = await getRecentDownloads(5)
    
    return NextResponse.json({
      success: true,
      downloads: result.downloads
    })
  } catch (error) {
    console.error('Error fetching recent downloads:', error)
    return NextResponse.json(
      { success: false, downloads: [] },
      { status: 500 }
    )
  }
}
