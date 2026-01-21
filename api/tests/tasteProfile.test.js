import { jest } from '@jest/globals';

const { calculateTasteProfile } = await import('../src/tasteProfile.js');

describe('Taste Profile Calculation', () => {
  let db;
  let mockAi;

  beforeAll(async () => {
    db = await global.mf.getD1Database('DB');
  });

  beforeEach(async () => {
    await db.prepare('DELETE FROM movies').run();
    await db.prepare('DELETE FROM taste_profile').run();
    
    mockAi = {
      run: jest.fn().mockResolvedValue({ response: 'Sci-Fi, Space, Rebellion, Heroism, Destiny' })
    };
  });

  async function seedMovies(count, baseRating = 8) {
    const statements = [];
    for (let i = 0; i < count; i++) {
       statements.push(db.prepare(`
        INSERT INTO movies (imdb_id, title, year, runtime_minutes, genres, director, user_rating, plot_keywords)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `tt${i.toString().padStart(7, '0')}`,
        `Movie ${i}`,
        1990 + (i % 30),
        120,
        i % 2 === 0 ? 'Action, Sci-Fi' : 'Drama',
        'Director X',
        baseRating + (i % 3),
        JSON.stringify(['keyword1', 'keyword2'])
      ));
    }
    
    // Execute as batch if possible, or one by one
    for (const stmt of statements) {
      await stmt.run();
    }
  }

  test('calculateTasteProfile fails with insufficient data', async () => {
    await seedMovies(10); // Less than MIN_SAMPLE_SIZE (20)

    const result = await calculateTasteProfile(db, mockAi);
    expect(result.error).toContain('Insufficient data');
    expect(result.sample_size).toBe(10);
  });

  test('calculateTasteProfile successfully calculates profile with enough data', async () => {
    await seedMovies(25); // More than MIN_SAMPLE_SIZE

    const result = await calculateTasteProfile(db, mockAi);

    expect(result.sample_size).toBe(25);
    expect(result.genres).toBeDefined();
    expect(result.genres['Action']).toBeGreaterThan(0);
    expect(result.eras['2000s']).toBeDefined();
    expect(result.runtime_preference).toBe('medium'); // 120 mins
    expect(result.directors).toContain('Director X');
    expect(result.themes).toEqual(['sci-fi', 'space', 'rebellion', 'heroism', 'destiny']);
    expect(result.confidence).toBeGreaterThan(0);

    // Verify database storage
    const storedGenres = await db.prepare("SELECT * FROM taste_profile WHERE dimension_name = 'genre'").all();
    expect(storedGenres.results.length).toBeGreaterThan(0);
    
    const storedThemes = await db.prepare("SELECT * FROM taste_profile WHERE dimension_name = 'theme'").all();
    expect(storedThemes.results.length).toBe(5);
  });

  test('calculateTasteProfile handles AI failure gracefully', async () => {
    await seedMovies(25);
    mockAi.run.mockRejectedValue(new Error('AI Service Unavailable'));

    const result = await calculateTasteProfile(db, mockAi);

    expect(result.sample_size).toBe(25);
    expect(result.themes).toBeDefined();
    expect(result.themes.length).toBeGreaterThan(0); // Should fallback to keywords
  });
});
