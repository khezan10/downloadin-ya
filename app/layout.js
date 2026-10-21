import './globals.css'

export const metadata = {
  title: 'Downloadin Ya — TikTok Video Downloader',
  description:
    'Download TikTok videos in HD without a watermark. No login, no cookies, no API key. Instagram, Facebook and more coming soon.',
  keywords: ['tiktok downloader', 'tiktok download', 'tiktok video', 'download tiktok without watermark', 'save tiktok'],
  authors: [{ name: 'Khezan Amartya' }],
  openGraph: {
    title: 'Downloadin Ya — TikTok Video Downloader',
    description: 'Download TikTok videos in HD without a watermark. No login, no cookies.',
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
