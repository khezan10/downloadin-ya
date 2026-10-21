import './globals.css'

export const metadata = {
  title: 'Downloadin Ya — Social Media Video Downloader',
  description:
    'Download videos from TikTok, Instagram, YouTube, Facebook, X (Twitter) and Threads. No login, no cookies, no API key. Pinterest coming soon.',
  keywords: [
    'video downloader',
    'tiktok downloader',
    'instagram downloader',
    'instagram reels downloader',
    'youtube downloader',
    'facebook video downloader',
    'twitter downloader',
    'x downloader',
    'threads downloader',
  ],
  authors: [{ name: 'Khezan Amartya' }],
  openGraph: {
    title: 'Downloadin Ya — Social Media Video Downloader',
    description:
      'Download videos from TikTok, Instagram, YouTube, Facebook, X (Twitter) and Threads. No login, no cookies.',
    type: 'website',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="bg-grid" aria-hidden="true" />
        {children}
      </body>
    </html>
  )
}
