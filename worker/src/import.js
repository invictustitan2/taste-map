/**
 * IMDB Import Handler
 * Processes IMDB movie exports and enriches them with TMDB data
 */

import { enrichMovieData } from './tmdb.js';

/**
 * Process IMDB import data and enrich with TMDB information
 * @param {Array} imdbData - Array of IMDB movie objects
 * @param {Object} db - D1 database binding
 * @param {string} tmdbApiKey - TMDB API key
 * @returns {Promise<Object>} Import summary with success/failure counts
 */
export async function processImdbImport(imdbData, db, tmdbApiKey) {
	const summary = {
		total: imdbData.length,
		successful: 0,
		failed: 0,
		skipped: 0,
		errors: [],
	};

	console.log(`Starting import of ${summary.total} movies...`);

	for (let i = 0; i < imdbData.length; i++) {
		const movie = imdbData[i];

		try {
			// Validate required fields
			if (!movie.Const || !movie.Title || !movie.Year) {
				summary.failed++;
				summary.errors.push({
					index: i,
					imdb_id: movie.Const || 'unknown',
					error: 'Missing required fields (Const, Title, or Year)',
				});
				continue;
			}

			const imdbId = movie.Const;

			// Check if movie already exists
			const existing = await db.prepare('SELECT id FROM movies WHERE imdb_id = ?').bind(imdbId).first();

			if (existing) {
				console.log(`Skipping ${imdbId}: Already in database`);
				summary.skipped++;
				continue;
			}

			// Parse IMDB data
			const title = movie.Title;
			const year = parseInt(movie.Year);
			const userRating = movie['Your Rating'] ? parseInt(movie['Your Rating']) : null;
			const watchDate = movie['Date Rated'] || null;
			const runtimeMins = movie['Runtime (mins)'] ? parseInt(movie['Runtime (mins)']) : null;

			// Enrich with TMDB data
			console.log(`Enriching ${imdbId}: ${title} (${year})...`);
			const tmdbData = await enrichMovieData(imdbId, title, year, tmdbApiKey);

			// Prepare data for insertion
			const insertData = {
				imdb_id: imdbId,
				tmdb_id: tmdbData.tmdb_id,
				title: title,
				year: year,
				runtime_minutes: runtimeMins || tmdbData.runtime,
				poster_path: tmdbData.poster_path,
				backdrop_path: tmdbData.backdrop_path,
				overview: tmdbData.overview,
				genres: JSON.stringify(tmdbData.genres),
				director: tmdbData.director,
				cast: JSON.stringify(tmdbData.cast),
				plot_keywords: JSON.stringify(tmdbData.plot_keywords),
				user_rating: userRating,
				watch_date: watchDate,
				tmdb_rating: tmdbData.tmdb_rating,
				tmdb_vote_count: tmdbData.tmdb_vote_count,
			};

			// Insert into database
			await db
				.prepare(
					`INSERT INTO movies (
						imdb_id, tmdb_id, title, year, runtime_minutes,
						poster_path, backdrop_path, overview, genres,
						director, cast, plot_keywords,
						user_rating, watch_date, tmdb_rating, tmdb_vote_count
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					insertData.imdb_id,
					insertData.tmdb_id,
					insertData.title,
					insertData.year,
					insertData.runtime_minutes,
					insertData.poster_path,
					insertData.backdrop_path,
					insertData.overview,
					insertData.genres,
					insertData.director,
					insertData.cast,
					insertData.plot_keywords,
					insertData.user_rating,
					insertData.watch_date,
					insertData.tmdb_rating,
					insertData.tmdb_vote_count
				)
				.run();

			summary.successful++;

			// Progress logging every 10 movies
			if ((i + 1) % 10 === 0) {
				console.log(`Progress: ${i + 1}/${summary.total} movies processed`);
			}
		} catch (error) {
			console.error(`Error processing ${movie.Const}:`, error);
			summary.failed++;
			summary.errors.push({
				imdb_id: movie.Const,
				title: movie.Title,
				error: error.message,
			});
		}
	}

	console.log('Import complete:', summary);
	return summary;
}
