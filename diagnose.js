
import fs from 'fs';
import { Miniflare } from 'miniflare';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const mf = new Miniflare({
    scriptPath: 'api/src/index.js',
    modules: true,
    compatibilityDate: '2024-01-01',
    compatibilityFlags: ['nodejs_compat'],
    modulesRules: [
      { type: 'ESModule', include: ['**/*.js'], fallthrough: true }
    ],
    d1Databases: ['DB'],
    aiBinding: 'AI',
    kvPersist: false,
    verbose: true,
  });

  const db = await mf.getD1Database('DB');
  const schemaStr = fs.readFileSync(path.join(__dirname, 'api/schema.sql'), 'utf8');
  const statements = schemaStr
    .split('\n')
    .map(line => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  for (const stmt of statements) {
    if (stmt) await db.prepare(stmt).run();
  }

  // Seed for recommendations
  console.log('Seeding data...');
  await db.prepare("INSERT INTO taste_profile (dimension_name, dimension_value, sample_size, metadata) VALUES (?, ?, ?, ?)").bind('genre', 'Sci-Fi', 20, '{"score":0.9}').run();
  await db.prepare("INSERT INTO movies (imdb_id, title, year, genres) VALUES ('tt9999999', 'Rec Movie', 2024, 'Sci-Fi')").run();

  console.log('Fetching recommendations...');
  const response = await mf.dispatchFetch('http://localhost:8787/api/recommendations');
  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));

  await mf.dispose();
}

run().catch(console.error);
