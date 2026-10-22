import { cleanupOldDownloads } from '@/lib/db'

/**
 * Vercel Cron endpoint — runs daily at 00:00 UTC.
 * Deletes download records older than 30 days.
 *
 * Protected by CRON_SECRET to prevent external calls.
 * Set CRON_SECRET in Vercel project env vars.
 */
export async function GET(request) {
  const auth = request.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (expected && auth !== `Bearer ${expected}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const result = await cleanupOldDownloads(30)
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message, deleted: 0 }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}