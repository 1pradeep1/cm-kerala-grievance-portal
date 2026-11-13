const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, allow } = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const ai = require('../services/aiService');
const C = require('../constants');

const router = express.Router();

// Protects the free AI quota: 10 analyses per minute per logged-in user.
const limiter = rateLimit({
  windowMs: 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `user-${req.user.id}`,
  message: { error: 'Too many AI requests. Please wait a minute and try again.' },
});

// Suggests category, department, priority and a summary. Read-only: nothing is saved or decided here.
router.post('/analyze', authenticate, allow('citizen', 'cmo'), limiter, async (req, res) => {
  const description = String(req.body.description || '').trim();
  const district = req.body.district;
  if (description.length < 20 || description.length > 2000) throw new AppError(400, 'Description must be 20 to 2000 characters');
  if (!C.DISTRICTS.includes(district)) throw new AppError(400, 'Please select a valid district');
  res.json(await ai.analyze({ description, district, user: req.user }));
});

module.exports = router;
