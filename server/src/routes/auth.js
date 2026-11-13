const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const { AppError } = require('../utils/errors');
const { signToken, authenticate } = require('../middleware/auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[6-9]\d{9}$/; // 10-digit Indian mobile number
// A real bcrypt hash of a random string: used so unknown emails take as long as known ones.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, mobile: u.mobile, role: u.role, departmentId: u.department_id });

// Public registration always creates a CITIZEN. Staff accounts are created by seed/admin only.
router.post('/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const mobile = String(req.body.mobile || '').trim();
  const password = String(req.body.password || '');

  if (name.length < 2 || name.length > 100) throw new AppError(400, 'Name must be 2 to 100 characters');
  if (!EMAIL_RE.test(email) || email.length > 255) throw new AppError(400, 'Enter a valid email address');
  if (!MOBILE_RE.test(mobile)) throw new AppError(400, 'Enter a valid 10-digit mobile number');
  if (password.length < 8 || password.length > 72) throw new AppError(400, 'Password must be 8 to 72 characters');

  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, mobile, password_hash, role)
       VALUES ($1, $2, $3, $4, 'citizen') RETURNING id, name, email, mobile, role, department_id`,
      [name, email, mobile, hash]);
    res.status(201).json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
  } catch (err) {
    if (err.code === '23505') throw new AppError(409, 'An account with this email already exists');
    throw err;
  }
});

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const { rows } = await pool.query(
    'SELECT id, name, email, mobile, role, department_id, password_hash FROM users WHERE email = $1 AND is_active', [email]);
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'Incorrect email or password'); // same message for both cases
  res.json({ token: signToken(user), user: publicUser(user) });
});

// Logout is client-side (the token is discarded); the token also expires on its own.
router.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

module.exports = router;
