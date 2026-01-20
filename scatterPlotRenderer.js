/**
 * Scatter Plot Renderer Module
 * 2D visualization of movies in taste space with interactive features
 */

import { ChartRenderer } from './canvasRenderer.js';
import { FILM_ATTRIBUTES, ATTRIBUTE_MAP } from './filmAttributes.js';

// ============================================================================
// ScatterPlot Class
// ============================================================================

/**
 * Scatter plot for visualizing movies in 2D taste space
 * Users can select which 2 attributes to compare on X and Y axes
 */
export class ScatterPlot extends ChartRenderer {
  /**
   * @param {HTMLCanvasElement} canvasElement - Canvas element to render on
   * @param {string} xAttribute - Initial X-axis attribute ID
   * @param {string} yAttribute - Initial Y-axis attribute ID
   */
  constructor(canvasElement, xAttribute = 'action', yAttribute = 'drama') {
    super(canvasElement);
    
    this.xAttribute = xAttribute;
    this.yAttribute = yAttribute;
    
    // Data
    this.userProfile = null;
    this.movies = [];
    this.ratedMovieIds = new Set();
    this.movieRatings = {}; // movieId -> rating score (1-5)
    
    // Interaction state
    this.hoveredPoint = null;
    this.selectedPoint = null;
    this.tooltipVisible = false;
    
    // Callbacks
    this.onMovieClick = null;
    this.onAxisChange = null;
    
    // Visual configuration
    this.config = {
      // Colors
      backgroundColor: '#1a1a2e',
      axisColor: 'rgba(255, 255, 255, 0.3)',
      gridColor: 'rgba(255, 255, 255, 0.1)',
      labelColor: '#ccc',
      
      // Point colors
      ratedColor: '#4ecdc4',       // Green-teal for rated
      unratedColor: '#5a7fb8',     // Blue for unrated
      userColor: '#ff6b6b',        // Red for user position
      hoverColor: '#ffd93d',       // Yellow for hover
      
      // Dimensions
      padding: 60,
      pointRadius: 6,
      userPointRadius: 12,
      minPointRadius: 4,
      maxPointRadius: 12,
      
      // Axis
      axisRange: { min: 0, max: 1 },
      axisPadding: 0.05, // 5% padding on each side
      gridLines: 5,
      
      // Tooltip
      tooltipPadding: 8,
      tooltipFont: '14px sans-serif',
    };
    
    // Setup interactions
    this.setupMouseEvents();
    
    // Initial draw
    this.draw();
  }

  /**
   * Set the X-axis attribute
   * @param {string} attributeId - Attribute ID
   */
  setXAttribute(attributeId) {
    if (ATTRIBUTE_MAP[attributeId]) {
      this.xAttribute = attributeId;
      this.draw();
      if (this.onAxisChange) {
        this.onAxisChange('x', attributeId);
      }
    }
  }

  /**
   * Set the Y-axis attribute
   * @param {string} attributeId - Attribute ID
   */
  setYAttribute(attributeId) {
    if (ATTRIBUTE_MAP[attributeId]) {
      this.yAttribute = attributeId;
      this.draw();
      if (this.onAxisChange) {
        this.onAxisChange('y', attributeId);
      }
    }
  }

  /**
   * Update plot data
   * @param {Object} userProfile - User's taste profile {attributeId: 0-1, ...}
   * @param {Array} movies - Array of Movie objects
   * @param {Object} ratings - Optional map of movieId to rating score
   */
  updateData(userProfile, movies, ratings = {}) {
    this.userProfile = userProfile;
    this.movies = movies || [];
    this.movieRatings = ratings;
    this.ratedMovieIds = new Set(Object.keys(ratings));
    this.draw();
  }

  /**
   * Get plot bounds with padding
   */
  getPlotBounds() {
    const displayWidth = this.width / this.dpr;
    const displayHeight = this.height / this.dpr;
    
    return {
      left: this.config.padding,
      right: displayWidth - this.config.padding,
      top: this.config.padding,
      bottom: displayHeight - this.config.padding,
      width: displayWidth - 2 * this.config.padding,
      height: displayHeight - 2 * this.config.padding,
    };
  }

  /**
   * Convert data coordinates to canvas coordinates
   */
  dataToCanvas(xValue, yValue) {
    const bounds = this.getPlotBounds();
    const { min, max } = this.config.axisRange;
    const pad = this.config.axisPadding;
    
    // Apply padding to range
    const rangeMin = min - pad;
    const rangeMax = max + pad;
    const range = rangeMax - rangeMin;
    
    // Handle edge case: all same values
    const normalizedX = range > 0 ? (xValue - rangeMin) / range : 0.5;
    const normalizedY = range > 0 ? (yValue - rangeMin) / range : 0.5;
    
    return {
      x: bounds.left + normalizedX * bounds.width,
      y: bounds.bottom - normalizedY * bounds.height, // Flip Y for canvas
    };
  }

  /**
   * Convert canvas coordinates to data coordinates
   */
  canvasToData(canvasX, canvasY) {
    const bounds = this.getPlotBounds();
    const { min, max } = this.config.axisRange;
    const pad = this.config.axisPadding;
    
    const rangeMin = min - pad;
    const rangeMax = max + pad;
    const range = rangeMax - rangeMin;
    
    const normalizedX = (canvasX - bounds.left) / bounds.width;
    const normalizedY = 1 - (canvasY - bounds.top) / bounds.height;
    
    return {
      x: rangeMin + normalizedX * range,
      y: rangeMin + normalizedY * range,
    };
  }

  /**
   * Get point radius based on rating
   */
  getPointRadius(movieId) {
    if (this.ratedMovieIds.has(movieId)) {
      const rating = this.movieRatings[movieId] || 3;
      // Scale from minPointRadius (rating 1) to maxPointRadius (rating 5)
      const scale = (rating - 1) / 4;
      return this.config.minPointRadius + 
             scale * (this.config.maxPointRadius - this.config.minPointRadius);
    }
    return this.config.minPointRadius;
  }

  /**
   * Main draw method
   */
  draw() {
    this.clear();
    
    const displayWidth = this.width / this.dpr;
    const displayHeight = this.height / this.dpr;
    
    // Draw background
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    // Draw grid
    this.drawGrid();
    
    // Draw axes
    this.drawAxes();
    
    // Draw axis labels
    this.drawAxisLabels();
    
    // Draw movie points (unrated first, then rated on top)
    this.drawMoviePoints();
    
    // Draw user position
    this.drawUserPoint();
    
    // Draw tooltip if hovering
    if (this.hoveredPoint) {
      this.drawTooltip();
    }
  }

  /**
   * Draw grid lines
   */
  drawGrid() {
    const bounds = this.getPlotBounds();
    
    this.ctx.strokeStyle = this.config.gridColor;
    this.ctx.lineWidth = 1;
    
    const steps = this.config.gridLines;
    
    // Vertical grid lines
    for (let i = 0; i <= steps; i++) {
      const x = bounds.left + (i / steps) * bounds.width;
      this.ctx.beginPath();
      this.ctx.moveTo(x, bounds.top);
      this.ctx.lineTo(x, bounds.bottom);
      this.ctx.stroke();
    }
    
    // Horizontal grid lines
    for (let i = 0; i <= steps; i++) {
      const y = bounds.top + (i / steps) * bounds.height;
      this.ctx.beginPath();
      this.ctx.moveTo(bounds.left, y);
      this.ctx.lineTo(bounds.right, y);
      this.ctx.stroke();
    }
  }

  /**
   * Draw X and Y axes
   */
  drawAxes() {
    const bounds = this.getPlotBounds();
    
    this.ctx.strokeStyle = this.config.axisColor;
    this.ctx.lineWidth = 2;
    
    // X axis
    this.ctx.beginPath();
    this.ctx.moveTo(bounds.left, bounds.bottom);
    this.ctx.lineTo(bounds.right, bounds.bottom);
    this.ctx.stroke();
    
    // Y axis
    this.ctx.beginPath();
    this.ctx.moveTo(bounds.left, bounds.top);
    this.ctx.lineTo(bounds.left, bounds.bottom);
    this.ctx.stroke();
    
    // Draw tick marks and values
    this.drawAxisTicks(bounds);
  }

  /**
   * Draw axis tick marks and values
   */
  drawAxisTicks(bounds) {
    this.ctx.fillStyle = this.config.labelColor;
    this.ctx.font = '11px sans-serif';
    
    const steps = this.config.gridLines;
    
    // X axis ticks
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    for (let i = 0; i <= steps; i++) {
      const x = bounds.left + (i / steps) * bounds.width;
      const value = (i / steps).toFixed(1);
      this.ctx.fillText(value, x, bounds.bottom + 5);
    }
    
    // Y axis ticks
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';
    for (let i = 0; i <= steps; i++) {
      const y = bounds.bottom - (i / steps) * bounds.height;
      const value = (i / steps).toFixed(1);
      this.ctx.fillText(value, bounds.left - 8, y);
    }
  }

  /**
   * Draw axis labels (attribute names)
   */
  drawAxisLabels() {
    const bounds = this.getPlotBounds();
    
    this.ctx.fillStyle = this.config.labelColor;
    this.ctx.font = 'bold 14px sans-serif';
    
    // X axis label
    const xAttr = ATTRIBUTE_MAP[this.xAttribute];
    const xLabel = xAttr ? xAttr.name : this.xAttribute;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(xLabel, bounds.left + bounds.width / 2, bounds.bottom + 25);
    
    // Y axis label (rotated)
    const yAttr = ATTRIBUTE_MAP[this.yAttribute];
    const yLabel = yAttr ? yAttr.name : this.yAttribute;
    this.ctx.save();
    this.ctx.translate(bounds.left - 40, bounds.top + bounds.height / 2);
    this.ctx.rotate(-Math.PI / 2);
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText(yLabel, 0, 0);
    this.ctx.restore();
  }

  /**
   * Draw movie points
   */
  drawMoviePoints() {
    // Separate into unrated and rated for layering
    const unratedMovies = this.movies.filter(m => !this.ratedMovieIds.has(m.id));
    const ratedMovies = this.movies.filter(m => this.ratedMovieIds.has(m.id));
    
    // Draw unrated first (below)
    unratedMovies.forEach(movie => this.drawMoviePoint(movie, false));
    
    // Draw rated on top
    ratedMovies.forEach(movie => this.drawMoviePoint(movie, true));
  }

  /**
   * Draw a single movie point
   */
  drawMoviePoint(movie, isRated) {
    const xValue = movie.getAttributeScore(this.xAttribute);
    const yValue = movie.getAttributeScore(this.yAttribute);
    const pos = this.dataToCanvas(xValue, yValue);
    const radius = this.getPointRadius(movie.id);
    
    const isHovered = this.hoveredPoint && this.hoveredPoint.id === movie.id;
    const isSelected = this.selectedPoint && this.selectedPoint.id === movie.id;
    
    // Determine color
    let fillColor;
    if (isHovered || isSelected) {
      fillColor = this.config.hoverColor;
    } else if (isRated) {
      fillColor = this.config.ratedColor;
    } else {
      fillColor = this.config.unratedColor;
    }
    
    // Draw point
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, isHovered ? radius + 2 : radius, 0, Math.PI * 2);
    this.ctx.fillStyle = fillColor;
    this.ctx.fill();
    
    // Draw border
    this.ctx.strokeStyle = isHovered || isSelected ? '#fff' : 'rgba(255,255,255,0.5)';
    this.ctx.lineWidth = isHovered || isSelected ? 2 : 1;
    this.ctx.stroke();
  }

  /**
   * Draw user's position point
   */
  drawUserPoint() {
    if (!this.userProfile) return;
    
    const xValue = this.userProfile[this.xAttribute] || 0.5;
    const yValue = this.userProfile[this.yAttribute] || 0.5;
    const pos = this.dataToCanvas(xValue, yValue);
    
    // Draw outer glow
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, this.config.userPointRadius + 4, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(255, 107, 107, 0.3)';
    this.ctx.fill();
    
    // Draw main point
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, this.config.userPointRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = this.config.userColor;
    this.ctx.fill();
    
    // Draw border
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();
    
    // Draw "YOU" label
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 10px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('YOU', pos.x, pos.y);
  }

  /**
   * Draw tooltip for hovered point
   */
  drawTooltip() {
    if (!this.hoveredPoint) return;
    
    const movie = this.hoveredPoint;
    const xValue = movie.getAttributeScore(this.xAttribute);
    const yValue = movie.getAttributeScore(this.yAttribute);
    const pos = this.dataToCanvas(xValue, yValue);
    
    // Tooltip content
    const title = movie.title;
    const year = movie.year ? ` (${movie.year})` : '';
    const rating = this.movieRatings[movie.id] 
      ? ` ★${this.movieRatings[movie.id]}` 
      : '';
    const text = `${title}${year}${rating}`;
    
    // Measure text
    this.ctx.font = this.config.tooltipFont;
    const metrics = this.ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = 18;
    const padding = this.config.tooltipPadding;
    
    // Calculate tooltip position (above point)
    let tooltipX = pos.x;
    let tooltipY = pos.y - this.getPointRadius(movie.id) - 15;
    
    // Keep tooltip within bounds
    const bounds = this.getPlotBounds();
    const displayWidth = this.width / this.dpr;
    
    if (tooltipX - textWidth / 2 - padding < 0) {
      tooltipX = textWidth / 2 + padding;
    }
    if (tooltipX + textWidth / 2 + padding > displayWidth) {
      tooltipX = displayWidth - textWidth / 2 - padding;
    }
    if (tooltipY - textHeight / 2 - padding < 0) {
      tooltipY = pos.y + this.getPointRadius(movie.id) + 25;
    }
    
    // Draw tooltip background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    this.ctx.beginPath();
    this.ctx.roundRect(
      tooltipX - textWidth / 2 - padding,
      tooltipY - textHeight / 2 - padding,
      textWidth + padding * 2,
      textHeight + padding * 2,
      4
    );
    this.ctx.fill();
    
    // Draw border
    this.ctx.strokeStyle = this.config.hoverColor;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    
    // Draw text
    this.ctx.fillStyle = '#fff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, tooltipX, tooltipY);
  }

  /**
   * Setup mouse event handlers
   */
  setupMouseEvents() {
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
  }

  /**
   * Find point at mouse position
   */
  findPointAtPosition(mouseX, mouseY) {
    // Check movies (in reverse order so top-most is found first)
    const allMovies = [...this.movies].reverse();
    
    for (const movie of allMovies) {
      const xValue = movie.getAttributeScore(this.xAttribute);
      const yValue = movie.getAttributeScore(this.yAttribute);
      const pos = this.dataToCanvas(xValue, yValue);
      const radius = this.getPointRadius(movie.id);
      
      const distance = Math.sqrt(
        Math.pow(mouseX - pos.x, 2) + Math.pow(mouseY - pos.y, 2)
      );
      
      if (distance <= radius + 5) {
        return movie;
      }
    }
    
    return null;
  }

  /**
   * Handle mouse move for hover effects
   */
  handleMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    const point = this.findPointAtPosition(mouseX, mouseY);
    
    if (point !== this.hoveredPoint) {
      this.hoveredPoint = point;
      this.canvas.style.cursor = point ? 'pointer' : 'default';
      this.draw();
    }
  }

  /**
   * Handle mouse leave
   */
  handleMouseLeave() {
    if (this.hoveredPoint) {
      this.hoveredPoint = null;
      this.canvas.style.cursor = 'default';
      this.draw();
    }
  }

  /**
   * Handle click on point
   */
  handleClick(event) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    const point = this.findPointAtPosition(mouseX, mouseY);
    
    if (point) {
      this.selectedPoint = point;
      this.draw();
      
      if (this.onMovieClick) {
        this.onMovieClick(point);
      }
    } else {
      if (this.selectedPoint) {
        this.selectedPoint = null;
        this.draw();
      }
    }
  }

  /**
   * Get all available attributes for axis selection
   * @returns {Array} Array of {id, name} objects
   */
  static getAvailableAttributes() {
    return FILM_ATTRIBUTES.map(attr => ({
      id: attr.id,
      name: attr.name,
    }));
  }

  /**
   * Create axis dropdown controls
   * @param {HTMLElement} container - Container element for controls
   * @returns {Object} {xDropdown, yDropdown} elements
   */
  createAxisControls(container) {
    const attributes = ScatterPlot.getAvailableAttributes();
    
    // Create control wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'scatter-axis-controls';
    wrapper.style.cssText = 'display: flex; gap: 16px; margin-bottom: 12px;';
    
    // X-axis dropdown
    const xGroup = this.createDropdownGroup('X-Axis:', this.xAttribute, attributes, (value) => {
      this.setXAttribute(value);
    });
    
    // Y-axis dropdown
    const yGroup = this.createDropdownGroup('Y-Axis:', this.yAttribute, attributes, (value) => {
      this.setYAttribute(value);
    });
    
    wrapper.appendChild(xGroup.group);
    wrapper.appendChild(yGroup.group);
    container.appendChild(wrapper);
    
    return {
      xDropdown: xGroup.dropdown,
      yDropdown: yGroup.dropdown,
    };
  }

  /**
   * Create a labeled dropdown group
   */
  createDropdownGroup(labelText, currentValue, options, onChange) {
    const group = document.createElement('div');
    group.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    
    const label = document.createElement('label');
    label.textContent = labelText;
    label.style.cssText = 'color: #ccc; font-size: 14px;';
    
    const dropdown = document.createElement('select');
    dropdown.style.cssText = `
      background: #2a2a3e;
      color: #fff;
      border: 1px solid #444;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 14px;
      cursor: pointer;
    `;
    
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.id;
      option.textContent = opt.name;
      if (opt.id === currentValue) {
        option.selected = true;
      }
      dropdown.appendChild(option);
    });
    
    dropdown.addEventListener('change', (e) => {
      onChange(e.target.value);
    });
    
    group.appendChild(label);
    group.appendChild(dropdown);
    
    return { group, dropdown };
  }

  /**
   * Create a legend for the chart
   * @param {HTMLElement} container - Container element for legend
   */
  createLegend(container) {
    const legend = document.createElement('div');
    legend.className = 'scatter-legend';
    legend.style.cssText = `
      display: flex;
      gap: 20px;
      margin-top: 12px;
      justify-content: center;
    `;
    
    const items = [
      { color: this.config.ratedColor, label: 'Rated Movies' },
      { color: this.config.unratedColor, label: 'Unrated Movies' },
      { color: this.config.userColor, label: 'Your Position' },
    ];
    
    items.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.style.cssText = 'display: flex; align-items: center; gap: 6px;';
      
      const dot = document.createElement('span');
      dot.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: ${item.color};
        border: 1px solid rgba(255,255,255,0.5);
      `;
      
      const label = document.createElement('span');
      label.textContent = item.label;
      label.style.cssText = 'color: #ccc; font-size: 12px;';
      
      itemEl.appendChild(dot);
      itemEl.appendChild(label);
      legend.appendChild(itemEl);
    });
    
    container.appendChild(legend);
    return legend;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default ScatterPlot;
