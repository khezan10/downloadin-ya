import { NextResponse } from 'next/server'

/**
 * Liveness probe.
 *
 * A tiny endpoint an uptime monitor can poll: it answers 200 as long as the
 * app is running, and reports whether the optional database is reachable.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const started = Date.now()
  const health = {
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: 'not configured',
  }

  try {
    const { getRecentDownloads } = await import('@/lib/db')
    const result = await getRecentDownloads(1)
    health.database = result?.success === false ? 'unreachable' : 'ok'
  } catch {
    health.database = 'unreachable'
  }

  health.ms = Date.now() - started

  return NextResponse.json(health, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
