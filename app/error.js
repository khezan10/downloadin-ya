'use client'

import { useEffect } from 'react'
import { REPO_URL } from '@/lib/site'

/**
 * Error boundary.
 *
 * A failure inside the page renders this instead of a blank screen. The
 * error is logged so it shows up in the Vercel logs, and the visitor gets a
 * way back to the form.
 */
export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Downloadin Ya error:', error)
  }, [error])

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">ERROR</p>

        <h1 className="title">
          <span className="title-text">SOMETHING BROKE</span>
        </h1>

        <p className="subtitle">
          The page hit an error. Try again, or check the status of the
          upstream services below the download form.
        </p>

        <div className="platforms">
          <button className="download-btn" type="button" onClick={() => reset()}>
            Try again
          </button>
          <a
            className="download-btn download-btn--audio"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Report it
          </a>
        </div>
      </section>

      <footer className="footer">
        <span>Downloadin Ya — Social Video Downloader</span>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </footer>
    </main>
  )
}
