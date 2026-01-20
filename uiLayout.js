/**
 * UI Layout Module
 * Manages DOM elements, event listeners, and UI state
 * Connects user interactions to data store and taste profile engine
 */

import { SAMPLE_MOVIES, MOVIE_MAP, FILM_ATTRIBUTES } from './filmAttributes.js';
import { UserDataStore } from './dataStore.js';
import { calculateTasteProfile, findSimilarMovies, getDominantAttributes } from './tasteProfileEngine.js';
import { RadarChart } from './canvasRenderer.js';
import * as ExplorationUI from './explorationUI.js';

// ============================================================================
// Module State
// ============================================================================

let dataStore = null;
let radarChart = null;
let currentProfile = {};
let selectedAttributeId = null;
let selectedMovieId = null;
let allMovies = [];
let filteredMovies = [];
let searchDropdownVisible = false;
let selectedDropdownIndex = -1;
let searchDebounceTimer = null;
let hasUnsavedChanges = false;
let localStorageAvailable = true;
let explorationFilters = {
  active: [],
  filteredMovies: [],
  dimNonSelected: false
};

// ============================================================================
// DOM References (cached for performance)
// ============================================================================

const DOM = {
  // Movie selection
  movieSearch: null,
  movieSelect: null,
  searchDropdown: null,
  selectedMovieInfo: null,
  selectedMovieTitle: null,
  selectedMovieYear: null,
  selectedMovieThumbnail: null,
  selectedMovieAttributes: null,
  
  // Rating buttons
  starButtons: null,
  
  // Profile display
  radarChartCanvas: null,
  chartLegend: null,
  attributeContributors: null,
  profileDisplay: null,
  profileStats: null,
  
  // Recommendations
  loadingRecommendations: null,
  recommendationsDisplay: null,
  
  // Actions
  clearRatingsBtn: null,
  exportDataBtn: null,
  importDataBtn: null,
  importFileInput: null,
  
  // Data indicators
  ratingsCounter: null,
  lastUpdate: null,
  
  // Debug
  debugOutput: null,
};

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the UI and wire up all components
 */
function init() {
  console.log('[UI] Initializing...');
  
  // Check localStorage availability
  checkLocalStorageAvailability();
  
  // Cache DOM references
  cacheDOMReferences();
  
  // Initialize data store (auto-loads from localStorage)
  try {
    dataStore = new UserDataStore();
  } catch (error) {
    console.error('[UI] Error initializing data store:', error);
    handleStorageError(error);
  }
  
  // Initialize radar chart
  initializeRadarChart();
  
  // Initialize movie list
  allMovies = [...SAMPLE_MOVIES];
  
  // Setup event listeners
  setupEventListeners();
  
  // Initial render
  renderMovieList(allMovies);
  updateTasteProfileDisplay();
  updateRecommendationsDisplay();
  updateDataIndicators();
  
  // Initialize exploration UI
  ExplorationUI.init(dataStore, allMovies, handleExplorationFilterChange);
  
  console.log('[UI] Initialization complete');
}

/**
 * Cache all DOM element references and create search dropdown
 */
function cacheDOMReferences() {
  DOM.movieSearch = document.getElementById('movie-search');
  DOM.movieSelect = document.getElementById('movie-select');
  DOM.selectedMovieInfo = document.getElementById('selected-movie-info');
  DOM.selectedMovieTitle = document.getElementById('selected-movie-title');
  DOM.selectedMovieYear = document.getElementById('selected-movie-year');
  DOM.selectedMovieThumbnail = document.getElementById('selected-movie-thumbnail');
  DOM.selectedMovieAttributes = document.getElementById('selected-movie-attributes');
  
  DOM.starButtons = document.querySelectorAll('.star-btn');
  
  DOM.radarChartCanvas = document.getElementById('taste-radar-chart');
  DOM.chartLegend = document.getElementById('chart-legend');
  DOM.attributeContributors = document.getElementById('attribute-contributors');
  DOM.profileDisplay = document.getElementById('profile-display');
  DOM.profileStats = document.getElementById('profile-stats');
  
  DOM.loadingRecommendations = document.getElementById('loading-recommendations');
  DOM.recommendationsDisplay = document.getElementById('recommendations-display');
  
  DOM.clearRatingsBtn = document.getElementById('clear-ratings-btn');
  DOM.exportDataBtn = document.getElementById('export-data-btn');
  DOM.importDataBtn = document.getElementById('import-data-btn');
  DOM.importFileInput = document.getElementById('import-file-input');
  
  DOM.ratingsCounter = document.getElementById('ratings-counter');
  DOM.lastUpdate = document.getElementById('last-update');
  
  DOM.debugOutput = document.getElementById('debug-output');
  
  // Create search dropdown dynamically
  createSearchDropdown();
}

/**
 * Initialize radar chart with enhanced interactivity
 */
function initializeRadarChart() {
  if (!DOM.radarChartCanvas) {
    console.warn('[UI] Radar chart canvas not found');
    return;
  }
  
  // Get attribute names for radar chart
  const attributeNames = FILM_ATTRIBUTES.map(attr => attr.name);
  
  // Create radar chart instance
  radarChart = new RadarChart(DOM.radarChartCanvas, attributeNames);
  
  // Customize colors to match theme
  radarChart.config.fillColor = 'rgba(78, 205, 196, 0.3)';
  radarChart.config.strokeColor = 'rgba(78, 205, 196, 0.8)';
  radarChart.config.pointColor = '#4ecdc4';
  radarChart.config.hoverColor = 'rgba(78, 205, 196, 1.0)';
  
  // Setup click handler for attribute selection
  DOM.radarChartCanvas.addEventListener('click', handleChartClick);
  
  // Setup resize handlers
  setupResponsiveCanvas();
  
  console.log('[UI] Radar chart initialized with interactive features');
}

/**
 * Setup responsive canvas sizing
 */
function setupResponsiveCanvas() {
  // Handle window resize
  window.addEventListener('resize', handleCanvasResize);
  
  // Handle orientation change on mobile
  window.addEventListener('orientationchange', () => {
    setTimeout(handleCanvasResize, 100);
  });
}

/**
 * Handle canvas resize to maintain aspect ratio
 */
function handleCanvasResize() {
  if (!radarChart) return;
  
  // Canvas resize is handled by ChartRenderer's ResizeObserver
  // Just redraw with current data
  if (Object.keys(currentProfile).length > 0) {
    const chartData = convertProfileToChartData(currentProfile);
    radarChart.updateData(chartData);
  }
  
  console.log('[UI] Canvas resized and redrawn');
}

/**
 * Handle clicks on chart for attribute interaction
 */
function handleChartClick(event) {
  const rect = DOM.radarChartCanvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;
  
  const centerX = (radarChart.width / radarChart.dpr) / 2;
  const centerY = (radarChart.height / radarChart.dpr) / 2;
  
  const angleStep = (Math.PI * 2) / FILM_ATTRIBUTES.length;
  
  // Find clicked attribute
  let clickedAttributeIndex = -1;
  let minDistance = Infinity;
  
  FILM_ATTRIBUTES.forEach((attr, index) => {
    const angle = angleStep * index - Math.PI / 2;
    const labelDistance = radarChart.config.maxRadius + 30;
    
    const labelX = centerX + Math.cos(angle) * labelDistance;
    const labelY = centerY + Math.sin(angle) * labelDistance;
    
    const distance = Math.sqrt(
      Math.pow(mouseX - labelX, 2) + Math.pow(mouseY - labelY, 2)
    );
    
    if (distance < 30 && distance < minDistance) {
      minDistance = distance;
      clickedAttributeIndex = index;
    }
  });
  
  if (clickedAttributeIndex >= 0) {
    const attributeId = FILM_ATTRIBUTES[clickedAttributeIndex].id;
    selectAttribute(attributeId);
  }
}

// ============================================================================
// Search Dropdown Creation
// ============================================================================

/**
 * Create custom search dropdown element
 */
function createSearchDropdown() {
  const dropdown = document.createElement('div');
  dropdown.id = 'search-dropdown';
  dropdown.className = 'search-dropdown';
  dropdown.setAttribute('role', 'listbox');
  dropdown.setAttribute('aria-label', 'Movie search results');
  dropdown.style.display = 'none';
  
  // Insert after search input
  DOM.movieSearch.parentElement.appendChild(dropdown);
  DOM.searchDropdown = dropdown;
}

// ============================================================================
// Event Listeners
// ============================================================================

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Movie search with debouncing and keyboard navigation
  DOM.movieSearch.addEventListener('input', handleMovieSearchInput);
  DOM.movieSearch.addEventListener('keydown', handleSearchKeydown);
  DOM.movieSearch.addEventListener('focus', handleSearchFocus);
  DOM.movieSearch.addEventListener('blur', handleSearchBlur);
  
  // Movie selection (legacy - keeping for backwards compatibility)
  DOM.movieSelect.addEventListener('change', handleMovieSelection);
  
  // Rating buttons
  DOM.starButtons.forEach(btn => {
    btn.addEventListener('click', handleRatingClick);
  });
  
  // Clear ratings
  DOM.clearRatingsBtn.addEventListener('click', handleClearRatings);
  
  // Export data
  DOM.exportDataBtn.addEventListener('click', handleExportData);
  
  // Import data
  DOM.importDataBtn.addEventListener('click', handleImportClick);
  DOM.importFileInput.addEventListener('change', handleImportFile);
  
  // Close dropdown on outside click
  document.addEventListener('click', handleOutsideClick);
}

/**
 * Handle movie search input with debouncing
 */
function handleMovieSearchInput(event) {
  const query = event.target.value.trim();
  
  // Clear previous debounce timer
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  
  // Debounce search (200ms)
  searchDebounceTimer = setTimeout(() => {
    performMovieSearch(query);
  }, 200);
}

/**
 * Perform movie search and update dropdown
 */
function performMovieSearch(query) {
  if (!query) {
    hideSearchDropdown();
    filteredMovies = [];
    return;
  }
  
  const lowerQuery = query.toLowerCase();
  
  // Filter movies by title or year
  filteredMovies = allMovies.filter(movie => 
    movie.title.toLowerCase().includes(lowerQuery) ||
    movie.year.toString().includes(lowerQuery)
  );
  
  selectedDropdownIndex = -1;
  renderSearchDropdown();
  showSearchDropdown();
}

/**
 * Handle keyboard navigation in search input
 */
function handleSearchKeydown(event) {
  if (!searchDropdownVisible || filteredMovies.length === 0) {
    return;
  }
  
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      selectedDropdownIndex = Math.min(
        selectedDropdownIndex + 1,
        filteredMovies.length - 1
      );
      updateDropdownSelection();
      break;
      
    case 'ArrowUp':
      event.preventDefault();
      selectedDropdownIndex = Math.max(selectedDropdownIndex - 1, 0);
      updateDropdownSelection();
      break;
      
    case 'Enter':
      event.preventDefault();
      if (selectedDropdownIndex >= 0) {
        selectMovieFromDropdown(filteredMovies[selectedDropdownIndex].id);
      }
      break;
      
    case 'Escape':
      event.preventDefault();
      hideSearchDropdown();
      DOM.movieSearch.blur();
      break;
  }
}

/**
 * Handle search input focus
 */
function handleSearchFocus() {
  if (DOM.movieSearch.value.trim() && filteredMovies.length > 0) {
    showSearchDropdown();
  }
}

/**
 * Handle search input blur (with delay for click events)
 */
function handleSearchBlur() {
  // Delay to allow dropdown click events to fire
  setTimeout(() => {
    hideSearchDropdown();
  }, 200);
}

/**
 * Handle clicks outside search dropdown
 */
function handleOutsideClick(event) {
  if (!DOM.movieSearch.contains(event.target) && 
      !DOM.searchDropdown.contains(event.target)) {
    hideSearchDropdown();
  }
}

/**
 * Handle movie selection from dropdown (legacy)
 */
function handleMovieSelection(event) {
  const movieId = event.target.value;
  
  if (!movieId) {
    DOM.selectedMovieInfo.style.display = 'none';
    selectedMovieId = null;
    return;
  }
  
  selectMovieFromDropdown(movieId);
}

/**
 * Select a movie and display its details
 */
function selectMovieFromDropdown(movieId) {
  hideSearchDropdown();
  
  const movie = MOVIE_MAP[movieId];
  
  if (!movie) {
    console.error('[UI] Movie not found:', movieId);
    return;
  }
  
  selectedMovieId = movieId;
  
  // Update selected movie display
  DOM.selectedMovieTitle.textContent = movie.title;
  DOM.selectedMovieYear.textContent = movie.year;
  
  // Update thumbnail (placeholder for now)
  if (DOM.selectedMovieThumbnail) {
    DOM.selectedMovieThumbnail.innerHTML = `
      <div class="movie-thumbnail-placeholder">
        <span class="movie-icon">🎬</span>
      </div>
    `;
  }
  
  // Display movie attributes breakdown
  renderMovieAttributesBreakdown(movie);
  
  DOM.selectedMovieInfo.style.display = 'block';
  
  // Update button states based on existing rating
  const ratingResult = dataStore.getRating(movieId);
  if (ratingResult.success) {
    highlightRatingButton(ratingResult.data.score);
  } else {
    clearRatingButtonHighlight();
  }
  
  // Clear search input
  DOM.movieSearch.value = '';
  
  // Scroll to selected movie info
  DOM.selectedMovieInfo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Handle rating button click
 */
function handleRatingClick(event) {
  if (!selectedMovieId) {
    showFeedback('⚠️ Please select a movie first', 'warning');
    return;
  }
  
  const rating = parseInt(event.target.dataset.rating);
  const movie = MOVIE_MAP[selectedMovieId];
  
  console.log('[UI] Rating movie:', movie.title, 'with score:', rating);
  
  // Add rating to store
  const result = dataStore.addRating(selectedMovieId, rating);
  
  if (!result.success) {
    showFeedback(`❌ Error: ${result.error}`, 'error');
    return;
  }
  
  // Update UI
  highlightRatingButton(rating);
  showFeedback(`✓ Added "${movie.title}"! (${rating} stars)`);
  
  // Update indicators
  updateDataIndicators();
  
  // Update exploration UI
  ExplorationUI.update();
  
  // Recalculate and update displays
  updateTasteProfileDisplay();
  updateRecommendationsDisplay();
  
  // Clear selection and reset for next movie
  setTimeout(() => {
    clearMovieSelection();
    
    // Scroll recommendations into view
    const recsSection = document.getElementById('recommendations-section');
    if (recsSection) {
      recsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 1500);
}

/**
 * Handle clear all ratings
 */
function handleClearRatings() {
  const ratingsResult = dataStore.getRatings();
  const count = ratingsResult.data.length;
  
  if (count === 0) {
    showFeedback('No ratings to clear', 'warning');
    return;
  }
  
  if (!confirm(`Are you sure you want to clear all ${count} ratings? This cannot be undone.`)) {
    return;
  }
  
  const result = dataStore.clearAllRatings();
  
  if (result.success) {
    showFeedback('✓ All ratings cleared');
    clearMovieSelection();
    updateTasteProfileDisplay();
    updateRecommendationsDisplay();
    updateDataIndicators();
    ExplorationUI.update();
  } else {
    showFeedback(`❌ Error: ${result.error}`, 'error');
  }
}

/**
 * Handle export data
 */
function handleExportData() {
  const data = dataStore.exportData();
  const json = JSON.stringify(data, null, 2);
  
  // Create downloadable file
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tastemap-ratings-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showFeedback(`✓ Exported ${data.ratings.length} ratings successfully`);
}

/**
 * Handle import button click
 */
function handleImportClick() {
  DOM.importFileInput.click();
}

/**
 * Handle import file selection
 */
function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      
      // Validate imported data structure
      if (!importedData.ratings || !Array.isArray(importedData.ratings)) {
        throw new Error('Invalid file format: missing ratings array');
      }
      
      // Confirm import
      const count = importedData.ratings.length;
      const currentCount = dataStore.getRatings().data.length;
      
      let confirmMsg = `Import ${count} ratings from file?`;
      if (currentCount > 0) {
        confirmMsg += `\n\nThis will replace your current ${currentCount} ratings.`;
      }
      
      if (!confirm(confirmMsg)) {
        event.target.value = '';
        return;
      }
      
      // Clear existing ratings
      dataStore.clearAllRatings();
      
      // Import ratings
      let successCount = 0;
      let errorCount = 0;
      
      importedData.ratings.forEach(rating => {
        const result = dataStore.addRating(rating.movieId, rating.score);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          console.warn('[UI] Failed to import rating:', rating, result.error);
        }
      });
      
      // Update UI
      updateTasteProfileDisplay();
      updateRecommendationsDisplay();
      updateDataIndicators();
      ExplorationUI.update();
      
      if (errorCount > 0) {
        showFeedback(`⚠️ Imported ${successCount} ratings, ${errorCount} failed`, 'warning');
      } else {
        showFeedback(`✓ Successfully imported ${successCount} ratings`);
      }
      
    } catch (error) {
      console.error('[UI] Import error:', error);
      showFeedback(`❌ Import failed: ${error.message}`, 'error');
    }
    
    // Reset file input
    event.target.value = '';
  };
  
  reader.onerror = function() {
    showFeedback('❌ Failed to read file', 'error');
    event.target.value = '';
  };
  
  reader.readAsText(file);
}

/**
 * Handle exploration filter changes
 */
function handleExplorationFilterChange(filterData) {
  explorationFilters = filterData;
  
  // Update recommendations to respect filters
  updateRecommendationsDisplay();
  
  // Update radar chart if dim is enabled
  if (filterData.dimNonSelected && radarChart) {
    updateTasteProfileDisplayWithDimming(filterData.filters);
  } else if (radarChart) {
    updateTasteProfileDisplay();
  }
  
  console.log('[UI] Exploration filters changed:', {
    activeFilters: filterData.filters,
    filteredCount: filterData.filteredMovies.length,
    dimNonSelected: filterData.dimNonSelected
  });
}

// ============================================================================
// Search Dropdown Rendering
// ============================================================================

/**
 * Render search dropdown with filtered movies
 */
function renderSearchDropdown() {
  if (!DOM.searchDropdown) return;
  
  DOM.searchDropdown.innerHTML = '';
  
  if (filteredMovies.length === 0) {
    const noResults = document.createElement('div');
    noResults.className = 'dropdown-item dropdown-no-results';
    noResults.textContent = 'No movies found';
    DOM.searchDropdown.appendChild(noResults);
    return;
  }
  
  filteredMovies.forEach((movie, index) => {
    const item = document.createElement('div');
    item.className = 'dropdown-item';
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', index === selectedDropdownIndex ? 'true' : 'false');
    item.dataset.movieId = movie.id;
    item.dataset.index = index;
    
    // Check if already rated
    const ratingResult = dataStore.getRating(movie.id);
    const ratingBadge = ratingResult.success 
      ? `<span class="rating-badge" aria-label="Rated ${ratingResult.data.score} stars">⭐${ratingResult.data.score}</span>`
      : '';
    
    item.innerHTML = `
      <div class="dropdown-item-content">
        <span class="dropdown-item-title">${highlightSearchTerm(movie.title, DOM.movieSearch.value)}</span>
        <span class="dropdown-item-year">${movie.year}</span>
      </div>
      ${ratingBadge}
    `;
    
    if (index === selectedDropdownIndex) {
      item.classList.add('selected');
    }
    
    // Click handler
    item.addEventListener('click', () => {
      selectMovieFromDropdown(movie.id);
    });
    
    // Hover handler
    item.addEventListener('mouseenter', () => {
      selectedDropdownIndex = index;
      updateDropdownSelection();
    });
    
    DOM.searchDropdown.appendChild(item);
  });
}

/**
 * Update dropdown selection highlighting
 */
function updateDropdownSelection() {
  if (!DOM.searchDropdown) return;
  
  const items = DOM.searchDropdown.querySelectorAll('.dropdown-item');
  items.forEach((item, index) => {
    if (index === selectedDropdownIndex) {
      item.classList.add('selected');
      item.setAttribute('aria-selected', 'true');
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      item.classList.remove('selected');
      item.setAttribute('aria-selected', 'false');
    }
  });
}

/**
 * Show search dropdown
 */
function showSearchDropdown() {
  if (DOM.searchDropdown && filteredMovies.length > 0) {
    DOM.searchDropdown.style.display = 'block';
    searchDropdownVisible = true;
    DOM.movieSearch.setAttribute('aria-expanded', 'true');
  }
}

/**
 * Hide search dropdown
 */
function hideSearchDropdown() {
  if (DOM.searchDropdown) {
    DOM.searchDropdown.style.display = 'none';
    searchDropdownVisible = false;
    DOM.movieSearch.setAttribute('aria-expanded', 'false');
  }
}

/**
 * Highlight search term in text
 */
function highlightSearchTerm(text, term) {
  if (!term) return text;
  
  const regex = new RegExp(`(${term})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Render movie attributes breakdown
 */
function renderMovieAttributesBreakdown(movie) {
  if (!DOM.selectedMovieAttributes) return;
  
  let html = '<table class="attributes-table">';
  html += '<caption class="sr-only">Movie attribute breakdown</caption>';
  html += '<thead><tr><th scope="col">Attribute</th><th scope="col">Type</th><th scope="col">Score</th></tr></thead>';
  html += '<tbody>';
  
  FILM_ATTRIBUTES.forEach(attr => {
    const score = movie.getAttributeScore(attr.id);
    const percentage = (score * 100).toFixed(0);
    const barWidth = percentage;
    
    html += `
      <tr>
        <td><strong>${attr.name}</strong></td>
        <td><span class="attribute-type-badge">${attr.type}</span></td>
        <td>
          <div class="attribute-mini-bar">
            <div class="attribute-mini-bar-fill" style="width: ${barWidth}%"></div>
            <span class="attribute-mini-bar-label">${percentage}%</span>
          </div>
        </td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  
  DOM.selectedMovieAttributes.innerHTML = html;
}

// ============================================================================
// Display Updates
// ============================================================================

/**
 * Render movie list in the select dropdown
 */
function renderMovieList(movies) {
  DOM.movieSelect.innerHTML = '';
  
  if (movies.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '-- No movies found --';
    DOM.movieSelect.appendChild(option);
    return;
  }
  
  // Add placeholder
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '-- Select a movie --';
  DOM.movieSelect.appendChild(placeholder);
  
  // Add movies
  movies.forEach(movie => {
    const option = document.createElement('option');
    option.value = movie.id;
    
    // Check if already rated
    const ratingResult = dataStore.getRating(movie.id);
    const ratingText = ratingResult.success ? ` ⭐${ratingResult.data.score}` : '';
    
    option.textContent = `${movie.title} (${movie.year})${ratingText}`;
    DOM.movieSelect.appendChild(option);
  });
}

/**
 * Update taste profile display with radar chart and legend
 */
function updateTasteProfileDisplay() {
  const ratingsResult = dataStore.getRatings();
  const ratings = ratingsResult.data;
  
  if (ratings.length === 0) {
    DOM.profileDisplay.innerHTML = '<p class="empty-state">Rate some movies to build your taste profile!</p>';
    DOM.profileStats.innerHTML = '';
    
    // Clear radar chart and legend
    if (radarChart) {
      radarChart.updateData({});
    }
    if (DOM.chartLegend) {
      DOM.chartLegend.innerHTML = '';
    }
    if (DOM.attributeContributors) {
      DOM.attributeContributors.style.display = 'none';
    }
    
    currentProfile = {};
    return;
  }
  
  // Calculate taste profile
  const profile = calculateTasteProfile(ratings, MOVIE_MAP);
  currentProfile = profile;
  
  // Update radar chart with smooth animation
  if (radarChart) {
    const chartData = convertProfileToChartData(profile);
    radarChart.updateData(chartData);
  }
  
  // Render legend
  renderChartLegend(profile);
  
  // Get dominant attributes
  const dominant = getDominantAttributes(profile, 3);
  
  // Build profile HTML (detailed breakdown)
  let html = '<div class="profile-attributes">';
  
  FILM_ATTRIBUTES.forEach(attr => {
    const score = profile[attr.id];
    const percentage = (score * 100).toFixed(0);
    const barWidth = percentage;
    
    html += `
      <div class="attribute-row">
        <div class="attribute-label">
          <span class="attribute-name">${attr.name}</span>
          <span class="attribute-type">(${attr.type})</span>
        </div>
        <div class="attribute-bar-container">
          <div class="attribute-bar" style="width: ${barWidth}%"></div>
        </div>
        <div class="attribute-value">${percentage}%</div>
      </div>
    `;
  });
  
  html += '</div>';
  
  // Add dominant attributes summary
  html += '<div class="dominant-attributes">';
  html += '<h3>Your Top Preferences:</h3>';
  html += '<ul>';
  dominant.forEach(attr => {
    html += `<li><strong>${attr.name}</strong>: ${(attr.score * 100).toFixed(0)}%</li>`;
  });
  html += '</ul>';
  html += '</div>';
  
  DOM.profileDisplay.innerHTML = html;
  
  // Update stats
  const avgRating = (ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length).toFixed(1);
  DOM.profileStats.innerHTML = `
    <p><strong>Total Ratings:</strong> ${ratings.length}</p>
    <p><strong>Average Rating:</strong> ${avgRating} stars</p>
  `;
}

/**
 * Convert profile (attribute IDs) to chart data (attribute names)
 */
function convertProfileToChartData(profile) {
  const chartData = {};
  FILM_ATTRIBUTES.forEach(attr => {
    chartData[attr.name] = profile[attr.id] || 0;
  });
  return chartData;
}

/**
 * Render interactive legend below chart
 */
function renderChartLegend(profile) {
  if (!DOM.chartLegend) return;
  
  let html = '<div class="legend-items">';
  
  FILM_ATTRIBUTES.forEach(attr => {
    const score = profile[attr.id] || 0;
    const percentage = (score * 100).toFixed(0);
    const isSelected = selectedAttributeId === attr.id;
    
    html += `
      <div class="legend-item ${isSelected ? 'selected' : ''}" 
           data-attribute-id="${attr.id}"
           role="button"
           tabindex="0"
           aria-pressed="${isSelected}"
           title="Click to see contributing movies">
        <div class="legend-color-box" style="background: #4ecdc4;"></div>
        <div class="legend-label">
          <span class="legend-name">${attr.name}</span>
          <span class="legend-value">${percentage}%</span>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  
  DOM.chartLegend.innerHTML = html;
  
  // Add click handlers to legend items
  const legendItems = DOM.chartLegend.querySelectorAll('.legend-item');
  legendItems.forEach(item => {
    item.addEventListener('click', () => {
      const attributeId = item.dataset.attributeId;
      selectAttribute(attributeId);
    });
    
    // Keyboard support
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const attributeId = item.dataset.attributeId;
        selectAttribute(attributeId);
      }
    });
  });
}

/**
 * Select an attribute to highlight and show contributors
 */
function selectAttribute(attributeId) {
  // Toggle selection
  if (selectedAttributeId === attributeId) {
    selectedAttributeId = null;
    if (DOM.attributeContributors) {
      DOM.attributeContributors.style.display = 'none';
    }
  } else {
    selectedAttributeId = attributeId;
    showAttributeContributors(attributeId);
  }
  
  // Update legend highlighting
  renderChartLegend(currentProfile);
  
  console.log('[UI] Selected attribute:', attributeId);
}

/**
 * Show movies contributing most to selected attribute
 */
function showAttributeContributors(attributeId) {
  if (!DOM.attributeContributors) return;
  
  const ratingsResult = dataStore.getRatings();
  const ratings = ratingsResult.data;
  
  if (ratings.length === 0) {
    DOM.attributeContributors.style.display = 'none';
    return;
  }
  
  // Find attribute
  const attribute = FILM_ATTRIBUTES.find(attr => attr.id === attributeId);
  if (!attribute) return;
  
  // Calculate each movie's contribution to this attribute
  const contributions = ratings.map(rating => {
    const movie = MOVIE_MAP[rating.movieId];
    if (!movie) return null;
    
    const attributeScore = movie.getAttributeScore(attributeId);
    const weight = rating.score; // User's rating weight
    const contribution = attributeScore * weight;
    
    return {
      movie,
      rating: rating.score,
      attributeScore,
      contribution,
    };
  }).filter(c => c !== null);
  
  // Sort by contribution (descending)
  contributions.sort((a, b) => b.contribution - a.contribution);
  
  // Take top 5
  const topContributors = contributions.slice(0, 5);
  
  // Build HTML
  let html = `
    <h4>Top Movies Contributing to "${attribute.name}"</h4>
    <p class="contributors-description">These movies have shaped your ${attribute.name} preference.</p>
    <div class="contributors-list">
  `;
  
  topContributors.forEach((contrib, index) => {
    const percentage = (contrib.attributeScore * 100).toFixed(0);
    html += `
      <div class="contributor-item">
        <div class="contributor-rank">${index + 1}</div>
        <div class="contributor-info">
          <div class="contributor-title">${contrib.movie.title} (${contrib.movie.year})</div>
          <div class="contributor-details">
            <span>Your Rating: ⭐${contrib.rating}</span>
            <span>${attribute.name}: ${percentage}%</span>
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  
  DOM.attributeContributors.innerHTML = html;
  DOM.attributeContributors.style.display = 'block';
  
  // Scroll into view
  DOM.attributeContributors.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Update recommendations display
 */
function updateRecommendationsDisplay() {
  const ratingsResult = dataStore.getRatings();
  const ratings = ratingsResult.data;
  
  // Show loading state
  DOM.loadingRecommendations.style.display = 'block';
  DOM.recommendationsDisplay.innerHTML = '';
  
  // Simulate async calculation (in case it becomes async later)
  setTimeout(() => {
    if (ratings.length === 0) {
      DOM.loadingRecommendations.style.display = 'none';
      DOM.recommendationsDisplay.innerHTML = '<p class="empty-state">Your recommendations will appear here after you rate a few movies.</p>';
      return;
    }
    
    // Calculate taste profile
    const profile = calculateTasteProfile(ratings, MOVIE_MAP);
    
    // Get rated movie IDs to exclude from recommendations
    const ratedMovieIds = ratings.map(r => r.movieId);
    
    // Use filtered movies if exploration filters are active
    const moviesToSearch = explorationFilters.active.length > 0 
      ? explorationFilters.filteredMovies 
      : allMovies;
    
    // Find similar movies
    const recommendations = findSimilarMovies(profile, moviesToSearch, 5, ratedMovieIds);
    
    DOM.loadingRecommendations.style.display = 'none';
    
    if (recommendations.length === 0) {
      const msg = explorationFilters.active.length > 0
        ? 'No recommendations match your current filters. Try adjusting them.'
        : 'You\'ve rated all available movies!';
      DOM.recommendationsDisplay.innerHTML = `<p class="empty-state">${msg}</p>`;
      return;
    }
    
    // Build recommendations HTML
    let html = '<div class="recommendations-list">';
    
    if (explorationFilters.active.length > 0) {
      html += `<p class="filter-notice">🔍 Filtered by: ${explorationFilters.active.join(', ')}</p>`;
    }
    
    recommendations.forEach((rec, index) => {
      const movie = rec.movie;
      const similarity = (rec.similarity * 100).toFixed(0);
      
      html += `
        <div class="recommendation-card">
          <div class="recommendation-header">
            <h3>${index + 1}. ${movie.title}</h3>
            <span class="similarity-badge">${similarity}% match</span>
          </div>
          <p class="movie-year">${movie.year}</p>
          <button class="btn btn-small rate-btn" data-movie-id="${movie.id}">Rate This Movie</button>
        </div>
      `;
    });
    
    html += '</div>';
    
    DOM.recommendationsDisplay.innerHTML = html;
    
    // Add click handlers to "Rate This Movie" buttons
    const rateBtns = DOM.recommendationsDisplay.querySelectorAll('.rate-btn');
    rateBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const movieId = e.target.dataset.movieId;
        selectMovie(movieId);
      });
    });
  }, 100);
}

/**
 * Update taste profile display with attribute dimming
 * @param {Array<string>} activeFilters - Array of active attribute IDs
 */
function updateTasteProfileDisplayWithDimming(activeFilters) {
  // First do regular update
  updateTasteProfileDisplay();
  
  if (!radarChart || activeFilters.length === 0) return;
  
  // Apply dimming by reducing opacity of non-selected attributes
  const chartData = convertProfileToChartData(currentProfile);
  
  // Create dimmed version
  const dimmedData = {};
  FILM_ATTRIBUTES.forEach(attr => {
    if (activeFilters.includes(attr.id)) {
      dimmedData[attr.name] = chartData[attr.name]; // Full opacity
    } else {
      dimmedData[attr.name] = chartData[attr.name] * 0.3; // Dimmed
    }
  });
  
  radarChart.updateData(dimmedData);
  
  console.log('[UI] Applied dimming to radar chart');
}

// ============================================================================
// UI Helper Functions
// ============================================================================

/**
 * Highlight a rating button
 */
function highlightRatingButton(rating) {
  DOM.starButtons.forEach(btn => {
    const btnRating = parseInt(btn.dataset.rating);
    if (btnRating <= rating) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Clear rating button highlight
 */
function clearRatingButtonHighlight() {
  DOM.starButtons.forEach(btn => {
    btn.classList.remove('active');
  });
}

/**
 * Select a movie programmatically
 */
function selectMovie(movieId) {
  DOM.movieSelect.value = movieId;
  DOM.movieSelect.dispatchEvent(new Event('change'));
  
  // Scroll to rating section
  document.getElementById('rating-section').scrollIntoView({ behavior: 'smooth' });
}

// ============================================================================
// Data Persistence Helpers
// ============================================================================

/**
 * Check if localStorage is available
 */
function checkLocalStorageAvailability() {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    localStorageAvailable = true;
    console.log('[UI] localStorage is available');
  } catch (error) {
    localStorageAvailable = false;
    console.warn('[UI] localStorage is not available:', error);
    showFeedback('⚠️ Data persistence unavailable. Ratings will be lost on page reload.', 'warning');
  }
}

/**
 * Handle storage errors
 */
function handleStorageError(error) {
  console.error('[UI] Storage error:', error);
  
  const message = 'Data storage error detected. Your saved ratings may be corrupted.';
  const resetOption = confirm(`${message}\n\nWould you like to reset and start fresh?`);
  
  if (resetOption) {
    try {
      localStorage.removeItem('tastemap-user-data');
      location.reload();
    } catch (e) {
      showFeedback('❌ Failed to reset data. Please clear browser cache manually.', 'error');
    }
  } else {
    showFeedback('⚠️ Continuing with potentially corrupted data', 'warning');
  }
}

/**
 * Update data indicators in header
 */
function updateDataIndicators() {
  if (!DOM.ratingsCounter || !DOM.lastUpdate) return;
  
  const ratingsResult = dataStore.getRatings();
  const count = ratingsResult.data.length;
  
  // Update ratings counter
  DOM.ratingsCounter.textContent = count === 1 ? '1 rating saved' : `${count} ratings saved`;
  
  // Update last update timestamp
  if (count > 0) {
    const lastUpdateTime = new Date().toLocaleString();
    DOM.lastUpdate.textContent = `Last update: ${lastUpdateTime}`;
    DOM.lastUpdate.style.display = 'inline-block';
  } else {
    DOM.lastUpdate.style.display = 'none';
  }
  
  // Storage warning if unavailable
  if (!localStorageAvailable && count > 0) {
    DOM.ratingsCounter.classList.add('unsaved');
    DOM.ratingsCounter.title = 'Data will be lost on page reload (localStorage unavailable)';
  } else {
    DOM.ratingsCounter.classList.remove('unsaved');
    DOM.ratingsCounter.title = '';
  }
}

/**
 * Show temporary feedback message
 */
function showFeedback(message, type = 'success') {
  const feedback = document.createElement('div');
  feedback.className = `feedback-message feedback-${type}`;
  feedback.textContent = message;
  feedback.setAttribute('role', 'alert');
  feedback.setAttribute('aria-live', 'polite');
  document.body.appendChild(feedback);
  
  // Remove after 3 seconds
  setTimeout(() => {
    feedback.classList.add('fade-out');
    setTimeout(() => feedback.remove(), 300);
  }, 3000);
}

/**
 * Clear movie selection and reset UI
 */
function clearMovieSelection() {
  selectedMovieId = null;
  DOM.selectedMovieInfo.style.display = 'none';
  DOM.movieSearch.value = '';
  clearRatingButtonHighlight();
  hideSearchDropdown();
}

// ============================================================================
// Debug Helpers
// ============================================================================

/**
 * Update debug output (if debug section is visible)
 */
function updateDebugOutput() {
  if (!DOM.debugOutput || DOM.debugOutput.parentElement.style.display === 'none') {
    return;
  }
  
  const ratingsResult = dataStore.getRatings();
  const storageInfo = dataStore.getStorageInfo();
  
  const debugInfo = {
    ratings: ratingsResult.data.length,
    storage: storageInfo.data,
    lastUpdate: new Date().toISOString(),
  };
  
  DOM.debugOutput.textContent = JSON.stringify(debugInfo, null, 2);
}

// ============================================================================
// Module Initialization
// ============================================================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging
window.TasteMapUI = {
  dataStore: () => dataStore,
  radarChart: () => radarChart,
  currentProfile: () => currentProfile,
  updateProfile: updateTasteProfileDisplay,
  updateRecommendations: updateRecommendationsDisplay,
  selectAttribute: (attrId) => selectAttribute(attrId),
};
