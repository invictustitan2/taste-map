# Taste Map API - Cloudflare Worker

Movie recommendation system backend using Cloudflare Workers, D1 database, TMDB API, and Workers AI.

## Setup Instructions

### 1. Install Dependencies

```bash
cd worker
npm install
```

### 2. Create D1 Database

```bash
wrangler d1 create tastemap_db
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "tastemap_db"
database_id = "YOUR_DATABASE_ID"  # Replace with actual ID
```

### 3. Apply Database Schema

```bash
wrangler d1 execute tastemap_db --file=schema.sql --remote
```

### 4. Set Secrets

```bash
# Get your TMDB API key from https://www.themoviedb.org/settings/api
wrangler secret put TMDB_API_KEY

# Create a secure import key (random string)
wrangler secret put IMPORT_SECRET
```

### 5. Run Locally

```bash
npm run dev
```

Worker will be available at `http://localhost:8787`

### 6. Deploy to Production

```bash
npm run deploy
```

## API Endpoints

### Health Check
```
GET /health
```

Returns worker status and version.

### List Movies
```
GET /api/movies?page=1
```

Returns paginated list of movies (50 per page).

### Get Movie by IMDB ID
```
GET /api/movies/tt0111161
```

Returns detailed movie information.

### Import IMDB Data
```
POST /api/movies/import
Headers:
  X-Import-Key: YOUR_IMPORT_SECRET
  Content-Type: application/json

Body: [
  {
    "Const": "tt0111161",
    "Your Rating": "10",
    "Date Rated": "2023-01-15",
    "Title": "The Shawshank Redemption",
    "Title Type": "movie",
    "Year": "1994",
    "Runtime (mins)": "142",
    "Genres": "Drama",
    "Directors": "Frank Darabont"
  }
]
```

Imports movies from IMDB export and enriches with TMDB data.

### Get Recommendations (TODO)
```
GET /api/recommendations?mood=uplifting&genre=comedy
```

### Calculate Taste Profile (TODO)
```
POST /api/taste-profile
```

## IMDB Export Format

To export your IMDB ratings:
1. Go to https://www.imdb.com/list/ratings
2. Click "Export" to download CSV
3. Convert CSV to JSON (or use a tool)
4. Import via POST /api/movies/import

Expected JSON fields:
- `Const` - IMDB ID (required)
- `Title` - Movie title (required)
- `Year` - Release year (required)
- `Your Rating` - Your rating 1-10
- `Date Rated` - ISO date
- `Runtime (mins)` - Duration
- `Directors` - Director name

## Architecture

- **D1 Database** - Stores movies, taste profile, and recommendations
- **TMDB API** - Enriches movies with posters, cast, genres, keywords
- **Workers AI** - Generates personalized recommendations (TODO)
- **Cloudflare KV** - Future: Cache TMDB responses (optional)

## Development

### Local Database

For local development, you can use `--local` flag:

```bash
wrangler d1 execute tastemap_db --file=schema.sql --local
npm run dev
```

### View Database

```bash
wrangler d1 execute tastemap_db --command="SELECT * FROM movies LIMIT 10"
```

## TODO

- [ ] Implement AI-powered recommendations endpoint
- [ ] Implement taste profile calculation
- [ ] Add rate limiting for import endpoint
- [ ] Add authentication for recommendations
- [ ] Optimize TMDB API calls (batch requests)
- [ ] Add KV cache for TMDB responses
- [ ] Add webhook for automatic IMDB syncing
