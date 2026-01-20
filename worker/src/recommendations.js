/**
 * AI-Powered Recommendations Engine
 * Generates personalized movie recommendations using Workers AI and taste profile
 */

const CACHE_EXPIRY_HOURS = 24;
const DEFAULT_COUNT = 10;
const MAX_COUNT = 50;

/**
 * Load taste profile from database
 * @param {Object} db - D1 database binding
 * @returns {Promise<Object|null>} Taste profile or null if not found
 */
async function loadTasteProfile(db) {
	const { results } = await db.prepare('SELECT * FROM taste_profile').all();

	if (!results || results.length === 0) {
		return null;
	}

	// Reconstruct profile from stored dimensions
	const profile = {
		genres: {},
		eras: {},
		themes: [],
		runtime_preference: 'medium',
		directors: [],
		sample_size: 0,
		confidence: 0,
	};

	results.forEach((row) => {
		if (row.dimension_name === 'genres' && row.metadata) {
			profile.genres = JSON.parse(row.metadata);
			profile.sample_size = row.sample_size;
		} else if (row.dimension_name === 'eras' && row.metadata) {
			profile.eras = JSON.parse(row.metadata);
		} else if (row.dimension_name === 'themes' && row.metadata) {
			profile.themes = JSON.parse(row.metadata);
		} else if (row.dimension_name === 'runtime_preference' && row.metadata) {
			const meta = JSON.parse(row.metadata);
			profile.runtime_preference = meta.preference;
			profile.confidence = row.dimension_value;
		} else if (row.dimension_name === 'directors' && row.metadata) {
			profile.directors = JSON.parse(row.metadata);
		}
	});

	return profile;
}

/**
 * Check if cached recommendations exist and are still valid
 * @param {Object} db - D1 database binding
 * @param {string} context - Context string (filters)
 * @returns {Promise<Object|null>} Cached recommendations or null
 */
async function getCachedRecommendations(db, context) {
	const result = await db
		.prepare(
			'SELECT * FROM recommendations WHERE context = ? AND expires_at > datetime("now") ORDER BY created_at DESC LIMIT 1'
		)
		.bind(context)
		.first();

	if (!result) return null;

	return {
		movie_ids: JSON.parse(result.recommended_movie_ids),
		reasoning: result.reasoning,
		confidence: result.confidence_score,
		cached: true,
		created_at: result.created_at,
	};
}

/**
 * Apply filters to candidate movies
 * @param {Array} movies - All unrated movies
 * @param {Object} options - Filter options
 * @returns {Array} Filtered movies
 */
function applyFilters(movies, options) {
	let filtered = [...movies];

	// Genre filter
	if (options.genre_filter && options.genre_filter.length > 0) {
		filtered = filtered.filter((movie) => {
			if (!movie.genres) return false;
			const genres = JSON.parse(movie.genres);
			return options.genre_filter.some((g) => genres.includes(g));
		});
	}

	// Era filter
	if (options.era_filter) {
		const currentYear = new Date().getFullYear();
		filtered = filtered.filter((movie) => {
			if (options.era_filter === 'classic') return movie.year < 1980;
			if (options.era_filter === 'modern') return movie.year >= 1980 && movie.year < 2010;
			if (options.era_filter === 'recent') return movie.year >= 2010;
			return true;
		});
	}

	return filtered;
}

/**
 * Calculate basic match score without AI (fallback)
 * @param {Object} movie - Movie to score
 * @param {Object} profile - Taste profile
 * @returns {number} Score (0-1)
 */
function calculateBasicMatchScore(movie, profile) {
	let score = 0;
	let factors = 0;

	// Genre matching
	if (movie.genres && Object.keys(profile.genres).length > 0) {
		const genres = JSON.parse(movie.genres);
		const genreScore = genres.reduce((sum, g) => sum + (profile.genres[g] || 0), 0) / genres.length;
		score += genreScore;
		factors++;
	}

	// Era matching
	if (movie.year && Object.keys(profile.eras).length > 0) {
		const decade = `${Math.floor(movie.year / 10) * 10}s`;
		const eraScore = profile.eras[decade] || 0;
		score += eraScore;
		factors++;
	}

	// Runtime matching
	if (movie.runtime_minutes && profile.runtime_preference) {
		let runtimeMatch = 0;
		if (profile.runtime_preference === 'short' && movie.runtime_minutes < 90) runtimeMatch = 1;
		else if (profile.runtime_preference === 'medium' && movie.runtime_minutes >= 90 && movie.runtime_minutes <= 150)
			runtimeMatch = 1;
		else if (profile.runtime_preference === 'long' && movie.runtime_minutes > 150) runtimeMatch = 1;
		else runtimeMatch = 0.3; // Partial match

		score += runtimeMatch;
		factors++;
	}

	return factors > 0 ? score / factors : 0.5;
}

/**
 * Use Workers AI to rank and explain recommendations
 * @param {Object} ai - Workers AI binding
 * @param {Array} candidates - Top candidates to rank
 * @param {Object} profile - Taste profile
 * @param {Object} options - Options including mood
 * @returns {Promise<Array>} Ranked candidates with reasoning
 */
async function rankWithAI(ai, candidates, profile, options) {
	try {
		// Prepare context for AI
		const topGenres = Object.keys(profile.genres)
			.sort((a, b) => profile.genres[b] - profile.genres[a])
			.slice(0, 3)
			.join(', ');

		const topEras = Object.keys(profile.eras)
			.sort((a, b) => profile.eras[b] - profile.eras[a])
			.slice(0, 2)
			.join(', ');

		const candidateSummaries = candidates
			.slice(0, 20)
			.map(
				(c, i) =>
					`${i + 1}. "${c.title}" (${c.year}) - Genres: ${c.genres ? JSON.parse(c.genres).join(', ') : 'N/A'}`
			)
			.join('\n');

		const moodContext = options.mood ? `\nMood preference: ${options.mood}` : '';

		const prompt = `You are a movie recommendation expert. User's taste profile:
- Favorite genres: ${topGenres}
- Favorite eras: ${topEras}
- Themes: ${profile.themes.join(', ')}
- Runtime preference: ${profile.runtime_preference}${moodContext}

Candidates:
${candidateSummaries}

Task: Rank top 5 movies by relevance. Return JSON array:
[{"rank": 1, "title": "Movie Title", "reasoning": "short explanation"}]

Response:`;

		const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
			messages: [{ role: 'user', content: prompt }],
			max_tokens: 500,
		});

		const aiText = response.response || '';
		const jsonMatch = aiText.match(/\[.*\]/s);

		if (jsonMatch) {
			const rankings = JSON.parse(jsonMatch[0]);
			return rankings.map((r) => {
				const movie = candidates.find((c) => c.title === r.title);
				return movie
					? {
							movie,
							reasoning: r.reasoning,
							ai_powered: true,
					  }
					: null;
			});
		}

		throw new Error('Failed to parse AI response');
	} catch (error) {
		console.error('AI ranking failed:', error);
		return null; // Signal to use fallback
	}
}

/**
 * Generate explanation for basic recommendations
 * @param {Object} movie - Movie being recommended
 * @param {Object} profile - Taste profile
 * @returns {string} Reasoning text
 */
function generateBasicReasoning(movie, profile) {
	const reasons = [];

	if (movie.genres) {
		const genres = JSON.parse(movie.genres);
		const topGenre = genres.find((g) => profile.genres[g] > 0.5);
		if (topGenre) reasons.push(`matches your love of ${topGenre}`);
	}

	if (movie.year) {
		const decade = `${Math.floor(movie.year / 10) * 10}s`;
		if (profile.eras[decade] > 0.5) reasons.push(`from your favorite era (${decade})`);
	}

	if (movie.director) {
		const favoriteDirector = profile.directors.find((d) => d.name === movie.director);
		if (favoriteDirector) reasons.push(`directed by ${movie.director} (you've loved ${favoriteDirector.count} films)`);
	}

	if (reasons.length === 0) {
		return 'Similar to movies in your collection';
	}

	return 'Recommended because it ' + reasons.join(' and ');
}

/**
 * Main function: Generate movie recommendations
 * @param {Object} db - D1 database binding
 * @param {Object} ai - Workers AI binding
 * @param {Object} options - Options for filtering and configuration
 * @returns {Promise<Object>} Recommendations with reasoning
 */
export async function generateRecommendations(db, ai, options = {}) {
	const count = Math.min(options.count || DEFAULT_COUNT, MAX_COUNT);

	// Load taste profile
	const profile = await loadTasteProfile(db);

	if (!profile) {
		return {
			error: 'No taste profile found. Please calculate taste profile first.',
			recommendations: [],
		};
	}

	// Build context string for caching
	const context = [
		options.mood || 'any',
		options.genre_filter?.join(',') || 'all',
		options.era_filter || 'all',
		count,
	].join('|');

	// Check cache
	const cached = await getCachedRecommendations(db, context);
	if (cached) {
		// Fetch movie details for cached IDs
		const moviePromises = cached.movie_ids.slice(0, count).map((id) =>
			db
				.prepare('SELECT * FROM movies WHERE id = ?')
				.bind(id)
				.first()
		);

		const movies = await Promise.all(moviePromises);

		return {
			recommendations: movies
				.filter((m) => m !== null)
				.map((movie, i) => ({
					movie,
					match_score: 1 - i * 0.05, // Decreasing scores
					reasoning: cached.reasoning,
				})),
			profile_confidence: profile.confidence,
			cached: true,
			created_at: cached.created_at,
		};
	}

	// Get all movies (unrated and rated)
	const { results: allMovies } = await db.prepare('SELECT * FROM movies').all();

	// Filter out already-rated movies
	const unrated = allMovies.filter((m) => !m.user_rating);

	// Apply optional filters
	const filtered = applyFilters(unrated, options);

	if (filtered.length === 0) {
		return {
			error: 'No movies match the specified filters',
			recommendations: [],
		};
	}

	// Calculate basic match scores for all candidates
	const scored = filtered.map((movie) => ({
		movie,
		score: calculateBasicMatchScore(movie, profile),
	}));

	// Sort by score
	scored.sort((a, b) => b.score - a.score);

	// Get top candidates for AI ranking
	const topCandidates = scored.slice(0, Math.min(50, scored.length)).map((s) => s.movie);

	// Try AI ranking
	const aiRanked = await rankWithAI(ai, topCandidates, profile, options);

	let recommendations;
	let reasoning;
	let ai_powered = false;

	if (aiRanked && aiRanked.length > 0) {
		// Use AI rankings
		recommendations = aiRanked.slice(0, count).map((r, i) => ({
			movie: r.movie,
			match_score: parseFloat((1 - i * 0.05).toFixed(2)),
			reasoning: r.reasoning,
		}));
		reasoning = 'AI-powered recommendations based on your taste profile';
		ai_powered = true;
	} else {
		// Fallback to basic scoring
		recommendations = scored.slice(0, count).map((s, i) => ({
			movie: s.movie,
			match_score: parseFloat(s.score.toFixed(2)),
			reasoning: generateBasicReasoning(s.movie, profile),
		}));
		reasoning = 'Recommendations based on genre and era preferences';
		ai_powered = false;
	}

	// Add diversity check - ensure not all from same genre
	const genreCounts = {};
	const diversified = [];
	const backup = [];

	recommendations.forEach((rec) => {
		if (!rec.movie.genres) {
			diversified.push(rec);
			return;
		}

		const genres = JSON.parse(rec.movie.genres);
		const primaryGenre = genres[0];

		if (!genreCounts[primaryGenre] || genreCounts[primaryGenre] < Math.ceil(count / 3)) {
			genreCounts[primaryGenre] = (genreCounts[primaryGenre] || 0) + 1;
			diversified.push(rec);
		} else {
			backup.push(rec);
		}
	});

	// Fill up to count if needed
	while (diversified.length < count && backup.length > 0) {
		diversified.push(backup.shift());
	}

	// Cache recommendations
	const movieIds = diversified.map((r) => r.movie.id);
	const expiresAt = new Date(Date.now() + CACHE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

	try {
		await db
			.prepare(
				'INSERT INTO recommendations (recommended_movie_ids, reasoning, context, confidence_score, expires_at) VALUES (?, ?, ?, ?, ?)'
			)
			.bind(JSON.stringify(movieIds), reasoning, context, profile.confidence, expiresAt)
			.run();
	} catch (error) {
		console.error('Failed to cache recommendations:', error);
	}

	return {
		recommendations: diversified,
		profile_confidence: profile.confidence,
		cached: false,
		ai_powered,
	};
}
