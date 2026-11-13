const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const { AppError } = require('../utils/errors');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  console.error('JWT_SECRET is missing or too short (use at least 16 random characters).');
  process.exit(1);
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
}

// Verifies the Bearer token, then reloads the user so deactivated accounts lose access immediately.
async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError(401, 'Please log in to continue');
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch (_) { throw new AppError(401, 'Your session has expired. Please log in again'); }
    const { rows } = await pool.query(
      'SELECT id, name, email, mobile, role, department_id FROM users WHERE id = $1 AND is_active', [payload.sub]);
    if (!rows[0]) throw new AppError(401, 'Account not found or disabled');
    req.user = rows[0];
    next();
  } catch (err) { next(err); }
}

// Role-based access control: allow('cmo'), allow('citizen', 'officer'), ...
const allow = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new AppError(403, 'You do not have permission to access this resource'));

module.exports = { signToken, authenticate, allow };
