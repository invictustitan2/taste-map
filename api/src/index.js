/**
 * Taste Map API Worker
 * Cloudflare Worker for movie recommendation system with D1 and AI integration
 * 
 * Routes:
 * - GET  /                        - API information and available endpoints
 * - GET  /health                  - Health check
 * - GET  /api/movies              - List all movies (paginated)
 * - GET  /api/movies/:imdbId      - Get single movie by IMDB ID
 * - POST /api/movies/import       - Import movies from IMDB JSON (with optional TMDB enrichment)
 * - POST /api/taste-profile       - Calculate taste profile using Workers AI
 * - GET  /api/taste-profile       - Retrieve stored taste profile
 * - GET  /api/recommendations     - Generate AI-powered recommendations
 */

import { processImdbImport } from './import.js';
import { generateRecommendations } from './recommendations.js';
import { calculateTasteProfile } from './tasteProfile.js';

// CORS headers for cross-origin requests
function corsHeaders() {
	return {
		'Access-Control-Allow-Origin': '*', // TODO: Restrict to specific domain in production
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Import-Key',
		'Content-Type': 'application/json',
	};
}

// Standardized error response
function errorResponse(message, status = 500, details = null) {
	return new Response(
		JSON.stringify({
			error: message,
			status,
			details,
			timestamp: new Date().toISOString(),
		}),
		{
			status,
			headers: corsHeaders(),
		}
	);
}

// Standardized success response
function successResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: corsHeaders(),
	});
}

export default {
	async fetch(request, env, ctx) {
		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: corsHeaders(),
			});
		}

		try {
			const url = new URL(request.url);
			const path = url.pathname;
			const method = request.method;

			// Root endpoint - API information
			if (path === '/' && method === 'GET') {
				return successResponse({
					name: 'Taste Map API',
					version: '1.0.0',
					description: 'Movie recommendation system with AI-powered taste profiling',
					endpoints: {
						health: 'GET /health',
						movies: {
							list: 'GET /api/movies?page=1',
							get: 'GET /api/movies/:imdbId',
							import: 'POST /api/movies/import',
						},
						tasteProfile: {
							calculate: 'POST /api/taste-profile',
							get: 'GET /api/taste-profile',
						},
						recommendations: 'GET /api/recommendations?count=10&mood=uplifting&genre=Drama&era=recent',
					},
					documentation: 'https://github.com/yourusername/taste-map',
				});
			}

			// Health check endpoint
			if (path === '/health' && method === 'GET') {
				return successResponse({
					status: 'ok',
					version: '1.0.0',
					timestamp: new Date().toISOString(),
				});
			}

			// List all movies (paginated)
			if (path === '/api/movies' && method === 'GET') {
				const page = parseInt(url.searchParams.get('page') || '1');
				const limit = 50;
				const offset = (page - 1) * limit;

				const movies = await env.DB.prepare(
					'SELECT * FROM movies ORDER BY user_rating DESC NULLS LAST, year DESC LIMIT ? OFFSET ?'
				)
					.bind(limit, offset)
					.all();

				// Get total count for pagination
				const { count } = await env.DB.prepare('SELECT COUNT(*) as count FROM movies').first();

				return successResponse({
					movies: movies.results,
					pagination: {
						page,
						limit,
						total: count,
						totalPages: Math.ceil(count / limit),
					},
				});
			}

			// Search movies
			if (path === '/api/movies/search' && method === 'GET') {
				const query = url.searchParams.get('q');
				if (!query) {
					return errorResponse('Query parameter "q" is required', 400);
				}

				const movies = await env.DB.prepare(
					'SELECT * FROM movies WHERE title LIKE ? OR year LIKE ? ORDER BY user_rating DESC LIMIT 20'
				)
					.bind(`%${query}%`, `%${query}%`)
					.all();

				return successResponse({
					movies: movies.results,
					count: movies.results.length
				});
			}

			// Get single movie by IMDB ID
			if (path.startsWith('/api/movies/') && method === 'GET') {
				const imdbId = path.split('/')[3];

				if (!imdbId || !imdbId.startsWith('tt')) {
					return errorResponse('Invalid IMDB ID format', 400);
				}

				const movie = await env.DB.prepare('SELECT * FROM movies WHERE imdb_id = ?').bind(imdbId).first();

				if (!movie) {
					return errorResponse('Movie not found', 404);
				}

				return successResponse(movie);
			}

			// Import movies from IMDB JSON with optional TMDB enrichment
			if (path === '/api/movies/import' && method === 'POST') {
				// Authenticate import request
				const importKey = request.headers.get('X-Import-Key');
				if (!importKey || importKey !== env.IMPORT_SECRET) {
					return errorResponse('Unauthorized: Invalid or missing import key', 401);
				}

				// Check for TMDB API key (optional but recommended)
				if (!env.TMDB_API_KEY) {
					console.warn('TMDB_API_KEY not set - importing without enrichment');
				}

				// Parse request body
				let imdbData;
				try {
					imdbData = await request.json();
				} catch (e) {
					return errorResponse('Invalid JSON in request body', 400);
				}

				if (!Array.isArray(imdbData)) {
					return errorResponse('Request body must be an array of IMDB movie objects', 400);
				}

				// Process import (this may take a while for large imports)
				// processImdbImport handles null/undefined TMDB key gracefully
				const summary = await processImdbImport(imdbData, env.DB, env.TMDB_API_KEY);

				return successResponse(summary, 201);
			}

			// POST /api/taste-profile - Calculate and store user's taste profile using Workers AI
			if (path === '/api/taste-profile' && method === 'POST') {
				try {
					const profile = await calculateTasteProfile(env.DB, env.AI);

					// Handle insufficient data error
					if (profile.error) {
						return errorResponse(profile.error, 400, {
							sample_size: profile.sample_size,
							required: profile.required,
						});
					}

					return successResponse(profile, 200);
				} catch (error) {
					console.error('Taste profile calculation error:', error);
					return errorResponse('Failed to calculate taste profile', 500, error.message);
				}
			}

			// GET /api/taste-profile - Retrieve stored taste profile
			if (path === '/api/taste-profile' && method === 'GET') {
				try {
					const { results } = await env.DB.prepare('SELECT * FROM taste_profile').all();

					// Check if profile exists
					if (!results || results.length === 0) {
						return errorResponse('No taste profile found. Calculate one first with POST /api/taste-profile', 404);
					}

					// Reconstruct profile from database dimensions
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
						if (row.dimension_name === 'genre' && row.metadata) {
							profile.genres[row.dimension_value] = JSON.parse(row.metadata).score;
							profile.sample_size = row.sample_size;
						} else if (row.dimension_name === 'era' && row.metadata) {
							profile.eras[row.dimension_value] = JSON.parse(row.metadata).score;
						} else if (row.dimension_name === 'theme') {
							profile.themes.push(row.dimension_value);
						} else if (row.dimension_name === 'runtime_preference' && row.metadata) {
							const meta = JSON.parse(row.metadata);
							profile.runtime_preference = row.dimension_value;
							profile.confidence = meta.confidence;
						} else if (row.dimension_name === 'director') {
							profile.directors.push(row.dimension_value);
						}
					});

					return successResponse(profile, 200);
				} catch (error) {
					console.error('Error retrieving taste profile:', error);
					return errorResponse('Failed to retrieve taste profile', 500, error.message);
				}
			}

			// GET /api/recommendations - Generate AI-powered movie recommendations
			if (path === '/api/recommendations' && method === 'GET') {
				try {
					// Parse and validate query parameters
					const mood = url.searchParams.get('mood');
					const genreFilter = url.searchParams.get('genre');
					const eraFilter = url.searchParams.get('era');
					const count = parseInt(url.searchParams.get('count') || '10');

					// Validate count parameter
					if (isNaN(count) || count < 1 || count > 50) {
						return errorResponse('Count must be between 1 and 50', 400);
					}

					// Build options object for recommendation engine
					const options = { count };

					if (mood) options.mood = mood;
					if (genreFilter) options.genre_filter = genreFilter.split(',').map((g) => g.trim());
					if (eraFilter) {
						if (!['classic', 'modern', 'recent'].includes(eraFilter)) {
							return errorResponse('Era filter must be one of: classic, modern, recent', 400);
						}
						options.era_filter = eraFilter;
					}

					// Generate recommendations using AI
					const result = await generateRecommendations(env.DB, env.AI, options);

					// Handle errors from recommendation engine
					if (result.error) {
						return errorResponse(result.error, 400);
					}

					return successResponse(result, 200);
				} catch (error) {
					console.error('Recommendations error:', error);
					return errorResponse('Failed to generate recommendations', 500, error.message);
				}
			}

			// Route not found
			return errorResponse('Route not found', 404);
		} catch (error) {
			// Global error handler
			console.error('Worker error:', error.message);
			console.error('Stack:', error.stack);
			return errorResponse('Internal server error', 500, error.message);
		}
	},
};
