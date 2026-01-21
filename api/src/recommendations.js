/**
 * AI-powered movie recommendation engine with reasoning
 */

const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const CACHE_DURATION_HOURS = 24;
const DEFAULT_COUNT = 10;
const MAX_COUNT = 50;

/**
 * Loads taste profile from database with confidence score
 * @param {Object} db - D1 database binding
 * @returns {Promise<Object|null>} Taste profile object with confidence or null
 */
async function loadTasteProfile(db) {
  const { results } = await db.prepare(`
    SELECT dimension_name, dimension_value, sample_size, metadata
    FROM taste_profile
  `).all();
  
  if (!results || results.length === 0) {
    return null;
  }
  
  const profile = {
    genres: {},
    eras: {},
    themes: [],
    directors: [],
    runtime_preference: null,
    sample_size: 0,
    confidence: 0
  };
  
  results.forEach(row => {
    const metadata = row.metadata ? JSON.parse(row.metadata) : {};
    profile.sample_size = row.sample_size || 0;
    
    switch (row.dimension_name) {
      case 'genre':
        profile.genres[row.dimension_value] = metadata.score || 0;
        break;
      case 'era':
        profile.eras[row.dimension_value] = metadata.score || 0;
        break;
      case 'theme':
        profile.themes.push(row.dimension_value);
        break;
      case 'director':
        profile.directors.push(row.dimension_value);
        break;
      case 'runtime_preference':
        profile.runtime_preference = row.dimension_value;
        profile.confidence = metadata.confidence || 0;
        break;
    }
  });
  
  return profile;
}

/**
 * Filters movies by genre (matches ANY genre)
 * @param {Array<Object>} movies - Array of movies
 * @param {Array<string>} genreFilter - Genres to match
 * @returns {Array<Object>} Filtered movies
 */
function filterByGenre(movies, genreFilter) {
  if (!genreFilter || genreFilter.length === 0) {
    return movies;
  }
  
  return movies.filter(movie => {
    if (!movie.genres) return false;
    
    const movieGenres = movie.genres.split(',').map(g => g.trim());
    return genreFilter.some(genre => 
      movieGenres.some(mg => mg.toLowerCase() === genre.toLowerCase())
    );
  });
}

/**
 * Filters movies by era
 * @param {Array<Object>} movies - Array of movies
 * @param {string} eraFilter - "classic", "modern", or "recent"
 * @returns {Array<Object>} Filtered movies
 */
function filterByEra(movies, eraFilter) {
  if (!eraFilter) {
    return movies;
  }
  
  return movies.filter(movie => {
    if (!movie.year) return false;
    
    switch (eraFilter) {
      case 'classic':
        return movie.year < 2000;
      case 'modern':
        return movie.year >= 2000 && movie.year <= 2015;
      case 'recent':
        return movie.year > 2015;
      default:
        return true;
    }
  });
}

/**
 * Builds cache key from recommendation context
 * @param {Object} options - Recommendation options
 * @returns {string} Cache key
 */
function buildCacheKey(options) {
  const mood = options.mood || 'any';
  const genres = options.genre_filter ? options.genre_filter.sort().join(',') : 'any';
  const era = options.era_filter || 'any';
  return `${mood}_${genres}_${era}`;
}

/**
 * Checks recommendation cache
 * @param {Object} db - D1 database binding
 * @param {string} cacheKey - Cache key
 * @returns {Promise<Object|null>} Cached recommendations with reasoning or null
 */
async function checkCache(db, cacheKey) {
  const result = await db.prepare(`
    SELECT recommended_movie_ids, reasoning, confidence_score
    FROM recommendations
    WHERE context = ?
      AND expires_at > datetime('now')
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(cacheKey).first();
  
  if (!result) {
    return null;
  }
  
  const recommendations = JSON.parse(result.recommended_movie_ids);
  const reasoning = result.reasoning ? JSON.parse(result.reasoning) : {};
  
  // Fetch full movie data
  const movieIds = recommendations.map(r => r.imdb_id).filter(Boolean);
  if (movieIds.length === 0) {
    return { recommendations: [], confidence_score: result.confidence_score || 0 };
  }
  
  const placeholders = movieIds.map(() => '?').join(',');
  const { results: movies } = await db.prepare(`
    SELECT imdb_id, title, year, genres, director, overview,
           poster_path, backdrop_path, tmdb_rating, runtime_minutes
    FROM movies
    WHERE imdb_id IN (${placeholders})
  `).bind(...movieIds).all();
  
  // Rebuild recommendations with full movie data
  const fullRecommendations = recommendations.map(rec => {
    const movie = movies.find(m => m.imdb_id === rec.imdb_id);
    return {
      movie,
      match_score: rec.match_score,
      reasoning: rec.reasoning
    };
  }).filter(r => r.movie); // Filter out any missing movies
  
  console.log(`Cache hit for context: ${cacheKey}`);
  return {
    recommendations: fullRecommendations,
    confidence_score: result.confidence_score || 0
  };
}

/**
 * Saves recommendations to cache
 * @param {Object} db - D1 database binding
 * @param {string} cacheKey - Cache key
 * @param {Array<Object>} recommendations - Recommendations with match_score and reasoning
 * @param {number} confidenceScore - Overall confidence score
 * @returns {Promise<void>}
 */
async function saveToCache(db, cacheKey, recommendations, confidenceScore) {
  const movieIds = recommendations.map(r => ({
    imdb_id: r.imdb_id,
    match_score: r.match_score,
    reasoning: r.reasoning
  }));
  
  await db.prepare(`
    INSERT INTO recommendations (context, recommended_movie_ids, reasoning, confidence_score, expires_at, created_at)
    VALUES (?, ?, ?, ?, datetime('now', '+${CACHE_DURATION_HOURS} hours'), datetime('now'))
  `).bind(
    cacheKey,
    JSON.stringify(movieIds),
    JSON.stringify({}), // Legacy field, kept for schema compatibility
    confidenceScore
  ).run();
  
  console.log(`Cached recommendations for context: ${cacheKey}`);
}

/**
 * Calculates simple compatibility score for fallback
 * @param {Object} movie - Movie object
 * @param {Object} profile - Taste profile
 * @returns {number} Compatibility score 0-1
 */
function calculateFallbackScore(movie, profile) {
  let score = 0;
  let factors = 0;
  
  // Genre matching
  if (movie.genres && Object.keys(profile.genres).length > 0) {
    const movieGenres = movie.genres.split(',').map(g => g.trim());
    const genreScores = movieGenres
      .map(g => profile.genres[g] || 0)
      .filter(s => s > 0);
    
    if (genreScores.length > 0) {
      score += genreScores.reduce((sum, s) => sum + s, 0) / genreScores.length;
      factors++;
    }
  }
  
  // Use IMDB rating as tiebreaker
  if (movie.tmdb_rating) {
    score += movie.tmdb_rating / 10;
    factors++;
  }
  
  return factors > 0 ? score / factors : 0.5;
}

/**
 * Uses AI to generate recommendations with reasoning
 * @param {Array<Object>} candidates - Candidate movies
 * @param {Object} profile - Taste profile
 * @param {Object} options - Recommendation options
 * @param {Object} ai - Workers AI binding
 * @returns {Promise<Array<Object>>} Recommendations with match_score and reasoning
 */
async function generateWithAI(candidates, profile, options, ai) {
  try {
    const count = options.count || DEFAULT_COUNT;
    
    // Limit candidates to top 100 by IMDB rating for AI processing
    const topCandidates = candidates
      .sort((a, b) => (b.tmdb_rating || 0) - (a.tmdb_rating || 0))
      .slice(0, 100);
    
    // Build profile summary
    const topGenres = Object.entries(profile.genres)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre, score]) => `${genre} (${(score * 100).toFixed(0)}%)`)
      .join(', ');
    
    const topEra = Object.entries(profile.eras)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'various';
    
    const movieList = topCandidates.map(m => 
      `{"imdb_id": "${m.imdb_id}", "title": "${m.title.replace(/"/g, '\\"')}", "year": ${m.year}, "genres": "${m.genres || 'Unknown'}", "director": "${m.director || 'Unknown'}"}`
    ).join(',\n');
    
    const moodText = options.mood ? `The user wants movies with a ${options.mood} mood.\n` : '';
    
    const prompt = `You are a movie recommendation expert. Based on this user's taste profile:

Favorite genres: ${topGenres}
Preferred eras: ${topEra}
Themes: ${profile.themes.slice(0, 5).join(', ')}
Favorite directors: ${profile.directors.slice(0, 3).join(', ')}

${moodText}From this list of unwatched movies, recommend the top ${count} that best match their taste:
[
${movieList}
]

For each recommendation, explain in one sentence why it matches their taste.
Respond ONLY with valid JSON (no markdown, no preamble):
[
  {
    "imdb_id": "tt1234567",
    "match_score": 0.85,
    "reasoning": "explanation here"
  }
]`;

    const response = await ai.run(AI_MODEL, {
      messages: [{ role: "user", content: prompt }]
    });
    
    let responseText = response.response || '';
    
    // Strip markdown code fences if present
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Parse JSON response
    if (!responseText) {
      throw new Error('Empty response from AI');
    }
    const recommendations = JSON.parse(responseText);
    
    // Validate structure
    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      throw new Error('Invalid AI response structure');
    }
    
    // Validate each recommendation has required fields
    const validated = recommendations.filter(rec => 
      rec.imdb_id && 
      typeof rec.match_score === 'number' && 
      rec.reasoning
    );
    
    if (validated.length === 0) {
      throw new Error('No valid recommendations in AI response');
    }
    
    console.log(`AI generated ${validated.length} recommendations`);
    return validated;
    
  } catch (error) {
    console.error('AI recommendation generation failed:', error.message);
    throw error;
  }
}

/**
 * Fallback recommendation logic using simple genre matching
 * @param {Array<Object>} candidates - Candidate movies
 * @param {Object} profile - Taste profile
 * @param {number} count - Number of recommendations
 * @returns {Array<Object>} Simple recommendations
 */
function generateFallback(candidates, profile, count) {
  console.log('Using fallback recommendation logic');
  
  // Score by genre match and IMDB rating
  const scored = candidates.map(movie => ({
    imdb_id: movie.imdb_id,
    match_score: calculateFallbackScore(movie, profile),
    reasoning: 'Recommended based on genre preferences and ratings'
  }));
  
  // Sort by score and take top N
  return scored
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, count);
}

/**
 * Generates AI-powered movie recommendations with reasoning
 * @param {Object} db - D1 database binding
 * @param {Object} ai - Workers AI binding
 * @param {Object} options - Recommendation options
 * @param {string} [options.mood] - Desired mood (e.g., "uplifting", "dark", "thoughtful")
 * @param {Array<string>} [options.genre_filter] - Filter by genres (matches ANY)
 * @param {string} [options.era_filter] - "classic" (<2000), "modern" (2000-2015), or "recent" (>2015)
 * @param {number} [options.count=10] - Number of recommendations (max 50)
 * @returns {Promise<Object>} Recommendations result with reasoning
 * @example
 * const result = await generateRecommendations(env.DB, env.AI, {
 *   mood: "uplifting",
 *   genre_filter: ["Drama", "Comedy"],
 *   era_filter: "recent",
 *   count: 10
 * });
 * // Returns:
 * // {
 * //   recommendations: [
 * //     {
 * //       movie: { imdb_id, title, year, ... },
 * //       match_score: 0.85,
 * //       reasoning: "Based on your love of..."
 * //     }
 * //   ],
 * //   profile_confidence: 0.9,
 * //   cached: false,
 * //   filters_applied: { mood, genres, era }
 * // }
 */
export async function generateRecommendations(db, ai, options = {}) {
  try {
    const count = Math.min(options.count || DEFAULT_COUNT, MAX_COUNT);
    
    // Load taste profile
    const profile = await loadTasteProfile(db);
    if (!profile) {
      return {
        error: 'No taste profile found. Calculate one first.',
        recommendations: [],
        profile_confidence: 0,
        cached: false,
        filters_applied: options
      };
    }
    
    // Check cache first
    const cacheKey = buildCacheKey(options);
    const cached = await checkCache(db, cacheKey);
    if (cached) {
      return {
        recommendations: cached.recommendations.slice(0, count),
        profile_confidence: profile.confidence,
        cached: true,
        filters_applied: options
      };
    }
    
    // Get all movies
    const { results: allMovies } = await db.prepare(`
      SELECT imdb_id, title, year, genres, director, overview,
             poster_path, backdrop_path, tmdb_rating, runtime_minutes, user_rating
      FROM movies
    `).all();
    
    // Separate rated vs unrated
    const unratedMovies = allMovies.filter(m => !m.user_rating);
    
    console.log(`Found ${unratedMovies.length} unrated movies`);
    
    // Apply filters
    let candidates = unratedMovies;
    
    if (options.genre_filter) {
      candidates = filterByGenre(candidates, options.genre_filter);
      console.log(`After genre filter: ${candidates.length} candidates`);
    }
    
    if (options.era_filter) {
      candidates = filterByEra(candidates, options.era_filter);
      console.log(`After era filter: ${candidates.length} candidates`);
    }
    
    if (candidates.length === 0) {
      return {
        error: 'No movies match the specified filters',
        recommendations: [],
        profile_confidence: profile.confidence,
        cached: false,
        filters_applied: options
      };
    }
    
    // Generate recommendations using AI (with fallback)
    let aiRecommendations;
    try {
      aiRecommendations = await generateWithAI(candidates, profile, { ...options, count }, ai);
    } catch (aiError) {
      console.warn('AI generation failed, using fallback:', aiError.message);
      aiRecommendations = generateFallback(candidates, profile, count);
    }
    
    // Fetch full movie details for recommended IDs
    const movieIds = aiRecommendations.map(r => r.imdb_id).filter(Boolean);
    if (movieIds.length === 0) {
      return {
        recommendations: [],
        profile_confidence: profile.confidence,
        cached: false,
        filters_applied: options
      };
    }
    
    const placeholders = movieIds.map(() => '?').join(',');
    const { results: movies } = await db.prepare(`
      SELECT imdb_id, title, year, genres, director, overview,
             poster_path, backdrop_path, tmdb_rating, runtime_minutes
      FROM movies
      WHERE imdb_id IN (${placeholders})
    `).bind(...movieIds).all();
    
    // Build final recommendations with full movie data
    const recommendations = aiRecommendations.map(rec => {
      const movie = movies.find(m => m.imdb_id === rec.imdb_id);
      return {
        movie,
        match_score: rec.match_score,
        reasoning: rec.reasoning
      };
    }).filter(r => r.movie); // Filter out any missing movies
    
    // Cache the results
    await saveToCache(db, cacheKey, aiRecommendations, profile.confidence);
    
    return {
      recommendations,
      profile_confidence: profile.confidence,
      cached: false,
      filters_applied: options
    };
    
  } catch (error) {
    console.error('Failed to generate recommendations:', error.message);
    throw error;
  }
}
