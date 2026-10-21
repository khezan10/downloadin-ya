'use client'

import { useState, useEffect } from 'react'

// Entrance animation: fade + rise + deblur, staggered per element.
// Mirrors the Zanara landing page (.reveal / .in) but starts immediately on
// mount instead of waiting for an IntersectionObserver, so nothing can get
// stuck invisible.
const REVEAL_STAGGER_MS = 90

export default function Home() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [recentDownloads, setRecentDownloads] = useState([])
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    fetchRecentDownloads()
  }, [])

  // Kick off the staggered entrance on the next frame so the initial
  // hidden state is painted first (otherwise there is nothing to transition from).
  useEffect(() => {
    const raf = requestAnimationFrame(() => setRevealed(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const fetchRecentDownloads = async () => {
    try {
      const res = await fetch('/api/recent', { cache: 'no-store' })
      const data = await res.json()
      if (data.success) {
        setRecentDownloads(Array.isArray(data.downloads) ? data.downloads : [])
      }
    } catch (err) {
      console.error('Failed to fetch recent downloads:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)

    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    if (!isSupportedUrl(url)) {
      setError(
        'That link is not supported yet. Try TikTok, Instagram, YouTube, Facebook, X (Twitter) or Threads.'
      )
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to download')
      }

      setResult(data.data)
      fetchRecentDownloads()
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

  const formatDuration = (seconds) => {
    if (!seconds || Number.isNaN(Number(seconds))) return null
    const total = Math.floor(Number(seconds))
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const formatCount = (n) => {
    if (!n) return null
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return String(n)
  }

  // Stagger helper: returns the transition delay; the shared class is applied
  // per element so the element's own className is never overwritten.
  const reveal = (index) => ({
    style: { transitionDelay: `${index * REVEAL_STAGGER_MS}ms` },
  })
  const revealClass = `reveal-item${revealed ? ' is-visible' : ''}`

  return (
    <main>
      {/* Hero Section */}
      <section className="hero">
        <p className={`eyebrow ${revealClass}`} {...reveal(0)}>
          TikTok Downloader
        </p>
        <h1 className={`title ${revealClass}`} {...reveal(1)}>
          DOWNLOADIN YA<span className="caret">_</span>
        </h1>
        <p className={`subtitle ${revealClass}`} {...reveal(2)}>
          Paste a link from TikTok, Instagram, YouTube, Facebook, X (Twitter) or Threads
          and get the video straight away. No login, no cookies, no API key. Pinterest
          coming soon.
        </p>

        {/* Platform badges */}
        <div className={`platforms ${revealClass}`} {...reveal(3)}>
          <span className="platform-badge platform-badge--active">TikTok</span>
          <span className="platform-badge platform-badge--active">Instagram</span>
          <span className="platform-badge platform-badge--active">YouTube</span>
          <span className="platform-badge platform-badge--active">Facebook</span>
          <span className="platform-badge platform-badge--active">X / Twitter</span>
          <span className="platform-badge platform-badge--active">Threads</span>
          <span className="platform-badge is-soon">Pinterest</span>
        </div>

        {/* Download form */}
        <form className={`download-form ${revealClass}`} {...reveal(4)} onSubmit={handleSubmit}>
          <div className="input-wrapper">
            <input
              type="url"
              className="url-input"
              placeholder="Paste a TikTok, Instagram, YouTube, Facebook, X or Threads URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              spellCheck={false}
            />
            <button type="submit" className="submit-btn" disabled={loading || !url.trim()}>
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
                  loading="lazy"
                />
              )}
              {result.title && (
                <p className="video-meta">
                  <strong>Title:</strong> {result.title}
                </p>
              )}
              <div className="video-stats">
                {result.author && (
                  <span className="video-stat">
                    <strong>Author:</strong> @{result.authorUsername || result.author}
                  </span>
                )}
                {formatDuration(result.duration) && (
                  <span className="video-stat">
                    <strong>Duration:</strong> {formatDuration(result.duration)}
                  </span>
                )}
                {formatCount(result.playCount) && (
                  <span className="video-stat">
                    <strong>Views:</strong> {formatCount(result.playCount)}
                  </span>
                )}
                {formatCount(result.likeCount) && (
                  <span className="video-stat">
                    <strong>Likes:</strong> {formatCount(result.likeCount)}
                  </span>
                )}
              </div>
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
                  {dl.quality || 'Download'}
                  {dl.format ? ` (${dl.format})` : ''}
                </a>
              ))}
              {result.audio?.url && (
                <a
                  href={result.audio.url}
                  className="download-btn download-btn--audio"
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  Audio (mp3)
                </a>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Recent Downloads */}
      <section className="recent-section">
        <header className={`recent-header ${revealClass}`} {...reveal(5)}>
          <p className="recent-eyebrow">activity log</p>
          <h2 className="recent-title">RECENT DOWNLOADS_</h2>
        </header>

        <div className="recent-grid">
          {recentDownloads.length === 0 ? (
            <div className={`recent-card ${revealClass}`} {...reveal(6)}>
              <p className="recent-empty">No downloads yet. Be the first!</p>
            </div>
          ) : (
            recentDownloads.map((item, i) => (
              <article
                key={item._id || i}
                className={`recent-card ${revealClass}`}
                {...reveal(6 + i)}
              >
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
        <span>Downloadin Ya — TikTok Downloader</span>
        <a href="https://github.com/khezan10/downloadin-ya" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </footer>
    </main>
  )
}

export function isSupportedUrl(url) {
  const u = String(url).toLowerCase()
  return (
    u.includes('tiktok.com') ||
    u.includes('instagram.com') ||
    u.includes('instagr.am') ||
    u.includes('youtube.com') ||
    u.includes('youtu.be') ||
    u.includes('facebook.com') ||
    u.includes('fb.watch') ||
    u.includes('twitter.com') ||
    u.includes('x.com') ||
    u.includes('t.co') ||
    u.includes('threads.net') ||
    u.includes('threads.com')
  )
}
