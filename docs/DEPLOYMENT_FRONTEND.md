# Cloudflare Pages Deployment Guide for TasteMap Frontend

## Prerequisites

1. **Cloudflare Account**
   - Sign up at https://dash.cloudflare.com/sign-up

2. **Wrangler CLI** (Optional but recommended)
   ```bash
   npm install -g wrangler
   wrangler login
   ```

3. **Git Repository**
   - Project must be in a Git repository
   - Pushed to GitHub, GitLab, or Bitbucket

## Deployment Methods

### Method 1: Direct Upload (Wrangler CLI) - Recommended for Testing

```bash
# From the taste-map root directory
cd /path/to/taste-map

# Deploy to Cloudflare Pages
npx wrangler pages deploy . --project-name=tastemap-frontend

# Or with custom branch name
npx wrangler pages deploy . --project-name=tastemap-frontend --branch=main
```

**Output:**
- Deployment URL: `https://tastemap-frontend.pages.dev`
- Preview URL: `https://<commit-hash>.tastemap-frontend.pages.dev`

### Method 2: Git Integration (Recommended for Production)

1. **Push to Git**
   ```bash
   git add .
   git commit -m "Add Cloudflare Pages configuration"
   git push origin main
   ```

2. **Connect to Cloudflare Pages**
   - Go to: https://dash.cloudflare.com/
   - Navigate to: **Pages** → **Create a project**
   - Click: **Connect to Git**
   - Select your repository: `taste-map`

3. **Configure Build Settings**
   - **Project Name:** `tastemap-frontend`
   - **Production Branch:** `main`
   - **Build Command:** *(leave empty)*
   - **Build Output Directory:** `.` *(root directory)*
   
4. **Deploy**
   - Click **Save and Deploy**
   - Wait for deployment to complete (~30 seconds)

## Configuration Files Explained

### 1. `wrangler.toml`
Defines the Pages project configuration:
- Project name: `tastemap-frontend`
- Build output directory: `.` (root)
- No build step (static files)

### 2. `_headers`
Sets HTTP headers for static assets:
- **CORS headers**: Allow cross-origin requests
- **Security headers**: XSS protection, frame denial
- **Cache control**: 
  - HTML: no-cache (always fresh)
  - JS/CSS: 1 day cache
  - Images: 1 week cache
  - Fonts: 1 year cache

### 3. `_redirects`
Configures URL routing:
- **API Proxy**: `/api/*` → `https://movies.aperion.cc/api/*`
  - Avoids CORS issues
  - Keeps API URL consistent
- **SPA Fallback**: `/*` → `/index.html`
  - Enables client-side routing
  - Serves index.html for all non-file routes

## Post-Deployment Steps

### 1. Verify Deployment
```bash
# Check if site is live
curl -I https://tastemap-frontend.pages.dev

# Test API proxy
curl https://tastemap-frontend.pages.dev/health

# Test main page
curl https://tastemap-frontend.pages.dev/
```

### 2. Update API Client (if needed)
If using custom domain, update `apiClient.js`:
```javascript
// Change from:
const API_BASE = 'https://movies.aperion.cc';

// To (if using proxy):
const API_BASE = ''; // Use relative URLs to leverage _redirects proxy
```

### 3. Test Full Flow
1. Visit: `https://tastemap-frontend.pages.dev`
2. Check browser console for API health check
3. Try importing IMDB JSON
4. Verify taste profile calculation
5. Check recommendations display

## Custom Domain Setup

### Option 1: Cloudflare Domain
If your domain is on Cloudflare:

1. **Add Custom Domain**
   - Dashboard → Pages → `tastemap-frontend` → **Custom domains**
   - Click **Set up a custom domain**
   - Enter: `tastemap.yourdomain.com`
   - Click **Continue**

2. **DNS Records** (auto-created)
   - `CNAME tastemap.yourdomain.com` → `tastemap-frontend.pages.dev`

### Option 2: External Domain
1. Add custom domain in Cloudflare Pages
2. Add CNAME record at your DNS provider:
   ```
   tastemap  CNAME  tastemap-frontend.pages.dev
   ```
3. Wait for DNS propagation (~5 minutes)

## Environment Variables

If you need environment-specific configuration:

1. **Dashboard Method**
   - Pages → `tastemap-frontend` → **Settings** → **Environment variables**
   - Add: `API_BASE_URL` = `https://movies.aperion.cc`

2. **Build-time Variables**
   ```toml
   # In wrangler.toml
   [pages.env.production]
   API_BASE = "https://movies.aperion.cc"
   
   [pages.env.preview]
   API_BASE = "https://movies-staging.aperion.cc"
   ```

## Deployment Branches

Cloudflare Pages supports multiple environments:

- **Production Branch**: `main`
  - URL: `https://tastemap-frontend.pages.dev`
  - Production-ready code

- **Preview Branches**: Any other branch
  - URL: `https://<branch>.<commit>.tastemap-frontend.pages.dev`
  - For testing before merging to main

Example workflow:
```bash
# Create feature branch
git checkout -b feature/new-ui
git push origin feature/new-ui

# Cloudflare auto-deploys to preview URL
# Test at: https://feature-new-ui.<hash>.tastemap-frontend.pages.dev

# Merge to main when ready
git checkout main
git merge feature/new-ui
git push origin main

# Auto-deploys to production
```

## Troubleshooting

### Issue: 404 on API Requests
**Cause:** `_redirects` not working or API proxy misconfigured

**Fix:**
1. Verify `_redirects` file is in root directory
2. Check Cloudflare Pages dashboard → Functions → Redirects
3. Ensure backend worker is running: `curl https://movies.aperion.cc/health`

### Issue: CORS Errors
**Cause:** `_headers` not applied or backend CORS misconfigured

**Fix:**
1. Verify `_headers` file exists in root
2. Check browser DevTools → Network → Response Headers
3. Update worker CORS settings if needed

### Issue: CSS/JS Not Loading
**Cause:** Incorrect cache headers or paths

**Fix:**
1. Check browser DevTools → Network tab
2. Verify files are in correct locations
3. Clear browser cache: Hard refresh (Ctrl+Shift+R)

### Issue: SPA Routing Not Working
**Cause:** `_redirects` fallback not configured

**Fix:**
1. Ensure `/* /index.html 200` is last rule in `_redirects`
2. Verify no conflicting redirect rules above it

### Issue: Old Version Still Showing
**Cause:** Browser cache or CDN cache

**Fix:**
1. Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
2. Clear browser cache
3. Purge Cloudflare cache: Dashboard → Caching → Purge Everything

## Monitoring and Logs

### View Deployment Logs
1. Dashboard → Pages → `tastemap-frontend`
2. Click on specific deployment
3. View **Build logs** and **Function logs**

### Analytics
- Dashboard → Pages → `tastemap-frontend` → **Analytics**
- View: Requests, bandwidth, errors, top pages

## CI/CD Integration

### GitHub Actions Example
```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: tastemap-frontend
          directory: .
          branch: main
```

## Security Considerations

### 1. CORS Configuration
**Current:** Wildcard `*` allows all origins
**Production:** Restrict to specific domain
```
# In _headers
Access-Control-Allow-Origin: https://tastemap.yourdomain.com
```

### 2. Content Security Policy
Add to `_headers`:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https://image.tmdb.org
```

### 3. API Key Protection
- Never commit API keys to Git
- Use Cloudflare environment variables
- Rotate keys regularly

## Performance Optimization

### 1. Enable Cloudflare Speed Features
- Dashboard → Speed → Optimization
- Enable: Auto Minify (JS, CSS, HTML)
- Enable: Brotli compression
- Enable: Early Hints

### 2. Image Optimization
Use Cloudflare Images or TMDB optimized URLs:
```javascript
// Instead of:
const imageUrl = `https://image.tmdb.org/t/p/original${posterPath}`;

// Use optimized size:
const imageUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
```

### 3. Cache Strategy
Already configured in `_headers`:
- HTML: no-cache (always fresh)
- JS/CSS: 1 day (frequent updates)
- Images: 1 week (rarely change)
- Fonts: 1 year (never change)

## Rollback

### Revert to Previous Deployment
1. Dashboard → Pages → `tastemap-frontend`
2. Click **View build**
3. Find previous successful deployment
4. Click **⋮** → **Rollback to this deployment**

### Via CLI
```bash
# List deployments
wrangler pages deployments list --project-name=tastemap-frontend

# Rollback to specific deployment
wrangler pages deployment tail <deployment-id>
```

## Cost Estimate

Cloudflare Pages Free Tier:
- ✅ Unlimited requests
- ✅ Unlimited bandwidth
- ✅ 500 builds/month
- ✅ 1 build at a time
- ✅ 20,000 files per deployment

**Typical Costs:** $0/month for this project 🎉

## Next Steps

1. **Deploy** using Method 1 or 2 above
2. **Verify** all three configuration files are working
3. **Test** the full application end-to-end
4. **Set up** custom domain (optional)
5. **Monitor** analytics and errors

## Support

- Cloudflare Pages Docs: https://developers.cloudflare.com/pages/
- Cloudflare Discord: https://discord.gg/cloudflaredev
- Community Forum: https://community.cloudflare.com/

---

**Ready to Deploy!** 🚀

Your TasteMap frontend is now configured for Cloudflare Pages deployment.
