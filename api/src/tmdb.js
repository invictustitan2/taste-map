/**
 * TMDB API client for enriching movie data
 * API Documentation: https://developers.themoviedb.org/3/
 */

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const RATE_LIMIT_DELAY = 100; // ms between requests
const MAX_RETRIES = 3;

/**
 * Delays execution for the specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches from TMDB API with exponential backoff on rate limiting
 * @param {string} url - Full URL to fetch
 * @param {number} retries - Number of retries remaining
 * @returns {Promise<Object|null>} Response data or null on error
 */
async function fetchWithRetry(url, retries = MAX_RETRIES) {
  try {
    const response = await fetch(url);
    
    if (response.status === 429) {
      if (retries > 0) {
        const backoffDelay = Math.pow(2, MAX_RETRIES - retries) * 1000;
        console.warn(`TMDB rate limit hit, retrying in ${backoffDelay}ms...`);
        await delay(backoffDelay);
        return fetchWithRetry(url, retries - 1);
      }
      console.error('TMDB rate limit exceeded, max retries reached');
      return null;
    }
    
    if (!response.ok) {
      console.error(`TMDB API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('TMDB network error:', error.message);
    return null;
  }
}

/**
 * Searches TMDB for a movie by title and exact year match
 * @param {string} title - Movie title to search
 * @param {number} year - Release year (must match exactly)
 * @param {string} apiKey - TMDB API key
 * @returns {Promise<Object|null>} Movie data or null if not found
 * @example
 * const movie = await searchMovie('Inception', 2010, apiKey);
 * // Returns: { tmdb_id, title, year, poster_path, overview }
 */
export async function searchMovie(title, year, apiKey) {
  const params = new URLSearchParams({
    api_key: apiKey,
    query: title,
    year: year.toString()
  });
  
  const url = `${TMDB_BASE_URL}/search/movie?${params}`;
  const data = await fetchWithRetry(url);
  
  if (!data || !data.results || data.results.length === 0) {
    console.log(`No TMDB match found for: ${title} (${year})`);
    return null;
  }
  
  const movie = data.results[0];
  return {
    tmdb_id: movie.id,
    title: movie.title,
    year: new Date(movie.release_date).getFullYear(),
    poster_path: movie.poster_path,
    overview: movie.overview
  };
}

/**
 * Gets full movie details from TMDB
 * @param {number} tmdbId - TMDB movie ID
 * @param {string} apiKey - TMDB API key
 * @returns {Promise<Object|null>} Movie details or null on error
 * @example
 * const details = await getMovieDetails(27205, apiKey);
 * // Returns: { genres, runtime, vote_average, vote_count, backdrop_path }
 */
export async function getMovieDetails(tmdbId, apiKey) {
  const params = new URLSearchParams({
    api_key: apiKey
  });
  
  const url = `${TMDB_BASE_URL}/movie/${tmdbId}?${params}`;
  const data = await fetchWithRetry(url);
  
  if (!data) {
    return null;
  }
  
  return {
    genres: data.genres ? data.genres.map(g => g.name) : [],
    runtime: data.runtime,
    vote_average: data.vote_average,
    vote_count: data.vote_count,
    backdrop_path: data.backdrop_path
  };
}

/**
 * Gets movie credits (director and cast) from TMDB
 * @param {number} tmdbId - TMDB movie ID
 * @param {string} apiKey - TMDB API key
 * @returns {Promise<Object|null>} Credits data or null on error
 * @example
 * const credits = await getMovieCredits(27205, apiKey);
 * // Returns: { director: "Christopher Nolan", cast: ["Leonardo DiCaprio", ...] }
 */
export async function getMovieCredits(tmdbId, apiKey) {
  const params = new URLSearchParams({
    api_key: apiKey
  });
  
  const url = `${TMDB_BASE_URL}/movie/${tmdbId}/credits?${params}`;
  const data = await fetchWithRetry(url);
  
  if (!data) {
    return null;
  }
  
  const director = data.crew
    ? data.crew.find(person => person.job === 'Director')?.name
    : null;
  
  const cast = data.cast
    ? data.cast.slice(0, 5).map(person => person.name)
    : [];
  
  return {
    director: director || 'Unknown',
    cast
  };
}

/**
 * Gets movie keywords from TMDB
 * @param {number} tmdbId - TMDB movie ID
 * @param {string} apiKey - TMDB API key
 * @returns {Promise<string[]>} Array of keyword strings
 * @example
 * const keywords = await getMovieKeywords(27205, apiKey);
 * // Returns: ["dream", "subconscious", "paris france", ...]
 */
export async function getMovieKeywords(tmdbId, apiKey) {
  const params = new URLSearchParams({
    api_key: apiKey
  });
  
  const url = `${TMDB_BASE_URL}/movie/${tmdbId}/keywords?${params}`;
  const data = await fetchWithRetry(url);
  
  if (!data || !data.keywords) {
    return [];
  }
  
  return data.keywords.map(kw => kw.name);
}

/**
 * Enriches movie data by orchestrating all TMDB API calls
 * @param {string} imdbId - IMDb ID (for reference, not used in TMDB calls)
 * @param {string} title - Movie title
 * @param {number} year - Release year
 * @param {string} apiKey - TMDB API key
 * @returns {Promise<Object|null>} Enriched movie data or null if search fails
 * @example
 * const enriched = await enrichMovieData('tt1375666', 'Inception', 2010, apiKey);
 * // Returns combined data from all endpoints
 */
export async function enrichMovieData(imdbId, title, year, apiKey) {
  // Search for the movie first
  const searchResult = await searchMovie(title, year, apiKey);
  if (!searchResult) {
    return null;
  }
  
  const { tmdb_id } = searchResult;
  const enrichedData = { ...searchResult, imdb_id: imdbId };
  
  // Get additional data with delays to respect rate limits
  await delay(RATE_LIMIT_DELAY);
  const details = await getMovieDetails(tmdb_id, apiKey);
  if (details) {
    Object.assign(enrichedData, details);
  }
  
  await delay(RATE_LIMIT_DELAY);
  const credits = await getMovieCredits(tmdb_id, apiKey);
  if (credits) {
    Object.assign(enrichedData, credits);
  }
  
  await delay(RATE_LIMIT_DELAY);
  const keywords = await getMovieKeywords(tmdb_id, apiKey);
  enrichedData.keywords = keywords;
  
  return enrichedData;
}
