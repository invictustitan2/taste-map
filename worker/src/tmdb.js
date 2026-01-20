/**
 * TMDB API Client
 * Handles communication with The Movie Database (TMDB) API
 * Documentation: https://developers.themoviedb.org/3
 */

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const RATE_LIMIT_DELAY = 100; // ms between requests (TMDB allows 40 req/10sec)

/**
 * Delay helper for rate limiting
 * @param {number} ms - Milliseconds to wait
 */
function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Search for a movie on TMDB by title and year
 * @param {string} title - Movie title
 * @param {number} year - Release year
 * @param {string} apiKey - TMDB API key
 * @returns {Promise<Object|null>} Best match or null if not found
 */
export async function searchMovie(title, year, apiKey) {
	try {
		const url = `${TMDB_BASE_URL}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(title)}&year=${year}`;
		const response = await fetch(url);

		if (!response.ok) {
			console.error(`TMDB search failed: ${response.status}`);
			return null;
		}

		const data = await response.json();

		if (!data.results || data.results.length === 0) {
			return null;
		}

		// Return best match (first result is usually most relevant)
		const match = data.results[0];
		return {
			tmdb_id: match.id,
			title: match.title,
			year: match.release_date ? new Date(match.release_date).getFullYear() : null,
			poster_path: match.poster_path,
			overview: match.overview,
		};
	} catch (error) {
		console.error('TMDB search error:', error);
		return null;
	}
}

/**
 * Get detailed movie information from TMDB
 * @param {number} tmdbId - TMDB movie ID
 * @param {string} apiKey - TMDB API key
 * @returns {Promise<Object|null>} Movie details or null on error
 */
export async function getMovieDetails(tmdbId, apiKey) {
	try {
		const url = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${apiKey}`;
		const response = await fetch(url);

		if (!response.ok) {
			console.error(`TMDB details failed: ${response.status}`);
			return null;
		}

		const data = await response.json();

		return {
			genres: data.genres ? data.genres.map((g) => g.name) : [],
			runtime: data.runtime,
			vote_average: data.vote_average,
			vote_count: data.vote_count,
			backdrop_path: data.backdrop_path,
		};
	} catch (error) {
		console.error('TMDB details error:', error);
		return null;
	}
}

/**
 * Get movie cast and crew from TMDB
 * @param {number} tmdbId - TMDB movie ID
 * @param {string} apiKey - TMDB API key
 * @returns {Promise<Object|null>} Credits data with director and top 5 cast
 */
export async function getMovieCredits(tmdbId, apiKey) {
	try {
		const url = `${TMDB_BASE_URL}/movie/${tmdbId}/credits?api_key=${apiKey}`;
		const response = await fetch(url);

		if (!response.ok) {
			console.error(`TMDB credits failed: ${response.status}`);
			return null;
		}

		const data = await response.json();

		// Find director
		const director = data.crew?.find((person) => person.job === 'Director');

		// Get top 5 cast members
		const cast = data.cast ? data.cast.slice(0, 5).map((actor) => actor.name) : [];

		return {
			director: director?.name || null,
			cast,
		};
	} catch (error) {
		console.error('TMDB credits error:', error);
		return null;
	}
}

/**
 * Get plot keywords from TMDB
 * @param {number} tmdbId - TMDB movie ID
 * @param {string} apiKey - TMDB API key
 * @returns {Promise<Array<string>>} Array of keyword strings
 */
export async function getMovieKeywords(tmdbId, apiKey) {
	try {
		const url = `${TMDB_BASE_URL}/movie/${tmdbId}/keywords?api_key=${apiKey}`;
		const response = await fetch(url);

		if (!response.ok) {
			console.error(`TMDB keywords failed: ${response.status}`);
			return [];
		}

		const data = await response.json();
		return data.keywords ? data.keywords.map((k) => k.name) : [];
	} catch (error) {
		console.error('TMDB keywords error:', error);
		return [];
	}
}

/**
 * Orchestrates fetching all TMDB data for a movie
 * Combines search, details, credits, and keywords into one enriched object
 * @param {string} imdbId - IMDB ID (for logging)
 * @param {string} title - Movie title
 * @param {number} year - Release year
 * @param {string} apiKey - TMDB API key
 * @returns {Promise<Object>} Enriched movie data (partial data if some calls fail)
 */
export async function enrichMovieData(imdbId, title, year, apiKey) {
	const enriched = {
		tmdb_id: null,
		poster_path: null,
		backdrop_path: null,
		overview: null,
		genres: [],
		runtime: null,
		director: null,
		cast: [],
		plot_keywords: [],
		tmdb_rating: null,
		tmdb_vote_count: null,
	};

	try {
		// Step 1: Search for movie
		await delay(RATE_LIMIT_DELAY);
		const searchResult = await searchMovie(title, year, apiKey);

		if (!searchResult) {
			console.log(`No TMDB match for ${imdbId}: ${title} (${year})`);
			return enriched;
		}

		enriched.tmdb_id = searchResult.tmdb_id;
		enriched.poster_path = searchResult.poster_path;
		enriched.overview = searchResult.overview;

		// Step 2: Get detailed information
		await delay(RATE_LIMIT_DELAY);
		const details = await getMovieDetails(searchResult.tmdb_id, apiKey);
		if (details) {
			enriched.genres = details.genres;
			enriched.runtime = details.runtime;
			enriched.tmdb_rating = details.vote_average;
			enriched.tmdb_vote_count = details.vote_count;
			enriched.backdrop_path = details.backdrop_path;
		}

		// Step 3: Get credits (cast and crew)
		await delay(RATE_LIMIT_DELAY);
		const credits = await getMovieCredits(searchResult.tmdb_id, apiKey);
		if (credits) {
			enriched.director = credits.director;
			enriched.cast = credits.cast;
		}

		// Step 4: Get keywords
		await delay(RATE_LIMIT_DELAY);
		const keywords = await getMovieKeywords(searchResult.tmdb_id, apiKey);
		enriched.plot_keywords = keywords;

		return enriched;
	} catch (error) {
		console.error(`Error enriching ${imdbId}:`, error);
		return enriched; // Return partial data
	}
}
