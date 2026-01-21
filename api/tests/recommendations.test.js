import { jest } from '@jest/globals';

const { generateRecommendations } = await import('../src/recommendations.js');

describe('Recommendation Engine', () => {
  let db;
  let mockAi;

  beforeAll(async () => {
    db = await global.mf.getD1Database('DB');
  });

  beforeEach(async () => {
    await db.prepare('DELETE FROM movies').run();
    await db.prepare('DELETE FROM taste_profile').run();
    await db.prepare('DELETE FROM recommendations').run();
    
    mockAi = {
      run: jest.fn().mockImplementation((model, { messages }) => {
        const prompt = messages[0].content;
        const recommendations = [];
        
        // Simple logic to mock AI choosing from the prompt's movie list
        if (prompt.includes('Future War')) {
          recommendations.push({ imdb_id: 'tt0000001', match_score: 0.95, reasoning: 'Matches your love for Sci-Fi' });
        }
        if (prompt.includes('Blast Off')) {
          recommendations.push({ imdb_id: 'tt0000002', match_score: 0.90, reasoning: 'Action-packed like your favorites' });
        }
        if (prompt.includes('Slow Drama')) {
          recommendations.push({ imdb_id: 'tt0000003', match_score: 0.75, reasoning: 'A different pace but solid drama' });
        }
        
        return Promise.resolve({ 
          response: JSON.stringify(recommendations.slice(0, 2))
        });
      })
    };
  });

  async function seedProfile() {
    await db.prepare(`
      INSERT INTO taste_profile (dimension_name, dimension_value, sample_size, metadata)
      VALUES ('genre', 'Sci-Fi', 25, '{"score": 0.9}'),
             ('genre', 'Action', 25, '{"score": 0.8}'),
             ('runtime_preference', 'medium', 25, '{"confidence": 0.85}')
    `).run();
  }

  async function seedUnratedMovies() {
    await db.prepare(`
      INSERT INTO movies (imdb_id, title, year, genres, tmdb_rating, user_rating)
      VALUES ('tt0000001', 'Future War', 2024, 'Sci-Fi, Action', 7.5, NULL),
             ('tt0000002', 'Blast Off', 2023, 'Action', 6.8, NULL),
             ('tt0000003', 'Slow Drama', 2022, 'Drama', 8.2, NULL)
    `).run();
  }

  test('generateRecommendations returns error if no profile found', async () => {
    const result = await generateRecommendations(db, mockAi);
    expect(result.error).toContain('No taste profile found');
  });

  test('generateRecommendations successfully uses AI logic', async () => {
    await seedProfile();
    await seedUnratedMovies();

    const result = await generateRecommendations(db, mockAi);

    expect(result.recommendations.length).toBe(2);
    expect(result.recommendations[0].movie.title).toBe('Future War');
    expect(result.recommendations[0].reasoning).toContain('Matches your love for Sci-Fi');
    expect(result.cached).toBe(false);

    // Verify it was cached
    const cached = await db.prepare("SELECT * FROM recommendations").first();
    expect(cached).toBeDefined();
    expect(cached.context).toBe('any_any_any');
  });

  test('generateRecommendations uses fallback when AI fails', async () => {
    await seedProfile();
    await seedUnratedMovies();
    mockAi.run.mockRejectedValue(new Error('AI Busy'));

    const result = await generateRecommendations(db, mockAi);

    expect(result.recommendations.length).toBe(3); // All matches by fallback
    expect(result.recommendations[0].reasoning).toContain('genre preferences'); // Fixed expectation
  });

  test('generateRecommendations applies genre filters', async () => {
    await seedProfile();
    await seedUnratedMovies();

    const result = await generateRecommendations(db, mockAi, { genre_filter: ['Drama'] });

    expect(result.recommendations.length).toBe(1);
    expect(result.recommendations[0].movie.title).toBe('Slow Drama');
  });

  test('generateRecommendations returns cached results', async () => {
    await seedProfile();
    await seedUnratedMovies();

    // First call to populate cache
    await generateRecommendations(db, mockAi);
    
    // Second call should hit cache
    const result = await generateRecommendations(db, mockAi);
    expect(result.cached).toBe(true);
    expect(mockAi.run).toHaveBeenCalledTimes(1);
  });
});
