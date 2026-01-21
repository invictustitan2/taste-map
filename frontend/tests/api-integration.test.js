import fetch from 'node-fetch';

describe('Pages ↔ Worker integration', () => {
  const base = 'https://movies.aperion.cc';

  test('Health endpoint returns ok', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
  });

  test('Movies list returns array', async () => {
    const res = await fetch(`${base}/api/movies?page=1`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.movies)).toBe(true);
  });
});
