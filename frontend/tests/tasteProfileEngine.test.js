import { MOVIE_MAP, SAMPLE_MOVIES } from '../filmAttributes.js';
import { calculateCosineSimilarity, calculateTasteProfile, findSimilarMovies, getNeutralProfile } from '../tasteProfileEngine.js';

describe('Taste Profile Engine', () => {
  test('calculateTasteProfile returns neutral profile for empty ratings', () => {
    const profile = calculateTasteProfile([], MOVIE_MAP);
    const neutral = getNeutralProfile();
    expect(profile).toEqual(neutral);
  });

  test('calculateTasteProfile calculates weighted average correctly', () => {
    // Mad Max (movie-1): action: 0.95, drama: 0.4
    // Superbad (movie-3): action: 0.3, comedy: 0.95
    const ratings = [
      { movieId: 'movie-1', score: 5 },
      { movieId: 'movie-3', score: 1 }
    ];
    
    const profile = calculateTasteProfile(ratings, MOVIE_MAP);
    
    // Weighted Average for action: (0.95 * 5 + 0.3 * 1) / (5 + 1) = (4.75 + 0.3) / 6 = 5.05 / 6 ≈ 0.84166
    expect(profile.action).toBeCloseTo(0.842, 3);
    // Weighted Average for drama: (0.4 * 5 + 0.4 * 1) / 6 = 2.4 / 6 = 0.4
    expect(profile.drama).toBeCloseTo(0.4, 3);
  });

  test('calculateCosineSimilarity measures vector similarity', () => {
    const profileA = { action: 1, drama: 0, comedy: 0, dark: 0, uplifting: 0, artistic: 0 };
    const profileB = { action: 1, drama: 0, comedy: 0, dark: 0, uplifting: 0, artistic: 0 };
    const profileC = { action: 0, drama: 1, comedy: 0, dark: 0, uplifting: 0, artistic: 0 };
    
    expect(calculateCosineSimilarity(profileA, profileB)).toBeCloseTo(1.0);
    expect(calculateCosineSimilarity(profileA, profileC)).toBeCloseTo(0.0);
  });

  test('findSimilarMovies returns top matching movies', () => {
    // High action profile
    const profile = { action: 0.9, drama: 0.2, comedy: 0.1, dark: 0.5, uplifting: 0.5, artistic: 0.5 };
    const matches = findSimilarMovies(profile, SAMPLE_MOVIES, 2);
    
    expect(matches.length).toBe(2);
    // Mad Max (movie-1) or John Wick (movie-9) should be top
    expect(['movie-1', 'movie-9']).toContain(matches[0].movie.id);
    expect(matches[0].similarity).toBeGreaterThan(matches[1].similarity);
  });

  test('findSimilarMovies handles exclusions', () => {
    const profile = { action: 0.9, drama: 0.2, comedy: 0.1, dark: 0.5, uplifting: 0.5, artistic: 0.5 };
    const matches = findSimilarMovies(profile, SAMPLE_MOVIES, 5, ['movie-1', 'movie-9']);
    
    const ids = matches.map(m => m.movie.id);
    expect(ids).not.toContain('movie-1');
    expect(ids).not.toContain('movie-9');
  });

  test('findSimilarMovies handles neutral profile with attribute strength', () => {
    const neutral = getNeutralProfile();
    const matches = findSimilarMovies(neutral, SAMPLE_MOVIES, 3);
    
    expect(matches.length).toBe(3);
    // Movies with strong attributes (Blade Runner 2049, Mad Max, etc) should be ranked higher than neutral ones
    expect(matches[0].similarity).toBeGreaterThan(0);
  });
});
