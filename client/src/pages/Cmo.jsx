import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, fmtDate, fmtDay, openAttachment } from '../api.js';
import { Alert, PriorityBadge, StatusBadge, Timeline } from '../components.jsx';
import { AiCard, CaseInfo, Pager } from './Shared.jsx';

const STATUS_COLORS = ['#3b82c4', '#d9962b', '#7c5cc4', '#2e9b55', '#c9453d'];
const EMPTY = { district: '', category: '', priority: '', status: '', departmentId: '', overdue: false, q: '' };

export function CmoDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState({ districts: [], categories: [], priorities: [], statuses: [] });
  const [depts, setDepts] = useState([]);
  const [filters, setFilters] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ grievances: [], total: 0, limit: 15 });
  const [error, setError] = useState('');

  useEffect(() => {
    api('/cmo/stats').then(setStats).catch((e) => setError(e.message));
    api('/meta').then(setMeta).catch(() => {});
    api('/departments').then((d) => setDepts(d.departments)).catch(() => {});
  }, []);
  useEffect(() => {
    const p = new URLSearchParams({ page, limit: 15 });
    Object.entries(applied).forEach(([k, v]) => { if (v) p.set(k, v); });
    api(`/cmo/grievances?${p}`).then(setList).catch((e) => setError(e.message));
  }, [applied, page]);

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const t = stats?.totals;
  return (
    <>
      <h1>Chief Minister's Office dashboard</h1>
      <Alert>{error}</Alert>
      {t && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', marginBottom: '1rem' }}>
          <div className="card stat"><b>{t.total}</b><span>Total</span></div>
          <div className="card stat warn"><b>{t.pending}</b><span>Pending</span></div>
          <div className="card stat"><b>{t.resolved}</b><span>Resolved</span></div>
          <div className="card stat bad"><b>{t.overdue}</b><span>Overdue</span></div>
          <div className="card stat bad"><b>{t.escalated}</b><span>Escalated</span></div>
          <div className="card stat warn"><b>{t.atr_awaiting_review}</b><span>Reports to review</span></div>
        </div>
      )}
      {stats && (
        <div className="grid two" style={{ marginBottom: '1rem' }}>
          <div className="card">
            <h3>Grievances by district</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.byDistrict} margin={{ left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" angle={-40} textAnchor="end" height={85} interval={0} fontSize={11} /><YAxis allowDecimals={false} />
                <Tooltip /><Legend verticalAlign="top" />
                <Bar dataKey="pending" name="Pending" stackId="a" fill="#d9962b" /><Bar dataKey="resolved" name="Resolved" stackId="a" fill="#2e9b55" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h3>Grievances by status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={stats.byStatus.filter((s) => s.count > 0)} dataKey="count" nameKey="status" outerRadius={100} label={(d) => `${d.status} (${d.count})`}>
                  {stats.byStatus.filter((s) => s.count > 0).map((s) => <Cell key={s.status} fill={STATUS_COLORS[stats.byStatus.findIndex((x) => x.status === s.status)]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {stats && (
        <div className="card scroll" style={{ marginBottom: '1rem' }}>
          <h3>Department-wise statistics</h3>
          <table>
            <thead><tr><th>Department</th><th>Total</th><th>Pending</th><th>Resolved</th><th>Overdue</th><th>Avg days to resolve</th></tr></thead>
            <tbody>{stats.byDepartment.map((d) => <tr key={d.id}><td>{d.name}</td><td>{d.total}</td><td>{d.pending}</td><td>{d.resolved}</td><td>{d.overdue || 0}</td><td>{d.avg_days_to_resolve ?? '-'}</td></tr>)}</tbody>
          </table>
        </div>
      )}

      <h2>All grievances</h2>
      <form className="card" onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(filters); }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
          <label>District<select value={filters.district} onChange={set('district')}><option value="">All</option>{meta.districts.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Category<select value={filters.category} onChange={set('category')}><option value="">All</option>{meta.categories.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Priority<select value={filters.priority} onChange={set('priority')}><option value="">All</option>{meta.priorities.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Status<select value={filters.status} onChange={set('status')}><option value="">All</option>{meta.statuses.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Department<select value={filters.departmentId} onChange={set('departmentId')}><option value="">All</option>{depts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Search<input value={filters.q} onChange={set('q')} placeholder="Reference or subject" /></label>
        </div>
        <div className="row" style={{ marginTop: '.7rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontWeight: 400 }}><input type="checkbox" style={{ width: 'auto' }} checked={filters.overdue} onChange={set('overdue')} /> Overdue only</label>
          <button className="btn small">Apply filters</button>
          <button type="button" className="btn ghost small" onClick={() => { setFilters(EMPTY); setApplied(EMPTY); setPage(1); }}>Clear</button>
        </div>
      </form>
      <Pager page={page} limit={list.limit} total={list.total} onPage={setPage} />
      <div className="card scroll" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Reference</th><th>Subject</th><th>District</th><th>Priority</th><th>Status</th><th>Department</th><th>Deadline</th></tr></thead>
          <tbody>
            {list.grievances.map((g) => (
              <tr key={g.id} className="click" onClick={() => navigate(`/cmo/grievance/${g.id}`)}>
                <td><Link to={`/cmo/grievance/${g.id}`}>{g.ref_no}</Link></td>
                <td>{g.subject}<div className="small muted">{g.category}</div>{g.atr_pending && <span className="badge Under">Report awaiting review</span>}</td>
                <td>{g.district}</td><td><PriorityBadge priority={g.priority} /></td>
                <td><StatusBadge status={g.status} /> {g.escalated && <span className="badge flag">Esc.</span>}</td>
                <td className="small">{g.department_name || '-'}</td>
                <td className="small">{fmtDay(g.due_date)} {g.overdue && <span className="badge flag">Overdue</span>}</td>
              </tr>
            ))}
            {list.grievances.length === 0 && <tr><td colSpan="7" className="muted">No grievances match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function CmoDetail() {
  const { id } = useParams();
  const [g, setG] = useState(null);
  const [depts, setDepts] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [assign, setAssign] = useState({ departmentId: '', officerId: '', instructions: '' });
  const [remark, setRemark] = useState('');
  const [esc, setEsc] = useState('');
  const [prio, setPrio] = useState('Medium');
  const [atr, setAtr] = useState({ decision: 'accept', remark: '' });

  const load = () => api(`/cmo/grievances/${id}`).then((d) => { setG(d.grievance); setPrio(d.grievance.priority); }).catch((e) => setError(e.message));
  useEffect(() => { load(); api('/departments').then((d) => setDepts(d.departments)); }, [id]); // eslint-disable-line
  useEffect(() => {
    if (!assign.departmentId) return setOfficers([]);
    api(`/cmo/officers?departmentId=${assign.departmentId}`).then((d) => setOfficers(d.officers)).catch(() => {});
  }, [assign.departmentId]);

  const act = async (fn, ok, reset) => {
    setError(''); setMsg(''); setBusy(true);
    try { await fn(); setMsg(ok); if (reset) reset(); await load(); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const post = (path, body, method = 'POST') => api(`/cmo/grievances/${id}${path}`, { method, body });
  if (!g) return <><Link to="/cmo">&larr; Dashboard</Link><Alert>{error}</Alert>{!error && <p className="muted">Loading...</p>}</>;
  const a = g.assignment;
  const open = g.status !== 'Resolved';

  return (
    <>
      <Link to="/cmo">&larr; Dashboard</Link>
      <div style={{ display: 'grid', gap: '1rem', marginTop: '.75rem' }}>
        <CaseInfo g={g} contact onError={setError} />
        <Alert>{error}</Alert><Alert kind="ok">{msg}</Alert>
        <AiCard ai={g.ai} />

        <div className="grid two">
          {open && (
            <div className="card">
              <h3>{g.status === 'In Progress' ? 'Reassign to another department' : 'Forward to a department'}</h3>
              {(g.status === 'Submitted' || g.status === 'Reopened') && (
                <p><button className="btn ghost small" disabled={busy} onClick={() => act(() => post('/status', { status: 'Under Review' }, 'PATCH'), 'Moved to Under Review')}>Mark Under Review</button> <span className="small muted">Forwarding also moves it to review automatically.</span></p>
              )}
              <form className="stack" onSubmit={(e) => { e.preventDefault(); act(() => post('/assign', assign), 'Forwarded to the department', () => setAssign({ departmentId: '', officerId: '', instructions: '' })); }}>
                <label>Department<select value={assign.departmentId} onChange={(e) => setAssign({ ...assign, departmentId: e.target.value, officerId: '' })} required><option value="">Select</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
                <label>Officer (optional)<select value={assign.officerId} onChange={(e) => setAssign({ ...assign, officerId: e.target.value })}><option value="">Any officer of the department</option>{officers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
                <label>Instructions for the officer (internal)<textarea style={{ minHeight: 70 }} value={assign.instructions} onChange={(e) => setAssign({ ...assign, instructions: e.target.value })} maxLength={1000} /></label>
                <button className="btn" disabled={busy}>Forward grievance</button>
              </form>
            </div>
          )}

          <div className="card">
            <h3>Department response</h3>
            {!a ? <p className="muted">Not forwarded to any department yet.</p> : (
              <>
                <p className="small"><b>{a.departmentName}</b> · officer: {a.officerName || 'any'} · work status: <b>{a.workStatus}</b></p>
                {a.instructions && <p className="small muted">Your instructions: {a.instructions}</p>}
                {a.atrText ? (
                  <div className="alert info">
                    <b>Action-taken report</b>{a.atrSubmittedAt ? ` (submitted ${fmtDate(a.atrSubmittedAt)})` : ' (returned to the department)'}
                    <p style={{ whiteSpace: 'pre-wrap', margin: '.4rem 0' }}>{a.atrText}</p>
                    {a.atrAttachmentId && <button className="btn ghost small" onClick={() => openAttachment(a.atrAttachmentId).catch((e) => setError(e.message))}>Open attached report file</button>}
                    {a.cmoDecision !== 'pending' && <p className="small" style={{ margin: '.4rem 0 0' }}>Your decision: {a.cmoDecision}. {a.decisionRemark}</p>}
                  </div>
                ) : <p className="muted small">No report submitted yet.</p>}
                {a.atrPending && (
                  <form className="stack" onSubmit={(e) => { e.preventDefault(); act(() => post('/review-atr', atr), atr.decision === 'accept' ? 'Report accepted. Grievance resolved.' : 'Report sent back to the department.', () => setAtr({ decision: 'accept', remark: '' })); }}>
                    <label>Your decision<select value={atr.decision} onChange={(e) => setAtr({ ...atr, decision: e.target.value })}><option value="accept">Accept report and resolve</option><option value="reject">Send back to the department</option></select></label>
                    <label>Remark (shown to the citizen when accepted)<textarea style={{ minHeight: 70 }} value={atr.remark} onChange={(e) => setAtr({ ...atr, remark: e.target.value })} required minLength={5} maxLength={1000} /></label>
                    <button className="btn" disabled={busy}>Save decision</button>
                  </form>
                )}
              </>
            )}
          </div>

          {open && (
            <div className="card">
              <h3>Priority and escalation</h3>
              <form className="row" onSubmit={(e) => { e.preventDefault(); act(() => post('/priority', { priority: prio }, 'PATCH'), 'Priority updated (deadline recalculated)'); }}>
                <select style={{ width: 'auto' }} value={prio} onChange={(e) => setPrio(e.target.value)}><option>Low</option><option>Medium</option><option>High</option></select>
                <button className="btn ghost small" disabled={busy || prio === g.priority}>Change priority</button>
              </form>
              {!g.escalated ? (
                <form className="stack" style={{ marginTop: '.8rem' }} onSubmit={(e) => { e.preventDefault(); act(() => post('/escalate', { remark: esc }), 'Grievance escalated', () => setEsc('')); }}>
                  <label>Escalate delayed grievance (reason)<textarea style={{ minHeight: 60 }} value={esc} onChange={(e) => setEsc(e.target.value)} required minLength={5} maxLength={1000} /></label>
                  <button className="btn danger small" disabled={busy}>Escalate</button>
                </form>
              ) : <p className="small muted">Already escalated on {fmtDate(g.updatedAt)}.</p>}
            </div>
          )}

          <div className="card">
            <h3>Internal remarks (never shown to citizens)</h3>
            <form className="stack" onSubmit={(e) => { e.preventDefault(); act(() => post('/remarks', { remark }), 'Remark saved', () => setRemark('')); }}>
              <textarea style={{ minHeight: 60 }} value={remark} onChange={(e) => setRemark(e.target.value)} required maxLength={1000} placeholder="Add an internal note" />
              <button className="btn ghost small" disabled={busy}>Save remark</button>
            </form>
            {g.internalRemarks.map((r) => <p key={r.id} className="small" style={{ borderTop: '1px solid var(--line)', paddingTop: '.4rem' }}>{r.remark}<br /><span className="muted">{r.author_name} · {fmtDate(r.created_at)}</span></p>)}
          </div>
        </div>

        {g.feedback && <div className="card"><b>Citizen feedback:</b> {g.feedback.rating}/5 {g.feedback.comment && `· "${g.feedback.comment}"`}</div>}
        <h2 style={{ margin: 0 }}>Full lifecycle</h2>
        <div className="card"><Timeline items={g.history} staff /></div>
      </div>
    </>
  );
}
