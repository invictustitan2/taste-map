-- Taste Map D1 Database Schema
-- Movie recommendation system with IMDB + TMDB data enrichment

-- ============================================================================
-- MOVIES TABLE
-- ============================================================================
-- Stores enriched movie data combining IMDB user ratings with TMDB metadata
-- Primary data source is IMDB export, enriched with TMDB API data
CREATE TABLE IF NOT EXISTS movies (
    -- Primary key
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- IMDB identifier (format: tt1234567)
    imdb_id TEXT NOT NULL UNIQUE,
    
    -- TMDB identifier (nullable if TMDB match not found)
    tmdb_id INTEGER,
    
    -- Core movie information
    title TEXT NOT NULL,
    year INTEGER NOT NULL,
    runtime_minutes INTEGER,
    
    -- TMDB visual assets (relative paths, prepend with https://image.tmdb.org/t/p/)
    poster_path TEXT,        -- e.g., /w185/abc123.jpg for posters
    backdrop_path TEXT,      -- e.g., /w1280/xyz789.jpg for backgrounds
    
    -- Descriptive content
    overview TEXT,           -- TMDB plot summary
    
    -- Structured metadata (stored as JSON strings)
    genres TEXT,             -- JSON array: ["Drama", "Thriller"]
    director TEXT,           -- Director name from TMDB credits
    cast TEXT,               -- JSON array: ["Actor 1", "Actor 2", ...] (top 5)
    plot_keywords TEXT,      -- JSON array: ["prison", "hope", "friendship"]
    
    -- Rating data
    user_rating INTEGER CHECK(user_rating >= 1 AND user_rating <= 10),  -- User's IMDB rating (1-10)
    watch_date TEXT,         -- ISO date string when user watched/rated
    tmdb_rating REAL,        -- TMDB average rating (0-10)
    tmdb_vote_count INTEGER, -- Number of TMDB votes (popularity indicator)
    
    -- Metadata
    enriched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- When TMDB data was fetched
);

-- Index for fast IMDB ID lookups (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_movies_imdb_id ON movies(imdb_id);

-- Index for filtering user-rated movies (for taste profile calculations)
CREATE INDEX IF NOT EXISTS idx_movies_user_rating ON movies(user_rating) 
    WHERE user_rating IS NOT NULL;

-- Index for year-based queries (era preferences)
CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year);


-- ============================================================================
-- TASTE_PROFILE TABLE
-- ============================================================================
-- Stores calculated taste dimensions derived from user's rated movies
-- Used to personalize recommendations and explain viewing preferences
CREATE TABLE IF NOT EXISTS taste_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Dimension identifier (e.g., "prefers_indie", "era_preference_1990s")
    dimension_name TEXT NOT NULL UNIQUE,
    
    -- Normalized score (-1 to 1 or 0 to 1 depending on dimension)
    dimension_value REAL NOT NULL,
    
    -- Number of movies that contributed to this calculation
    sample_size INTEGER NOT NULL DEFAULT 0,
    
    -- When this dimension was last calculated
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional context (stored as JSON)
    -- e.g., {"top_genres": ["Drama", "Sci-Fi"], "avg_rating": 8.2}
    metadata TEXT
);


-- ============================================================================
-- RECOMMENDATIONS TABLE
-- ============================================================================
-- Caches AI-generated movie recommendations with reasoning
-- Avoids re-computing expensive AI inferences for repeat queries
CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- List of recommended movie IDs from the movies table (stored as JSON array)
    recommended_movie_ids TEXT NOT NULL,  -- JSON: [123, 456, 789]
    
    -- AI-generated explanation for these recommendations
    reasoning TEXT NOT NULL,
    
    -- Context/filters that produced this recommendation
    -- e.g., "mood:uplifting genre:comedy decade:2000s"
    context TEXT,
    
    -- AI confidence score (0-1)
    confidence_score REAL,
    
    -- Cache timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL  -- Recommendations expire after 24h
);

-- Index for finding valid cached recommendations
CREATE INDEX IF NOT EXISTS idx_recommendations_created ON recommendations(created_at);

-- Index for efficient cache cleanup (remove expired entries)
CREATE INDEX IF NOT EXISTS idx_recommendations_expires ON recommendations(expires_at);


-- ============================================================================
-- INITIAL SETUP COMPLETE
-- ============================================================================
-- To apply this schema:
--   1. Create database: wrangler d1 create tastemap_db
--   2. Update wrangler.toml with database_id
--   3. Apply schema: wrangler d1 execute tastemap_db --file=schema.sql --remote
