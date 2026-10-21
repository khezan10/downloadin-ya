# Downloadin Ya - Setup Instructions

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `downloadin-ya`
3. Description: `Social Media Video Downloader - FB, TikTok, IG, Threads, X, Pixiv`
4. Make it **Public**
5. Click "Create repository"

## Step 2: Push to GitHub

After creating the repository, run these commands in terminal:

```bash
cd /c/Users/ASUS/downloadin-ya
git remote add origin https://github.com/khezan10/downloadin-ya.git
git push -u origin main
```

Or with your personal access token:

```bash
git remote add origin https://YOUR_TOKEN@github.com/khezan10/downloadin-ya.git
git push -u origin main
```

## Step 3: Create MongoDB Atlas Cluster

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Create free account
3. Create a **free M0 cluster**
4. Create database user (username/password)
5. Whitelist IP: `0.0.0.0/0` (allow all for Vercel)
6. Get connection string: `mongodb+srv://<user>:<password>@cluster.mongodb.net/downloadin-ya?retryWrites=true&w=majority`

## Step 4: Get RapidAPI Key

Choose one of these APIs:

### Option A: Social Media Video Downloader (Multi-platform)
1. Go to: https://rapidapi.com/social-media-video-downloader-api/api/social-media-video-downloader
2. Subscribe (free tier available)
3. Copy your API Key

### Option B: TikWM (TikTok focused)
1. Go to: https://rapidapi.com/tikwm/api/tikwm
2. Subscribe (free tier available)
3. Copy your API Key

## Step 5: Deploy to Vercel

1. Go to: https://vercel.com/new
2. Import `khezan10/downloadin-ya` repository
3. Add Environment Variables:
   ```
   MONGODB_URI = mongodb+srv://<user>:<password>@cluster.mongodb.net/downloadin-ya?retryWrites=true&w=majority
   RAPIDAPI_KEY = your-rapidapi-key-here
   RAPIDAPI_HOST = social-media-video-downloader.p.rapidapi.com
   ```
4. Click "Deploy"

## Step 6: Test Your Site

Your site will be live at: `https://downloadin-ya.vercel.app`

---

## Alternative: Test Locally First

Create `.env.local` file:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/downloadin-ya?retryWrites=true&w=majority
RAPIDAPI_KEY=your-rapidapi-key-here
RAPIDAPI_HOST=social-media-video-downloader.p.rapidapi.com
```

Then run:

```bash
npm run dev
```

Open http://localhost:3000
