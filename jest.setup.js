import fs from 'fs';
import { Miniflare } from 'miniflare';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

global.mf = new Miniflare({
  scriptPath: 'api/src/index.js',
  modules: true,
  compatibilityDate: '2024-01-01',
  compatibilityFlags: ['nodejs_compat'],
  modulesRules: [
    { type: 'ESModule', include: ['**/*.js'], fallthrough: true }
  ],
  d1Databases: ['DB'],
  kvPersist: false,
});

beforeAll(async () => {
  // Read schema
  const schemaStr = fs.readFileSync(path.join(__dirname, 'api/schema.sql'), 'utf8');

  // Remove comments line by line
  const statements = schemaStr
    .split('\n')
    .map(line => line.replace(/--.*$/, '')) // Remove comment from each line
    .join('\n')
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  const db = await global.mf.getD1Database('DB');
  for (const stmt of statements) {
    if (stmt) {
      await db.prepare(stmt).run();
    }
  }
});
