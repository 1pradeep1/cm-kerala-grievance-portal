// Role-checked file retrieval. Files live in the database, never on a public path.
const express = require('express');
const { pool } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const { parseId } = require('../utils/http');

const router = express.Router();

router.get('/:id', authenticate, async (req, res) => {
  const id = parseId(req.params.id);
  const { rows } = await pool.query(
    `SELECT a.*, g.citizen_id,
            (SELECT department_id FROM assignments x WHERE x.grievance_id = a.grievance_id AND x.is_active) AS assigned_dept
       FROM attachments a JOIN grievances g ON g.id = a.grievance_id WHERE a.id = $1`, [id]);
  const f = rows[0];
  const u = req.user;
  const allowed = f && (
    u.role === 'cmo'
    || (u.role === 'citizen' && f.citizen_id === u.id && f.kind === 'evidence')
    || (u.role === 'officer' && f.assigned_dept === u.department_id));
  if (!allowed) throw new AppError(404, 'File not found');

  res.setHeader('Content-Type', f.mime_type);
  res.setHeader('Content-Length', f.size_bytes);
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.original_name)}`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(f.data);
});

module.exports = router;
