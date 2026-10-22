import { NextResponse } from 'next/server'
import { resolveViaSaveFrom, normalizeSaveFrom } from '@/lib/savefrom'
import { UPSTREAMS, getUsage } from '@/lib/upstreams'
import { getUpstreamUsage } from '@/lib/db'
import { fetchTikwm } from '@/lib/tikwm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** Probe one upstream and report whether it is alive right now. */
async function probe(upstream) {
  const started = Date.now()

  try {
    if (upstream.id === 'savefrom') {
      const data = normalizeSaveFrom(await resolveViaSaveFrom(upstream.probeUrl))
      return {
        status: 'ok',
        ms: Date.now() - started,
        // Every card reports the same outcome word, so the three are directly
        // comparable. The quality list belongs to the result, not the status.
        note: data.downloads.length > 0 ? 'resolved' : 'no media returned',
      }
    }

    if (upstream.id === 'tikwm') {
      // Same helper the download route uses, so "ONLINE" here means the
      // fallback genuinely works from this network.
      const { body, variant } = await fetchTikwm(upstream.probeUrl)
      return {
        status: 'ok',
        ms: Date.now() - started,
        note: `resolved (${variant})`,
      }
    }

    // socialdownloader
    const res = await fetch('https://www.socialdownloader.space/api/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': UA,
        Origin: 'https://www.socialdownloader.space',
        Referer: 'https://www.socialdownloader.space/',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
      },
      body: JSON.stringify({ url: upstream.probeUrl }),
      signal: AbortSignal.timeout(30000),
    })
    const text = await res.text()
    let ok = false
    try {
      ok = JSON.parse(text).success === true
    } catch {
      ok = false
    }
    return {
      status: res.ok && ok ? 'ok' : 'down',
      ms: Date.now() - started,
      note: ok ? 'resolved' : `HTTP ${res.status}`,
    }
  } catch (e) {
    return {
      status: 'down',
      ms: Date.now() - started,
      error: e.message.slice(0, 160),
    }
  }
}

/**
 * Live status for every download upstream, plus which one is actually serving
 * traffic right now.
 *
 * The visitor-facing "backend monitor" section reads this. The role (primary
 * vs fallback) is static and comes from lib/upstreams.js; the live status is
 * probed on request; the share comes from the database so it is the same for
 * every visitor.
 */
export async function GET() {
  const checkedAt = new Date().toISOString()

  const results = await Promise.all(UPSTREAMS.map(probe))
  // Pair each probe result with its upstream by position — the probe returns
  // only the status, not the id.
  const byId = Object.fromEntries(results.map((r, i) => [UPSTREAMS[i].id, r]))

  const dbUsage = await getUpstreamUsage(50)
  const memoryUsage = getUsage()

  const upstreams = UPSTREAMS.map((u) => {
    const live = byId[u.id] || { status: 'down', ms: 0 }
    const served = dbUsage.usage[u.id] || 0
    const share = dbUsage.total > 0 ? Math.round((served / dbUsage.total) * 100) : null
    return {
      id: u.id,
      label: u.label,
      host: u.host,
      role: u.role,
      scope: u.scope,
      note: u.note,
      status: live.status,
      ms: live.ms,
      detail: live.note || live.error || '',
      served,
      share,
      instanceCount: memoryUsage.counts[u.id] || 0,
    }
  })

  const healthy = upstreams.filter((u) => u.status === 'ok')
  const activeUpstream =
    upstreams.find((u) => u.id === memoryUsage.lastUsed) ||
    upstreams.find((u) => u.role === 'primary' && u.status === 'ok') ||
    upstreams.find((u) => u.status === 'ok') ||
    null

  return NextResponse.json(
    {
      success: healthy.length > 0,
      checkedAt,
      healthy: healthy.length,
      total: upstreams.length,
      upstreams,
      active: activeUpstream
        ? {
            id: activeUpstream.id,
            label: activeUpstream.label,
            role: activeUpstream.role,
            since: memoryUsage.lastUsedAt,
          }
        : null,
      sample: dbUsage.total,
    },
    {
      status: healthy.length > 0 ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
