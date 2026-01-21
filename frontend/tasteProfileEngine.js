/**
 * Taste Profile Engine
 * Pure functions for calculating user taste profiles and finding similar movies
 * 
 * Algorithm: Cosine Similarity
 * - Measures similarity based on angle between attribute vectors
 * - Range: 0 (completely different) to 1 (identical)
 * - Better than euclidean distance for preference matching as it focuses on
 *   the direction/pattern of preferences rather than magnitude
 */

import { FILM_ATTRIBUTES } from './filmAttributes.js';

// ============================================================================
// Taste Profile Calculation
// ============================================================================

/**
 * Calculate normalized taste profile from user ratings
 * 
 * Algorithm:
 * 1. For each attribute, calculate weighted sum of movie attributes
 * 2. Weight is the rating score (1-5), normalized to emphasize higher ratings
 * 3. Divide by total weight to get weighted average
 * 4. Result is already in 0-1 range since movie attributes are 0-1
 * 
 * @param {Array} ratings - Array of rating objects {movieId, score, ...}
 * @param {Object} movieMap - Map of movieId to Movie objects
 * @returns {Object} Normalized taste profile {attributeId: 0-1, ...}
 * 
 * @example
 * const ratings = [
 *   { movieId: 'movie-1', score: 5 },  // Action movie
 *   { movieId: 'movie-2', score: 4 },  // Drama
 * ];
 * const profile = calculateTasteProfile(ratings, MOVIE_MAP);
 * // Returns: { action: 0.65, drama: 0.75, comedy: 0.1, ... }
 */
export function calculateTasteProfile(ratings, movieMap) {
  // Edge case: No ratings → return neutral profile
  if (!ratings || ratings.length === 0) {
    return getNeutralProfile();
  }

  // Initialize accumulators
  const attributeSums = {};
  const attributeWeights = {};
  
  FILM_ATTRIBUTES.forEach(attr => {
    attributeSums[attr.id] = 0;
    attributeWeights[attr.id] = 0;
  });

  // Calculate weighted sums
  // Weight = rating score (1-5), which gives higher rated movies more influence
  ratings.forEach(rating => {
    const movie = movieMap[rating.movieId];
    
    // Skip invalid movie references
    if (!movie) {
      console.warn(`Movie not found: ${rating.movieId}`);
      return;
    }

    // Use rating score as weight (1-5)
    const weight = rating.score;

    FILM_ATTRIBUTES.forEach(attr => {
      const attributeScore = movie.getAttributeScore(attr.id);
      attributeSums[attr.id] += attributeScore * weight;
      attributeWeights[attr.id] += weight;
    });
  });

  // Calculate weighted averages (already normalized to 0-1)
  const profile = {};
  FILM_ATTRIBUTES.forEach(attr => {
    if (attributeWeights[attr.id] > 0) {
      profile[attr.id] = attributeSums[attr.id] / attributeWeights[attr.id];
    } else {
      profile[attr.id] = 0.5; // Neutral if no data
    }
  });

  return profile;
}

/**
 * Get a neutral profile (all attributes = 0.5)
 * Used when no ratings exist
 * 
 * @returns {Object} Neutral profile
 */
export function getNeutralProfile() {
  const profile = {};
  FILM_ATTRIBUTES.forEach(attr => {
    profile[attr.id] = 0.5;
  });
  return profile;
}

// ============================================================================
// Movie Similarity Calculation
// ============================================================================

/**
 * Calculate cosine similarity between two attribute vectors
 * 
 * Formula: cos(θ) = (A · B) / (||A|| × ||B||)
 * Where:
 * - A · B is the dot product of vectors A and B
 * - ||A|| is the magnitude (length) of vector A
 * - Result ranges from 0 (orthogonal/different) to 1 (identical)
 * 
 * @param {Object} profileA - First attribute profile {attributeId: score, ...}
 * @param {Object} profileB - Second attribute profile
 * @returns {number} Similarity score between 0 and 1
 * 
 * @example
 * const userProfile = { action: 0.8, drama: 0.6, comedy: 0.2 };
 * const movieAttributes = { action: 0.9, drama: 0.5, comedy: 0.1 };
 * const similarity = calculateCosineSimilarity(userProfile, movieAttributes);
 * // Returns: ~0.98 (very similar)
 */
export function calculateCosineSimilarity(profileA, profileB) {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  FILM_ATTRIBUTES.forEach(attr => {
    const a = profileA[attr.id] || 0;
    const b = profileB[attr.id] || 0;
    
    dotProduct += a * b;
    magnitudeA += a * a;
    magnitudeB += b * b;
  });

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  // Avoid division by zero
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Find movies most similar to user's taste profile
 * 
 * @param {Object} userProfile - User's taste profile {attributeId: 0-1, ...}
 * @param {Array} allMovies - Array of all Movie objects
 * @param {number} topN - Number of top matches to return (default: 5)
 * @param {Array} excludeMovieIds - Movie IDs to exclude (e.g., already rated)
 * @returns {Array} Top N similar movies with scores: [{movie, similarity}, ...]
 * 
 * @example
 * const userProfile = { action: 0.8, drama: 0.6, comedy: 0.2, dark: 0.7, uplifting: 0.3, artistic: 0.6 };
 * const recommendations = findSimilarMovies(userProfile, SAMPLE_MOVIES, 3);
 * // Returns: [
 * //   { movie: Movie{...}, similarity: 0.95 },
 * //   { movie: Movie{...}, similarity: 0.89 },
 * //   { movie: Movie{...}, similarity: 0.82 }
 * // ]
 */
export function findSimilarMovies(userProfile, allMovies, topN = 5, excludeMovieIds = []) {
  // Edge case: No movies available
  if (!allMovies || allMovies.length === 0) {
    return [];
  }

  // Edge case: Neutral profile (no preferences yet)
  // Return movies sorted by average attribute strength (diverse, interesting films)
  const isNeutralProfile = isProfileNeutral(userProfile);
  
  // Calculate similarity for each movie
  const moviesWithSimilarity = allMovies
    .filter(movie => !excludeMovieIds.includes(movie.id))
    .map(movie => {
      let similarity;
      
      if (isNeutralProfile) {
        // For neutral profiles, score by attribute diversity/strength
        // This gives users interesting, well-defined movies to start rating
        similarity = calculateAttributeStrength(movie.attributes);
      } else {
        // Normal case: use cosine similarity
        similarity = calculateCosineSimilarity(userProfile, movie.attributes);
      }
      
      return { movie, similarity };
    });

  // Sort by similarity (descending) and return top N
  moviesWithSimilarity.sort((a, b) => b.similarity - a.similarity);
  
  return moviesWithSimilarity.slice(0, topN);
}

/**
 * Check if a profile is neutral (all values around 0.5)
 * @param {Object} profile - Taste profile
 * @returns {boolean} True if profile is neutral
 */
function isProfileNeutral(profile) {
  const values = FILM_ATTRIBUTES.map(attr => profile[attr.id] || 0.5);
  const average = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length;
  
  // If all values are close to 0.5 with low variance, it's neutral
  return Math.abs(average - 0.5) < 0.1 && variance < 0.01;
}

/**
 * Calculate attribute strength (how defined/strong a movie's attributes are)
 * Used for neutral profiles to recommend diverse, interesting movies
 * @param {Object} attributes - Movie attributes
 * @returns {number} Strength score
 */
function calculateAttributeStrength(attributes) {
  // Calculate average distance from neutral (0.5)
  // Movies with strong, defined attributes (close to 0 or 1) score higher
  const values = FILM_ATTRIBUTES.map(attr => attributes[attr.id] || 0);
  const deviations = values.map(val => Math.abs(val - 0.5));
  const averageDeviation = deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;
  
  // Normalize to 0-1 range (max deviation is 0.5)
  return averageDeviation / 0.5;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate profile difference (for debugging/analysis)
 * Returns absolute differences for each attribute
 * 
 * @param {Object} profileA - First profile
 * @param {Object} profileB - Second profile
 * @returns {Object} Differences for each attribute
 */
export function calculateProfileDifference(profileA, profileB) {
  const differences = {};
  
  FILM_ATTRIBUTES.forEach(attr => {
    const a = profileA[attr.id] || 0;
    const b = profileB[attr.id] || 0;
    differences[attr.id] = Math.abs(a - b);
  });
  
  return differences;
}

/**
 * Get the dominant attributes from a profile
 * Returns attributes sorted by strength (descending)
 * 
 * @param {Object} profile - Taste profile
 * @param {number} topN - Number of top attributes to return
 * @returns {Array} [{attributeId, score, name}, ...]
 * 
 * @example
 * const profile = { action: 0.9, drama: 0.7, comedy: 0.1, dark: 0.8, uplifting: 0.2, artistic: 0.5 };
 * const dominant = getDominantAttributes(profile, 3);
 * // Returns: [
 * //   { attributeId: 'action', score: 0.9, name: 'Action' },
 * //   { attributeId: 'dark', score: 0.8, name: 'Dark' },
 * //   { attributeId: 'drama', score: 0.7, name: 'Drama' }
 * // ]
 */
export function getDominantAttributes(profile, topN = 3) {
  const attributeMap = FILM_ATTRIBUTES.reduce((map, attr) => {
    map[attr.id] = attr;
    return map;
  }, {});

  const attributes = Object.entries(profile)
    .map(([id, score]) => ({
      attributeId: id,
      score,
      name: attributeMap[id]?.name || id,
    }))
    .sort((a, b) => b.score - a.score);

  return attributes.slice(0, topN);
}

// ============================================================================
// Test Examples (for reference/documentation)
// ============================================================================

/**
 * UNIT TEST EXAMPLES (to be run in a test environment)
 * 
 * // Test 1: Empty ratings → neutral profile
 * const profile1 = calculateTasteProfile([], MOVIE_MAP);
 * console.assert(profile1.action === 0.5, 'Empty ratings should return neutral profile');
 * 
 * // Test 2: Single rating (5 stars) → movie's attributes
 * const ratings2 = [{ movieId: 'movie-1', score: 5 }];  // Mad Max (action: 0.95)
 * const profile2 = calculateTasteProfile(ratings2, MOVIE_MAP);
 * console.assert(profile2.action === 0.95, 'Single high rating should match movie attributes');
 * 
 * // Test 3: Multiple ratings → weighted average
 * const ratings3 = [
 *   { movieId: 'movie-1', score: 5 },  // Mad Max (action: 0.95)
 *   { movieId: 'movie-3', score: 5 },  // Superbad (comedy: 0.95)
 * ];
 * const profile3 = calculateTasteProfile(ratings3, MOVIE_MAP);
 * console.assert(profile3.action > 0.4, 'Should have high action from Mad Max');
 * console.assert(profile3.comedy > 0.4, 'Should have high comedy from Superbad');
 * 
 * // Test 4: Cosine similarity - identical vectors
 * const vectorA = { action: 0.8, drama: 0.6, comedy: 0.2 };
 * const similarity1 = calculateCosineSimilarity(vectorA, vectorA);
 * console.assert(Math.abs(similarity1 - 1.0) < 0.001, 'Identical vectors should have similarity 1.0');
 * 
 * // Test 5: Cosine similarity - orthogonal vectors
 * const vectorB = { action: 1.0, drama: 0, comedy: 0 };
 * const vectorC = { action: 0, drama: 1.0, comedy: 0 };
 * const similarity2 = calculateCosineSimilarity(vectorB, vectorC);
 * console.assert(similarity2 < 0.1, 'Orthogonal vectors should have low similarity');
 * 
 * // Test 6: Find similar movies
 * const actionProfile = { action: 0.9, drama: 0.3, comedy: 0.1, dark: 0.6, uplifting: 0.3, artistic: 0.5 };
 * const similar = findSimilarMovies(actionProfile, SAMPLE_MOVIES, 3);
 * console.assert(similar.length === 3, 'Should return 3 movies');
 * console.assert(similar[0].similarity >= similar[1].similarity, 'Should be sorted by similarity');
 * 
 * // Test 7: Exclude movies
 * const similar2 = findSimilarMovies(actionProfile, SAMPLE_MOVIES, 5, ['movie-1']);
 * console.assert(!similar2.find(m => m.movie.id === 'movie-1'), 'Should exclude specified movie');
 * 
 * // Test 8: Neutral profile handling
 * const neutralProfile = getNeutralProfile();
 * const similar3 = findSimilarMovies(neutralProfile, SAMPLE_MOVIES, 5);
 * console.assert(similar3.length > 0, 'Should recommend movies even with neutral profile');
 */

// ============================================================================
// Exports
// ============================================================================

export default {
  calculateTasteProfile,
  getNeutralProfile,
  calculateCosineSimilarity,
  findSimilarMovies,
  calculateProfileDifference,
  getDominantAttributes,
};
