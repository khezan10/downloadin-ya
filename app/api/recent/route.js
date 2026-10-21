import { NextResponse } from 'next/server'
import { getRecentDownloads } from '@/lib/db'

// The activity log is read on every page load — never cache it.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const result = await getRecentDownloads(5)

    return NextResponse.json(
      {
        success: true,
        downloads: Array.isArray(result.downloads) ? result.downloads : [],
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (error) {
    console.error('Error fetching recent downloads:', error)
    return NextResponse.json(
      { success: false, downloads: [] },
      { status: 500 }
    )
  }
}
