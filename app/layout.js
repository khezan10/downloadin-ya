import './globals.css'

export const metadata = {
  title: 'Downloadin Ya — Social Media Video Downloader',
  description: 'Download videos from Facebook, TikTok, Instagram, Threads, X (Twitter), and Pixiv. No login required, no cookies needed.',
  keywords: ['video downloader', 'tiktok downloader', 'instagram downloader', 'facebook video', 'twitter video', 'pixiv'],
  authors: [{ name: 'Khezan Amartya' }],
  openGraph: {
    title: 'Downloadin Ya',
    description: 'Download videos from Facebook, TikTok, Instagram, Threads, X, and Pixiv',
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
