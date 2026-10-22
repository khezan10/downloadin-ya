import clientPromise from '@/lib/mongodb'

const DB_NAME = 'downloadin-ya'
const COLLECTION = 'downloads'

export async function saveDownload(data) {
  if (!clientPromise) {
    console.warn('MongoDB not configured, skipping save')
    return { success: false, error: 'Database not configured' }
  }

  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const collection = db.collection(COLLECTION)

    await collection.insertOne({
      ...data,
      timestamp: new Date().toISOString()
    })

    return { success: true }
  } catch (error) {
    console.error('Error saving download:', error)
    return { success: false, error: error.message }
  }
}

/**
 * How often each upstream served a download, over the most recent records.
 *
 * Read from the database rather than memory so the numbers are the same for
 * every visitor regardless of which serverless instance served them.
 */
export async function getUpstreamUsage(limit = 50) {
  if (!clientPromise) {
    return { success: true, usage: {}, total: 0 }
  }

  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const collection = db.collection(COLLECTION)

    const recent = await collection
      .find({ upstream: { $exists: true } })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()

    const usage = {}
    for (const doc of recent) {
      usage[doc.upstream] = (usage[doc.upstream] || 0) + 1
    }

    return { success: true, usage, total: recent.length }
  } catch (error) {
    console.error('Error fetching upstream usage:', error)
    return { success: false, usage: {}, total: 0 }
  }
}

export async function getRecentDownloads(limit = 5) {
  if (!clientPromise) {
    return { success: true, downloads: [] }
  }

  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const collection = db.collection(COLLECTION)

    const downloads = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()

    return { success: true, downloads }
  } catch (error) {
    console.error('Error fetching recent downloads:', error)
    return { success: false, downloads: [] }
  }
}

/**
 * Delete download records older than the given number of days.
 * Default: keep last 30 days.
 */
export async function cleanupOldDownloads(daysToKeep = 30) {
  if (!clientPromise) {
    return { success: false, error: 'Database not configured', deleted: 0 }
  }

  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const collection = db.collection(COLLECTION)

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysToKeep)
    const cutoffISO = cutoff.toISOString()

    const result = await collection.deleteMany({
      timestamp: { $lt: cutoffISO }
    })

    return { success: true, deleted: result.deletedCount, cutoff: cutoffISO }
  } catch (error) {
    console.error('Error cleaning up old downloads:', error)
    return { success: false, error: error.message, deleted: 0 }
  }
}
