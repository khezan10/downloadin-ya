import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
const options = {}

let clientPromise = null

if (process.env.MONGODB_URI) {
  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable to preserve connection across hot reloads
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, options)
      global._mongoClientPromise = client.connect()
    }
    clientPromise = global._mongoClientPromise
  } else {
    // In production mode, create a new connection
    const client = new MongoClient(uri, options)
    // Catch here so a database that is down or unreachable shows up as a
    // failed write in the log, not as an unhandled rejection that takes the
    // whole serverless instance down.
    clientPromise = client.connect().catch((error) => {
      console.error('MongoDB connection failed:', error?.message || error)
      throw error
    })
  }
} else {
  console.warn('Warning: MONGODB_URI not set. Database features will be limited.')
}

export default clientPromise
