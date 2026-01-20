# Cloudflare Pages Configuration Complete ✅

## Files Created

### 1. `wrangler.toml` (1 KB)
Cloudflare Pages project configuration.

**Key Settings:**
- **Project Name:** `tastemap-frontend`
- **Build Output:** `.` (root directory)
- **Type:** Static site (no build step)

### 2. `_headers` (4.1 KB)
HTTP headers for static assets and security.

**Configured Headers:**

| File Type | Cache Duration | Notes |
|-----------|----------------|-------|
| `*.html` | No cache | Always fetch latest |
| `*.js` | 1 day | Must revalidate |
| `*.css` | 1 day | Must revalidate |
| `*.jpg/png/gif` | 1 week | Immutable |
| `*.woff/woff2` | 1 year | Immutable |
| `*.json` | No cache | Data files |

**Security Headers:**
- CORS: Allow all origins (change for production)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: enabled
- Permissions-Policy: restricted

### 3. `_redirects` (2.7 KB)
URL routing and API proxying.

**Rules:**
1. **API Proxy** (Status 200)
   ```
   /api/*  →  https://movies.aperion.cc/api/*
   ```
   - Proxies API requests server-side
   - Avoids CORS issues
   - Browser sees same-origin request

2. **Health Check Proxy** (Status 200)
   ```
   /health  →  https://movies.aperion.cc/health
   ```

3. **SPA Fallback** (Status 200)
   ```
   /*  →  /index.html
   ```
   - Enables client-side routing
   - Must be last rule

### 4. `DEPLOYMENT_FRONTEND.md` (9.2 KB)
Comprehensive deployment guide with:
- Step-by-step instructions
- Two deployment methods
- Configuration explanations
- Troubleshooting section
- Custom domain setup
- CI/CD examples
- Security considerations
- Performance tips

### 5. `deploy-frontend.sh` (1.4 KB)
Quick deployment script.

**Usage:**
```bash
./deploy-frontend.sh
```

**What it does:**
1. Checks for Wrangler CLI
2. Verifies Cloudflare authentication
3. Confirms deployment
4. Deploys to `tastemap-frontend`
5. Shows live URL

### 6. `.gitignore` (541 bytes)
Git ignore patterns for:
- Node modules
- Environment files
- OS files
- Editor configs
- Build output
- Wrangler state
- Logs

## How It Works

### Request Flow

```
User Browser
    ↓
https://tastemap-frontend.pages.dev
    ↓
Cloudflare Pages (Static Files)
    ↓ (if /api/*)
Cloudflare Pages (_redirects proxy)
    ↓
https://movies.aperion.cc/api/*
    ↓
Cloudflare Worker (Backend)
    ↓
D1 Database + Workers AI
```

### File Serving

1. **HTML Request**
   ```
   GET /index.html
   → Served with no-cache headers
   → Always fresh
   ```

2. **JS/CSS Request**
   ```
   GET /game.js
   → Served with 1-day cache
   → Must revalidate if stale
   ```

3. **API Request**
   ```
   GET /api/taste-profile
   → Proxied to https://movies.aperion.cc/api/taste-profile
   → Returns JSON response
   ```

4. **Client-Side Route**
   ```
   GET /recommendations (doesn't exist as file)
   → SPA fallback triggers
   → Serves /index.html
   → JavaScript router handles /recommendations
   ```

## Deployment Options

### Option 1: Quick Deploy (CLI)
```bash
# One-time deployment
npx wrangler pages deploy . --project-name=tastemap-frontend
```

**Pros:**
- Fast (30 seconds)
- No Git required
- Good for testing

**Cons:**
- Manual process
- No automatic updates

### Option 2: Git Integration (Recommended)
```bash
# Connect repository to Cloudflare Pages
# Auto-deploys on every git push
```

**Pros:**
- Automatic deployments
- Preview branches
- Version history
- Rollback capability

**Cons:**
- Requires Git repository
- Initial setup time

## Testing After Deployment

### 1. Basic Connectivity
```bash
# Test main page
curl -I https://tastemap-frontend.pages.dev/

# Test health endpoint (proxied)
curl https://tastemap-frontend.pages.dev/health

# Test API proxy
curl https://tastemap-frontend.pages.dev/api/taste-profile
```

### 2. Browser Testing
1. Open: `https://tastemap-frontend.pages.dev`
2. Check console: API health check should succeed
3. Try import: Upload IMDB JSON
4. Verify: Profile calculates
5. Check: Recommendations load

### 3. Header Verification
```bash
# Check cache headers
curl -I https://tastemap-frontend.pages.dev/game.js | grep -i cache

# Check CORS headers
curl -I https://tastemap-frontend.pages.dev/ | grep -i access-control

# Check security headers
curl -I https://tastemap-frontend.pages.dev/ | grep -i x-frame
```

## Configuration Customization

### Change API Backend
Edit `_redirects`:
```
# From:
/api/*  https://movies.aperion.cc/api/:splat  200

# To (staging):
/api/*  https://movies-staging.aperion.cc/api/:splat  200
```

### Adjust Cache Duration
Edit `_headers`:
```
# From:
/*.js
  Cache-Control: public, max-age=86400, must-revalidate

# To (1 hour):
/*.js
  Cache-Control: public, max-age=3600, must-revalidate
```

### Add Custom Domain
1. Dashboard → Pages → `tastemap-frontend` → Custom domains
2. Enter: `tastemap.yourdomain.com`
3. Add CNAME record: `tastemap` → `tastemap-frontend.pages.dev`
4. Wait for SSL certificate (~5 minutes)

### Restrict CORS
Edit `_headers`:
```
# From:
Access-Control-Allow-Origin: *

# To:
Access-Control-Allow-Origin: https://tastemap.yourdomain.com
```

## Performance Metrics

**Expected Load Times:**
- Initial page load: <2 seconds
- API health check: <100ms (cached worker)
- Import 250 movies: 60-120 seconds (TMDB enrichment)
- Profile calculation: 2-5 seconds (AI processing)
- Recommendations: <1 second (cached) or 3-8 seconds (fresh AI)

**Cloudflare Edge Network:**
- 300+ data centers worldwide
- Automatic HTTPS
- DDoS protection
- Brotli compression
- HTTP/2 & HTTP/3

## Monitoring

### Cloudflare Dashboard
- Pages → `tastemap-frontend` → Analytics
- Metrics: Requests, bandwidth, errors
- Real-time updates

### Browser DevTools
- Network tab: Check API proxy
- Console: Check API health logs
- Application: Check local storage

### Logs
```bash
# View deployment logs
wrangler pages deployments list --project-name=tastemap-frontend

# Tail function logs
wrangler pages deployment tail
```

## Troubleshooting

### Problem: API requests fail with CORS error
**Solution:** Verify `_headers` file is in root and contains CORS headers

### Problem: 404 on /api/* requests
**Solution:** Check `_redirects` file exists and API proxy rule is correct

### Problem: Old version still showing
**Solution:** Hard refresh (Ctrl+Shift+R) or clear browser cache

### Problem: Import key prompt not appearing
**Solution:** Check browser console for JavaScript errors

### Problem: Recommendations not loading
**Solution:** Verify backend worker is deployed and healthy

## Security Checklist

- [x] CORS headers configured
- [x] X-Frame-Options: DENY (prevent clickjacking)
- [x] X-Content-Type-Options: nosniff
- [x] X-XSS-Protection enabled
- [ ] Content Security Policy (add if needed)
- [ ] Restrict CORS to specific domain (production)
- [ ] Environment variables for secrets (if any)
- [ ] Rate limiting (handled by Worker)

## Cost

**Cloudflare Pages Free Tier:**
- ✅ Unlimited requests
- ✅ Unlimited bandwidth
- ✅ 500 builds/month
- ✅ Free SSL certificate
- ✅ DDoS protection

**Expected Cost:** $0/month 🎉

## Next Steps

1. **Deploy Now**
   ```bash
   ./deploy-frontend.sh
   ```

2. **Verify Deployment**
   - Visit live URL
   - Test all features
   - Check browser console

3. **Custom Domain** (Optional)
   - Set up in Cloudflare dashboard
   - Add DNS records
   - Wait for SSL

4. **Monitor**
   - Check analytics
   - Watch for errors
   - Review performance

## Support Resources

- **Cloudflare Pages Docs:** https://developers.cloudflare.com/pages/
- **Wrangler CLI Docs:** https://developers.cloudflare.com/workers/wrangler/
- **Community Forum:** https://community.cloudflare.com/
- **Discord:** https://discord.gg/cloudflaredev

---

## Summary

✅ **Configuration Complete**
- 3 config files created
- 1 deployment guide written
- 1 deployment script added
- 1 .gitignore added

✅ **Ready to Deploy**
- Run: `./deploy-frontend.sh`
- Or: Push to Git and connect to Cloudflare Pages

✅ **Features Enabled**
- API proxying (no CORS issues)
- SPA routing (client-side navigation)
- Smart caching (performance)
- Security headers (protection)
- Free hosting (unlimited)

**Your TasteMap frontend is ready for production! 🚀**
