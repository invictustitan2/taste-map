/**
 * Taste profile calculator using Workers AI
 * Analyzes user's movie ratings to identify preferences and patterns
 */

const MIN_SAMPLE_SIZE = 20;
const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";

/**
 * Groups movies by rating tier
 * @param {Array<Object>} movies - Array of movie objects with ratings
 * @returns {Object} Movies grouped by tier (loved, liked, neutral, disliked)
 */
function groupByRating(movies) {
  return {
    loved: movies.filter(m => m.user_rating >= 9),
    liked: movies.filter(m => m.user_rating >= 7 && m.user_rating < 9),
    neutral: movies.filter(m => m.user_rating >= 5 && m.user_rating < 7),
    disliked: movies.filter(m => m.user_rating < 5)
  };
}

/**
 * Calculates genre preferences from rated movies
 * @param {Object} ratingGroups - Movies grouped by rating tier
 * @returns {Object} Genre scores normalized to 0-1 scale
 */
function calculateGenrePreferences(ratingGroups) {
  const genreCounts = {};
  const genreWeights = {};
  
  // Count genre occurrences weighted by rating
  const processMovies = (movies, weight) => {
    movies.forEach(movie => {
      if (!movie.genres) return;
      
      const genres = movie.genres.split(',').map(g => g.trim());
      genres.forEach(genre => {
        if (!genre) return;
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        genreWeights[genre] = (genreWeights[genre] || 0) + weight;
      });
    });
  };
  
  processMovies(ratingGroups.loved, 1.0);
  processMovies(ratingGroups.liked, 0.6);
  processMovies(ratingGroups.neutral, 0.3);
  processMovies(ratingGroups.disliked, -0.5);
  
  // Normalize to 0-1 scale
  const maxWeight = Math.max(...Object.values(genreWeights));
  const minWeight = Math.min(...Object.values(genreWeights));
  const range = maxWeight - minWeight;
  
  const normalized = {};
  for (const genre in genreWeights) {
    if (range > 0) {
      normalized[genre] = (genreWeights[genre] - minWeight) / range;
    } else {
      normalized[genre] = 0.5;
    }
  }
  
  return normalized;
}

/**
 * Calculates era/decade preferences
 * @param {Array<Object>} movies - All rated movies
 * @returns {Object} Era scores by decade
 */
function calculateEraPreferences(movies) {
  const eraCounts = {};
  const eraWeights = {};
  
  movies.forEach(movie => {
    if (!movie.year) return;
    
    const decade = Math.floor(movie.year / 10) * 10;
    const eraLabel = `${decade}s`;
    
    eraCounts[eraLabel] = (eraCounts[eraLabel] || 0) + 1;
    eraWeights[eraLabel] = (eraWeights[eraLabel] || 0) + (movie.user_rating / 10);
  });
  
  // Normalize by average rating per era
  const normalized = {};
  for (const era in eraWeights) {
    normalized[era] = eraWeights[era] / eraCounts[era];
  }
  
  return normalized;
}

/**
 * Determines runtime preference based on high-rated movies
 * @param {Object} ratingGroups - Movies grouped by rating tier
 * @returns {string} "short", "medium", or "long"
 */
function calculateRuntimePreference(ratingGroups) {
  const runtimeCounts = { short: 0, medium: 0, long: 0 };
  
  // Analyze loved and liked movies
  const highRated = [...ratingGroups.loved, ...ratingGroups.liked];
  
  highRated.forEach(movie => {
    if (!movie.runtime_minutes) return;
    
    if (movie.runtime_minutes < 90) {
      runtimeCounts.short++;
    } else if (movie.runtime_minutes <= 150) {
      runtimeCounts.medium++;
    } else {
      runtimeCounts.long++;
    }
  });
  
  // Return preference with highest count
  const max = Math.max(runtimeCounts.short, runtimeCounts.medium, runtimeCounts.long);
  if (runtimeCounts.medium === max) return "medium";
  if (runtimeCounts.long === max) return "long";
  return "short";
}

/**
 * Extracts top directors from loved movies
 * @param {Array<Object>} lovedMovies - Movies rated 9-10
 * @returns {Array<string>} Top 5 directors by count
 */
function extractTopDirectors(lovedMovies) {
  const directorCounts = {};
  
  lovedMovies.forEach(movie => {
    if (!movie.director || movie.director === 'Unknown') return;
    
    // Handle multiple directors separated by comma
    const directors = movie.director.split(',').map(d => d.trim());
    directors.forEach(director => {
      directorCounts[director] = (directorCounts[director] || 0) + 1;
    });
  });
  
  // Sort by count and take top 5
  return Object.entries(directorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([director]) => director);
}

/**
 * Analyzes themes using Workers AI
 * @param {Array<Object>} lovedMovies - Movies rated 9-10
 * @param {Object} ai - Workers AI binding
 * @returns {Promise<Array<string>>} Array of identified themes
 */
async function analyzeThemes(lovedMovies, ai) {
  try {
    // Collect all plot keywords from loved movies
    const allKeywords = [];
    lovedMovies.forEach(movie => {
      if (movie.plot_keywords) {
        try {
          const keywords = JSON.parse(movie.plot_keywords);
          if (Array.isArray(keywords)) {
            allKeywords.push(...keywords);
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    });
    
    if (allKeywords.length === 0) {
      return [];
    }
    
    // Get most common keywords (top 30)
    const keywordCounts = {};
    allKeywords.forEach(kw => {
      keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
    });
    
    const topKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([kw]) => kw);
    
    // Use Workers AI to identify patterns
    const prompt = `Analyze these movie themes and identify 5 key patterns or recurring themes. Return only the themes as a comma-separated list, no explanations:\n\n${topKeywords.join(', ')}`;
    
    const response = await ai.run(AI_MODEL, {
      messages: [{ role: "user", content: prompt }]
    });
    
    // Extract themes from AI response
    let themesText = response.response || '';
    
    // Parse comma-separated themes
    const themes = themesText
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0)
      .slice(0, 5);
    
    return themes.length > 0 ? themes : topKeywords.slice(0, 5);
    
  } catch (error) {
    console.error('AI theme analysis failed:', error.message);
    // Fallback: return top keywords
    const fallbackKeywords = [];
    lovedMovies.forEach(movie => {
      if (movie.plot_keywords) {
        try {
          const keywords = JSON.parse(movie.plot_keywords);
          if (Array.isArray(keywords)) {
            fallbackKeywords.push(...keywords);
          }
        } catch (e) {}
      }
    });
    
    const keywordCounts = {};
    fallbackKeywords.forEach(kw => {
      keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
    });
    
    return Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([kw]) => kw);
  }
}

/**
 * Calculates confidence score based on sample size and distribution
 * @param {number} sampleSize - Number of rated movies
 * @param {Object} genrePreferences - Genre preference scores
 * @returns {number} Confidence score 0-1
 */
function calculateConfidence(sampleSize, genrePreferences) {
  // Base confidence from sample size
  let confidence = Math.min(sampleSize / 100, 1.0);
  
  // Reduce confidence if genre distribution is very uniform (low variance)
  const values = Object.values(genrePreferences);
  if (values.length > 0) {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    
    // Low variance (< 0.05) indicates uniform distribution, reduce confidence
    if (variance < 0.05) {
      confidence *= 0.7;
    }
  }
  
  return Math.round(confidence * 100) / 100;
}

/**
 * Stores taste profile in database
 * @param {Object} db - D1 database binding
 * @param {Object} profile - Computed taste profile
 * @returns {Promise<void>}
 */
async function storeTasteProfile(db, profile) {
  // Clear existing profile
  await db.prepare('DELETE FROM taste_profile').run();
  
  const insertStmt = db.prepare(`
    INSERT INTO taste_profile (dimension_name, dimension_value, sample_size, metadata)
    VALUES (?, ?, ?, ?)
  `);
  
  // Store genres
  for (const [genre, score] of Object.entries(profile.genres)) {
    await insertStmt.bind(
      'genre',
      genre,
      profile.sample_size,
      JSON.stringify({ score })
    ).run();
  }
  
  // Store eras
  for (const [era, score] of Object.entries(profile.eras)) {
    await insertStmt.bind(
      'era',
      era,
      profile.sample_size,
      JSON.stringify({ score })
    ).run();
  }
  
  // Store themes
  profile.themes.forEach(async (theme, index) => {
    await insertStmt.bind(
      'theme',
      theme,
      profile.sample_size,
      JSON.stringify({ rank: index + 1 })
    ).run();
  });
  
  // Store runtime preference
  await insertStmt.bind(
    'runtime_preference',
    profile.runtime_preference,
    profile.sample_size,
    JSON.stringify({ confidence: profile.confidence })
  ).run();
  
  // Store directors
  profile.directors.forEach(async (director, index) => {
    await insertStmt.bind(
      'director',
      director,
      profile.sample_size,
      JSON.stringify({ rank: index + 1 })
    ).run();
  });
}

/**
 * Calculates user's taste profile using Workers AI
 * @param {Object} db - D1 database binding
 * @param {Object} ai - Workers AI binding
 * @returns {Promise<Object>} Computed taste profile or error
 * @example
 * const profile = await calculateTasteProfile(env.DB, env.AI);
 * // Returns: { genres, eras, themes, runtime_preference, directors, sample_size, confidence }
 */
export async function calculateTasteProfile(db, ai) {
  try {
    // Query all rated movies
    const { results: movies } = await db.prepare(`
      SELECT imdb_id, title, year, runtime_minutes, genres, director,
             user_rating, plot_keywords
      FROM movies
      WHERE user_rating IS NOT NULL
      ORDER BY user_rating DESC
    `).all();
    
    // Check minimum sample size
    if (!movies || movies.length < MIN_SAMPLE_SIZE) {
      return {
        error: 'Insufficient data for taste profile calculation',
        sample_size: movies ? movies.length : 0,
        required: MIN_SAMPLE_SIZE
      };
    }
    
    console.log(`Calculating taste profile from ${movies.length} rated movies...`);
    
    // Group movies by rating tier
    const ratingGroups = groupByRating(movies);
    
    // Calculate all profile dimensions
    const genres = calculateGenrePreferences(ratingGroups);
    const eras = calculateEraPreferences(movies);
    const runtime_preference = calculateRuntimePreference(ratingGroups);
    const directors = extractTopDirectors(ratingGroups.loved);
    const themes = await analyzeThemes(ratingGroups.loved, ai);
    
    // Calculate confidence score
    const confidence = calculateConfidence(movies.length, genres);
    
    const profile = {
      genres,
      eras,
      themes,
      runtime_preference,
      directors,
      sample_size: movies.length,
      confidence
    };
    
    // Store profile in database
    await storeTasteProfile(db, profile);
    
    console.log('Taste profile calculated successfully');
    return profile;
    
  } catch (error) {
    console.error('Failed to calculate taste profile:', error.message);
    throw error;
  }
}
