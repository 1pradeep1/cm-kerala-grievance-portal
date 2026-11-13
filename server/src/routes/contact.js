const express = require('express');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db/pool');
const { AppError } = require('../utils/errors');

const router = express.Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many messages sent. Please try again later.' },
});

router.post('/', limiter, async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim();
  const subject = String(req.body.subject || '').trim();
  const message = String(req.body.message || '').trim();
  if (name.length < 2 || name.length > 100) throw new AppError(400, 'Name must be 2 to 100 characters');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) throw new AppError(400, 'Enter a valid email address');
  if (subject.length < 3 || subject.length > 150) throw new AppError(400, 'Subject must be 3 to 150 characters');
  if (message.length < 10 || message.length > 2000) throw new AppError(400, 'Message must be 10 to 2000 characters');
  await pool.query('INSERT INTO contact_enquiries (name, email, subject, message) VALUES ($1,$2,$3,$4)', [name, email, subject, message]);
  res.status(201).json({ message: 'Thank you. Your message has been received.' });
});

module.exports = router;
