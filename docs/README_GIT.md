# TasteMap 🎬

> AI-powered movie recommendation system that visualizes your unique film DNA

[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-orange?logo=cloudflare)](https://tastemap-frontend.pages.dev)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?logo=cloudflare)](https://workers.cloudflare.com)
[![Workers AI](https://img.shields.io/badge/Workers-AI-blue?logo=cloudflare)](https://developers.cloudflare.com/workers-ai/)

## Overview

TasteMap analyzes your IMDB ratings to create a personalized "film DNA" profile using AI, then recommends movies tailored to your unique taste.

### Key Features

- 🧠 **AI-Powered Analysis** - Uses Cloudflare Workers AI (Llama 3.1 8B) to extract themes and preferences
- 🎯 **Smart Recommendations** - AI-generated suggestions with match scores and explanations
- 📊 **Taste Visualization** - Interactive charts showing your genre, era, and theme preferences
- 📥 **IMDB Import** - Upload your IMDB ratings JSON for instant analysis
- ⚡ **Lightning Fast** - Cloudflare edge network, D1 database, 24h caching
- 📱 **Mobile Responsive** - Works seamlessly on all devices

## Architecture

```
Frontend (Cloudflare Pages)
    ↓
API Proxy (/api/*)
    ↓
Backend (Cloudflare Worker)
    ↓
├─ D1 Database (SQLite)
├─ Workers AI (Llama 3.1)
└─ TMDB API (movie metadata)
```

## Quick Start

### Prerequisites

- Cloudflare account (free tier works)
- IMDB account with rated movies
- Node.js 18+ (for local development)

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/taste-map.git
cd taste-map
```

### 2. Deploy Backend (Worker)

```bash
cd worker
npm install
wrangler login
wrangler d1 create tastemap_db
wrangler d1 execute tastemap_db --file=schema.sql --remote
wrangler secret put TMDB_API_KEY
wrangler secret put IMPORT_SECRET
wrangler deploy
```

### 3. Deploy Frontend (Pages)

```bash
cd ..
./deploy-frontend.sh
```

Or connect to GitHub/GitLab for automatic deployments.

### 4. Import Your Data

1. Export IMDB ratings: [IMDB → Your Ratings](https://www.imdb.com/list/ratings)
2. Visit your deployed site
3. Upload JSON file
4. Enter import key when prompted
5. Wait for profile calculation (~2-5 seconds)
6. Explore recommendations!

## Project Structure

```
taste-map/
├── Frontend Files
│   ├── index.html          # Main UI
│   ├── game.js             # App logic + API integration
│   ├── apiClient.js        # API client module
│   ├── styles.css          # Responsive styles
│   └── config.js           # Configuration
│
├── Cloudflare Pages Config
│   ├── wrangler.toml       # Pages configuration
│   ├── _headers            # HTTP headers
│   └── _redirects          # API proxy + SPA routing
│
├── Backend (Worker)
│   └── worker/
│       ├── src/
│       │   ├── index.js             # Main worker
│       │   ├── tasteProfile.js      # AI taste analysis
│       │   ├── recommendations.js   # AI recommendations
│       │   ├── import.js            # IMDB import
│       │   └── tmdb.js              # TMDB enrichment
│       ├── schema.sql               # D1 database schema
│       └── wrangler.toml            # Worker configuration
│
└── Documentation
    ├── PHASE_3_4_COMPLETE.md        # Implementation summary
    ├── DEPLOYMENT_FRONTEND.md       # Frontend deployment guide
    ├── CLOUDFLARE_PAGES_SETUP.md    # Pages configuration
    └── FRONTEND_INTEGRATION.md      # API integration details
```

## API Endpoints

### Taste Profile

- **POST** `/api/taste-profile` - Calculate taste profile
- **GET** `/api/taste-profile` - Retrieve stored profile

### Recommendations

- **GET** `/api/recommendations?mood=uplifting&genre=Drama&count=10`
  - Query params: `mood`, `genre`, `era`, `count`
  - Returns AI-powered recommendations with reasoning

### Movies

- **GET** `/api/movies?page=1` - List all movies (paginated)
- **GET** `/api/movies/:imdbId` - Get single movie
- **POST** `/api/movies/import` - Import IMDB JSON (requires key)

## Technology Stack

**Frontend:**
- Vanilla JavaScript (ES6+)
- Phaser 3 (for future canvas visualization)
- Cloudflare Pages (hosting)

**Backend:**
- Cloudflare Workers (serverless)
- D1 Database (SQLite)
- Workers AI (Llama 3.1 8B Instruct)
- TMDB API (movie metadata)

**Infrastructure:**
- 100% Cloudflare (Workers, Pages, D1, AI)
- Edge-optimized (300+ data centers)
- Zero-cost on free tier

## Features Implemented

### Phase 3: AI Backend ✅
- [x] Taste profile calculation with AI
- [x] Genre, era, theme extraction
- [x] Director affinity analysis
- [x] Confidence scoring
- [x] AI-powered recommendations
- [x] Mood/genre/era filtering
- [x] 24-hour caching system
- [x] Fallback algorithms

### Phase 4: Frontend Integration ✅
- [x] API client module
- [x] Health check on load
- [x] Auto-load profile
- [x] IMDB import with progress
- [x] Profile visualization
- [x] Recommendations display
- [x] Toast notifications
- [x] Mobile responsive design

### Phase 5: Deployment ✅
- [x] Cloudflare Pages configuration
- [x] API proxying
- [x] SPA routing
- [x] Cache optimization
- [x] Security headers
- [x] Deployment scripts

## Performance

- **Initial Load:** <2 seconds
- **API Health Check:** <100ms
- **Profile Calculation:** 2-5 seconds
- **Recommendations:** <1s (cached) or 3-8s (fresh)
- **Import 250 Movies:** 60-120 seconds

## Cost

**Free Tier (Cloudflare):**
- ✅ Unlimited requests
- ✅ Unlimited bandwidth
- ✅ 10 GB D1 storage
- ✅ 10,000 AI requests/day
- ✅ 100,000 Worker requests/day

**Typical Monthly Cost:** $0 🎉

## Development

```bash
# Frontend development
python -m http.server 8000
# Visit http://localhost:8000

# Worker development
cd worker
wrangler dev
# API at http://localhost:8787
```

## Configuration

### Update API URL
Edit `apiClient.js`:
```javascript
const API_BASE = 'https://your-worker.workers.dev';
```

### Change Cache Duration
Edit `_headers`:
```
/*.js
  Cache-Control: public, max-age=3600  # 1 hour
```

### Restrict CORS
Edit `_headers`:
```
Access-Control-Allow-Origin: https://yourdomain.com
```

## Troubleshooting

### API Offline
- Check worker is deployed: `wrangler deployments list`
- Verify API URL in `apiClient.js`
- Check `_redirects` proxy configuration

### Import Fails
- Verify import key is correct
- Check TMDB_API_KEY is set
- Ensure JSON format is valid

### Recommendations Empty
- Need minimum 20 rated movies
- Check taste profile exists: GET `/api/taste-profile`
- Verify Workers AI binding in `wrangler.toml`

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit pull request

## License

MIT License - See LICENSE file for details

## Support

- **Documentation:** See `/docs` folder
- **Issues:** GitHub Issues
- **Cloudflare Docs:** https://developers.cloudflare.com

## Roadmap

- [ ] Canvas visualization (Phaser)
- [ ] Movie detail modals
- [ ] Rating from recommendations
- [ ] Collaborative filtering
- [ ] Social features
- [ ] Analytics dashboard

## Credits

- **TMDB API** - Movie metadata and images
- **Cloudflare** - Infrastructure and AI
- **Workers AI** - Taste analysis and recommendations

---

**Built with ❤️ using Cloudflare's edge platform**

Deploy your own: `./deploy-frontend.sh`
