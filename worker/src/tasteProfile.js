/**
 * Taste Profile Calculator
 * Analyzes user's rated movies to compute personalized taste dimensions using Workers AI
 */

const MIN_SAMPLE_SIZE = 20;

/**
 * Groups movies by rating tiers for analysis
 * @param {Array} movies - Array of movie objects with user_rating
 * @returns {Object} Movies grouped by rating tiers
 */
function groupMoviesByRating(movies) {
	return {
		loved: movies.filter((m) => m.user_rating >= 9),
		liked: movies.filter((m) => m.user_rating >= 7 && m.user_rating <= 8),
		neutral: movies.filter((m) => m.user_rating >= 5 && m.user_rating <= 6),
		disliked: movies.filter((m) => m.user_rating >= 1 && m.user_rating <= 4),
	};
}

/**
 * Extract genre preferences from rated movies
 * @param {Array} movies - Movies to analyze
 * @returns {Object} Genre scores (0-1)
 */
function extractGenrePreferences(grouped) {
	const genreScores = {};
	const genreCounts = {};

	// Count genres across all rated movies
	[...grouped.loved, ...grouped.liked, ...grouped.neutral, ...grouped.disliked].forEach((movie) => {
		if (!movie.genres) return;

		const genres = JSON.parse(movie.genres);
		const weight = movie.user_rating / 10; // Use rating as weight

		genres.forEach((genre) => {
			genreScores[genre] = (genreScores[genre] || 0) + weight;
			genreCounts[genre] = (genreCounts[genre] || 0) + 1;
		});
	});

	// Normalize scores to 0-1 range
	const maxScore = Math.max(...Object.values(genreScores), 1);
	const normalized = {};
	Object.keys(genreScores).forEach((genre) => {
		normalized[genre] = parseFloat((genreScores[genre] / maxScore).toFixed(2));
	});

	return normalized;
}

/**
 * Extract era preferences from rated movies
 * @param {Array} movies - Movies to analyze
 * @returns {Object} Era scores by decade (0-1)
 */
function extractEraPreferences(grouped) {
	const eraScores = {};
	const eraCounts = {};

	// Analyze by decade
	[...grouped.loved, ...grouped.liked, ...grouped.neutral, ...grouped.disliked].forEach((movie) => {
		if (!movie.year) return;

		const decade = `${Math.floor(movie.year / 10) * 10}s`;
		const weight = movie.user_rating / 10;

		eraScores[decade] = (eraScores[decade] || 0) + weight;
		eraCounts[decade] = (eraCounts[decade] || 0) + 1;
	});

	// Normalize scores to 0-1 range
	const maxScore = Math.max(...Object.values(eraScores), 1);
	const normalized = {};
	Object.keys(eraScores).forEach((era) => {
		normalized[era] = parseFloat((eraScores[era] / maxScore).toFixed(2));
	});

	return normalized;
}

/**
 * Determine runtime preference from rated movies
 * @param {Array} movies - Movies to analyze
 * @returns {string} "short" (<90), "medium" (90-150), "long" (>150)
 */
function extractRuntimePreference(grouped) {
	const runtimeScores = { short: 0, medium: 0, long: 0 };
	const runtimeCounts = { short: 0, medium: 0, long: 0 };

	// Analyze high-rated movies only
	[...grouped.loved, ...grouped.liked].forEach((movie) => {
		if (!movie.runtime_minutes) return;

		const runtime = movie.runtime_minutes;
		let category;

		if (runtime < 90) category = 'short';
		else if (runtime <= 150) category = 'medium';
		else category = 'long';

		runtimeScores[category] += movie.user_rating;
		runtimeCounts[category]++;
	});

	// Find category with highest average rating
	let bestCategory = 'medium';
	let bestAvg = 0;

	Object.keys(runtimeScores).forEach((category) => {
		if (runtimeCounts[category] === 0) return;
		const avg = runtimeScores[category] / runtimeCounts[category];
		if (avg > bestAvg) {
			bestAvg = avg;
			bestCategory = category;
		}
	});

	return bestCategory;
}

/**
 * Extract director affinity from loved movies
 * @param {Array} movies - Movies to analyze
 * @returns {Array} Top directors with their scores
 */
function extractDirectorAffinity(loved) {
	const directorScores = {};
	const directorCounts = {};

	loved.forEach((movie) => {
		if (!movie.director) return;

		const director = movie.director;
		directorScores[director] = (directorScores[director] || 0) + movie.user_rating;
		directorCounts[director] = (directorCounts[director] || 0) + 1;
	});

	// Get top 5 directors by count (familiarity)
	return Object.keys(directorCounts)
		.sort((a, b) => directorCounts[b] - directorCounts[a])
		.slice(0, 5)
		.map((director) => ({
			name: director,
			count: directorCounts[director],
			avg_rating: parseFloat((directorScores[director] / directorCounts[director]).toFixed(1)),
		}));
}

/**
 * Use Workers AI to extract themes from plot keywords and overviews
 * @param {Object} ai - Workers AI binding
 * @param {Array} loved - Loved movies
 * @param {Array} disliked - Disliked movies
 * @returns {Promise<Object>} Themes and differentiating factors
 */
async function extractThemesWithAI(ai, loved, disliked) {
	try {
		// Collect keywords from loved movies
		const lovedKeywords = loved
			.filter((m) => m.plot_keywords)
			.flatMap((m) => JSON.parse(m.plot_keywords))
			.slice(0, 50);

		// Collect keywords from disliked movies
		const dislikedKeywords = disliked
			.filter((m) => m.plot_keywords)
			.flatMap((m) => JSON.parse(m.plot_keywords))
			.slice(0, 30);

		// Sample overviews from loved movies
		const lovedOverviews = loved
			.filter((m) => m.overview)
			.slice(0, 10)
			.map((m) => m.overview)
			.join(' | ');

		const prompt = `Analyze movie viewing preferences:

LOVED MOVIES:
Keywords: ${lovedKeywords.join(', ')}
Sample plots: ${lovedOverviews}

DISLIKED MOVIES:
Keywords: ${dislikedKeywords.join(', ')}

Task: Identify 3-5 key themes that the user loves. Return ONLY a JSON array of theme strings.
Example: ["redemption", "anti-hero", "coming-of-age", "moral-ambiguity"]

Themes:`;

		const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
			messages: [{ role: 'user', content: prompt }],
			max_tokens: 100,
		});

		// Parse AI response
		const aiText = response.response || '';
		const jsonMatch = aiText.match(/\[.*\]/s);

		if (jsonMatch) {
			const themes = JSON.parse(jsonMatch[0]);
			return {
				themes: themes.slice(0, 5),
				ai_powered: true,
			};
		}

		// Fallback: extract most common keywords
		return {
			themes: lovedKeywords
				.filter((k, i, arr) => arr.indexOf(k) === i)
				.slice(0, 5),
			ai_powered: false,
		};
	} catch (error) {
		console.error('AI theme extraction failed:', error);
		// Fallback to keyword frequency
		const keywordCounts = {};
		loved
			.filter((m) => m.plot_keywords)
			.forEach((m) => {
				JSON.parse(m.plot_keywords).forEach((keyword) => {
					keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
				});
			});

		const topKeywords = Object.keys(keywordCounts)
			.sort((a, b) => keywordCounts[b] - keywordCounts[a])
			.slice(0, 5);

		return {
			themes: topKeywords,
			ai_powered: false,
			error: error.message,
		};
	}
}

/**
 * Calculate confidence score based on sample size
 * @param {number} sampleSize - Number of rated movies
 * @returns {number} Confidence score (0-1)
 */
function calculateConfidence(sampleSize) {
	if (sampleSize < MIN_SAMPLE_SIZE) return 0;
	if (sampleSize >= 100) return 1;

	// Linear interpolation between 20 and 100
	return parseFloat(((sampleSize - MIN_SAMPLE_SIZE) / (100 - MIN_SAMPLE_SIZE)).toFixed(2));
}

/**
 * Main function: Calculate and store taste profile
 * @param {Object} db - D1 database binding
 * @param {Object} ai - Workers AI binding
 * @returns {Promise<Object>} Computed taste profile
 */
export async function calculateTasteProfile(db, ai) {
	// Query all rated movies
	const { results: ratedMovies } = await db
		.prepare('SELECT * FROM movies WHERE user_rating IS NOT NULL ORDER BY user_rating DESC')
		.all();

	// Check minimum sample size
	if (ratedMovies.length < MIN_SAMPLE_SIZE) {
		return {
			error: `Insufficient data: need at least ${MIN_SAMPLE_SIZE} rated movies, found ${ratedMovies.length}`,
			sample_size: ratedMovies.length,
			required: MIN_SAMPLE_SIZE,
		};
	}

	// Group movies by rating tiers
	const grouped = groupMoviesByRating(ratedMovies);

	// Extract basic patterns
	const genres = extractGenrePreferences(grouped);
	const eras = extractEraPreferences(grouped);
	const runtimePreference = extractRuntimePreference(grouped);
	const directors = extractDirectorAffinity(grouped.loved);

	// Use AI to extract themes
	const { themes, ai_powered, error: aiError } = await extractThemesWithAI(ai, grouped.loved, grouped.disliked);

	// Calculate confidence
	const confidence = calculateConfidence(ratedMovies.length);

	// Build profile object
	const profile = {
		genres,
		eras,
		themes,
		runtime_preference: runtimePreference,
		directors,
		sample_size: ratedMovies.length,
		confidence,
		ai_powered,
		calculated_at: new Date().toISOString(),
	};

	if (aiError) {
		profile.ai_error = aiError;
	}

	// Store in database (clear old entries first)
	await db.prepare('DELETE FROM taste_profile').run();

	// Store each dimension
	await db
		.prepare('INSERT INTO taste_profile (dimension_name, dimension_value, sample_size, metadata) VALUES (?, ?, ?, ?)')
		.bind('genres', 0, ratedMovies.length, JSON.stringify(genres))
		.run();

	await db
		.prepare('INSERT INTO taste_profile (dimension_name, dimension_value, sample_size, metadata) VALUES (?, ?, ?, ?)')
		.bind('eras', 0, ratedMovies.length, JSON.stringify(eras))
		.run();

	await db
		.prepare('INSERT INTO taste_profile (dimension_name, dimension_value, sample_size, metadata) VALUES (?, ?, ?, ?)')
		.bind('themes', 0, ratedMovies.length, JSON.stringify(themes))
		.run();

	await db
		.prepare('INSERT INTO taste_profile (dimension_name, dimension_value, sample_size, metadata) VALUES (?, ?, ?, ?)')
		.bind('runtime_preference', confidence, ratedMovies.length, JSON.stringify({ preference: runtimePreference }))
		.run();

	await db
		.prepare('INSERT INTO taste_profile (dimension_name, dimension_value, sample_size, metadata) VALUES (?, ?, ?, ?)')
		.bind('directors', confidence, ratedMovies.length, JSON.stringify(directors))
		.run();

	return profile;
}
