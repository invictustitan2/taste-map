/**
 * Exploration UI Module
 * Advanced filtering, taste clusters, and taste journey timeline
 */

import { FILM_ATTRIBUTES, MOVIE_MAP } from './filmAttributes.js';

// ============================================================================
// Module State
// ============================================================================

let activeFilters = new Set(); // Set of attribute IDs to filter by
let filterMode = 'AND'; // AND or OR logic
let dataStore = null;
let allMovies = [];
let filteredMovies = [];
let tasteClusters = [];
let onFilterChangeCallback = null;
let dimNonSelected = false;

// DOM References
const DOM = {
  filterContainer: null,
  filterCheckboxes: {},
  clusterDisplay: null,
  timelineContainer: null,
  timelineCanvas: null,
  dimToggle: null,
  filterStats: null,
};

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the exploration UI module
 * @param {UserDataStore} store - The data store instance
 * @param {Array} movies - Array of all movies
 * @param {Function} onFilterChange - Callback when filters change
 */
export function init(store, movies, onFilterChange) {
  console.log('[ExplorationUI] Initializing...');
  
  dataStore = store;
  allMovies = movies;
  filteredMovies = [...movies];
  onFilterChangeCallback = onFilterChange;
  
  cacheDOMReferences();
  renderFilterControls();
  setupEventListeners();
  updateClusters();
  renderTimeline();
  
  console.log('[ExplorationUI] Initialization complete');
}

/**
 * Cache DOM references
 */
function cacheDOMReferences() {
  DOM.filterContainer = document.getElementById('filter-controls');
  DOM.clusterDisplay = document.getElementById('cluster-display');
  DOM.timelineContainer = document.getElementById('timeline-container');
  DOM.timelineCanvas = document.getElementById('timeline-canvas');
  DOM.dimToggle = document.getElementById('dim-toggle');
  DOM.filterStats = document.getElementById('filter-stats');
}

// ============================================================================
// Filter Controls
// ============================================================================

/**
 * Render filter controls for all attributes
 */
function renderFilterControls() {
  if (!DOM.filterContainer) return;
  
  let html = '<div class="filter-header">';
  html += '<h3>Filter by Attributes</h3>';
  html += '<div class="filter-actions">';
  html += '<button id="clear-filters-btn" class="btn-small">Clear All</button>';
  html += '<label class="toggle-label">';
  html += '<input type="checkbox" id="dim-toggle" />';
  html += '<span>Dim unselected</span>';
  html += '</label>';
  html += '</div>';
  html += '</div>';
  
  // Group attributes by type
  const attributesByType = {
    genre: [],
    mood: [],
    influence: []
  };
  
  FILM_ATTRIBUTES.forEach(attr => {
    attributesByType[attr.type].push(attr);
  });
  
  // Render each group
  Object.keys(attributesByType).forEach(type => {
    if (attributesByType[type].length === 0) return;
    
    html += `<div class="filter-group">`;
    html += `<h4>${capitalizeFirst(type)}</h4>`;
    html += '<div class="filter-checkboxes">';
    
    attributesByType[type].forEach(attr => {
      html += `
        <label class="filter-checkbox" title="${attr.description}">
          <input 
            type="checkbox" 
            id="filter-${attr.id}" 
            data-attribute-id="${attr.id}"
            class="filter-input"
          />
          <span class="filter-label">${attr.name}</span>
        </label>
      `;
    });
    
    html += '</div></div>';
  });
  
  // Filter stats
  html += '<div id="filter-stats" class="filter-stats"></div>';
  
  DOM.filterContainer.innerHTML = html;
  
  // Cache checkbox references
  FILM_ATTRIBUTES.forEach(attr => {
    DOM.filterCheckboxes[attr.id] = document.getElementById(`filter-${attr.id}`);
  });
  
  updateFilterStats();
}

/**
 * Setup event listeners for filter controls
 */
function setupEventListeners() {
  // Individual filter checkboxes
  Object.values(DOM.filterCheckboxes).forEach(checkbox => {
    checkbox?.addEventListener('change', handleFilterChange);
  });
  
  // Clear filters button
  const clearBtn = document.getElementById('clear-filters-btn');
  clearBtn?.addEventListener('click', clearAllFilters);
  
  // Dim toggle
  DOM.dimToggle = document.getElementById('dim-toggle');
  DOM.dimToggle?.addEventListener('change', handleDimToggle);
  
  DOM.filterStats = document.getElementById('filter-stats');
}

/**
 * Handle filter checkbox change
 */
function handleFilterChange(event) {
  const attributeId = event.target.dataset.attributeId;
  
  if (event.target.checked) {
    activeFilters.add(attributeId);
  } else {
    activeFilters.delete(attributeId);
  }
  
  applyFilters();
}

/**
 * Clear all active filters
 */
function clearAllFilters() {
  activeFilters.clear();
  
  // Uncheck all checkboxes
  Object.values(DOM.filterCheckboxes).forEach(checkbox => {
    if (checkbox) checkbox.checked = false;
  });
  
  applyFilters();
}

/**
 * Handle dim toggle
 */
function handleDimToggle(event) {
  dimNonSelected = event.target.checked;
  
  if (onFilterChangeCallback) {
    onFilterChangeCallback({
      filters: Array.from(activeFilters),
      filteredMovies,
      dimNonSelected
    });
  }
}

/**
 * Apply active filters to movie list
 */
function applyFilters() {
  if (activeFilters.size === 0) {
    // No filters active - show all movies
    filteredMovies = [...allMovies];
  } else {
    // Apply AND logic - movies must match ALL selected attributes
    filteredMovies = allMovies.filter(movie => {
      return Array.from(activeFilters).every(attrId => {
        const score = movie.getAttributeScore(attrId);
        // Consider attribute "present" if score > 0.5
        return score > 0.5;
      });
    });
  }
  
  updateFilterStats();
  updateClusters();
  
  // Notify callback
  if (onFilterChangeCallback) {
    onFilterChangeCallback({
      filters: Array.from(activeFilters),
      filteredMovies,
      dimNonSelected
    });
  }
  
  console.log('[ExplorationUI] Filters applied:', {
    activeCount: activeFilters.size,
    resultCount: filteredMovies.length
  });
}

/**
 * Update filter statistics display
 */
function updateFilterStats() {
  if (!DOM.filterStats) return;
  
  if (activeFilters.size === 0) {
    DOM.filterStats.innerHTML = '<p class="filter-stat-text">No filters active</p>';
  } else {
    const total = allMovies.length;
    const filtered = filteredMovies.length;
    const percentage = ((filtered / total) * 100).toFixed(0);
    
    DOM.filterStats.innerHTML = `
      <p class="filter-stat-text">
        Showing <strong>${filtered}</strong> of ${total} movies (${percentage}%)
      </p>
    `;
  }
}

// ============================================================================
// Taste Clusters
// ============================================================================

/**
 * Calculate taste clusters based on current ratings
 */
function updateClusters() {
  if (!dataStore) return;
  
  const ratingsResult = dataStore.getRatings();
  const ratings = ratingsResult.data;
  
  if (ratings.length === 0) {
    tasteClusters = [];
    renderClusters();
    return;
  }
  
  // Define clusters based on dominant attributes
  // Using simple 2D quadrant approach with action and drama as primary axes
  const clusters = [
    { id: 'action-high', name: 'High Action', filter: m => m.getAttributeScore('action') > 0.6 },
    { id: 'drama-high', name: 'High Drama', filter: m => m.getAttributeScore('drama') > 0.6 },
    { id: 'comedy-high', name: 'High Comedy', filter: m => m.getAttributeScore('comedy') > 0.6 },
    { id: 'dark-high', name: 'Dark/Intense', filter: m => m.getAttributeScore('dark') > 0.6 },
    { id: 'cerebral', name: 'Cerebral/Complex', filter: m => m.getAttributeScore('cerebral') > 0.6 },
    { id: 'balanced', name: 'Balanced', filter: m => {
      const scores = FILM_ATTRIBUTES.map(a => m.getAttributeScore(a.id));
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / scores.length;
      return variance < 0.05; // Low variance = balanced
    }}
  ];
  
  // Categorize rated movies into clusters
  tasteClusters = clusters.map(cluster => {
    const moviesInCluster = ratings
      .map(r => MOVIE_MAP[r.movieId])
      .filter(m => m && cluster.filter(m));
    
    // Calculate average rating for this cluster
    const avgRating = moviesInCluster.length > 0
      ? ratings
          .filter(r => moviesInCluster.find(m => m.id === r.movieId))
          .reduce((sum, r) => sum + r.score, 0) / moviesInCluster.length
      : 0;
    
    return {
      ...cluster,
      movies: moviesInCluster,
      count: moviesInCluster.length,
      avgRating: avgRating.toFixed(1)
    };
  }).filter(c => c.count > 0); // Only show clusters with movies
  
  renderClusters();
}

/**
 * Render taste clusters display
 */
function renderClusters() {
  if (!DOM.clusterDisplay) return;
  
  if (tasteClusters.length === 0) {
    DOM.clusterDisplay.innerHTML = '<p class="empty-state">Rate movies to see your taste clusters</p>';
    return;
  }
  
  // Sort by count descending
  const sorted = [...tasteClusters].sort((a, b) => b.count - a.count);
  
  let html = '<div class="clusters-grid">';
  
  sorted.forEach(cluster => {
    const stars = '⭐'.repeat(Math.round(cluster.avgRating));
    
    html += `
      <div class="cluster-card">
        <div class="cluster-header">
          <h4>${cluster.name}</h4>
          <span class="cluster-badge">${cluster.count}</span>
        </div>
        <div class="cluster-stats">
          <p>${cluster.count} ${cluster.count === 1 ? 'movie' : 'movies'}</p>
          <p class="cluster-rating">${stars} ${cluster.avgRating} avg</p>
        </div>
        <div class="cluster-movies">
          ${cluster.movies.slice(0, 3).map(m => `<span class="cluster-movie">${m.title}</span>`).join('')}
          ${cluster.movies.length > 3 ? `<span class="cluster-more">+${cluster.movies.length - 3} more</span>` : ''}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  
  DOM.clusterDisplay.innerHTML = html;
}

// ============================================================================
// Taste Journey Timeline
// ============================================================================

/**
 * Render taste journey timeline
 */
function renderTimeline() {
  if (!DOM.timelineContainer) return;
  
  if (!dataStore) {
    DOM.timelineContainer.innerHTML = '<p class="empty-state">Timeline will appear after rating movies</p>';
    return;
  }
  
  const ratingsResult = dataStore.getRatings();
  const ratings = ratingsResult.data;
  
  if (ratings.length === 0) {
    DOM.timelineContainer.innerHTML = '<p class="empty-state">Rate movies to see your taste journey</p>';
    return;
  }
  
  // Sort by timestamp
  const sortedRatings = [...ratings].sort((a, b) => a.timestamp - b.timestamp);
  
  // Build timeline HTML
  let html = '<div class="timeline-header">';
  html += '<h3>Your Taste Journey</h3>';
  html += `<p class="timeline-subtitle">${ratings.length} movies rated</p>`;
  html += '</div>';
  
  html += '<div class="timeline-content">';
  
  // Group by month for better visualization
  const grouped = groupByMonth(sortedRatings);
  
  Object.keys(grouped).forEach((monthKey, index) => {
    const monthRatings = grouped[monthKey];
    const avgRating = (monthRatings.reduce((sum, r) => sum + r.score, 0) / monthRatings.length).toFixed(1);
    
    html += `
      <div class="timeline-period">
        <div class="timeline-marker"></div>
        <div class="timeline-period-content">
          <div class="timeline-period-header">
            <span class="timeline-date">${monthKey}</span>
            <span class="timeline-count">${monthRatings.length} ${monthRatings.length === 1 ? 'movie' : 'movies'}</span>
            <span class="timeline-avg">Avg: ${avgRating} ⭐</span>
          </div>
          <div class="timeline-movies">
            ${monthRatings.map(r => {
              const movie = MOVIE_MAP[r.movieId];
              if (!movie) return '';
              return `
                <div class="timeline-movie">
                  <span class="timeline-movie-title">${movie.title}</span>
                  <span class="timeline-movie-rating">${'⭐'.repeat(r.score)}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  
  // Add trend analysis
  html += renderTrendAnalysis(sortedRatings);
  
  DOM.timelineContainer.innerHTML = html;
}

/**
 * Group ratings by month
 */
function groupByMonth(ratings) {
  const grouped = {};
  
  ratings.forEach(rating => {
    const date = new Date(rating.timestamp);
    const key = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(rating);
  });
  
  return grouped;
}

/**
 * Render trend analysis
 */
function renderTrendAnalysis(sortedRatings) {
  if (sortedRatings.length < 3) {
    return '<div class="trend-analysis"><p>Rate more movies to see trends</p></div>';
  }
  
  // Split into first half and second half
  const midpoint = Math.floor(sortedRatings.length / 2);
  const firstHalf = sortedRatings.slice(0, midpoint);
  const secondHalf = sortedRatings.slice(midpoint);
  
  // Calculate average scores for each attribute in each period
  const firstProfile = calculatePeriodProfile(firstHalf);
  const secondProfile = calculatePeriodProfile(secondHalf);
  
  // Find attributes with biggest changes
  const changes = FILM_ATTRIBUTES.map(attr => {
    const change = secondProfile[attr.id] - firstProfile[attr.id];
    return {
      attribute: attr.name,
      change: change,
      direction: change > 0.1 ? 'increasing' : change < -0.1 ? 'decreasing' : 'stable'
    };
  }).filter(c => c.direction !== 'stable')
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  
  let html = '<div class="trend-analysis">';
  html += '<h4>Taste Evolution</h4>';
  
  if (changes.length === 0) {
    html += '<p>Your taste profile has remained consistent</p>';
  } else {
    html += '<div class="trend-changes">';
    changes.slice(0, 3).forEach(change => {
      const arrow = change.direction === 'increasing' ? '↗️' : '↘️';
      const changePercent = (Math.abs(change.change) * 100).toFixed(0);
      html += `
        <div class="trend-change">
          <span class="trend-arrow">${arrow}</span>
          <span class="trend-text">${change.attribute} ${change.direction} (${changePercent}%)</span>
        </div>
      `;
    });
    html += '</div>';
  }
  
  html += '</div>';
  
  return html;
}

/**
 * Calculate average profile for a period
 */
function calculatePeriodProfile(ratings) {
  const profile = {};
  
  FILM_ATTRIBUTES.forEach(attr => {
    let sum = 0;
    let weightSum = 0;
    
    ratings.forEach(rating => {
      const movie = MOVIE_MAP[rating.movieId];
      if (movie) {
        const weight = rating.score;
        sum += movie.getAttributeScore(attr.id) * weight;
        weightSum += weight;
      }
    });
    
    profile[attr.id] = weightSum > 0 ? sum / weightSum : 0;
  });
  
  return profile;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Update the exploration UI with new data
 */
export function update() {
  updateClusters();
  renderTimeline();
}

/**
 * Get currently active filters
 */
export function getActiveFilters() {
  return Array.from(activeFilters);
}

/**
 * Get filtered movies
 */
export function getFilteredMovies() {
  return filteredMovies;
}

/**
 * Get dim state
 */
export function getDimNonSelected() {
  return dimNonSelected;
}

/**
 * Set filters programmatically
 */
export function setFilters(filters) {
  activeFilters.clear();
  filters.forEach(f => activeFilters.add(f));
  
  // Update checkboxes
  Object.keys(DOM.filterCheckboxes).forEach(attrId => {
    const checkbox = DOM.filterCheckboxes[attrId];
    if (checkbox) {
      checkbox.checked = activeFilters.has(attrId);
    }
  });
  
  applyFilters();
}

// ============================================================================
// Utilities
// ============================================================================

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// Exports
// ============================================================================

export default {
  init,
  update,
  getActiveFilters,
  getFilteredMovies,
  getDimNonSelected,
  setFilters
};
