/**
 * IMDB data import handler with optional TMDB enrichment
 */

import { enrichMovieData } from './tmdb.js';

/**
 * Delays execution for the specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validates that a movie object has required fields
 * @param {Object} movie - IMDB movie object
 * @returns {boolean} True if valid
 */
function isValidMovie(movie) {
  return movie.Const && movie.Title && movie.Year;
}

/**
 * Checks if a movie already exists in the database
 * @param {Object} db - D1 database binding
 * @param {string} imdbId - IMDB ID (e.g., "tt0111161")
 * @returns {Promise<boolean>} True if movie exists
 */
async function movieExists(db, imdbId) {
  const result = await db.prepare(
    'SELECT imdb_id FROM movies WHERE imdb_id = ?'
  ).bind(imdbId).first();
  
  return result !== null;
}

/**
 * Inserts a movie record into the database
 * @param {Object} db - D1 database binding
 * @param {Object} movieData - Combined movie data
 * @returns {Promise<void>}
 */
async function insertMovie(db, movieData) {
  await db.prepare(`
    INSERT INTO movies (
      imdb_id, title, year, runtime_minutes,
      genres, director, user_rating, watch_date,
      tmdb_rating, tmdb_id, poster_path, backdrop_path,
      overview, cast, plot_keywords, tmdb_vote_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    movieData.imdb_id,
    movieData.title,
    movieData.year,
    movieData.runtime_minutes,
    movieData.genres,
    movieData.director,
    movieData.user_rating,
    movieData.watch_date,
    movieData.tmdb_rating,
    movieData.tmdb_id,
    movieData.poster_path,
    movieData.backdrop_path,
    movieData.overview,
    movieData.cast,
    movieData.plot_keywords,
    movieData.tmdb_vote_count
  ).run();
}

/**
 * Processes IMDB data import with optional TMDB enrichment
 * @param {Array<Object>} imdbData - Array of IMDB movie objects from ratings.json
 * @param {Object} db - D1 database binding
 * @param {string|null|undefined} tmdbApiKey - TMDB API key (optional)
 * @returns {Promise<Object>} Import results summary
 * @example
 * const results = await processImdbImport(imdbData, env.DB, env.TMDB_API_KEY);
 * // Returns: { total, successful, failed, skipped, errors: [] }
 */
export async function processImdbImport(imdbData, db, tmdbApiKey) {
  const results = {
    total: imdbData.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };
  
  console.log(`Starting import of ${results.total} movies...`);
  const enrichWithTmdb = Boolean(tmdbApiKey);
  if (enrichWithTmdb) {
    console.log('TMDB enrichment enabled');
  }
  
  for (let i = 0; i < imdbData.length; i++) {
    const movie = imdbData[i];
    
    // Progress logging every 10 movies
    if ((i + 1) % 10 === 0) {
      console.log(`Processed ${i + 1}/${results.total} movies...`);
    }
    
    try {
      // Validate required fields
      if (!isValidMovie(movie)) {
        results.failed++;
        results.errors.push({
          imdb_id: movie.Const || 'unknown',
          title: movie.Title || 'unknown',
          error: 'Missing required fields (Const, Title, or Year)'
        });
        continue;
      }
      
      // Check if movie already exists
      if (await movieExists(db, movie.Const)) {
        results.skipped++;
        continue;
      }
      
      // Build base movie data from IMDB
      const movieData = {
        imdb_id: movie.Const,
        title: movie.Title,
        year: movie.Year,
        runtime_minutes: movie['Runtime (mins)'] || null,
        genres: movie.Genres || null,
        director: movie.Directors || null,
        user_rating: movie['Your Rating'] || null,
        watch_date: movie['Date Rated'] || null,
        tmdb_rating: movie['IMDb Rating'] || null,
        tmdb_id: null,
        poster_path: null,
        backdrop_path: null,
        overview: null,
        cast: null,
        plot_keywords: null,
        tmdb_vote_count: movie['Num Votes'] || null
      };
      
      // Enrich with TMDB data if API key provided
      if (enrichWithTmdb) {
        try {
          const tmdbData = await enrichMovieData(
            movie.Const,
            movie.Title,
            movie.Year,
            tmdbApiKey
          );
          
          if (tmdbData) {
            // Merge TMDB data (overwrites IMDB data where available)
            movieData.tmdb_id = tmdbData.tmdb_id || null;
            movieData.poster_path = tmdbData.poster_path || null;
            movieData.backdrop_path = tmdbData.backdrop_path || null;
            movieData.overview = tmdbData.overview || null;
            movieData.tmdb_rating = tmdbData.vote_average || movieData.tmdb_rating;
            movieData.tmdb_vote_count = tmdbData.vote_count || movieData.tmdb_vote_count;
            
            // Handle array fields - convert to JSON strings
            if (tmdbData.genres && Array.isArray(tmdbData.genres)) {
              movieData.genres = tmdbData.genres.join(', ');
            }
            if (tmdbData.director) {
              movieData.director = tmdbData.director;
            }
            if (tmdbData.cast && Array.isArray(tmdbData.cast)) {
              movieData.cast = JSON.stringify(tmdbData.cast);
            }
            if (tmdbData.keywords && Array.isArray(tmdbData.keywords)) {
              movieData.plot_keywords = JSON.stringify(tmdbData.keywords);
            }
          }
          
          // Rate limiting delay between TMDB calls
          await delay(100);
        } catch (tmdbError) {
          // Log TMDB enrichment error but continue with basic import
          console.warn(`TMDB enrichment failed for ${movie.Title} (${movie.Year}):`, tmdbError.message);
        }
      }
      
      // Insert movie into database
      await insertMovie(db, movieData);
      results.successful++;
      
    } catch (error) {
      results.failed++;
      results.errors.push({
        imdb_id: movie.Const || 'unknown',
        title: movie.Title || 'unknown',
        error: error.message
      });
      console.error(`Failed to import ${movie.Title} (${movie.Year}):`, error.message);
    }
  }
  
  console.log('Import complete:', {
    successful: results.successful,
    failed: results.failed,
    skipped: results.skipped
  });
  
  return results;
}
