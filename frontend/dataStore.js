/**
 * Data Store Module
 * Manages user ratings and taste profiles with localStorage persistence
 */

import { Rating, MOVIE_MAP, FILM_ATTRIBUTES } from './filmAttributes.js';

// ============================================================================
// Configuration
// ============================================================================

const STORAGE_KEY = 'tastemap-user-data';
const DEBUG_MODE = true; // Set to false in production

/**
 * Debug logger
 */
function log(...args) {
  if (DEBUG_MODE) {
    console.log('[DataStore]', ...args);
  }
}

// ============================================================================
// UserDataStore Class
// ============================================================================

/**
 * Manages user ratings and calculates taste profiles with localStorage persistence
 */
export class UserDataStore {
  constructor(userId = 'default-user') {
    this.userId = userId;
    this.ratings = new Map(); // movieId -> Rating
    this.load();
    log('Initialized UserDataStore for user:', userId);
  }

  // ==========================================================================
  // Public Methods - Rating Management
  // ==========================================================================

  /**
   * Add or update a rating for a movie
   * @param {string} movieId - Movie identifier
   * @param {number} score - Rating score (1-5)
   * @returns {Object} { success: boolean, data?: Rating, error?: string }
   */
  addRating(movieId, score) {
    // Validate score
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      const error = `Invalid score: ${score}. Must be an integer between 1-5.`;
      log('ERROR:', error);
      return { success: false, error };
    }

    // Validate movieId exists
    if (!MOVIE_MAP[movieId]) {
      const error = `Invalid movieId: ${movieId}. Movie not found.`;
      log('ERROR:', error);
      return { success: false, error };
    }

    try {
      // Create new rating
      const rating = new Rating(movieId, this.userId, score);
      
      // Store in memory
      this.ratings.set(movieId, rating);
      
      // Persist to localStorage
      const saveResult = this.save();
      if (!saveResult.success) {
        return saveResult;
      }

      log('Added rating:', { movieId, score, userId: this.userId });
      return { success: true, data: rating };
    } catch (err) {
      const error = `Failed to add rating: ${err.message}`;
      log('ERROR:', error);
      return { success: false, error };
    }
  }

  /**
   * Get a specific rating by movie ID
   * @param {string} movieId - Movie identifier
   * @returns {Object} { success: boolean, data?: Rating, error?: string }
   */
  getRating(movieId) {
    const rating = this.ratings.get(movieId);
    if (!rating) {
      return { 
        success: false, 
        error: `No rating found for movie: ${movieId}` 
      };
    }
    return { success: true, data: rating };
  }

  /**
   * Get all user ratings
   * @returns {Object} { success: boolean, data: Rating[] }
   */
  getRatings() {
    const ratingsArray = Array.from(this.ratings.values());
    log('Retrieved ratings:', ratingsArray.length);
    return { success: true, data: ratingsArray };
  }

  /**
   * Delete a specific rating
   * @param {string} movieId - Movie identifier
   * @returns {Object} { success: boolean, error?: string }
   */
  deleteRating(movieId) {
    if (!this.ratings.has(movieId)) {
      const error = `No rating found for movie: ${movieId}`;
      log('ERROR:', error);
      return { success: false, error };
    }

    this.ratings.delete(movieId);
    const saveResult = this.save();
    if (!saveResult.success) {
      return saveResult;
    }

    log('Deleted rating for movie:', movieId);
    return { success: true };
  }

  /**
   * Clear all ratings (useful for testing)
   * @returns {Object} { success: boolean, error?: string }
   */
  clearAllRatings() {
    this.ratings.clear();
    const saveResult = this.save();
    if (!saveResult.success) {
      return saveResult;
    }

    log('Cleared all ratings');
    return { success: true };
  }

  // ==========================================================================
  // Public Methods - Taste Profile
  // ==========================================================================

  /**
   * Calculate user's taste profile based on their ratings
   * Returns weighted average of movie attributes based on ratings
   * Higher rated movies contribute more to the profile
   * @returns {Object} { success: boolean, data?: Object, error?: string }
   */
  getTasteProfile() {
    const ratingsArray = Array.from(this.ratings.values());

    if (ratingsArray.length === 0) {
      log('No ratings available for taste profile');
      return { 
        success: true, 
        data: this._getEmptyProfile() 
      };
    }

    try {
      // Initialize accumulators for each attribute
      const attributeSums = {};
      const attributeWeights = {};
      
      FILM_ATTRIBUTES.forEach(attr => {
        attributeSums[attr.id] = 0;
        attributeWeights[attr.id] = 0;
      });

      // Calculate weighted sums
      ratingsArray.forEach(rating => {
        const movie = MOVIE_MAP[rating.movieId];
        if (!movie) {
          log('WARNING: Movie not found:', rating.movieId);
          return;
        }

        // Normalize rating to 0-1 scale (1-5 → 0-1)
        // Use the actual rating as weight (higher ratings = more influence)
        const weight = rating.score;

        FILM_ATTRIBUTES.forEach(attr => {
          const attributeScore = movie.getAttributeScore(attr.id);
          attributeSums[attr.id] += attributeScore * weight;
          attributeWeights[attr.id] += weight;
        });
      });

      // Calculate weighted averages
      const profile = {};
      FILM_ATTRIBUTES.forEach(attr => {
        if (attributeWeights[attr.id] > 0) {
          profile[attr.id] = attributeSums[attr.id] / attributeWeights[attr.id];
        } else {
          profile[attr.id] = 0;
        }
      });

      log('Calculated taste profile:', profile);
      return { success: true, data: profile };
    } catch (err) {
      const error = `Failed to calculate taste profile: ${err.message}`;
      log('ERROR:', error);
      return { success: false, error };
    }
  }

  /**
   * Get taste profile with metadata
   * @returns {Object} Profile with additional statistics
   */
  getTasteProfileWithStats() {
    const profileResult = this.getTasteProfile();
    if (!profileResult.success) {
      return profileResult;
    }

    const ratingsArray = Array.from(this.ratings.values());
    const stats = {
      totalRatings: ratingsArray.length,
      averageRating: ratingsArray.length > 0
        ? ratingsArray.reduce((sum, r) => sum + r.score, 0) / ratingsArray.length
        : 0,
      ratingDistribution: this._getRatingDistribution(ratingsArray),
    };

    return {
      success: true,
      data: {
        profile: profileResult.data,
        stats,
      },
    };
  }

  // ==========================================================================
  // Private Methods - Persistence
  // ==========================================================================

  /**
   * Load ratings from localStorage
   * @private
   */
  load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        log('No stored data found');
        return;
      }

      const data = JSON.parse(stored);
      
      // Validate data structure
      if (!data.ratings || !Array.isArray(data.ratings)) {
        log('Invalid stored data structure');
        return;
      }

      // Filter ratings for this user and reconstruct Rating objects
      this.ratings.clear();
      data.ratings
        .filter(r => r.userId === this.userId)
        .forEach(r => {
          try {
            const rating = new Rating(r.movieId, r.userId, r.score, r.timestamp);
            this.ratings.set(r.movieId, rating);
          } catch (err) {
            log('WARNING: Skipping invalid rating:', r, err.message);
          }
        });

      log('Loaded ratings from localStorage:', this.ratings.size);
    } catch (err) {
      log('ERROR loading from localStorage:', err.message);
      // Don't fail initialization, just start with empty ratings
      this.ratings.clear();
    }
  }

  /**
   * Save ratings to localStorage
   * @private
   * @returns {Object} { success: boolean, error?: string }
   */
  save() {
    try {
      // Load existing data to preserve other users' ratings
      let allRatings = [];
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.ratings && Array.isArray(data.ratings)) {
          // Keep ratings from other users
          allRatings = data.ratings.filter(r => r.userId !== this.userId);
        }
      }

      // Add current user's ratings
      const currentUserRatings = Array.from(this.ratings.values()).map(r => ({
        movieId: r.movieId,
        userId: r.userId,
        score: r.score,
        timestamp: r.timestamp,
      }));

      allRatings.push(...currentUserRatings);

      // Save to localStorage
      const dataToSave = {
        version: 1,
        ratings: allRatings,
        lastUpdated: Date.now(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      log('Saved to localStorage');
      return { success: true };
    } catch (err) {
      const error = `Failed to save to localStorage: ${err.message}`;
      log('ERROR:', error);
      return { success: false, error };
    }
  }

  // ==========================================================================
  // Private Methods - Utilities
  // ==========================================================================

  /**
   * Get empty profile with all attributes set to 0
   * @private
   */
  _getEmptyProfile() {
    const profile = {};
    FILM_ATTRIBUTES.forEach(attr => {
      profile[attr.id] = 0;
    });
    return profile;
  }

  /**
   * Get distribution of ratings (1-5)
   * @private
   */
  _getRatingDistribution(ratingsArray) {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingsArray.forEach(rating => {
      distribution[rating.score]++;
    });
    return distribution;
  }

  // ==========================================================================
  // Public Methods - Utilities
  // ==========================================================================

  /**
   * Export all data (for backup/debugging)
   * @returns {Object} All user data
   */
  exportData() {
    const ratingsArray = Array.from(this.ratings.values());
    return {
      userId: this.userId,
      ratings: ratingsArray.map(r => ({
        movieId: r.movieId,
        score: r.score,
        timestamp: r.timestamp,
      })),
      exportedAt: Date.now(),
    };
  }

  /**
   * Get storage size information
   * @returns {Object} Storage statistics
   */
  getStorageInfo() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const sizeInBytes = stored ? new Blob([stored]).size : 0;
      const ratingsCount = this.ratings.size;

      return {
        success: true,
        data: {
          sizeInBytes,
          sizeInKB: (sizeInBytes / 1024).toFixed(2),
          ratingsCount,
          userId: this.userId,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to get storage info: ${err.message}`,
      };
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export default UserDataStore;
