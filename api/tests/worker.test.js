
describe('Worker API Integration', () => {
  let db;

  beforeAll(async () => {
    db = await global.mf.getD1Database('DB');
  });

  beforeEach(async () => {
    await db.prepare('DELETE FROM movies').run();
    await db.prepare('DELETE FROM taste_profile').run();
    await db.prepare('DELETE FROM recommendations').run();
  });

  test('GET /health returns ok', async () => {
    const response = await global.mf.dispatchFetch('http://localhost:8787/health');
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  test('POST /api/movies/import requires secret', async () => {
    const response = await global.mf.dispatchFetch('http://localhost:8787/api/movies/import', {
      method: 'POST',
      body: JSON.stringify([{ Const: 'tt123', Title: 'Test', Year: 2024 }]),
      headers: { 'Content-Type': 'application/json' }
    });
    expect(response.status).toBe(401);
  });

  test('GET /api/movies/search finds movies', async () => {
    await db.prepare("INSERT INTO movies (imdb_id, title, year) VALUES ('tt0111161', 'The Shawshank Redemption', 1994)").run();

    const response = await global.mf.dispatchFetch('http://localhost:8787/api/movies/search?q=Shawshank');
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.movies[0].title).toBe('The Shawshank Redemption');
  });

  test('GET /api/movies/:id returns movie details', async () => {
    await db.prepare("INSERT INTO movies (imdb_id, title, year) VALUES ('tt0111161', 'The Shawshank Redemption', 1994)").run();

    const response = await global.mf.dispatchFetch('http://localhost:8787/api/movies/tt0111161');
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.title).toBe('The Shawshank Redemption');
  });

  test('POST /api/taste-profile handles lack of AI binding or data', async () => {
    for (let i = 0; i < 20; i++) {
      await db.prepare("INSERT INTO movies (imdb_id, title, year, user_rating) VALUES (?, ?, ?, ?)")
        .bind(`tt${i.toString().padStart(7, '0')}`, `Movie ${i}`, 2000, 8).run();
    }

    const response = await global.mf.dispatchFetch('http://localhost:8787/api/taste-profile', {
      method: 'POST'
    });
    
    expect([200, 500]).toContain(response.status);
  });

  test('GET /api/recommendations returns list (with fallback)', async () => {
    // Seed full profile
    await db.prepare("INSERT INTO taste_profile (dimension_name, dimension_value, sample_size, metadata) VALUES (?, ?, ?, ?)").bind('genre', 'Sci-Fi', 20, '{"score":0.9}').run();
    await db.prepare("INSERT INTO taste_profile (dimension_name, dimension_value, sample_size, metadata) VALUES (?, ?, ?, ?)").bind('genre', 'Action', 20, '{"score":0.8}').run();
    await db.prepare("INSERT INTO taste_profile (dimension_name, dimension_value, sample_size, metadata) VALUES (?, ?, ?, ?)").bind('era', '2000s', 20, '{"score":0.7}').run();
    await db.prepare("INSERT INTO taste_profile (dimension_name, dimension_value, sample_size, metadata) VALUES (?, ?, ?, ?)").bind('theme', 'space', 20, '{"rank":1}').run();
    await db.prepare("INSERT INTO taste_profile (dimension_name, dimension_value, sample_size, metadata) VALUES (?, ?, ?, ?)").bind('director', 'James Cameron', 20, '{"rank":1}').run();
    await db.prepare("INSERT INTO taste_profile (dimension_name, dimension_value, sample_size, metadata) VALUES (?, ?, ?, ?)").bind('runtime_preference', 'medium', 20, '{"confidence":0.8}').run();

    await db.prepare("INSERT INTO movies (imdb_id, title, year, genres) VALUES ('tt9999999', 'Rec Movie', 2024, 'Sci-Fi')").run();

    const response = await global.mf.dispatchFetch('http://localhost:8787/api/recommendations');
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.recommendations)).toBe(true);
  });
});
