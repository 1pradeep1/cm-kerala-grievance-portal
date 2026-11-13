// Read-side queries: lists, detail views and statistics, with per-role visibility rules.
const { pool } = require('../db/pool');
const { AppError } = require('../utils/errors');
const C = require('../constants');

const OVERDUE_SQL = "(g.status <> 'Resolved' AND g.due_date < now())";

/* ---------- history ---------- */

// audience 'staff' sees names and full remarks. 'citizen' (and the public tracker) sees roles only,
// and never sees the text of an action-taken report before the CMO has decided on it.
async function getHistory(grievanceId, audience) {
  const { rows } = await pool.query(
    `SELECT h.id, h.event_type, h.old_status, h.new_status, h.actor_role, u.name AS actor_name,
            h.remark, h.created_at
       FROM grievance_history h JOIN users u ON u.id = h.changed_by
      WHERE h.grievance_id = $1 ORDER BY h.created_at, h.id`, [grievanceId]);
  return rows.map((r) => {
    if (audience === 'staff') return r;
    const hidden = r.event_type === 'atr_submitted' || r.event_type === 'atr_rejected';
    const label = r.actor_role === 'citizen' ? 'Citizen' : r.actor_role === 'cmo' ? 'Chief Minister\'s Office' : 'Department officer';
    return {
      id: r.id, event_type: r.event_type, old_status: r.old_status, new_status: r.new_status,
      actor_role: r.actor_role, actor_name: label,
      remark: hidden ? (r.event_type === 'atr_submitted' ? 'Department submitted its report for CMO review' : 'CMO asked the department for more detail') : r.remark,
      created_at: r.created_at,
    };
  });
}

/* ---------- public tracking (no login, no personal data) ---------- */

async function trackByRef(refNo) {
  const { rows } = await pool.query(
    `SELECT g.id, g.ref_no, g.subject, g.category, g.district, g.status, g.created_at, g.updated_at, g.due_date,
            d.name AS department_name, ${OVERDUE_SQL} AS overdue
       FROM grievances g LEFT JOIN departments d ON d.id = g.department_id
      WHERE g.ref_no = $1`, [String(refNo).trim().toUpperCase()]);
  const g = rows[0];
  if (!g) throw new AppError(404, 'No grievance found with that reference number');
  const history = await getHistory(g.id, 'citizen');
  delete g.id;
  return { grievance: g, history };
}

/* ---------- detail view ---------- */

async function getGrievanceDetail(id, viewer) {
  const { rows } = await pool.query(
    `SELECT g.*, d.name AS department_name, ${OVERDUE_SQL} AS overdue,
            c.name AS citizen_name, c.email AS citizen_email, c.mobile AS citizen_mobile
       FROM grievances g
       JOIN users c ON c.id = g.citizen_id
       LEFT JOIN departments d ON d.id = g.department_id
      WHERE g.id = $1`, [id]);
  const g = rows[0];
  if (!g) throw new AppError(404, 'Grievance not found');

  const assignment = (await pool.query(
    `SELECT a.*, d.name AS department_name, o.name AS officer_name, ab.name AS assigned_by_name
       FROM assignments a JOIN departments d ON d.id = a.department_id
       LEFT JOIN users o ON o.id = a.officer_id JOIN users ab ON ab.id = a.assigned_by
      WHERE a.grievance_id = $1 AND a.is_active`, [id])).rows[0] || null;

  // Access rules. Anything the viewer may not see is reported as "not found".
  if (viewer.role === 'citizen' && g.citizen_id !== viewer.id) throw new AppError(404, 'Grievance not found');
  if (viewer.role === 'officer') {
    const ok = assignment && assignment.department_id === viewer.department_id
      && (assignment.officer_id === null || assignment.officer_id === viewer.id);
    if (!ok) throw new AppError(404, 'Grievance not found');
  }

  const staff = viewer.role !== 'citizen';
  const attachments = (await pool.query(
    `SELECT a.id, a.kind, a.original_name, a.mime_type, a.size_bytes, a.created_at
       FROM attachments a WHERE a.grievance_id = $1 ${staff ? '' : "AND a.kind = 'evidence'"} ORDER BY a.id`, [id])).rows;
  const history = await getHistory(id, staff ? 'staff' : 'citizen');
  const feedback = (await pool.query('SELECT rating, comment, created_at FROM feedback WHERE grievance_id = $1', [id])).rows[0] || null;

  const detail = {
    id: g.id, refNo: g.ref_no, subject: g.subject, description: g.description, district: g.district,
    category: g.category, priority: g.priority, status: g.status, departmentName: g.department_name,
    dueDate: g.due_date, overdue: g.overdue, escalated: g.escalated, reopenCount: g.reopen_count,
    createdAt: g.created_at, updatedAt: g.updated_at, resolvedAt: g.resolved_at,
    attachments, history, feedback,
  };

  if (staff) {
    // Contact details go to the CMO only; officers see just the citizen's name.
    detail.citizen = viewer.role === 'cmo' ? { name: g.citizen_name, email: g.citizen_email, mobile: g.citizen_mobile } : { name: g.citizen_name };
    detail.ai = { summary: g.ai_summary, source: g.ai_source, suggestion: g.ai_suggestion };
    detail.assignment = assignment && {
      id: assignment.id, departmentId: assignment.department_id, departmentName: assignment.department_name,
      officerName: assignment.officer_name, instructions: assignment.instructions, workStatus: assignment.work_status,
      atrText: assignment.atr_text, atrAttachmentId: assignment.atr_attachment_id, atrSubmittedAt: assignment.atr_submitted_at,
      cmoDecision: assignment.cmo_decision, decisionRemark: assignment.decision_remark, createdAt: assignment.created_at,
      atrPending: !!assignment.atr_submitted_at && assignment.cmo_decision === 'pending',
    };
  }
  if (viewer.role === 'cmo') {
    detail.internalRemarks = (await pool.query(
      `SELECT r.id, r.remark, r.created_at, u.name AS author_name FROM internal_remarks r
         JOIN users u ON u.id = r.author_id WHERE r.grievance_id = $1 ORDER BY r.created_at DESC`, [id])).rows;
  }
  return detail;
}

/* ---------- lists ---------- */

const pickEnum = (value, allowed, name) => {
  if (value === undefined || value === '') return null;
  if (!allowed.includes(value)) throw new AppError(400, `${name} must be one of: ${allowed.join(', ')}`);
  return value;
};

// Used by the CMO (all grievances) and officers (only those assigned to them / their department).
async function listGrievances(query, viewer) {
  const where = []; const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };

  const district = pickEnum(query.district, C.DISTRICTS, 'district');
  const category = pickEnum(query.category, C.CATEGORIES, 'category');
  const priority = pickEnum(query.priority, C.PRIORITIES, 'priority');
  const status = pickEnum(query.status, C.STATUSES, 'status');
  if (district) add('g.district = ?', district);
  if (category) add('g.category = ?', category);
  if (priority) add('g.priority = ?', priority);
  if (status) add('g.status = ?', status);
  if (query.departmentId) add('g.department_id = ?', Number(query.departmentId) || 0);
  if (query.overdue === 'true') where.push(OVERDUE_SQL);
  if (query.escalated === 'true') where.push('g.escalated');
  if (query.q) {
    params.push(`%${String(query.q).trim().slice(0, 100)}%`);
    where.push(`(g.ref_no ILIKE $${params.length} OR g.subject ILIKE $${params.length})`);
  }

  if (viewer.role === 'officer') {
    add('a.department_id = ?', viewer.department_id);
    add('(a.officer_id IS NULL OR a.officer_id = ?)', viewer.id);
  }

  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  params.push(limit, (page - 1) * limit);

  const { rows } = await pool.query(
    `SELECT g.id, g.ref_no, g.subject, g.district, g.category, g.priority, g.status, g.escalated,
            g.due_date, g.created_at, g.updated_at, d.name AS department_name, g.ai_source,
            ${OVERDUE_SQL} AS overdue, a.work_status,
            (a.atr_submitted_at IS NOT NULL AND a.cmo_decision = 'pending') AS atr_pending,
            count(*) OVER()::int AS total
       FROM grievances g
       LEFT JOIN departments d ON d.id = g.department_id
       LEFT JOIN assignments a ON a.grievance_id = g.id AND a.is_active
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY g.created_at DESC, g.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return {
    total: rows.length ? rows[0].total : 0, page, limit,
    grievances: rows.map(({ total, ...r }) => r),
  };
}

async function listForCitizen(citizenId) {
  const { rows } = await pool.query(
    `SELECT g.id, g.ref_no, g.subject, g.district, g.category, g.priority, g.status, g.created_at, g.updated_at,
            d.name AS department_name, (f.id IS NOT NULL) AS has_feedback,
            (SELECT remark FROM grievance_history h WHERE h.grievance_id = g.id
                AND h.event_type IN ('status_change','officer_remark','escalation') AND h.actor_role <> 'citizen'
              ORDER BY h.created_at DESC, h.id DESC LIMIT 1) AS latest_remark
       FROM grievances g LEFT JOIN departments d ON d.id = g.department_id
       LEFT JOIN feedback f ON f.grievance_id = g.id
      WHERE g.citizen_id = $1 ORDER BY g.created_at DESC, g.id DESC`, [citizenId]);
  return {
    summary: {
      total: rows.length,
      resolved: rows.filter((r) => r.status === 'Resolved').length,
      pending: rows.filter((r) => r.status !== 'Resolved').length,
    },
    grievances: rows,
  };
}

/* ---------- statistics ---------- */

async function cmoStats() {
  const totals = (await pool.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status <> 'Resolved')::int AS pending,
            count(*) FILTER (WHERE status = 'Resolved')::int AS resolved,
            count(*) FILTER (WHERE status <> 'Resolved' AND due_date < now())::int AS overdue,
            count(*) FILTER (WHERE escalated AND status <> 'Resolved')::int AS escalated,
            count(*) FILTER (WHERE status = 'Reopened')::int AS reopened
       FROM grievances`)).rows[0];
  const group = async (sql) => (await pool.query(sql)).rows;
  const byStatus = await group('SELECT status, count(*)::int AS count FROM grievances GROUP BY status');
  const byDistrict = await group(
    `SELECT district AS name, count(*)::int AS total,
            count(*) FILTER (WHERE status <> 'Resolved')::int AS pending,
            count(*) FILTER (WHERE status = 'Resolved')::int AS resolved,
            count(*) FILTER (WHERE status <> 'Resolved' AND due_date < now())::int AS overdue
       FROM grievances GROUP BY district ORDER BY total DESC, name`);
  const byDepartment = await group(
    `SELECT d.id, d.name, count(g.id)::int AS total,
            count(g.id) FILTER (WHERE g.status <> 'Resolved')::int AS pending,
            count(g.id) FILTER (WHERE g.status = 'Resolved')::int AS resolved,
            count(g.id) FILTER (WHERE g.status <> 'Resolved' AND g.due_date < now())::int AS overdue,
            round(avg(extract(epoch FROM g.resolved_at - g.created_at) / 86400)::numeric, 1)::float AS avg_days_to_resolve
       FROM departments d LEFT JOIN grievances g ON g.department_id = d.id
      GROUP BY d.id, d.name ORDER BY total DESC, d.name`);
  const byCategory = await group('SELECT category AS name, count(*)::int AS total FROM grievances GROUP BY category ORDER BY total DESC');
  const byPriority = await group('SELECT priority AS name, count(*)::int AS total FROM grievances GROUP BY priority');
  const extra = (await pool.query(
    `SELECT (SELECT count(*)::int FROM assignments WHERE is_active AND atr_submitted_at IS NOT NULL AND cmo_decision = 'pending') AS atr_awaiting_review,
            (SELECT round(avg(rating)::numeric, 1)::float FROM feedback) AS average_rating,
            (SELECT count(*)::int FROM feedback) AS feedback_count`)).rows[0];
  return {
    totals: { ...totals, ...extra },
    byStatus: C.STATUSES.map((s) => ({ status: s, count: (byStatus.find((r) => r.status === s) || {}).count || 0 })),
    byDistrict, byDepartment, byCategory,
    byPriority: C.PRIORITIES.map((p) => ({ name: p, total: (byPriority.find((r) => r.name === p) || {}).total || 0 })),
  };
}

async function publicStats() {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status = 'Resolved')::int AS resolved,
            count(*) FILTER (WHERE status NOT IN ('Resolved', 'Submitted'))::int AS in_action,
            (SELECT count(*)::int FROM departments) AS departments,
            round(avg(extract(epoch FROM resolved_at - created_at) / 86400) FILTER (WHERE status = 'Resolved')::numeric, 1)::float AS avg_days_to_resolve
       FROM grievances`);
  return rows[0];
}

module.exports = { getHistory, trackByRef, getGrievanceDetail, listGrievances, listForCitizen, cmoStats, publicStats };
