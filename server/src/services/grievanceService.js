// All grievance business rules live here. Routes only call these functions.
// Every function runs inside ONE database transaction and writes grievance_history,
// so no endpoint can change a grievance without leaving a trace.
const { withTransaction } = require('../db/pool');
const { AppError } = require('../utils/errors');
const C = require('../constants');

/* ---------- small helpers ---------- */

function requireRole(user, ...roles) {
  if (!user || !roles.includes(user.role)) {
    throw new AppError(403, 'You are not allowed to perform this action');
  }
}

function cleanText(value, field, { min = 1, max = 2000, required = true } = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    if (required) throw new AppError(400, `${field} is required`);
    return null;
  }
  if (text.length < min) throw new AppError(400, `${field} must be at least ${min} characters`);
  if (text.length > max) throw new AppError(400, `${field} must be at most ${max} characters`);
  return text;
}

function pick(value, allowed, field) {
  if (!allowed.includes(value)) throw new AppError(400, `${field} must be one of: ${allowed.join(', ')}`);
  return value;
}

async function lockGrievance(client, id) {
  // FOR UPDATE locks the row so two people cannot change the same grievance at once.
  const { rows } = await client.query('SELECT * FROM grievances WHERE id = $1 FOR UPDATE', [id]);
  if (!rows[0]) throw new AppError(404, 'Grievance not found');
  return rows[0];
}

async function getActiveAssignment(client, grievanceId) {
  const { rows } = await client.query(
    'SELECT * FROM assignments WHERE grievance_id = $1 AND is_active FOR UPDATE', [grievanceId]);
  return rows[0] || null;
}

async function writeHistory(client, { grievanceId, eventType, oldStatus = null, newStatus = null, user, remark = null }) {
  await client.query(
    `INSERT INTO grievance_history
       (grievance_id, event_type, old_status, new_status, changed_by, actor_role, remark)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [grievanceId, eventType, oldStatus, newStatus, user.id, user.role, remark]);
}

async function insertAttachment(client, grievanceId, userId, kind, file) {
  const { rows } = await client.query(
    `INSERT INTO attachments (grievance_id, uploaded_by, kind, original_name, mime_type, size_bytes, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [grievanceId, userId, kind, file.originalname.slice(0, 255), file.mimetype, file.size, file.buffer]);
  return rows[0].id;
}

// The ONLY place a grievance status changes. Validates the move, updates, writes history.
async function transition(client, grievance, toStatus, user, remark) {
  const allowed = C.TRANSITIONS[grievance.status] || [];
  if (!allowed.includes(toStatus)) {
    throw new AppError(409, `A grievance cannot move from "${grievance.status}" to "${toStatus}"`);
  }
  const { rows } = await client.query(
    `UPDATE grievances
        SET status = $1, updated_at = now(),
            resolved_at = CASE WHEN $3::text = 'Resolved' THEN now() ELSE resolved_at END
      WHERE id = $2 RETURNING *`,
    [toStatus, grievance.id, toStatus]);
  await writeHistory(client, {
    grievanceId: grievance.id, eventType: 'status_change',
    oldStatus: grievance.status, newStatus: toStatus, user, remark,
  });
  return rows[0];
}

function assertOfficerOwns(user, assignment) {
  if (!assignment) throw new AppError(409, 'This grievance is not currently assigned to a department');
  const sameDept = assignment.department_id === user.department_id;
  const sameOfficer = assignment.officer_id === null || assignment.officer_id === user.id;
  if (!sameDept || !sameOfficer) throw new AppError(403, 'This grievance is not assigned to you');
}

/* ---------- citizen ---------- */

async function createGrievance(input, user, files = []) {
  requireRole(user, 'citizen');
  const district = pick(input.district, C.DISTRICTS, 'district');
  const category = pick(input.category, C.CATEGORIES, 'category');
  const priority = input.priority ? pick(input.priority, C.PRIORITIES, 'priority') : 'Medium';
  const subject = cleanText(input.subject, 'subject', { min: 5, max: 150 });
  const description = cleanText(input.description, 'description', { min: 20, max: 2000 });
  const aiSource = input.aiSource ? pick(input.aiSource, ['llm', 'fallback'], 'aiSource') : null;
  const aiSummary = cleanText(input.aiSummary, 'aiSummary', { max: 600, required: false });
  const aiSuggestion = input.aiSuggestion ? JSON.stringify(input.aiSuggestion) : null;

  return withTransaction(async (client) => {
    const seq = await client.query("SELECT nextval('grievance_ref_seq') AS n");
    const refNo = `CMK-${new Date().getFullYear()}-${String(seq.rows[0].n).padStart(6, '0')}`;
    const { rows } = await client.query(
      `INSERT INTO grievances
         (ref_no, citizen_id, district, category, subject, description, priority,
          ai_summary, ai_suggestion, ai_source, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now() + make_interval(days => $11))
       RETURNING *`,
      [refNo, user.id, district, category, subject, description, priority,
        aiSummary, aiSuggestion, aiSource, C.SLA_DAYS[priority]]);
    const grievance = rows[0];
    await writeHistory(client, {
      grievanceId: grievance.id, eventType: 'created', newStatus: 'Submitted', user,
      remark: 'Grievance submitted by citizen',
    });
    for (const file of files) await insertAttachment(client, grievance.id, user.id, 'evidence', file);
    return grievance;
  });
}

async function reopenGrievance(id, input, user) {
  requireRole(user, 'citizen');
  const remark = cleanText(input.remark, 'remark', { min: 10, max: 1000 });
  return withTransaction(async (client) => {
    const g = await lockGrievance(client, id);
    if (g.citizen_id !== user.id) throw new AppError(403, 'You can only reopen your own grievance');
    const updated = await transition(client, g, 'Reopened', user, remark);
    // Close the old assignment; the CMO will forward it again.
    await client.query('UPDATE assignments SET is_active = false WHERE grievance_id = $1 AND is_active', [id]);
    const { rows } = await client.query(
      `UPDATE grievances
          SET reopen_count = reopen_count + 1, resolved_at = NULL,
              due_date = now() + make_interval(days => $2)
        WHERE id = $1 RETURNING *`, [id, C.SLA_DAYS[updated.priority]]);
    return rows[0];
  });
}

async function addFeedback(id, input, user) {
  requireRole(user, 'citizen');
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError(400, 'rating must be a whole number from 1 to 5');
  const comment = cleanText(input.comment, 'comment', { max: 1000, required: false });
  return withTransaction(async (client) => {
    const g = await lockGrievance(client, id);
    if (g.citizen_id !== user.id) throw new AppError(403, 'You can only rate your own grievance');
    if (g.status !== 'Resolved') throw new AppError(409, 'Feedback can only be given after resolution');
    const exists = await client.query('SELECT 1 FROM feedback WHERE grievance_id = $1', [id]);
    if (exists.rowCount) throw new AppError(409, 'Feedback has already been submitted');
    const { rows } = await client.query(
      'INSERT INTO feedback (grievance_id, citizen_id, rating, comment) VALUES ($1,$2,$3,$4) RETURNING *',
      [id, user.id, rating, comment]);
    await writeHistory(client, { grievanceId: id, eventType: 'feedback', user, remark: `Citizen rated the resolution ${rating}/5` });
    return rows[0];
  });
}

/* ---------- CMO ---------- */

async function startReview(id, input, user) {
  requireRole(user, 'cmo');
  const remark = cleanText(input.remark, 'remark', { required: false, max: 1000 }) || 'Grievance taken up for review by the CMO';
  return withTransaction(async (client) => {
    const g = await lockGrievance(client, id);
    return transition(client, g, 'Under Review', user, remark);
  });
}

async function assignGrievance(id, input, user) {
  requireRole(user, 'cmo');
  const instructions = cleanText(input.instructions, 'instructions', { required: false, max: 1000 });
  return withTransaction(async (client) => {
    let g = await lockGrievance(client, id);
    if (g.status === 'Resolved') throw new AppError(409, 'A resolved grievance must be reopened before it can be forwarded again');

    const dept = (await client.query('SELECT id, name FROM departments WHERE id = $1', [input.departmentId])).rows[0];
    if (!dept) throw new AppError(400, 'Unknown department');
    let officerId = null;
    if (input.officerId) {
      const officer = (await client.query(
        "SELECT id FROM users WHERE id = $1 AND role = 'officer' AND department_id = $2 AND is_active",
        [input.officerId, dept.id])).rows[0];
      if (!officer) throw new AppError(400, 'That officer does not belong to the selected department');
      officerId = officer.id;
    }

    const wasInProgress = g.status === 'In Progress';
    if (g.status === 'Submitted' || g.status === 'Reopened') {
      g = await transition(client, g, 'Under Review', user, 'Grievance taken up for review by the CMO');
    }
    if (g.status === 'Under Review') {
      g = await transition(client, g, 'In Progress', user, `Forwarded to ${dept.name}`);
    }

    await client.query('UPDATE assignments SET is_active = false WHERE grievance_id = $1 AND is_active', [id]);
    await client.query(
      `INSERT INTO assignments (grievance_id, department_id, officer_id, assigned_by, instructions)
       VALUES ($1,$2,$3,$4,$5)`, [id, dept.id, officerId, user.id, instructions]);
    const { rows } = await client.query(
      'UPDATE grievances SET department_id = $1, updated_at = now() WHERE id = $2 RETURNING *', [dept.id, id]);

    if (wasInProgress) {
      await writeHistory(client, { grievanceId: id, eventType: 'assignment', user, remark: `Reassigned to ${dept.name}` });
    }
    return rows[0];
  });
}

async function reviewAtr(id, input, user) {
  requireRole(user, 'cmo');
  const decision = pick(input.decision, ['accept', 'reject'], 'decision');
  const remark = cleanText(input.remark, 'remark', { min: 5, max: 1000 });
  return withTransaction(async (client) => {
    const g = await lockGrievance(client, id);
    const a = await getActiveAssignment(client, id);
    if (!a || !a.atr_submitted_at) throw new AppError(409, 'No action-taken report is waiting for review');
    if (g.status !== 'In Progress') throw new AppError(409, 'Grievance is not in progress');

    if (decision === 'accept') {
      await client.query(
        "UPDATE assignments SET cmo_decision = 'accepted', decision_remark = $2, decided_at = now() WHERE id = $1", [a.id, remark]);
      return transition(client, g, 'Resolved', user, remark);
    }
    // Reject: send it back to the officer; status stays In Progress.
    await client.query(
      `UPDATE assignments
          SET cmo_decision = 'rejected', decision_remark = $2, decided_at = now(),
              work_status = 'Investigating', atr_submitted_at = NULL
        WHERE id = $1`, [a.id, remark]);
    await writeHistory(client, { grievanceId: id, eventType: 'atr_rejected', user, remark: `Action-taken report sent back: ${remark}` });
    return g;
  });
}

async function escalateGrievance(id, input, user) {
  requireRole(user, 'cmo');
  const remark = cleanText(input.remark, 'remark', { min: 5, max: 1000 });
  return withTransaction(async (client) => {
    const g = await lockGrievance(client, id);
    if (g.status === 'Resolved') throw new AppError(409, 'A resolved grievance cannot be escalated');
    if (g.escalated) throw new AppError(409, 'Grievance is already escalated');
    const { rows } = await client.query(
      'UPDATE grievances SET escalated = true, escalated_at = now(), updated_at = now() WHERE id = $1 RETURNING *', [id]);
    await writeHistory(client, { grievanceId: id, eventType: 'escalation', user, remark: `Escalated by the CMO: ${remark}` });
    return rows[0];
  });
}

async function updatePriority(id, input, user) {
  requireRole(user, 'cmo');
  const priority = pick(input.priority, C.PRIORITIES, 'priority');
  return withTransaction(async (client) => {
    const g = await lockGrievance(client, id);
    if (g.status === 'Resolved') throw new AppError(409, 'Priority of a resolved grievance cannot be changed');
    if (g.priority === priority) return g;
    // Deadline is recalculated from the original submission date.
    const { rows } = await client.query(
      `UPDATE grievances SET priority = $1, updated_at = now(),
              due_date = created_at + make_interval(days => $2)
        WHERE id = $3 RETURNING *`, [priority, C.SLA_DAYS[priority], id]);
    await writeHistory(client, { grievanceId: id, eventType: 'priority_change', user, remark: `Priority changed from ${g.priority} to ${priority}` });
    return rows[0];
  });
}

async function addInternalRemark(id, input, user) {
  requireRole(user, 'cmo');
  const remark = cleanText(input.remark, 'remark', { max: 1000 });
  return withTransaction(async (client) => {
    await lockGrievance(client, id);
    const { rows } = await client.query(
      'INSERT INTO internal_remarks (grievance_id, author_id, remark) VALUES ($1,$2,$3) RETURNING *', [id, user.id, remark]);
    return rows[0];
  });
}

/* ---------- department officer ---------- */

async function officerUpdate(id, input, user) {
  requireRole(user, 'officer');
  const remark = cleanText(input.remark, 'remark', { min: 5, max: 1000 });
  const workStatus = input.workStatus ? pick(input.workStatus, ['Investigating'], 'workStatus') : null;
  return withTransaction(async (client) => {
    const g = await lockGrievance(client, id);
    const a = await getActiveAssignment(client, id);
    assertOfficerOwns(user, a);
    if (g.status !== 'In Progress') throw new AppError(409, 'Only grievances that are In Progress can be updated');
    if (workStatus && a.work_status === 'Assigned') {
      await client.query('UPDATE assignments SET work_status = $1, officer_id = COALESCE(officer_id, $3) WHERE id = $2', [workStatus, a.id, user.id]);
    }
    await client.query('UPDATE grievances SET updated_at = now() WHERE id = $1', [id]);
    await writeHistory(client, { grievanceId: id, eventType: 'officer_remark', user, remark });
    return g;
  });
}

async function submitAtr(id, input, user, file = null) {
  requireRole(user, 'officer');
  const atrText = cleanText(input.atrText, 'action-taken report', { min: 20, max: 2000 });
  return withTransaction(async (client) => {
    const g = await lockGrievance(client, id);
    const a = await getActiveAssignment(client, id);
    assertOfficerOwns(user, a);
    if (g.status !== 'In Progress') throw new AppError(409, 'Only grievances that are In Progress can receive a report');
    if (a.atr_submitted_at) throw new AppError(409, 'A report is already waiting for CMO review');
    const attachmentId = file ? await insertAttachment(client, id, user.id, 'atr', file) : a.atr_attachment_id;
    await client.query(
      `UPDATE assignments
          SET atr_text = $2, atr_attachment_id = $3, atr_submitted_at = now(),
              work_status = 'ATR Submitted', cmo_decision = 'pending',
              officer_id = COALESCE(officer_id, $4)
        WHERE id = $1`, [a.id, atrText, attachmentId, user.id]);
    await client.query('UPDATE grievances SET updated_at = now() WHERE id = $1', [id]);
    await writeHistory(client, { grievanceId: id, eventType: 'atr_submitted', user, remark: `Action-taken report submitted: ${atrText}` });
    return g;
  });
}

module.exports = {
  createGrievance, reopenGrievance, addFeedback,
  startReview, assignGrievance, reviewAtr, escalateGrievance, updatePriority, addInternalRemark,
  officerUpdate, submitAtr,
};
