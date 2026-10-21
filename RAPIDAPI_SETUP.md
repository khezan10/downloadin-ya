# RapidAPI Setup - Social Media Video Downloader

## Step 1: Create RapidAPI Account

1. Go to: https://rapidapi.com/auth/signup
2. Sign up with Google or email (FREE)

## Step 2: Subscribe to API

1. Go to: https://rapidapi.com/social-media-video-downloader-api/api/social-media-video-downloader
2. Click **"Pricing"** tab
3. Choose **FREE** tier (100 requests/month)
4. Click **"Subscribe"**

## Step 3: Get Your API Key

1. After subscribing, go to the **"Endpoints"** tab
2. Look for **"Header Parameters"** section
3. Copy your **X-RapidAPI-Key** value

Example:
```
X-RapidAPI-Key: your-api-key-here
X-RapidAPI-Host: social-media-video-downloader.p.rapidapi.com
```

## Step 4: Add to Project

Update `.env.local`:

```env
RAPIDAPI_KEY=your-copied-api-key-here
RAPIDAPI_HOST=social-media-video-downloader.p.rapidapi.com
```

---

## Alternative APIs (if needed)

| Platform | API Link | Free Tier |
|----------|----------|-----------|
| TikTok | https://rapidapi.com/tikwm/api/tikwm | ✅ 500/month |
| Instagram | https://rapidapi.com/Glavier/api/instagram-downloader-download-instagram-videos-stories | ✅ 100/month |
| Facebook | https://rapidapi.com/t-r372524-5b-world-api-facebook-video-d-v1.p.rapidapi.com | Limited |

---

## Test API (optional)

```bash
curl -X POST "https://social-media-video-downloader.p.rapidapi.com/download" \
  -H "Content-Type: application/json" \
  -H "X-RapidAPI-Key: YOUR_KEY" \
  -H "X-RapidAPI-Host: social-media-video-downloader.p.rapidapi.com" \
  -d '{"url":"https://www.tiktok.com/@username/video/123456789"}'
```
