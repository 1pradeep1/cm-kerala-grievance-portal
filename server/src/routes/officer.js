// Department officer endpoints (role: officer).
const express = require('express');
const { authenticate, allow } = require('../middleware/auth');
const svc = require('../services/grievanceService');
const q = require('../services/queries');
const { upload, checkFiles } = require('../utils/uploads');
const { parseId } = require('../utils/http');

const router = express.Router();
router.use(authenticate, allow('officer'));

// Only grievances forwarded to this officer's department.
router.get('/grievances', async (req, res) => res.json(await q.listGrievances(req.query, req.user)));

router.get('/grievances/:id', async (req, res) => {
  res.json({ grievance: await q.getGrievanceDetail(parseId(req.params.id), req.user) });
});

// Update progress: add an investigation remark and (optionally) mark the work as "Investigating".
router.patch('/grievances/:id/status', async (req, res) => {
  await svc.officerUpdate(parseId(req.params.id), req.body, req.user);
  res.json({ message: 'Progress update saved' });
});

// Submit the action-taken report (text + optional file) back to the CMO.
router.post('/grievances/:id/atr', upload.single('file'), async (req, res) => {
  const files = checkFiles(req.file ? [req.file] : []);
  await svc.submitAtr(parseId(req.params.id), req.body, req.user, files[0] || null);
  res.status(201).json({ message: 'Action-taken report submitted to the CMO for review' });
});

module.exports = router;
