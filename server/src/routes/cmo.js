// Chief Minister's Office dashboard endpoints (role: cmo).
const express = require('express');
const { pool } = require('../db/pool');
const { authenticate, allow } = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const svc = require('../services/grievanceService');
const q = require('../services/queries');
const { parseId } = require('../utils/http');

const router = express.Router();
router.use(authenticate, allow('cmo'));

router.get('/stats', async (_req, res) => res.json(await q.cmoStats()));

router.get('/grievances', async (req, res) => res.json(await q.listGrievances(req.query, req.user)));

router.get('/grievances/:id', async (req, res) => {
  res.json({ grievance: await q.getGrievanceDetail(parseId(req.params.id), req.user) });
});

// Officers of a department (for the "forward to" dropdown).
router.get('/officers', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, department_id FROM users WHERE role = 'officer' AND is_active
       ${req.query.departmentId ? 'AND department_id = $1' : ''} ORDER BY name`,
    req.query.departmentId ? [parseId(req.query.departmentId, 'departmentId')] : []);
  res.json({ officers: rows });
});

// The CMO moves a grievance to "Under Review". Other statuses are reached only through the workflow:
// assign -> In Progress, review-atr (accept) -> Resolved, citizen reopen -> Reopened.
router.patch('/grievances/:id/status', async (req, res) => {
  if (req.body.status !== 'Under Review') {
    throw new AppError(400, 'The CMO can set "Under Review" here. Use /assign to forward (In Progress) and /review-atr to resolve.');
  }
  const g = await svc.startReview(parseId(req.params.id), req.body, req.user);
  res.json({ message: 'Grievance is now under review', status: g.status });
});

router.patch('/grievances/:id/priority', async (req, res) => {
  const g = await svc.updatePriority(parseId(req.params.id), req.body, req.user);
  res.json({ message: 'Priority updated', priority: g.priority, dueDate: g.due_date });
});

router.post('/grievances/:id/assign', async (req, res) => {
  const g = await svc.assignGrievance(parseId(req.params.id), req.body, req.user);
  res.json({ message: 'Grievance forwarded to the department', status: g.status, departmentId: g.department_id });
});

router.post('/grievances/:id/remarks', async (req, res) => {
  const remark = await svc.addInternalRemark(parseId(req.params.id), req.body, req.user);
  res.status(201).json({ message: 'Internal remark saved (not visible to the citizen)', remark });
});

router.post('/grievances/:id/escalate', async (req, res) => {
  const g = await svc.escalateGrievance(parseId(req.params.id), req.body, req.user);
  res.json({ message: 'Grievance escalated', escalated: g.escalated });
});

router.post('/grievances/:id/review-atr', async (req, res) => {
  const g = await svc.reviewAtr(parseId(req.params.id), req.body, req.user);
  res.json({ message: req.body.decision === 'accept' ? 'Report accepted and grievance resolved' : 'Report sent back to the department', status: g.status });
});

module.exports = router;
