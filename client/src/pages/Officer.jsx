import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fmtDay } from '../api.js';
import { Alert, PriorityBadge, StatusBadge, Timeline } from '../components.jsx';
import { useAuth } from '../auth.jsx';
import { AiCard, CaseInfo, Pager } from './Shared.jsx';

export function OfficerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ grievances: [], total: 0, limit: 20 });
  const [error, setError] = useState('');
  useEffect(() => {
    const p = new URLSearchParams({ page, limit: 20 });
    if (status) p.set('status', status);
    api(`/officer/grievances?${p}`).then(setList).catch((e) => setError(e.message));
  }, [status, page]);
  return (
    <>
      <h1>Department officer dashboard</h1>
      <p className="muted">Grievances forwarded to your department by the Chief Minister's Office. Signed in as {user.name}.</p>
      <Alert>{error}</Alert>
      <div className="row"><label style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>Status
        <select style={{ width: 'auto' }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option><option>In Progress</option><option>Resolved</option>
        </select></label></div>
      <Pager page={page} limit={list.limit} total={list.total} onPage={setPage} />
      <div className="card scroll" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Reference</th><th>Subject</th><th>District</th><th>Priority</th><th>Status</th><th>My work</th><th>Deadline</th></tr></thead>
          <tbody>
            {list.grievances.map((g) => (
              <tr key={g.id} className="click" onClick={() => navigate(`/officer/grievance/${g.id}`)}>
                <td><Link to={`/officer/grievance/${g.id}`}>{g.ref_no}</Link></td>
                <td>{g.subject}<div className="small muted">{g.category}</div></td>
                <td>{g.district}</td><td><PriorityBadge priority={g.priority} /></td>
                <td><StatusBadge status={g.status} /></td>
                <td className="small">{g.work_status}</td>
                <td className="small">{fmtDay(g.due_date)} {g.overdue && <span className="badge flag">Overdue</span>}</td>
              </tr>
            ))}
            {list.grievances.length === 0 && <tr><td colSpan="7" className="muted">Nothing forwarded to your department right now.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function OfficerDetail() {
  const { id } = useParams();
  const [g, setG] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [upd, setUpd] = useState({ remark: '', workStatus: '' });
  const [atrText, setAtrText] = useState('');
  const [file, setFile] = useState(null);

  const load = () => api(`/officer/grievances/${id}`).then((d) => setG(d.grievance)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line
  const act = async (fn, ok, reset) => {
    setError(''); setMsg(''); setBusy(true);
    try { await fn(); setMsg(ok); if (reset) reset(); await load(); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  if (!g) return <><Link to="/officer">&larr; Dashboard</Link><Alert>{error}</Alert>{!error && <p className="muted">Loading...</p>}</>;
  const a = g.assignment;
  const active = g.status === 'In Progress' && a;

  return (
    <>
      <Link to="/officer">&larr; Dashboard</Link>
      <div style={{ display: 'grid', gap: '1rem', marginTop: '.75rem' }}>
        <CaseInfo g={g} onError={setError} />
        <Alert>{error}</Alert><Alert kind="ok">{msg}</Alert>
        {g.ai?.summary && <AiCard ai={{ ...g.ai, suggestion: { ...g.ai.suggestion, possibleDuplicates: [] } }} />}
        {a?.instructions && <div className="alert info"><b>Instructions from the CMO:</b> {a.instructions}</div>}

        {a && (
          <div className="grid two">
            <div className="card">
              <h3>Update progress</h3>
              {!active ? <p className="muted small">This grievance is not open for updates.</p> : (
                <form className="stack" onSubmit={(e) => { e.preventDefault(); act(() => api(`/officer/grievances/${id}/status`, { method: 'PATCH', body: { remark: upd.remark, workStatus: upd.workStatus || undefined } }), 'Progress update saved', () => setUpd({ remark: '', workStatus: '' })); }}>
                  <label>Investigation remark (visible to the citizen)<textarea style={{ minHeight: 80 }} value={upd.remark} onChange={(e) => setUpd({ ...upd, remark: e.target.value })} required minLength={5} maxLength={1000} /></label>
                  {a.workStatus === 'Assigned' && <label>Work status<select value={upd.workStatus} onChange={(e) => setUpd({ ...upd, workStatus: e.target.value })}><option value="">Keep as Assigned</option><option value="Investigating">Investigating</option></select></label>}
                  <button className="btn" disabled={busy}>Save update</button>
                </form>
              )}
            </div>
            <div className="card">
              <h3>Action-taken report</h3>
              {a.atrPending && <div className="alert info">Report submitted. Waiting for CMO review.<p style={{ whiteSpace: 'pre-wrap', margin: '.3rem 0 0' }}>{a.atrText}</p></div>}
              {a.cmoDecision === 'rejected' && !a.atrPending && <div className="alert err">Returned by the CMO: {a.decisionRemark}</div>}
              {a.cmoDecision === 'accepted' && <div className="alert ok">Accepted by the CMO: {a.decisionRemark}</div>}
              {active && !a.atrPending && (
                <form className="stack" onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(); fd.append('atrText', atrText); if (file) fd.append('file', file);
                  act(() => api(`/officer/grievances/${id}/atr`, { method: 'POST', form: fd }), 'Report submitted to the CMO', () => { setAtrText(''); setFile(null); });
                }}>
                  <label>What action was taken?<textarea style={{ minHeight: 110 }} value={atrText} onChange={(e) => setAtrText(e.target.value)} required minLength={20} maxLength={2000} placeholder="Describe the investigation, the action taken and the outcome" /></label>
                  <label>Supporting file (optional)<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files[0] || null)} /></label>
                  <button className="btn" disabled={busy}>Submit report to the CMO</button>
                </form>
              )}
            </div>
          </div>
        )}
        <h2 style={{ margin: 0 }}>History</h2>
        <div className="card"><Timeline items={g.history} staff /></div>
      </div>
    </>
  );
}
