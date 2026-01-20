# AI-Powered Taste Profile & Recommendations

## Overview
This implementation adds AI-powered taste profile calculation and movie recommendations using Cloudflare Workers AI.

## New Files

### 1. `src/tasteProfile.js` (338 lines)
Calculates user's taste dimensions from rated movies.

**Key Features:**
- Minimum sample size check (20 movies required)
- Groups movies by rating tiers (loved 9-10, liked 7-8, neutral 5-6, disliked 1-4)
- Extracts patterns:
  - Genre preferences (weighted by ratings)
  - Era preferences (by decade)
  - Runtime preference (short/medium/long)
  - Director affinity (top 5 from loved movies)
- Uses Workers AI (`@cf/meta/llama-3.1-8b-instruct`) to extract themes from plot keywords
- Normalizes all scores to 0-1 range
- Stores results in `taste_profile` table
- Calculates confidence based on sample size

**Export:**
```javascript
calculateTasteProfile(db, ai) -> Promise<Object>
```

**Response Format:**
```json
{
  "genres": {"Drama": 0.85, "Sci-Fi": 0.72, ...},
  "eras": {"1990s": 0.80, "2000s": 0.65, ...},
  "themes": ["redemption", "anti-hero", "moral-ambiguity"],
  "runtime_preference": "medium",
  "directors": [
    {"name": "Christopher Nolan", "count": 5, "avg_rating": 9.2}
  ],
  "sample_size": 250,
  "confidence": 0.95,
  "ai_powered": true,
  "calculated_at": "2026-01-20T04:52:00.000Z"
}
```

### 2. `src/recommendations.js` (416 lines)
Generates AI-powered movie recommendations.

**Key Features:**
- Loads taste profile from database
- Filters out already-rated movies
- Applies optional filters (genre, era, mood)
- Calculates basic match scores for all candidates
- Uses Workers AI to rank top candidates and generate explanations
- Implements diversity check (not all from same genre)
- 24-hour caching system for recommendations
- Fallback to basic scoring if AI fails

**Export:**
```javascript
generateRecommendations(db, ai, options) -> Promise<Object>
```

**Options:**
```javascript
{
  mood?: string,           // "uplifting", "dark", "thoughtful"
  genre_filter?: string[], // ["Drama", "Thriller"]
  era_filter?: string,     // "classic", "modern", "recent"
  count: number           // 1-50, default 10
}
```

**Response Format:**
```json
{
  "recommendations": [
    {
      "movie": {...full movie object...},
      "match_score": 0.85,
      "reasoning": "Recommended because it matches your love of Drama and from your favorite era (1990s)"
    }
  ],
  "profile_confidence": 0.95,
  "cached": false,
  "ai_powered": true
}
```

## API Endpoints

### POST /api/taste-profile
Calculate and store user's taste profile.

**Requirements:**
- At least 20 rated movies in database
- Workers AI binding configured

**Response:** Computed taste profile object

**Error Cases:**
- 400: Insufficient data (<20 movies)
- 500: AI binding not configured or calculation error

### GET /api/taste-profile
Retrieve stored taste profile.

**Response:** Latest taste profile

**Error Cases:**
- 404: No profile exists (need to POST first)

### GET /api/recommendations
Generate AI-powered recommendations.

**Query Parameters:**
- `mood` (optional): e.g., "uplifting", "dark"
- `genre` (optional): comma-separated, e.g., "Drama,Thriller"
- `era` (optional): "classic", "modern", or "recent"
- `count` (optional): 1-50, default 10

**Response:** Recommendations array with reasoning

**Error Cases:**
- 400: Invalid parameters or no taste profile
- 500: AI binding not configured

## AI Integration Points

### Workers AI Model
- Model: `@cf/meta/llama-3.1-8b-instruct`
- Used for:
  1. Theme extraction from plot keywords and overviews
  2. Ranking and explaining recommendations

### Fallback Strategy
Both modules implement robust fallbacks:
- **tasteProfile.js**: Falls back to keyword frequency if AI fails
- **recommendations.js**: Falls back to genre/era matching if AI fails

## Database Schema Usage

### `taste_profile` table
Stores calculated dimensions:
- `genres` dimension with metadata JSON
- `eras` dimension with metadata JSON
- `themes` dimension with metadata JSON
- `runtime_preference` dimension with confidence score
- `directors` dimension with top directors array

### `recommendations` table
Caches AI-generated recommendations:
- `recommended_movie_ids`: JSON array of movie IDs
- `reasoning`: AI explanation
- `context`: Filter context for cache key
- `confidence_score`: Profile confidence
- `expires_at`: 24h expiry timestamp

## Testing

Basic syntax validation passes. Integration tests would require:
1. D1 database with sample movie data
2. Workers AI binding active
3. At least 20 rated movies

## Performance Considerations

- **Caching**: Recommendations cached for 24h per filter combination
- **AI Rate Limiting**: AI calls only made for:
  - Taste profile calculation (once per update)
  - New recommendation queries (cache miss)
- **Fallback**: Basic algorithms ensure service continuity if AI fails
- **Diversity**: Prevents all recommendations from same genre

## Next Steps

1. Deploy to Cloudflare Workers
2. Test with real movie data
3. Monitor AI performance and adjust prompts if needed
4. Consider A/B testing AI vs basic recommendations
5. Add user feedback mechanism to improve recommendations

## Configuration

Ensure `wrangler.toml` has:
```toml
[ai]
binding = "AI"
```

And environment secrets:
```bash
wrangler secret put TMDB_API_KEY
wrangler secret put IMPORT_SECRET
```
