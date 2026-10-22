import Link from 'next/link'
import { REPO_URL } from '@/lib/site'

export const metadata = {
  title: 'Page not found — Downloadin Ya',
  description: 'That page does not exist.',
}

export default function NotFound() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">404</p>

        <h1 className="title">
          <span className="title-text">NOT FOUND</span>
        </h1>

        <p className="subtitle">
          That page does not exist. Nothing to download here.
        </p>

        <div className="platforms">
          <Link className="download-btn" href="/">
            Back to the downloader
          </Link>
          <a
            className="download-btn download-btn--audio"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
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
