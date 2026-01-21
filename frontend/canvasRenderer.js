/**
 * Canvas Renderer Module
 * Provides canvas-based chart rendering with DPI scaling and animations
 */

// ============================================================================
// ChartRenderer Base Class
// ============================================================================

/**
 * Base class for canvas chart rendering
 * Handles canvas context management, DPI scaling, and resize events
 */
export class ChartRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dpr = window.devicePixelRatio || 1;
    
    // Animation state
    this.animationFrame = null;
    this.isAnimating = false;
    
    // Initialize
    this.setupCanvas();
    this.setupResizeObserver();
  }

  /**
   * Setup canvas with proper DPI scaling
   */
  setupCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    
    // Set display size (CSS pixels)
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    
    // Set actual size in memory (scaled for DPI)
    this.width = rect.width * this.dpr;
    this.height = rect.height * this.dpr;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    
    // Scale context to match DPI
    this.ctx.scale(this.dpr, this.dpr);
    
    console.log('[ChartRenderer] Canvas setup:', {
      displaySize: { width: rect.width, height: rect.height },
      actualSize: { width: this.width, height: this.height },
      dpr: this.dpr,
    });
  }

  /**
   * Setup resize observer to handle canvas resizing
   */
  setupResizeObserver() {
    if (typeof ResizeObserver === 'undefined') {
      // Fallback to window resize event
      window.addEventListener('resize', () => this.handleResize());
      return;
    }
    
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    
    this.resizeObserver.observe(this.canvas);
  }

  /**
   * Handle canvas resize
   */
  handleResize() {
    this.setupCanvas();
    this.draw();
  }

  /**
   * Clear canvas
   */
  clear() {
    const displayWidth = this.width / this.dpr;
    const displayHeight = this.height / this.dpr;
    this.ctx.clearRect(0, 0, displayWidth, displayHeight);
  }

  /**
   * Draw method (to be overridden by subclasses)
   */
  draw() {
    // Override in subclass
  }

  /**
   * Start animation loop
   */
  startAnimation(callback) {
    if (this.isAnimating) return;
    
    this.isAnimating = true;
    const animate = (timestamp) => {
      if (!this.isAnimating) return;
      
      callback(timestamp);
      this.animationFrame = requestAnimationFrame(animate);
    };
    
    this.animationFrame = requestAnimationFrame(animate);
  }

  /**
   * Stop animation loop
   */
  stopAnimation() {
    this.isAnimating = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopAnimation();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}

// ============================================================================
// RadarChart Class
// ============================================================================

/**
 * Radar/Spider chart for visualizing multi-dimensional data
 * Perfect for displaying taste profiles across multiple attributes
 */
export class RadarChart extends ChartRenderer {
  constructor(canvasElement, attributes = []) {
    super(canvasElement);
    
    this.attributes = attributes;
    this.data = {};
    this.targetData = {};
    this.hoveredIndex = -1;
    
    // Visual configuration
    this.config = {
      // Colors (matching site theme)
      backgroundColor: '#1a1a2e',
      axisColor: 'rgba(255, 255, 255, 0.2)',
      gridColor: 'rgba(255, 255, 255, 0.1)',
      labelColor: '#ccc',
      fillColor: 'rgba(78, 205, 196, 0.3)',
      strokeColor: 'rgba(78, 205, 196, 0.8)',
      pointColor: '#4ecdc4',
      hoverColor: 'rgba(78, 205, 196, 1.0)',
      
      // Dimensions
      padding: 60,
      gridLevels: 5,
      maxRadius: 0, // Calculated based on canvas size
      
      // Animation
      animationDuration: 500, // ms
      easing: 'easeOutCubic',
    };
    
    // Animation state
    this.animationStart = null;
    this.animationProgress = 1;
    
    // Setup mouse events
    this.setupMouseEvents();
    
    // Initial draw
    this.draw();
  }

  /**
   * Update chart data with animation
   * @param {Object} profile - Profile data {attributeName: 0-1}
   */
  updateData(profile) {
    // Store target data
    this.targetData = { ...profile };
    
    // If no current data, initialize without animation
    if (Object.keys(this.data).length === 0) {
      this.data = { ...profile };
      this.draw();
      return;
    }
    
    // Start animation
    this.startDataAnimation();
  }

  /**
   * Start smooth animation to new data
   */
  startDataAnimation() {
    this.animationStart = performance.now();
    this.animationProgress = 0;
    
    const initialData = { ...this.data };
    
    const animate = (timestamp) => {
      const elapsed = timestamp - this.animationStart;
      this.animationProgress = Math.min(elapsed / this.config.animationDuration, 1);
      
      // Apply easing
      const easedProgress = this.easeOutCubic(this.animationProgress);
      
      // Interpolate data
      this.attributes.forEach(attr => {
        const start = initialData[attr] || 0;
        const end = this.targetData[attr] || 0;
        this.data[attr] = start + (end - start) * easedProgress;
      });
      
      this.draw();
      
      if (this.animationProgress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }

  /**
   * Easing function for smooth animation
   */
  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Main draw method
   */
  draw() {
    this.clear();
    
    const displayWidth = this.width / this.dpr;
    const displayHeight = this.height / this.dpr;
    const centerX = displayWidth / 2;
    const centerY = displayHeight / 2;
    
    // Calculate max radius based on canvas size
    this.config.maxRadius = Math.min(displayWidth, displayHeight) / 2 - this.config.padding;
    
    // Draw background
    this.drawBackground(displayWidth, displayHeight);
    
    // Draw grid circles
    this.drawGrid(centerX, centerY);
    
    // Draw axes
    this.drawAxes(centerX, centerY);
    
    // Draw data polygon
    this.drawDataPolygon(centerX, centerY);
    
    // Draw labels
    this.drawLabels(centerX, centerY);
    
    // Draw hover tooltip
    if (this.hoveredIndex >= 0) {
      this.drawTooltip(centerX, centerY);
    }
  }

  /**
   * Draw background
   */
  drawBackground(width, height) {
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, width, height);
  }

  /**
   * Draw grid circles
   */
  drawGrid(centerX, centerY) {
    this.ctx.strokeStyle = this.config.gridColor;
    this.ctx.lineWidth = 1;
    
    for (let i = 1; i <= this.config.gridLevels; i++) {
      const radius = (this.config.maxRadius / this.config.gridLevels) * i;
      
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  /**
   * Draw axes radiating from center
   */
  drawAxes(centerX, centerY) {
    this.ctx.strokeStyle = this.config.axisColor;
    this.ctx.lineWidth = 1;
    
    const angleStep = (Math.PI * 2) / this.attributes.length;
    
    this.attributes.forEach((_, index) => {
      const angle = angleStep * index - Math.PI / 2; // Start from top
      const endX = centerX + Math.cos(angle) * this.config.maxRadius;
      const endY = centerY + Math.sin(angle) * this.config.maxRadius;
      
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();
    });
  }

  /**
   * Draw data polygon
   */
  drawDataPolygon(centerX, centerY) {
    if (this.attributes.length === 0) return;
    
    const angleStep = (Math.PI * 2) / this.attributes.length;
    const points = [];
    
    // Calculate points
    this.attributes.forEach((attr, index) => {
      const value = this.data[attr] || 0;
      const angle = angleStep * index - Math.PI / 2;
      const radius = value * this.config.maxRadius;
      
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      points.push({ x, y, value, angle });
    });
    
    // Draw filled polygon
    this.ctx.fillStyle = this.config.fillColor;
    this.ctx.strokeStyle = this.config.strokeColor;
    this.ctx.lineWidth = 2;
    
    this.ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        this.ctx.moveTo(point.x, point.y);
      } else {
        this.ctx.lineTo(point.x, point.y);
      }
    });
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    // Draw points
    points.forEach((point, index) => {
      const isHovered = index === this.hoveredIndex;
      this.ctx.fillStyle = isHovered ? this.config.hoverColor : this.config.pointColor;
      
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, isHovered ? 6 : 4, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Add white border for better visibility
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    });
  }

  /**
   * Draw attribute labels
   */
  drawLabels(centerX, centerY) {
    this.ctx.fillStyle = this.config.labelColor;
    this.ctx.font = 'bold 12px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    const angleStep = (Math.PI * 2) / this.attributes.length;
    const labelDistance = this.config.maxRadius + 30;
    
    this.attributes.forEach((attr, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const x = centerX + Math.cos(angle) * labelDistance;
      const y = centerY + Math.sin(angle) * labelDistance;
      
      // Highlight hovered label
      if (index === this.hoveredIndex) {
        this.ctx.fillStyle = this.config.hoverColor;
        this.ctx.font = 'bold 14px sans-serif';
      } else {
        this.ctx.fillStyle = this.config.labelColor;
        this.ctx.font = 'bold 12px sans-serif';
      }
      
      this.ctx.fillText(attr, x, y);
    });
  }

  /**
   * Draw hover tooltip
   */
  drawTooltip(centerX, centerY) {
    if (this.hoveredIndex < 0) return;
    
    const attr = this.attributes[this.hoveredIndex];
    const value = this.data[attr] || 0;
    const percentage = Math.round(value * 100);
    
    const angleStep = (Math.PI * 2) / this.attributes.length;
    const angle = angleStep * this.hoveredIndex - Math.PI / 2;
    const radius = value * this.config.maxRadius;
    
    const pointX = centerX + Math.cos(angle) * radius;
    const pointY = centerY + Math.sin(angle) * radius;
    
    // Tooltip text
    const text = `${attr}: ${percentage}%`;
    
    // Measure text
    this.ctx.font = 'bold 14px sans-serif';
    const metrics = this.ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = 20;
    
    // Tooltip position (above point)
    const tooltipX = pointX;
    const tooltipY = pointY - 20;
    
    // Draw tooltip background
    const padding = 8;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(
      tooltipX - textWidth / 2 - padding,
      tooltipY - textHeight / 2 - padding,
      textWidth + padding * 2,
      textHeight + padding * 2
    );
    
    // Draw tooltip border
    this.ctx.strokeStyle = this.config.hoverColor;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      tooltipX - textWidth / 2 - padding,
      tooltipY - textHeight / 2 - padding,
      textWidth + padding * 2,
      textHeight + padding * 2
    );
    
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
  }

  /**
   * Handle mouse move for hover effects
   */
  handleMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    const centerX = (this.width / this.dpr) / 2;
    const centerY = (this.height / this.dpr) / 2;
    
    const angleStep = (Math.PI * 2) / this.attributes.length;
    let closestIndex = -1;
    let closestDistance = Infinity;
    
    // Find closest point
    this.attributes.forEach((attr, index) => {
      const value = this.data[attr] || 0;
      const angle = angleStep * index - Math.PI / 2;
      const radius = value * this.config.maxRadius;
      
      const pointX = centerX + Math.cos(angle) * radius;
      const pointY = centerY + Math.sin(angle) * radius;
      
      const distance = Math.sqrt(
        Math.pow(mouseX - pointX, 2) + Math.pow(mouseY - pointY, 2)
      );
      
      if (distance < closestDistance && distance < 20) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    
    if (closestIndex !== this.hoveredIndex) {
      this.hoveredIndex = closestIndex;
      this.draw();
      
      // Update cursor
      this.canvas.style.cursor = closestIndex >= 0 ? 'pointer' : 'default';
    }
  }

  /**
   * Handle mouse leave
   */
  handleMouseLeave() {
    if (this.hoveredIndex >= 0) {
      this.hoveredIndex = -1;
      this.canvas.style.cursor = 'default';
      this.draw();
    }
  }

  /**
   * Update attributes list
   */
  setAttributes(attributes) {
    this.attributes = attributes;
    this.draw();
  }

  /**
   * Get current data
   */
  getData() {
    return { ...this.data };
  }
}

// ============================================================================
// Example Usage
// ============================================================================

/**
 * Example usage:
 * 
 * const canvas = document.getElementById('radar-chart');
 * const attributes = ['Action', 'Drama', 'Comedy', 'Dark', 'Uplifting', 'Artistic'];
 * const radar = new RadarChart(canvas, attributes);
 * 
 * // Update with profile data
 * const profile = {
 *   'Action': 0.8,
 *   'Drama': 0.6,
 *   'Comedy': 0.3,
 *   'Dark': 0.7,
 *   'Uplifting': 0.4,
 *   'Artistic': 0.9
 * };
 * radar.updateData(profile);
 * 
 * // Later, update with new data (will animate smoothly)
 * const newProfile = {
 *   'Action': 0.6,
 *   'Drama': 0.8,
 *   'Comedy': 0.5,
 *   'Dark': 0.5,
 *   'Uplifting': 0.7,
 *   'Artistic': 0.7
 * };
 * radar.updateData(newProfile);
 * 
 * // Cleanup when done
 * radar.destroy();
 */

// ============================================================================
// Exports
// ============================================================================

export default {
  ChartRenderer,
  RadarChart,
};
