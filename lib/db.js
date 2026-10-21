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
