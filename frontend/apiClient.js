/**
 * Taste Map API Client
 * Interfaces with the Cloudflare Worker API for movie data and recommendations
 */

const API_BASE = 'https://movies.aperion.cc';
const DEV_MODE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

/**
 * Log API requests in development mode
 * @param {string} method - HTTP method
 * @param {string} endpoint - API endpoint
 * @param {any} data - Request/response data
 */
function devLog(method, endpoint, data) {
	if (DEV_MODE) {
		console.log(`[API ${method}] ${endpoint}`, data);
	}
}

/**
 * Make an API request with error handling
 * @param {string} endpoint - API endpoint (relative to API_BASE)
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} With context on failure
 */
async function apiRequest(endpoint, options = {}) {
	const url = `${API_BASE}${endpoint}`;
	const defaultOptions = {
		headers: {
			'Content-Type': 'application/json',
		},
	};

	const finalOptions = {
		...defaultOptions,
		...options,
		headers: {
			...defaultOptions.headers,
			...options.headers,
		},
	};

	try {
		devLog(options.method || 'GET', endpoint, options.body || null);

		const response = await fetch(url, finalOptions);
		const data = await response.json();

		if (!response.ok) {
			throw new Error(data.error || `API request failed with status ${response.status}`);
		}

		devLog('RESPONSE', endpoint, data);
		return data;
	} catch (error) {
		console.error(`API Error [${endpoint}]:`, error);

		// Network error vs API error
		if (error.message.includes('fetch')) {
			throw new Error(`Network error: Unable to reach API at ${API_BASE}`);
		}

		throw error;
	}
}

/**
 * Taste Map API Client
 * Provides methods to interact with the movie recommendation API
 */
export const TasteMapAPI = {
	/**
	 * Health check - verify API is reachable
	 * @returns {Promise<Object>} Health status object
	 * @example
	 * const health = await TasteMapAPI.checkHealth();
	 * // Returns: { status: "ok", version: "1.0.0", timestamp: "..." }
	 */
	async checkHealth() {
		return apiRequest('/health');
	},

	/**
	 * Get paginated list of movies
	 * @param {number} page - Page number (1-indexed)
	 * @returns {Promise<Object>} Movies and pagination info
	 * @example
	 * const data = await TasteMapAPI.getMovies(1);
	 * // Returns: { movies: [...], pagination: { page, limit, total, totalPages } }
	 */
	async getMovies(page = 1) {
		if (page < 1) {
			throw new Error('Page number must be >= 1');
		}
		return apiRequest(`/api/movies?page=${page}`);
	},

	/**
	 * Get single movie by IMDB ID
	 * @param {string} imdbId - IMDB ID (format: tt1234567)
	 * @returns {Promise<Object>} Movie object
	 * @throws {Error} If movie not found (404)
	 * @example
	 * const movie = await TasteMapAPI.getMovie('tt0111161');
	 * // Returns: { id, imdb_id, title, year, ... }
	 */
	async getMovie(imdbId) {
		if (!imdbId || !imdbId.startsWith('tt')) {
			throw new Error('Invalid IMDB ID format. Expected: tt1234567');
		}
		return apiRequest(`/api/movies/${imdbId}`);
	},

	/**
	 * Import IMDB movie data with TMDB enrichment
	 * @param {Array<Object>} imdbData - Array of IMDB movie objects
	 * @param {string} importKey - Secret import key for authentication
	 * @returns {Promise<Object>} Import summary
	 * @example
	 * const summary = await TasteMapAPI.importMovies(jsonData, 'secret-key');
	 * // Returns: {
	 * //   total_processed: 250,
	 * //   successful: 245,
	 * //   failed: 5,
	 * //   enriched_with_tmdb: 240,
	 * //   processing_time_seconds: 120
	 * // }
	 */
	async importMovies(imdbData, importKey) {
		if (!Array.isArray(imdbData) || imdbData.length === 0) {
			throw new Error('imdbData must be a non-empty array');
		}

		if (!importKey) {
			throw new Error('Import key is required');
		}

		return apiRequest('/api/movies/import', {
			method: 'POST',
			headers: {
				'X-Import-Key': importKey,
			},
			body: JSON.stringify(imdbData),
		});
	},

	/**
	 * Get stored taste profile
	 * @returns {Promise<Object>} Taste profile object
	 * @throws {Error} If no profile exists (404)
	 * @example
	 * const profile = await TasteMapAPI.getTasteProfile();
	 * // Returns: {
	 * //   genres: { Drama: 0.85, "Sci-Fi": 0.72, ... },
	 * //   eras: { "1990s": 0.80, "2000s": 0.65, ... },
	 * //   themes: ["redemption", "anti-hero", ...],
	 * //   runtime_preference: "medium",
	 * //   directors: [{name, count, avg_rating}, ...],
	 * //   sample_size: 250,
	 * //   confidence: 0.95
	 * // }
	 */
	async getTasteProfile() {
		return apiRequest('/api/taste-profile');
	},

	/**
	 * Calculate and store taste profile using Workers AI
	 * Requires at least 20 rated movies in database
	 * @returns {Promise<Object>} Computed taste profile
	 * @throws {Error} If insufficient data (<20 movies)
	 * @example
	 * const profile = await TasteMapAPI.calculateTasteProfile();
	 * // Returns: same structure as getTasteProfile() plus:
	 * // { ai_powered: true, calculated_at: "2026-01-20T..." }
	 */
	async calculateTasteProfile() {
		return apiRequest('/api/taste-profile', {
			method: 'POST',
		});
	},

	/**
	 * Get AI-powered movie recommendations
	 * @param {Object} options - Filter options
	 * @param {string} options.mood - Optional mood filter (e.g., "uplifting", "dark", "thoughtful")
	 * @param {string} options.genre - Optional genre filter, comma-separated (e.g., "Drama,Thriller")
	 * @param {string} options.era - Optional era filter: "classic", "modern", or "recent"
	 * @param {number} options.count - Number of recommendations (1-50, default 10)
	 * @returns {Promise<Object>} Recommendations with reasoning
	 * @throws {Error} If no taste profile exists
	 * @example
	 * const recs = await TasteMapAPI.getRecommendations({
	 *   mood: 'uplifting',
	 *   genre: 'Drama,Comedy',
	 *   count: 5
	 * });
	 * // Returns: {
	 * //   recommendations: [{
	 * //     movie: { id, title, year, ... },
	 * //     match_score: 0.85,
	 * //     reasoning: "Recommended because..."
	 * //   }],
	 * //   profile_confidence: 0.95,
	 * //   cached: false,
	 * //   ai_powered: true
	 * // }
	 */
	async getRecommendations(options = {}) {
		const params = new URLSearchParams();

		if (options.mood) params.append('mood', options.mood);
		if (options.genre) params.append('genre', options.genre);
		if (options.era) params.append('era', options.era);
		if (options.count) params.append('count', String(options.count));

		const query = params.toString();
		const endpoint = query ? `/api/recommendations?${query}` : '/api/recommendations';

		return apiRequest(endpoint);
	},
};

/**
 * Type Definitions (for documentation)
 *
 * @typedef {Object} Movie
 * @property {number} id - Database ID
 * @property {string} imdb_id - IMDB identifier (tt1234567)
 * @property {number} tmdb_id - TMDB identifier
 * @property {string} title - Movie title
 * @property {number} year - Release year
 * @property {number} runtime_minutes - Runtime in minutes
 * @property {string} poster_path - TMDB poster path
 * @property {string} backdrop_path - TMDB backdrop path
 * @property {string} overview - Plot summary
 * @property {string} genres - JSON array of genres
 * @property {string} director - Director name
 * @property {string} cast - JSON array of cast members
 * @property {string} plot_keywords - JSON array of keywords
 * @property {number} user_rating - User's rating (1-10)
 * @property {string} watch_date - ISO date string
 * @property {number} tmdb_rating - TMDB average rating
 * @property {number} tmdb_vote_count - TMDB vote count
 *
 * @typedef {Object} TasteProfile
 * @property {Object<string, number>} genres - Genre preferences (0-1)
 * @property {Object<string, number>} eras - Era preferences by decade (0-1)
 * @property {string[]} themes - Identified themes
 * @property {string} runtime_preference - "short", "medium", or "long"
 * @property {Array<{name: string, count: number, avg_rating: number}>} directors - Top directors
 * @property {number} sample_size - Number of rated movies analyzed
 * @property {number} confidence - Confidence score (0-1)
 *
 * @typedef {Object} Recommendation
 * @property {Movie} movie - Recommended movie object
 * @property {number} match_score - Match score (0-1)
 * @property {string} reasoning - Explanation for recommendation
 *
 * @typedef {Object} RecommendationsResponse
 * @property {Recommendation[]} recommendations - Array of recommendations
 * @property {number} profile_confidence - Profile confidence score
 * @property {boolean} cached - Whether results are from cache
 * @property {boolean} ai_powered - Whether AI was used
 */
