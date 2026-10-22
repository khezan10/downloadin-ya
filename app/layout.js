import './globals.css'
import { SITE_URL, REPO_URL } from '@/lib/site'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Downloadin Ya — Social Media Video Downloader',
  description:
    'Download videos and images from TikTok, Instagram, YouTube, Facebook, X (Twitter), Threads and Pinterest. No login, no cookies, no API key.',
  applicationName: 'Downloadin Ya',
  keywords: [
    'video downloader',
    'social media video downloader',
    'tiktok downloader',
    'instagram downloader',
    'instagram reels downloader',
    'youtube downloader',
    'facebook video downloader',
    'twitter downloader',
    'x downloader',
    'threads downloader',
    'pinterest downloader',
    'pinterest video downloader',
    'pinterest image downloader',
  ],
  authors: [{ name: 'Khezan Amartya', url: REPO_URL }],
  creator: 'Khezan Amartya',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Downloadin Ya',
    title: 'Downloadin Ya — Social Media Video Downloader',
    description:
      'Download videos and images from TikTok, Instagram, YouTube, Facebook, X, Threads and Pinterest. No login, no cookies, no API key.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Downloadin Ya — social media video downloader',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Downloadin Ya — Social Media Video Downloader',
    description:
      'Download videos and images from TikTok, Instagram, YouTube, Facebook, X, Threads and Pinterest.',
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon-16.svg" type="image/svg+xml" sizes="16x16" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
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
