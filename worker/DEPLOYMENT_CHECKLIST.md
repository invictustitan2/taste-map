# Taste Map API - Deployment Checklist

## Pre-Deployment Setup

### Local Development Setup
- [ ] Install dependencies: `npm install`
- [ ] Create D1 database: `wrangler d1 create tastemap_db`
- [ ] Copy database_id to `wrangler.toml` (line 25)
- [ ] Apply schema locally: `wrangler d1 execute tastemap_db --file=schema.sql --local`
- [ ] Set TMDB_API_KEY: `wrangler secret put TMDB_API_KEY` (get from https://www.themoviedb.org/settings/api)
- [ ] Set IMPORT_SECRET: `wrangler secret put IMPORT_SECRET` (generate random string)
- [ ] Test locally: `npm run dev`
- [ ] Run test script: `./test-api.sh`

### Remote Database Setup
- [ ] Apply schema remotely: `wrangler d1 execute tastemap_db --file=schema.sql --remote`
- [ ] Verify tables: `wrangler d1 execute tastemap_db --command="SELECT name FROM sqlite_master WHERE type='table'"`

### Import Initial Data
- [ ] Export IMDB ratings from https://www.imdb.com/list/ratings
- [ ] Convert CSV to JSON format (see `sample-imdb.json`)
- [ ] Test import locally with sample data
- [ ] Import full dataset: `POST /api/movies/import`
- [ ] Verify import: `wrangler d1 execute tastemap_db --command="SELECT COUNT(*) FROM movies"`

## Deployment

### Deploy to Production
- [ ] Review `wrangler.toml` configuration
- [ ] Deploy: `npm run deploy`
- [ ] Note deployed URL (e.g., https://taste-map-api.ACCOUNT.workers.dev)
- [ ] Test health endpoint: `curl https://taste-map-api.ACCOUNT.workers.dev/health`
- [ ] Test movies endpoint: `curl https://taste-map-api.ACCOUNT.workers.dev/api/movies`

### Security Hardening
- [ ] Update CORS origin in `src/index.js` (line 9) to specific domain
- [ ] Rotate IMPORT_SECRET if exposed
- [ ] Set up Cloudflare Access for admin endpoints (optional)
- [ ] Enable rate limiting on import endpoint

## Post-Deployment

### Frontend Integration
- [ ] Update frontend API endpoint to worker URL
- [ ] Test movie list display
- [ ] Test movie detail view
- [ ] Test CORS from frontend domain

### Monitoring
- [ ] Check Cloudflare dashboard for request counts
- [ ] Monitor D1 database size
- [ ] Check TMDB API usage (quota limits)
- [ ] Review error logs: `wrangler tail`

### Future Enhancements
- [ ] Implement AI recommendations endpoint
- [ ] Implement taste profile calculation
- [ ] Add KV cache for TMDB responses
- [ ] Add webhook for IMDB auto-sync
- [ ] Add search endpoint

## Troubleshooting

### Common Issues

**Worker fails to start:**
- Check `wrangler.toml` syntax
- Ensure database_id is correct
- Verify Node.js compatibility is enabled

**Import fails:**
- Check TMDB_API_KEY is set: `wrangler secret list`
- Verify IMPORT_SECRET header matches
- Check TMDB API rate limits (40 requests/10 seconds)

**Database errors:**
- Verify schema is applied: Check tables exist
- Check D1 binding in wrangler.toml
- Ensure using `--remote` flag for production

**TMDB enrichment fails:**
- Verify API key is valid
- Check rate limiting (100ms delay between calls)
- Movies without TMDB match will store IMDB data only

## Maintenance

### Regular Tasks
- **Weekly**: Review error logs
- **Monthly**: Check TMDB API usage
- **Quarterly**: Rotate secrets
- **As needed**: Re-import IMDB ratings

### Database Backup
```bash
# Export all movies
wrangler d1 export tastemap_db --output=backup.sql

# Restore from backup
wrangler d1 execute tastemap_db --file=backup.sql
```

### View Logs
```bash
# Tail live logs
wrangler tail

# Filter for errors
wrangler tail --format=pretty | grep ERROR
```

### Update Worker
```bash
# Make changes to code
# Test locally
npm run dev

# Deploy when ready
npm run deploy
```

## Support

### Useful Links
- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- D1 Database Docs: https://developers.cloudflare.com/d1/
- TMDB API Docs: https://developers.themoviedb.org/3
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/

### Debug Commands
```bash
# Check secrets
wrangler secret list

# Query database
wrangler d1 execute tastemap_db --command="SELECT * FROM movies LIMIT 5"

# View worker logs
wrangler tail --format=pretty

# Check worker status
wrangler deployments list
```
