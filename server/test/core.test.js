// Run with: npm test   (needs DATABASE_URL + JWT_SECRET; run db:setup and db:seed first)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../src/db/pool');
const app = require('../src/app');
const svc = require('../src/services/grievanceService');

let server, base, cmo, officer, citizen, deptId;

const api = async (method, path, body, token) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};
const user = async (email) => (await pool.query('SELECT id, role, department_id FROM users WHERE email = $1', [email])).rows[0];
const newGrievance = () => svc.createGrievance({
  district: 'Kollam', category: 'Roads & Infrastructure', subject: 'Test grievance subject',
  description: 'This is a test grievance description that is long enough to pass validation.', priority: 'High',
}, citizen);
const rejects = async (promise, status) => {
  await assert.rejects(promise, (e) => e.status === status);
};

before(async () => {
  cmo = await user('cmo@cmkerala-demo.test');
  officer = await user('officer.pwd@cmkerala-demo.test');
  citizen = await user('anjali@cmkerala-demo.test');
  deptId = officer.department_id;
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}`;
});
after(async () => { server.close(); await pool.end(); });

test('login works for all three roles and rejects bad credentials', async () => {
  for (const [email, pw, role] of [
    ['cmo@cmkerala-demo.test', 'Cmo@12345', 'cmo'],
    ['officer.pwd@cmkerala-demo.test', 'Officer@123', 'officer'],
    ['anjali@cmkerala-demo.test', 'Citizen@123', 'citizen']]) {
    const r = await api('POST', '/api/auth/login', { email, password: pw });
    assert.equal(r.status, 200);
    assert.equal(r.body.user.role, role);
    assert.ok(r.body.token);
  }
  assert.equal((await api('POST', '/api/auth/login', { email: 'cmo@cmkerala-demo.test', password: 'wrong' })).status, 401);
  assert.equal((await api('POST', '/api/auth/login', { email: 'nobody@x.test', password: 'wrong' })).status, 401);
});

test('registration validates input, always creates a citizen, and blocks duplicates', async () => {
  const email = `t${Date.now()}@example.test`;
  const ok = await api('POST', '/api/auth/register', { name: 'Test User', email, mobile: '9876543210', password: 'Passw0rd!x', role: 'cmo' });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.user.role, 'citizen'); // a client-sent "role" is ignored
  assert.equal((await api('POST', '/api/auth/register', { name: 'Test User', email, mobile: '9876543210', password: 'Passw0rd!x' })).status, 409);
  assert.equal((await api('POST', '/api/auth/register', { name: 'T', email: 'bad', mobile: '123', password: 'short' })).status, 400);
  await pool.query('DELETE FROM users WHERE email = $1', [email]);
});

test('protected routes need a valid token', async () => {
  assert.equal((await api('GET', '/api/auth/me')).status, 401);
  assert.equal((await api('GET', '/api/auth/me', null, 'garbage')).status, 401);
  const login = await api('POST', '/api/auth/login', { email: 'anjali@cmkerala-demo.test', password: 'Citizen@123' });
  assert.equal((await api('GET', '/api/auth/me', null, login.body.token)).status, 200);
});

test('public endpoints return departments and form lists', async () => {
  const d = await api('GET', '/api/departments');
  assert.equal(d.status, 200);
  assert.equal(d.body.departments.length, 9);
  assert.equal((await api('GET', '/api/meta')).body.districts.length, 14);
});

test('full happy path writes a complete, ordered history', async () => {
  const g = await newGrievance();
  assert.match(g.ref_no, /^CMK-\d{4}-\d{6}$/);
  assert.equal(g.status, 'Submitted');
  await svc.assignGrievance(g.id, { departmentId: deptId, officerId: officer.id }, cmo);
  await svc.officerUpdate(g.id, { remark: 'Inspection under way', workStatus: 'Investigating' }, officer);
  await svc.submitAtr(g.id, { atrText: 'Road repaired and inspected by the assistant engineer.' }, officer);
  await svc.reviewAtr(g.id, { decision: 'accept', remark: 'Accepted, resolved.' }, cmo);
  const final = (await pool.query('SELECT status, resolved_at FROM grievances WHERE id = $1', [g.id])).rows[0];
  assert.equal(final.status, 'Resolved');
  assert.ok(final.resolved_at);
  const events = (await pool.query('SELECT event_type, old_status, new_status, actor_role FROM grievance_history WHERE grievance_id = $1 ORDER BY id', [g.id])).rows;
  assert.deepEqual(events.map((e) => e.event_type),
    ['created', 'status_change', 'status_change', 'officer_remark', 'atr_submitted', 'status_change']);
  assert.deepEqual(events.filter((e) => e.event_type === 'status_change').map((e) => `${e.old_status}>${e.new_status}`),
    ['Submitted>Under Review', 'Under Review>In Progress', 'In Progress>Resolved']);
});

test('invalid status moves are rejected and leave no trace', async () => {
  const g = await newGrievance();
  await rejects(svc.reviewAtr(g.id, { decision: 'accept', remark: 'Trying to skip ahead' }, cmo), 409);
  await rejects(svc.reopenGrievance(g.id, { remark: 'Cannot reopen what is not resolved' }, citizen), 409);
  const n = (await pool.query('SELECT count(*)::int AS n FROM grievance_history WHERE grievance_id = $1', [g.id])).rows[0].n;
  assert.equal(n, 1); // only "created"
});

test('role rules: citizens cannot assign, officers cannot touch other departments', async () => {
  const g = await newGrievance();
  await rejects(svc.assignGrievance(g.id, { departmentId: deptId }, citizen), 403);
  await rejects(svc.assignGrievance(g.id, { departmentId: deptId }, officer), 403);
  await svc.assignGrievance(g.id, { departmentId: deptId }, cmo);
  const other = await user('officer.health@cmkerala-demo.test');
  await rejects(svc.officerUpdate(g.id, { remark: 'Not my department' }, other), 403);
  const other2 = await user('anjali@cmkerala-demo.test');
  await rejects(svc.reopenGrievance(g.id, { remark: 'Not resolved yet' }, { ...other2, id: 999999 }), 403);
});

test('rejected ATR returns to the officer; reopen and feedback rules hold', async () => {
  const g = await newGrievance();
  await svc.assignGrievance(g.id, { departmentId: deptId }, cmo);
  await svc.submitAtr(g.id, { atrText: 'First report, not detailed enough for the CMO.' }, officer);
  await svc.reviewAtr(g.id, { decision: 'reject', remark: 'Please attach proof of repair.' }, cmo);
  const a = (await pool.query('SELECT work_status, atr_submitted_at, cmo_decision FROM assignments WHERE grievance_id = $1 AND is_active', [g.id])).rows[0];
  assert.equal(a.work_status, 'Investigating');
  assert.equal(a.atr_submitted_at, null);
  assert.equal(a.cmo_decision, 'rejected');
  await svc.submitAtr(g.id, { atrText: 'Second report with photographs of the completed repair.' }, officer);
  await rejects(svc.addFeedback(g.id, { rating: 5 }, citizen), 409); // not resolved yet
  await svc.reviewAtr(g.id, { decision: 'accept', remark: 'Accepted this time.' }, cmo);
  await svc.addFeedback(g.id, { rating: 5, comment: 'Thanks' }, citizen);
  await rejects(svc.addFeedback(g.id, { rating: 3 }, citizen), 409); // only once
  const re = await svc.reopenGrievance(g.id, { remark: 'The problem came back again.' }, citizen);
  assert.equal(re.status, 'Reopened');
  assert.equal(re.reopen_count, 1);
  const active = (await pool.query('SELECT count(*)::int AS n FROM assignments WHERE grievance_id = $1 AND is_active', [g.id])).rows[0].n;
  assert.equal(active, 0);
});

test('escalation works once and not on resolved grievances', async () => {
  const g = await newGrievance();
  const e = await svc.escalateGrievance(g.id, { remark: 'Delayed beyond the deadline' }, cmo);
  assert.equal(e.escalated, true);
  await rejects(svc.escalateGrievance(g.id, { remark: 'Again for no reason' }, cmo), 409);
});

test('input validation rejects bad data', async () => {
  await rejects(svc.createGrievance({ district: 'Atlantis', category: 'Healthcare', subject: 'Valid subject', description: 'x'.repeat(30) }, citizen), 400);
  await rejects(svc.createGrievance({ district: 'Kollam', category: 'Healthcare', subject: 'Hi', description: 'x'.repeat(30) }, citizen), 400);
});
