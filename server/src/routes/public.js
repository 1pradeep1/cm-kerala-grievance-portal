const express = require('express');
const { pool } = require('../db/pool');
const C = require('../constants');
const q = require('../services/queries');

const router = express.Router();

router.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', time: new Date().toISOString() });
});

router.get('/departments', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, name, description FROM departments ORDER BY name');
  res.json({ departments: rows });
});

router.get('/stats/public', async (_req, res) => res.json(await q.publicStats()));

// Lists used by the forms, so the frontend never hard-codes them.
router.get('/meta', (_req, res) => {
  res.json({ districts: C.DISTRICTS, categories: C.CATEGORIES, priorities: C.PRIORITIES, statuses: C.STATUSES });
});

module.exports = router;
