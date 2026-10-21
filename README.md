# Downloadin Ya

A social media video downloader built with Next.js, MongoDB, and Vercel.

## Supported Platforms

- Facebook (reels, videos, stories)
- TikTok (videos, slideshows)
- Instagram (reels, videos, stories)
- Threads (videos)
- X / Twitter (videos)
- Pixiv (videos, artworks)

## Features

- No login required
- No cookies needed
- Open source
- Recent downloads activity log (IP addresses masked)
- Terminal-style dark theme with lime accent

## Tech Stack

- **Frontend**: Next.js 15, React 19
- **Database**: MongoDB Atlas
- **Hosting**: Vercel
- **Video API**: RapidAPI (social media video downloader)

## Setup

### Prerequisites

- Node.js 18+
- MongoDB Atlas account
- RapidAPI account with video downloader API subscription

### Environment Variables

Create `.env.local` file:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/downloadin-ya?retryWrites=true&w=majority
RAPIDAPI_KEY=your-rapidapi-key-here
RAPIDAPI_HOST=social-media-video-downloader.p.rapidapi.com
```

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build & Deploy

```bash
npm run build
```

Deploy to Vercel with environment variables configured.

## Recommended RapidAPI Services

Choose one of these APIs:

1. **Social Media Video Downloader** - Multi-platform support
2. **TikWM API** - TikTok focused
3. **SnapTik API** - TikTok focused  
4. **InstaDown API** - Instagram focused
5. **FBDown API** - Facebook focused

## License

MIT © Khezan Amartya
