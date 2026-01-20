/**
 * Film Attributes Module
 * Defines film attributes, movies, and ratings for the taste map system
 */

// ============================================================================
// Film Attribute Definition
// ============================================================================

/**
 * Represents a film attribute with categorization
 */
export class FilmAttribute {
  constructor(id, name, type, description) {
    this.id = id;
    this.name = name;
    this.type = type; // 'genre', 'mood', or 'influence'
    this.description = description;
    Object.freeze(this);
  }
}

/**
 * Fixed set of film attributes for the taste map
 * Type categories:
 * - genre: Broad content categories
 * - mood: Emotional tone descriptors
 * - influence: Creator/stylistic elements (0-1 scale)
 */
export const FILM_ATTRIBUTES = Object.freeze([
  new FilmAttribute(
    'action',
    'Action',
    'genre',
    'High-energy sequences, physical stunts, and intense pacing'
  ),
  new FilmAttribute(
    'drama',
    'Drama',
    'genre',
    'Character-driven narratives with emotional depth'
  ),
  new FilmAttribute(
    'comedy',
    'Comedy',
    'genre',
    'Humor-focused content designed to entertain and amuse'
  ),
  new FilmAttribute(
    'dark',
    'Dark',
    'mood',
    'Somber, serious tone with mature or heavy themes'
  ),
  new FilmAttribute(
    'uplifting',
    'Uplifting',
    'mood',
    'Positive, inspiring tone that leaves viewers feeling hopeful'
  ),
  new FilmAttribute(
    'artistic',
    'Artistic Vision',
    'influence',
    'Strong directorial style, unconventional cinematography, or auteur influence'
  ),
]);

/**
 * Map of attribute IDs for easy lookup
 */
export const ATTRIBUTE_MAP = Object.freeze(
  FILM_ATTRIBUTES.reduce((map, attr) => {
    map[attr.id] = attr;
    return map;
  }, {})
);

// ============================================================================
// Movie Class
// ============================================================================

/**
 * Represents a movie with attribute scores
 */
export class Movie {
  /**
   * @param {string} id - Unique identifier
   * @param {string} title - Movie title
   * @param {number} year - Release year
   * @param {Object.<string, number>} attributes - Map of attribute ID to score (0-1)
   */
  constructor(id, title, year, attributes = {}) {
    this.id = id;
    this.title = title;
    this.year = year;
    this.attributes = Object.freeze({ ...attributes });
    
    // Validate attribute scores are in [0, 1] range
    Object.entries(this.attributes).forEach(([attrId, score]) => {
      if (score < 0 || score > 1) {
        throw new Error(`Invalid score ${score} for attribute ${attrId} in movie ${title}`);
      }
      if (!ATTRIBUTE_MAP[attrId]) {
        throw new Error(`Unknown attribute ID: ${attrId} in movie ${title}`);
      }
    });
    
    Object.freeze(this);
  }

  /**
   * Get the score for a specific attribute
   * @param {string} attributeId - The attribute ID
   * @returns {number} Score between 0-1, or 0 if not set
   */
  getAttributeScore(attributeId) {
    return this.attributes[attributeId] || 0;
  }
}

// ============================================================================
// Rating Class
// ============================================================================

/**
 * Represents a user rating for a movie
 */
export class Rating {
  /**
   * @param {string} movieId - Movie identifier
   * @param {string} userId - User identifier
   * @param {number} score - Rating score (1-5)
   * @param {number} timestamp - Unix timestamp in milliseconds
   */
  constructor(movieId, userId, score, timestamp = Date.now()) {
    this.movieId = movieId;
    this.userId = userId;
    this.score = score;
    this.timestamp = timestamp;
    
    // Validate score is in [1, 5] range
    if (score < 1 || score > 5 || !Number.isInteger(score)) {
      throw new Error(`Invalid rating score ${score}. Must be integer between 1-5`);
    }
    
    Object.freeze(this);
  }
}

// ============================================================================
// Sample Movie Data
// ============================================================================

/**
 * Collection of sample movies with pre-filled attribute data
 */
export const SAMPLE_MOVIES = Object.freeze([
  new Movie('movie-1', 'Mad Max: Fury Road', 2015, {
    action: 0.95,
    drama: 0.4,
    comedy: 0.1,
    dark: 0.7,
    uplifting: 0.5,
    artistic: 0.85,
  }),
  
  new Movie('movie-2', 'The Shawshank Redemption', 1994, {
    action: 0.2,
    drama: 1.0,
    comedy: 0.15,
    dark: 0.6,
    uplifting: 0.9,
    artistic: 0.7,
  }),
  
  new Movie('movie-3', 'Superbad', 2007, {
    action: 0.3,
    drama: 0.4,
    comedy: 0.95,
    dark: 0.2,
    uplifting: 0.7,
    artistic: 0.3,
  }),
  
  new Movie('movie-4', 'Blade Runner 2049', 2017, {
    action: 0.6,
    drama: 0.8,
    comedy: 0.05,
    dark: 0.85,
    uplifting: 0.3,
    artistic: 0.95,
  }),
  
  new Movie('movie-5', 'The Grand Budapest Hotel', 2014, {
    action: 0.4,
    drama: 0.6,
    comedy: 0.7,
    dark: 0.3,
    uplifting: 0.6,
    artistic: 0.9,
  }),
  
  new Movie('movie-6', 'Die Hard', 1988, {
    action: 0.9,
    drama: 0.5,
    comedy: 0.4,
    dark: 0.4,
    uplifting: 0.6,
    artistic: 0.4,
  }),
  
  new Movie('movie-7', 'Schindler\'s List', 1993, {
    action: 0.3,
    drama: 1.0,
    comedy: 0.0,
    dark: 0.95,
    uplifting: 0.4,
    artistic: 0.85,
  }),
  
  new Movie('movie-8', 'Moonrise Kingdom', 2012, {
    action: 0.2,
    drama: 0.7,
    comedy: 0.6,
    dark: 0.2,
    uplifting: 0.8,
    artistic: 0.85,
  }),
  
  new Movie('movie-9', 'John Wick', 2014, {
    action: 0.95,
    drama: 0.5,
    comedy: 0.15,
    dark: 0.7,
    uplifting: 0.4,
    artistic: 0.75,
  }),
  
  new Movie('movie-10', 'Amélie', 2001, {
    action: 0.1,
    drama: 0.6,
    comedy: 0.7,
    dark: 0.2,
    uplifting: 0.95,
    artistic: 0.9,
  }),
]);

/**
 * Map of movie IDs for easy lookup
 */
export const MOVIE_MAP = Object.freeze(
  SAMPLE_MOVIES.reduce((map, movie) => {
    map[movie.id] = movie;
    return map;
  }, {})
);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validates that all required attributes are present in a movie
 * @param {Movie} movie - Movie to validate
 * @returns {boolean} True if valid
 */
export function validateMovieAttributes(movie) {
  const requiredAttributes = FILM_ATTRIBUTES.map(attr => attr.id);
  return requiredAttributes.every(attrId => 
    movie.attributes.hasOwnProperty(attrId)
  );
}

/**
 * Gets all attributes of a specific type
 * @param {string} type - Attribute type ('genre', 'mood', or 'influence')
 * @returns {FilmAttribute[]} Array of matching attributes
 */
export function getAttributesByType(type) {
  return FILM_ATTRIBUTES.filter(attr => attr.type === type);
}
