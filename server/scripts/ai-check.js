// Usage: npm run ai:check
// Lists the Gemini models your key can use, then tests one real analysis call.
require('dotenv').config();
(async () => {
  if (!process.env.GEMINI_API_KEY) { console.log('GEMINI_API_KEY is empty in .env'); return; }
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY },
  });
  if (!res.ok) { console.log('Could not list models: HTTP', res.status); return; }
  const { models = [] } = await res.json();
  const usable = models.filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace('models/', ''));
  console.log('Models usable with your key:\n  ' + usable.filter((n) => /flash/.test(n)).join('\n  '));
  const { pool } = require('../src/db/pool');
  const { analyze } = require('../src/services/aiService');
  const r = await analyze({
    description: 'The street light near the school has not worked for two weeks and children walk home in the dark.',
    district: 'Kollam', user: { role: 'cmo', id: 0 },
  });
  console.log('\nTest analysis:', JSON.stringify(r, null, 2));
  await pool.end();
})();
