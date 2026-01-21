import { jest } from '@jest/globals';

// Mock TMDB enrichment before importing the module that uses it
jest.unstable_mockModule('../src/tmdb.js', () => ({
  enrichMovieData: jest.fn()
}));

// Use dynamic imports for modules that depend on the mock
const { processImdbImport } = await import('../src/import.js');
const tmdb = await import('../src/tmdb.js');

describe('Movie Import Logic', () => {
  let db;

  beforeAll(async () => {
    db = await global.mf.getD1Database('DB');
  });

  beforeEach(async () => {
    // Clear movies table before each test
    await db.prepare('DELETE FROM movies').run();
    jest.clearAllMocks();
  });

  test('processImdbImport successfully imports a valid movie', async () => {
    const imdbData = [
      {
        Const: 'tt0111161',
        Title: 'The Shawshank Redemption',
        Year: 1994,
        'Runtime (mins)': 142,
        Genres: 'Drama',
        Directors: 'Frank Darabont',
        'Your Rating': 10,
        'Date Rated': '2023-01-01',
        'IMDb Rating': 9.3,
        'Num Votes': 2345678
      }
    ];

    tmdb.enrichMovieData.mockResolvedValue({
      tmdb_id: 278,
      poster_path: '/path/to/poster.jpg',
      backdrop_path: '/path/to/backdrop.jpg',
      overview: 'Two imprisoned men bond over a number of years...',
      vote_average: 8.7,
      vote_count: 21815,
      genres: ['Drama'],
      director: 'Frank Darabont',
      cast: ['Tim Robbins', 'Morgan Freeman'],
      keywords: ['prison', 'hope', 'friendship']
    });

    const results = await processImdbImport(imdbData, db, 'fake-api-key');

    expect(results.successful).toBe(1);
    expect(results.failed).toBe(0);
    expect(results.skipped).toBe(0);

    // Verify database record
    const movie = await db.prepare('SELECT * FROM movies WHERE imdb_id = ?').bind('tt0111161').first();
    expect(movie.title).toBe('The Shawshank Redemption');
    expect(movie.tmdb_id).toBe(278);
    expect(movie.poster_path).toBe('/path/to/poster.jpg');
    expect(JSON.parse(movie.cast)).toContain('Tim Robbins');
  });

  test('processImdbImport skips existing movies', async () => {
    const imdbData = [
      {
        Const: 'tt0111161',
        Title: 'The Shawshank Redemption',
        Year: 1994
      }
    ];

    // Pre-insert the movie
    await db.prepare('INSERT INTO movies (imdb_id, title, year) VALUES (?, ?, ?)')
      .bind('tt0111161', 'The Shawshank Redemption', 1994)
      .run();

    const results = await processImdbImport(imdbData, db, null);

    expect(results.successful).toBe(0);
    expect(results.skipped).toBe(1);
  });

  test('processImdbImport handles invalid movie data', async () => {
    const imdbData = [
      {
        // Missing Const and Year
        Title: 'Invalid Movie'
      }
    ];

    const results = await processImdbImport(imdbData, db, null);

    expect(results.successful).toBe(0);
    expect(results.failed).toBe(1);
    expect(results.errors[0].error).toContain('Missing required fields');
  });

  test('processImdbImport continues on TMDB enrichment failure', async () => {
    const imdbData = [
      {
        Const: 'tt0111161',
        Title: 'The Shawshank Redemption',
        Year: 1994
      }
    ];

    tmdb.enrichMovieData.mockRejectedValue(new Error('TMDB API Down'));

    const results = await processImdbImport(imdbData, db, 'fake-api-key');

    expect(results.successful).toBe(1);
    expect(results.failed).toBe(0);
    
    // Verify it still imported the basic data
    const movie = await db.prepare('SELECT * FROM movies WHERE imdb_id = ?').bind('tt0111161').first();
    expect(movie.title).toBe('The Shawshank Redemption');
    expect(movie.tmdb_id).toBeNull();
  });
});
