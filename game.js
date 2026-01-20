import { GAME_WIDTH, GAME_HEIGHT, PLAYER_SPEED, JUMP_VELOCITY } from './config.js';
import { TasteMapAPI } from './apiClient.js';

// API Integration State
let tasteProfile = null;
let recommendations = [];
let apiHealthy = false;

/**
 * Check API health on app initialization
 * Shows status banner to user
 */
async function checkAPIHealth() {
    try {
        const health = await TasteMapAPI.checkHealth();
        apiHealthy = health.status === 'ok';
        console.log('✓ API connected:', health);
        showToast('Connected to TasteMap API', 'success');
        return true;
    } catch (error) {
        console.error('✗ API health check failed:', error);
        apiHealthy = false;
        showToast('Unable to connect to API. Working in offline mode.', 'error');
        return false;
    }
}

/**
 * Load taste profile from API
 * Displays profile visualization if it exists
 */
async function loadTasteProfile() {
    if (!apiHealthy) {
        console.log('Skipping profile load - API offline');
        return null;
    }

    try {
        showLoadingState('profile-display', true);
        const profile = await TasteMapAPI.getTasteProfile();
        tasteProfile = profile;

        // Render profile visualization
        renderTasteProfile(profile);
        console.log('Loaded taste profile:', profile);
        return profile;
    } catch (error) {
        // 404 means no profile exists yet
        if (error.message.includes('404') || error.message.includes('not found')) {
            console.log('No taste profile found - user needs to import data');
            showImportPrompt();
        } else {
            console.error('Error loading taste profile:', error);
            showToast('Failed to load taste profile', 'error');
        }
        return null;
    } finally {
        showLoadingState('profile-display', false);
    }
}

/**
 * Load recommendations from API with optional filters
 * @param {Object} filters - Optional filters {mood, genre, era, count}
 */
async function loadRecommendations(filters = {}) {
    if (!apiHealthy) {
        console.log('Skipping recommendations load - API offline');
        return [];
    }

    try {
        showLoadingState('loading-recommendations', true);

        const result = await TasteMapAPI.getRecommendations({
            count: 10,
            ...filters,
        });

        recommendations = result.recommendations || [];

        // Render recommendations for canvas display
        renderRecommendations(result);

        console.log(`Loaded ${recommendations.length} recommendations`, result);
        return recommendations;
    } catch (error) {
        if (error.message.includes('No taste profile')) {
            console.log('Cannot load recommendations - need taste profile first');
            showImportPrompt();
        } else {
            console.error('Error loading recommendations:', error);
            showToast('Failed to load recommendations', 'error');
        }
        return [];
    } finally {
        showLoadingState('loading-recommendations', false);
    }
}

/**
 * Import IMDB data from user's JSON file
 * @param {File} file - JSON file from IMDB export
 */
async function importIMDBData(file) {
    if (!apiHealthy) {
        showToast('Cannot import - API offline', 'error');
        return;
    }

    // Get import key from user
    const importKey = prompt(
        'Enter import key (contact admin if you don\'t have one):\n\nThis key authenticates your import request.'
    );

    if (!importKey) {
        showToast('Import cancelled', 'info');
        return;
    }

    try {
        // Read file
        const text = await file.text();
        const imdbData = JSON.parse(text);

        if (!Array.isArray(imdbData)) {
            throw new Error('Invalid IMDB JSON format - expected an array');
        }

        console.log(`Starting import of ${imdbData.length} movies...`);
        showToast(`Importing ${imdbData.length} movies...`, 'info');

        // Show progress UI
        const progressDiv = document.getElementById('import-progress');
        const progressText = document.getElementById('import-progress-text');
        if (progressDiv) {
            progressDiv.style.display = 'block';
            progressText.textContent = `Importing ${imdbData.length} movies...`;
        }

        // Send to API
        const summary = await TasteMapAPI.importMovies(imdbData, importKey);

        console.log('Import complete:', summary);

        // Hide progress
        if (progressDiv) progressDiv.style.display = 'none';

        // Show success message
        showToast(
            `Import complete! ${summary.successful}/${summary.total_processed} movies imported (${summary.enriched_with_tmdb} enriched with TMDB data)`,
            'success'
        );

        // Calculate taste profile automatically
        await calculateAndDisplayProfile();

        // Load initial recommendations
        await loadRecommendations();
    } catch (error) {
        console.error('Import failed:', error);

        const progressDiv = document.getElementById('import-progress');
        if (progressDiv) progressDiv.style.display = 'none';

        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            showToast('Import failed: Invalid import key', 'error');
        } else if (error.message.includes('JSON')) {
            showToast('Import failed: Invalid JSON file', 'error');
        } else {
            showToast(`Import failed: ${error.message}`, 'error');
        }
    }
}

/**
 * Calculate taste profile using AI and display results
 */
async function calculateAndDisplayProfile() {
    if (!apiHealthy) return;

    try {
        showToast('Analyzing your taste profile...', 'info');
        const profile = await TasteMapAPI.calculateTasteProfile();
        tasteProfile = profile;
        renderTasteProfile(profile);
        showToast('Taste profile updated!', 'success');
    } catch (error) {
        console.error('Profile calculation failed:', error);
        if (error.message.includes('Insufficient data')) {
            showToast('Need at least 20 rated movies to calculate profile', 'error');
        } else {
            showToast('Failed to calculate taste profile', 'error');
        }
    }
}

/**
 * Render taste profile visualization
 * @param {Object} profile - Taste profile data
 */
function renderTasteProfile(profile) {
    const container = document.getElementById('profile-display');
    if (!container) return;

    container.innerHTML = `
        <div class="profile-card">
            <h3>Your Film DNA</h3>
            <div class="profile-stats">
                <span>Sample Size: ${profile.sample_size} movies</span>
                <span>Confidence: ${(profile.confidence * 100).toFixed(0)}%</span>
            </div>
            
            <div class="profile-section">
                <h4>Top Genres</h4>
                <div class="genre-tags">
                    ${Object.entries(profile.genres)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([genre, score]) => `<span class="tag">${genre} (${(score * 100).toFixed(0)}%)</span>`)
                        .join('')}
                </div>
            </div>
            
            <div class="profile-section">
                <h4>Favorite Eras</h4>
                <div class="era-tags">
                    ${Object.entries(profile.eras)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([era, score]) => `<span class="tag">${era} (${(score * 100).toFixed(0)}%)</span>`)
                        .join('')}
                </div>
            </div>
            
            <div class="profile-section">
                <h4>Key Themes</h4>
                <div class="theme-tags">
                    ${profile.themes.map((theme) => `<span class="tag">${theme}</span>`).join('')}
                </div>
            </div>
            
            <div class="profile-section">
                <h4>Runtime Preference</h4>
                <p>${profile.runtime_preference} films</p>
            </div>
        </div>
    `;
}

/**
 * Render recommendations display
 * @param {Object} result - Recommendations result from API
 */
function renderRecommendations(result) {
    const container = document.getElementById('recommendations-display');
    if (!container) return;

    if (!result.recommendations || result.recommendations.length === 0) {
        container.innerHTML = '<p class="empty-state">No recommendations available yet.</p>';
        return;
    }

    const cached = result.cached ? ' (cached)' : '';
    const aiPowered = result.ai_powered ? '🤖 AI-powered' : '🧮 Algorithm-based';

    container.innerHTML = `
        <div class="recommendations-header">
            <span class="badge">${aiPowered}</span>
            <span class="badge">${result.recommendations.length} recommendations${cached}</span>
        </div>
        <div class="recommendations-grid">
            ${result.recommendations
                .map(
                    (rec) => `
                <div class="recommendation-card">
                    <div class="rec-header">
                        <h4>${rec.movie.title} (${rec.movie.year})</h4>
                        <span class="match-score">${(rec.match_score * 100).toFixed(0)}% match</span>
                    </div>
                    <p class="rec-reasoning">${rec.reasoning}</p>
                    ${rec.movie.genres ? `<div class="rec-genres">${JSON.parse(rec.movie.genres).join(', ')}</div>` : ''}
                </div>
            `
                )
                .join('')}
        </div>
    `;
}

/**
 * Show import prompt to user
 */
function showImportPrompt() {
    const container = document.getElementById('profile-display');
    if (container) {
        container.innerHTML = `
            <div class="empty-state-card">
                <h3>📥 Import Your IMDB Ratings</h3>
                <p>To get started, import your IMDB ratings data.</p>
                <ol>
                    <li>Go to IMDB → Your Ratings & Reviews</li>
                    <li>Export as JSON</li>
                    <li>Upload the file below</li>
                </ol>
                <button id="trigger-import-btn" class="btn btn-primary">Choose File</button>
            </div>
        `;

        document.getElementById('trigger-import-btn')?.addEventListener('click', () => {
            document.getElementById('import-file-input')?.click();
        });
    }
}

/**
 * Show loading state for a container
 * @param {string} elementId - Element ID to show loading state
 * @param {boolean} loading - Whether to show loading
 */
function showLoadingState(elementId, loading) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = loading ? 'block' : 'none';
    }
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type: 'success', 'error', 'info'
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Phaser Game Scene (kept for future canvas visualization)
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.player = null;
        this.cursors = null;
    }

    preload() {
        // Using a simple rectangle as a placeholder sprite
        this.load.image('player', 'https://via.placeholder.com/32x48/88aaff/000000?text=P');
        this.load.image('ground', 'https://via.placeholder.com/800x32/444444/000000?text=');
    }

    create() {
        console.log('Game initialized!');

        // API Integration Point: Load data for canvas visualization
        if (recommendations.length > 0) {
            console.log(`Canvas has ${recommendations.length} movies to visualize`);
        }

        const ground = this.physics.add.staticImage(GAME_WIDTH / 2, GAME_HEIGHT - 16, 'ground');

        // Create a placeholder player
        this.player = this.physics.add.sprite(100, 450, 'player');
        this.player.setBounce(0.2);
        this.player.setCollideWorldBounds(true);

        this.physics.add.collider(this.player, ground);

        // Setup input handling
        this.cursors = this.input.keyboard.createCursorKeys();
    }

    update() {
        if (!this.player || !this.cursors) return;

        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-PLAYER_SPEED);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(PLAYER_SPEED);
        } else {
            this.player.setVelocityX(0);
        }

        if (this.cursors.up.isDown && this.player.body.touching.down) {
            this.player.setVelocityY(JUMP_VELOCITY);
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false,
        },
    },
    scene: [GameScene],
};

// Initialize app
async function initApp() {
    // Check API health
    await checkAPIHealth();

    // Load taste profile if available
    await loadTasteProfile();

    // Load initial recommendations
    await loadRecommendations();

    // Initialize Phaser game (for future canvas visualization)
    const game = new Phaser.Game(config);
}

// Wire up file upload
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('import-file-input');
    const importBtn = document.getElementById('import-data-btn');

    if (importBtn) {
        importBtn.addEventListener('click', () => fileInput?.click());
    }

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (file) {
                await importIMDBData(file);
                fileInput.value = ''; // Reset input
            }
        });
    }

    // Initialize the app
    initApp();
});

// Export functions for external use
export { loadTasteProfile, loadRecommendations, importIMDBData, calculateAndDisplayProfile };