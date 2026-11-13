// Citizen-facing grievance endpoints + public tracking.
const express = require('express');
const { authenticate, allow } = require('../middleware/auth');
const svc = require('../services/grievanceService');
const q = require('../services/queries');
const ai = require('../services/aiService');
const { upload, checkFiles } = require('../utils/uploads');
const { parseId } = require('../utils/http');
const C = require('../constants');

const router = express.Router();

// Public: track by reference number (no login, no personal data returned).
router.get('/track/:refNo', async (req, res) => {
  if (!/^CMK-\d{4}-\d{6}$/i.test(req.params.refNo.trim())) {
    return res.status(400).json({ error: 'Reference numbers look like CMK-2026-000123' });
  }
  res.json(await q.trackByRef(req.params.refNo));
});

router.get('/mine', authenticate, allow('citizen'), async (req, res) => {
  res.json(await q.listForCitizen(req.user.id));
});

// Submit a grievance (multipart/form-data so up to 3 files can be attached).
router.post('/', authenticate, allow('citizen'), upload.array('attachments', 3), async (req, res) => {
  const files = checkFiles(req.files || []);
  const b = req.body;

  // AI fields are advisory metadata. Keep only whitelisted, length-limited values.
  let suggestion = null;
  try { suggestion = b.aiSuggestion ? JSON.parse(b.aiSuggestion) : null; } catch (_) { suggestion = null; }
  const clean = suggestion && typeof suggestion === 'object' ? {
    category: C.CATEGORIES.includes(suggestion.category) ? suggestion.category : null,
    department: typeof suggestion.department === 'string' ? suggestion.department.slice(0, 120) : null,
    priority: C.PRIORITIES.includes(suggestion.priority) ? suggestion.priority : null,
    reasoning: typeof suggestion.reasoning === 'string' ? suggestion.reasoning.slice(0, 300) : null,
    model: typeof suggestion.model === 'string' ? suggestion.model.slice(0, 60) : null,
    citizenEdited: !!suggestion.citizenEdited, // true when the citizen changed the AI's suggestion
  } : null;
  const aiSource = suggestion && ['llm', 'fallback'].includes(suggestion.source) ? suggestion.source : null;

  // Duplicate check is always done on the server (never taken from the client).
  let duplicates = [];
  if (C.DISTRICTS.includes(b.district) && C.CATEGORIES.includes(b.category) && typeof b.description === 'string') {
    duplicates = await ai.findDuplicates({ district: b.district, category: b.category, description: b.description });
  }

  const grievance = await svc.createGrievance({
    district: b.district, category: b.category, subject: b.subject, description: b.description, priority: b.priority,
    aiSummary: suggestion && typeof suggestion.summary === 'string' ? suggestion.summary.slice(0, 500) : undefined,
    aiSource, aiSuggestion: clean ? { ...clean, possibleDuplicates: duplicates } : (duplicates.length ? { possibleDuplicates: duplicates } : null),
  }, req.user, files);

  res.status(201).json({
    message: 'Your grievance has been submitted. Please keep the reference number to track it.',
    grievance: { id: grievance.id, refNo: grievance.ref_no, status: grievance.status, dueDate: grievance.due_date },
  });
});

// Detail view (the owner, the CMO, or the assigned officer).
router.get('/:id', authenticate, async (req, res) => {
  res.json({ grievance: await q.getGrievanceDetail(parseId(req.params.id), req.user) });
});

router.post('/:id/feedback', authenticate, allow('citizen'), async (req, res) => {
  const feedback = await svc.addFeedback(parseId(req.params.id), req.body, req.user);
  res.status(201).json({ message: 'Thank you for your feedback.', feedback });
});

router.post('/:id/reopen', authenticate, allow('citizen'), async (req, res) => {
  const g = await svc.reopenGrievance(parseId(req.params.id), req.body, req.user);
  res.json({ message: 'Your grievance has been reopened and sent back to the CMO.', status: g.status });
});

module.exports = router;
