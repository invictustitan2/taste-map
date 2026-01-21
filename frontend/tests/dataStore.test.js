
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  clear() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
}

global.localStorage = new MockLocalStorage();

// Mock global console to avoid cluttering test output
// global.console = { ...console, log: jest.fn() };

const { UserDataStore } = await import('../dataStore.js');

describe('UserDataStore', () => {
  let store;

  beforeEach(() => {
    localStorage.clear();
    store = new UserDataStore('test-user');
  });

  test('addRating stores rating and persists to localStorage', () => {
    const result = store.addRating('movie-1', 5);
    expect(result.success).toBe(true);
    expect(store.ratings.has('movie-1')).toBe(true);
    
    const stored = JSON.parse(localStorage.getItem('tastemap-user-data'));
    expect(stored.ratings.length).toBe(1);
    expect(stored.ratings[0].movieId).toBe('movie-1');
  });

  test('getRatings returns all user ratings', () => {
    store.addRating('movie-1', 5);
    store.addRating('movie-2', 4);
    
    const result = store.getRatings();
    expect(result.data.length).toBe(2);
  });

  test('deleteRating removes rating from store and persistence', () => {
    store.addRating('movie-1', 5);
    store.deleteRating('movie-1');
    
    expect(store.ratings.has('movie-1')).toBe(false);
    const stored = JSON.parse(localStorage.getItem('tastemap-user-data'));
    expect(stored.ratings.length).toBe(0);
  });

  test('getTasteProfile calculates profile from ratings', () => {
    store.addRating('movie-1', 5); // Mad Max: action 0.95
    store.addRating('movie-3', 1); // Superbad: action 0.3
    
    const profileResult = store.getTasteProfile();
    expect(profileResult.success).toBe(true);
    // (0.95 * 5 + 0.3 * 1) / 6 = 0.84166...
    expect(profileResult.data.action).toBeCloseTo(0.8416, 3);
  });

  test('load() reconstructs ratings from localStorage on initialization', () => {
    // Manually seed localStorage
    const data = {
      ratings: [
        { movieId: 'movie-1', userId: 'test-user', score: 5, timestamp: Date.now() },
        { movieId: 'movie-2', userId: 'other-user', score: 3, timestamp: Date.now() }
      ]
    };
    localStorage.setItem('tastemap-user-data', JSON.stringify(data));
    
    const newStore = new UserDataStore('test-user');
    expect(newStore.ratings.has('movie-1')).toBe(true);
    expect(newStore.ratings.has('movie-2')).toBe(false); // Different user
  });
});
