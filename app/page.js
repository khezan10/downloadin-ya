'use client'

import { useState, useEffect } from 'react'

export default function Home() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [recentDownloads, setRecentDownloads] = useState([])

  // Fetch recent downloads on mount
  useEffect(() => {
    fetchRecentDownloads()
  }, [])

  const fetchRecentDownloads = async () => {
    try {
      const res = await fetch('/api/recent')
      const data = await res.json()
      if (data.success) {
        setRecentDownloads(data.downloads)
      }
    } catch (err) {
      console.error('Failed to fetch recent downloads:', err)
    }
  }

  const detectPlatform = (url) => {
    const platforms = {
      facebook: ['facebook.com', 'fb.watch', 'fb.com'],
      tiktok: ['tiktok.com', 'vm.tiktok.com'],
      instagram: ['instagram.com', 'instagr.am'],
      threads: ['threads.net'],
      twitter: ['twitter.com', 'x.com', 't.co'],
      pixiv: ['pixiv.net', 'pximg.net']
    }

    const urlLower = url.toLowerCase()
    for (const [platform, domains] of Object.entries(platforms)) {
      if (domains.some(domain => urlLower.includes(domain))) {
        return platform
      }
    }
    return 'unknown'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)

    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    const platform = detectPlatform(url)
    if (platform === 'unknown') {
      setError('Unsupported platform. Please use Facebook, TikTok, Instagram, Threads, X, or Pixiv links.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to download')
      }

      setResult(data.data)
      fetchRecentDownloads() // Refresh recent downloads
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const maskIP = (ip) => {
    if (!ip) return '***.***.***.***'
    const parts = ip.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.***.***.${parts[3]}`
    }
    return '***.***.***.***'
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000)

    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <main>
      {/* Hero Section */}
      <section className="hero">
        <p className="eyebrow">Video Downloader</p>
        <h1 className="title">
          DOWNLOADIN YA<span className="caret">_</span>
        </h1>
        <p className="subtitle">
          Download videos from Facebook, TikTok, Instagram, Threads, X (Twitter), and Pixiv.
          No login required, no cookies needed. Open source.
        </p>

        {/* Platform badges */}
        <div className="platforms">
          <span className="platform-badge">Facebook</span>
          <span className="platform-badge">TikTok</span>
          <span className="platform-badge">Instagram</span>
          <span className="platform-badge">Threads</span>
          <span className="platform-badge">X / Twitter</span>
          <span className="platform-badge">Pixiv</span>
        </div>

        {/* Download form */}
        <form className="download-form" onSubmit={handleSubmit}>
          <div className="input-wrapper">
            <input
              type="url"
              className="url-input"
              placeholder="Paste video URL here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="submit-btn"
              disabled={loading || !url.trim()}
            >
              {loading ? '...' : 'DOWNLOAD'}
            </button>
          </div>

          {error && <div className="error-msg">{error}</div>}
        </form>

        {/* Loading */}
        {loading && (
          <div className="loading">
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="result">
            <p className="result-title">DOWNLOAD READY</p>
            <div className="video-info">
              {result.thumbnail && (
                <img
                  src={result.thumbnail}
                  alt="Video thumbnail"
                  className="video-thumb"
                />
              )}
              {result.title && (
                <p className="video-meta"><strong>Title:</strong> {result.title}</p>
              )}
              {result.duration && (
                <p className="video-meta"><strong>Duration:</strong> {result.duration}</p>
              )}
            </div>
            <div className="download-options">
              {result.downloads?.map((dl, i) => (
                <a
                  key={i}
                  href={dl.url}
                  className="download-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  {dl.quality || 'Download'} {dl.format && `(${dl.format})`}
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Recent Downloads */}
      <section className="recent-section">
        <header className="recent-header">
          <p className="recent-eyebrow">activity log</p>
          <h2 className="recent-title">RECENT DOWNLOADS_</h2>
        </header>

        <div className="recent-grid">
          {recentDownloads.length === 0 ? (
            <div className="recent-card">
              <p style={{ color: 'var(--muted)', textAlign: 'center' }}>
                No downloads yet. Be the first!
              </p>
            </div>
          ) : (
            recentDownloads.map((item, i) => (
              <article key={item._id || i} className="recent-card reveal in">
                <div className="recent-card-top">
                  <span className="recent-platform">{item.platform}</span>
                  <span className="recent-time">{formatTime(item.timestamp)}</span>
                </div>
                <a
                  href={item.originalUrl}
                  className="recent-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.originalUrl.length > 60
                    ? item.originalUrl.substring(0, 60) + '...'
                    : item.originalUrl}
                </a>
                <p className="recent-ip">IP: {maskIP(item.ip)}</p>
              </article>
            ))
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <span>Downloadin Ya — Open Source Video Downloader</span>
        <a href="https://github.com/khezan10/downloadin-ya" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </footer>
    </main>
  )
}
