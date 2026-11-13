// Run with: npm test  (AI tests use the labelled fallback because GEMINI_API_KEY is blanked below)
process.env.GEMINI_API_KEY = '';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../src/db/pool');
const app = require('../src/app');

let server, base;
const tok = {};
// Smallest valid PNG (1x1 pixel)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function call(method, path, { body, token, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let payload;
  if (form) payload = form; else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(base + path, { method, headers, body: payload });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, type, body: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
}
const login = async (email, password) => (await call('POST', '/api/auth/login', { body: { email, password } })).body.token;
const submitForm = (extra = {}, file = { data: PNG, type: 'image/png', name: 'pothole.png' }) => {
  const f = new FormData();
  const fields = { district: 'Kollam', category: 'Roads & Infrastructure', subject: 'Broken road near the bus stand',
    description: 'The road near the bus stand has a large crater that is dangerous for two wheelers and school children.', priority: 'High', ...extra };
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  if (file) f.append('attachments', new Blob([file.data], { type: file.type }), file.name);
  return f;
};

before(async () => {
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}`;
  tok.cmo = await login('cmo@cmkerala-demo.test', 'Cmo@12345');
  tok.pwd = await login('officer.pwd@cmkerala-demo.test', 'Officer@123');
  tok.health = await login('officer.health@cmkerala-demo.test', 'Officer@123');
  tok.anjali = await login('anjali@cmkerala-demo.test', 'Citizen@123');
  tok.rahul = await login('rahul@cmkerala-demo.test', 'Citizen@123');
});
after(async () => { server.close(); await pool.end(); });

test('public stats, tracking and contact form', async () => {
  const s = await call('GET', '/api/stats/public');
  assert.equal(s.status, 200);
  assert.ok(s.body.total >= 20);
  const { rows } = await pool.query("SELECT ref_no FROM grievances WHERE status = 'In Progress' AND id IN (SELECT grievance_id FROM assignments WHERE atr_submitted_at IS NOT NULL) LIMIT 1");
  const t = await call('GET', `/api/grievances/track/${rows[0].ref_no}`);
  assert.equal(t.status, 200);
  const text = JSON.stringify(t.body);
  assert.ok(t.body.history.length >= 3);
  assert.ok(!text.includes('Site inspected by the assistant engineer'), 'ATR text must stay hidden from the public');
  assert.ok(!text.includes('@cmkerala-demo.test'), 'no personal data in public tracking');
  assert.equal((await call('GET', '/api/grievances/track/CMK-2026-999999')).status, 404);
  assert.equal((await call('GET', '/api/grievances/track/abc')).status, 400);
  const c = await call('POST', '/api/contact', { body: { name: 'Visitor', email: 'v@example.test', subject: 'Question', message: 'How do I track my grievance?' } });
  assert.equal(c.status, 201);
  assert.equal((await call('POST', '/api/contact', { body: { name: 'V', email: 'bad', subject: 'x', message: 'short' } })).status, 400);
});

test('AI analyze: needs login, validates input, returns a labelled fallback and reviewable fields', async () => {
  const body = { district: 'Kollam', description: 'A big pothole on the main road caused an accident and a child was injured yesterday.' };
  assert.equal((await call('POST', '/api/ai/analyze', { body })).status, 401);
  assert.equal((await call('POST', '/api/ai/analyze', { body: { ...body, description: 'short' }, token: tok.anjali })).status, 400);
  const r = await call('POST', '/api/ai/analyze', { body, token: tok.anjali });
  assert.equal(r.status, 200);
  assert.equal(r.body.source, 'fallback');
  assert.ok(r.body.notice);
  assert.equal(r.body.category, 'Roads & Infrastructure');
  assert.equal(r.body.priority, 'High');
  assert.ok(r.body.summary && r.body.departmentId);
});

test('citizen submits with a file; file is retrievable only by the right people', async () => {
  const sub = await call('POST', '/api/grievances', { form: submitForm(), token: tok.anjali });
  assert.equal(sub.status, 201);
  assert.match(sub.body.grievance.refNo, /^CMK-\d{4}-\d{6}$/);
  const id = sub.body.grievance.id;
  const detail = await call('GET', `/api/grievances/${id}`, { token: tok.anjali });
  assert.equal(detail.body.grievance.attachments.length, 1);
  const fileId = detail.body.grievance.attachments[0].id;
  const own = await call('GET', `/api/attachments/${fileId}`, { token: tok.anjali });
  assert.equal(own.status, 200);
  assert.equal(own.type, 'image/png');
  assert.ok(own.body.equals(PNG));
  assert.equal((await call('GET', `/api/attachments/${fileId}`, { token: tok.cmo })).status, 200);
  assert.equal((await call('GET', `/api/attachments/${fileId}`, { token: tok.rahul })).status, 404); // another citizen
  assert.equal((await call('GET', `/api/attachments/${fileId}`, { token: tok.pwd })).status, 404);   // not assigned yet
  assert.equal((await call('GET', `/api/grievances/${id}`, { token: tok.rahul })).status, 404);
  assert.equal((await call('GET', `/api/attachments/${fileId}`)).status, 401);
});

test('upload safety: wrong content, wrong type, and oversize files are rejected', async () => {
  const fake = await call('POST', '/api/grievances', { form: submitForm({}, { data: Buffer.from('<script>alert(1)</script>'), type: 'image/png', name: 'x.png' }), token: tok.anjali });
  assert.equal(fake.status, 400);
  const exe = await call('POST', '/api/grievances', { form: submitForm({}, { data: Buffer.from('MZ....'), type: 'application/x-msdownload', name: 'x.exe' }), token: tok.anjali });
  assert.equal(exe.status, 400);
  const big = await call('POST', '/api/grievances', { form: submitForm({}, { data: Buffer.concat([PNG, Buffer.alloc(5.5 * 1024 * 1024)]), type: 'image/png', name: 'big.png' }), token: tok.anjali });
  assert.equal(big.status, 400);
});

test('role isolation on dashboards', async () => {
  assert.equal((await call('GET', '/api/cmo/stats', { token: tok.anjali })).status, 403);
  assert.equal((await call('GET', '/api/cmo/grievances', { token: tok.pwd })).status, 403);
  assert.equal((await call('GET', '/api/officer/grievances', { token: tok.cmo })).status, 403);
  assert.equal((await call('POST', '/api/grievances', { form: submitForm(), token: tok.cmo })).status, 403);
  const mine = await call('GET', '/api/officer/grievances', { token: tok.health });
  assert.equal(mine.status, 200);
  assert.ok(mine.body.grievances.length > 0);
  assert.ok(mine.body.grievances.every((g) => g.category === 'Healthcare'));
  const cit = await call('GET', '/api/grievances/mine', { token: tok.anjali });
  assert.equal(cit.body.summary.total, cit.body.grievances.length);
});

test('CMO dashboard: stats, filters and pagination', async () => {
  const s = await call('GET', '/api/cmo/stats', { token: tok.cmo });
  assert.equal(s.status, 200);
  const t = s.body.totals;
  assert.equal(t.total, t.pending + t.resolved);
  assert.ok(t.overdue >= 1 && t.escalated >= 1);
  assert.equal(s.body.byStatus.length, 5);
  assert.ok(s.body.byDistrict.length > 5 && s.body.byDepartment.length === 9);
  const f = await call('GET', '/api/cmo/grievances?status=In%20Progress&priority=High&limit=5', { token: tok.cmo });
  assert.ok(f.body.grievances.every((g) => g.status === 'In Progress' && g.priority === 'High'));
  assert.ok(f.body.grievances.length <= 5);
  const o = await call('GET', '/api/cmo/grievances?overdue=true', { token: tok.cmo });
  assert.ok(o.body.grievances.length >= 1 && o.body.grievances.every((g) => g.overdue));
  assert.equal((await call('GET', '/api/cmo/grievances?status=Nonsense', { token: tok.cmo })).status, 400);
});

test('end-to-end workflow over the REST API, with correct visibility at each step', async () => {
  const sub = await call('POST', '/api/grievances', { form: submitForm({ subject: 'E2E road repair request' }, null), token: tok.anjali });
  const id = sub.body.grievance.id; const ref = sub.body.grievance.refNo;
  const pwdDept = (await pool.query("SELECT id FROM departments WHERE name = 'Public Works Department'")).rows[0].id;

  assert.equal((await call('PATCH', `/api/cmo/grievances/${id}/status`, { body: { status: 'Resolved' }, token: tok.cmo })).status, 400);
  assert.equal((await call('PATCH', `/api/cmo/grievances/${id}/status`, { body: { status: 'Under Review' }, token: tok.cmo })).status, 200);
  assert.equal((await call('POST', `/api/cmo/grievances/${id}/remarks`, { body: { remark: 'Internal: check budget first' }, token: tok.cmo })).status, 201);
  assert.equal((await call('POST', `/api/cmo/grievances/${id}/assign`, { body: { departmentId: pwdDept, instructions: 'Inspect urgently' }, token: tok.cmo })).status, 200);

  // officer of another department cannot see it; the right officer can, without internal remarks
  assert.equal((await call('GET', `/api/officer/grievances/${id}`, { token: tok.health })).status, 404);
  const od = await call('GET', `/api/officer/grievances/${id}`, { token: tok.pwd });
  assert.equal(od.status, 200);
  assert.equal(od.body.grievance.internalRemarks, undefined);
  assert.equal(od.body.grievance.citizen.email, undefined); // officers do not receive citizen contact details

  assert.equal((await call('PATCH', `/api/officer/grievances/${id}/status`, { body: { remark: 'Team visited the site', workStatus: 'Investigating' }, token: tok.pwd })).status, 200);
  const atr = new FormData();
  atr.append('atrText', 'Road resurfaced and inspected; completion photo attached.');
  atr.append('file', new Blob([PNG], { type: 'image/png' }), 'done.png');
  assert.equal((await call('POST', `/api/officer/grievances/${id}/atr`, { form: atr, token: tok.pwd })).status, 201);

  // citizen cannot read the ATR text or file before the CMO decides
  const cit = await call('GET', `/api/grievances/${id}`, { token: tok.anjali });
  const text = JSON.stringify(cit.body);
  assert.ok(!text.includes('Road resurfaced'));
  assert.ok(!text.includes('Internal: check budget'));
  assert.ok(cit.body.grievance.attachments.every((a) => a.kind === 'evidence'));

  assert.equal((await call('POST', `/api/cmo/grievances/${id}/review-atr`, { body: { decision: 'accept', remark: 'Verified on site photos' }, token: tok.cmo })).status, 200);
  const done = await call('GET', `/api/grievances/track/${ref}`);
  assert.equal(done.body.grievance.status, 'Resolved');
  assert.ok(done.body.history.some((h) => h.remark === 'Verified on site photos'));

  assert.equal((await call('POST', `/api/grievances/${id}/feedback`, { body: { rating: 5 }, token: tok.rahul })).status, 403); // not the owner
  assert.equal((await call('POST', `/api/grievances/${id}/feedback`, { body: { rating: 5, comment: 'Quick fix' }, token: tok.anjali })).status, 201);
  const re = await call('POST', `/api/grievances/${id}/reopen`, { body: { remark: 'Crater has reappeared after rain' }, token: tok.anjali });
  assert.equal(re.status, 200);
  assert.equal(re.body.status, 'Reopened');
  // after reopening, the department no longer sees it until the CMO forwards it again
  assert.equal((await call('GET', `/api/officer/grievances/${id}`, { token: tok.pwd })).status, 404);
});

test('AI analyze: Gemini path (mocked) validates model output and falls back safely', async () => {
  const realFetch = global.fetch;
  const body = { district: 'Kollam', description: 'Street light outside the school has not worked for weeks and children walk in the dark.' };
  const reply = (obj) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  let seen;
  const stub = (handler) => { global.fetch = (url, opts) => (String(url).includes('generativelanguage.googleapis.com') ? handler(url, opts) : realFetch(url, opts)); };
  process.env.GEMINI_API_KEY = 'test-key';
  try {
    // 1) valid model answer -> source "llm"
    stub((url, opts) => { seen = { url: String(url), body: JSON.parse(opts.body), key: opts.headers['x-goog-api-key'] };
      return reply({ category: 'Electricity', department: 'Kerala State Electricity Board', priority: 'Medium', summary: 'Street light near a school is out.', reasoning: 'Lighting fault.' }); });
    let r = await call('POST', '/api/ai/analyze', { body, token: tok.anjali });
    assert.equal(r.body.source, 'llm');
    assert.equal(r.body.category, 'Electricity');
    assert.equal(r.body.notice, null);
    assert.equal(seen.key, 'test-key');
    assert.ok(seen.body.contents[0].parts[0].text.includes('<complaint>')); // complaint is fenced as data
    assert.equal(seen.body.generationConfig.responseMimeType, 'application/json');
    // 2) model invents a department -> rejected, labelled fallback used
    stub(() => reply({ category: 'Electricity', department: 'Ministry of Made-Up Things', priority: 'High', summary: 'x', reasoning: 'y' }));
    r = await call('POST', '/api/ai/analyze', { body, token: tok.anjali });
    assert.equal(r.body.source, 'fallback');
    assert.ok(r.body.notice);
    // 3) API error (rate limit) -> labelled fallback
    stub(() => new Response('{}', { status: 429 }));
    r = await call('POST', '/api/ai/analyze', { body, token: tok.anjali });
    assert.equal(r.body.source, 'fallback');
  } finally { global.fetch = realFetch; process.env.GEMINI_API_KEY = ''; }
});
