import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fmtDate, fmtDay, openAttachment } from '../api.js';
import { Alert, PriorityBadge, StatusBadge, Timeline } from '../components.jsx';
import { useAuth } from '../auth.jsx';

export function CitizenDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/grievances/mine').then(setData).catch((e) => setError(e.message)); }, []);
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Welcome, {user.name}</h1>
        <Link className="btn gold" to="/submit">Submit new grievance</Link>
      </div>
      <Alert>{error}</Alert>
      {data && (
        <>
          <div className="grid" style={{ margin: '1rem 0' }}>
            <div className="card stat"><b>{data.summary.total}</b><span>Submitted</span></div>
            <div className="card stat warn"><b>{data.summary.pending}</b><span>Pending</span></div>
            <div className="card stat"><b>{data.summary.resolved}</b><span>Resolved</span></div>
          </div>
          <h2>My grievances</h2>
          {data.grievances.length === 0 ? <div className="card"><p>You have not submitted any grievances yet.</p></div> : (
            <div className="scroll card" style={{ padding: 0 }}>
              <table>
                <thead><tr><th>Reference</th><th>Subject</th><th>Status</th><th>Department</th><th>Latest update</th><th>Submitted</th></tr></thead>
                <tbody>
                  {data.grievances.map((g) => (
                    <tr key={g.id} className="click" onClick={() => navigate(`/grievance/${g.id}`)}>
                      <td><Link to={`/grievance/${g.id}`}>{g.ref_no}</Link></td>
                      <td>{g.subject}<div className="small muted">{g.category} · {g.district}</div></td>
                      <td><StatusBadge status={g.status} /></td>
                      <td>{g.department_name || '-'}</td>
                      <td className="small">{g.latest_remark || '-'}</td>
                      <td className="small">{fmtDay(g.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

export function CitizenDetail() {
  const { id } = useParams();
  const [g, setG] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [fb, setFb] = useState({ rating: '5', comment: '' });
  const [reopen, setReopen] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api(`/grievances/${id}`).then((d) => setG(d.grievance)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const act = async (fn, okMsg) => {
    setError(''); setMsg(''); setBusy(true);
    try { await fn(); setMsg(okMsg); await load(); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  if (!g) return <><Link to="/dashboard">&larr; My grievances</Link><Alert>{error}</Alert>{!error && <p className="muted">Loading...</p>}</>;

  return (
    <div className="mid">
      <Link to="/dashboard">&larr; My grievances</Link>
      <div className="card" style={{ margin: '.75rem 0' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0 }}>{g.refNo}</h1>
          <span><StatusBadge status={g.status} /> <PriorityBadge priority={g.priority} /> {g.overdue && <span className="badge flag">Overdue</span>}</span>
        </div>
        <h3 style={{ marginTop: '.5rem' }}>{g.subject}</h3>
        <p style={{ whiteSpace: 'pre-wrap' }}>{g.description}</p>
        <div className="grid small">
          <div><span className="muted">District</span><br />{g.district}</div>
          <div><span className="muted">Category</span><br />{g.category}</div>
          <div><span className="muted">Department</span><br />{g.departmentName || 'Not yet assigned'}</div>
          <div><span className="muted">Target date</span><br />{fmtDay(g.dueDate)}</div>
        </div>
        {g.attachments.length > 0 && (
          <p className="small" style={{ marginBottom: 0 }}>Attachments: {g.attachments.map((a) => (
            <button key={a.id} className="btn ghost small" style={{ marginRight: 6 }} onClick={() => openAttachment(a.id).catch((e) => setError(e.message))}>{a.original_name}</button>
          ))}</p>
        )}
      </div>
      <Alert>{error}</Alert><Alert kind="ok">{msg}</Alert>
      <h2>Updates and status history</h2>
      <div className="card"><Timeline items={g.history} /></div>

      {g.status === 'Resolved' && (
        <div className="grid two" style={{ marginTop: '1rem' }}>
          <div className="card">
            <h3>Your feedback</h3>
            {g.feedback ? <p>You rated this resolution <b>{g.feedback.rating}/5</b>{g.feedback.comment ? `: "${g.feedback.comment}"` : ''}</p> : (
              <form className="stack" onSubmit={(e) => { e.preventDefault(); act(() => api(`/grievances/${id}/feedback`, { method: 'POST', body: fb }), 'Thank you for your feedback.'); }}>
                <label>Rating<select value={fb.rating} onChange={(e) => setFb({ ...fb, rating: e.target.value })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} {n === 5 ? '(very satisfied)' : n === 1 ? '(not satisfied)' : ''}</option>)}</select></label>
                <label>Comment (optional)<textarea style={{ minHeight: 70 }} value={fb.comment} onChange={(e) => setFb({ ...fb, comment: e.target.value })} maxLength={1000} /></label>
                <button className="btn" disabled={busy}>Send feedback</button>
              </form>
            )}
          </div>
          <div className="card">
            <h3>Problem not fixed?</h3>
            <form className="stack" onSubmit={(e) => { e.preventDefault(); act(() => api(`/grievances/${id}/reopen`, { method: 'POST', body: { remark: reopen } }), 'Your grievance has been reopened.'); }}>
              <label>Tell us what is still wrong<textarea style={{ minHeight: 70 }} value={reopen} onChange={(e) => setReopen(e.target.value)} required minLength={10} maxLength={1000} /></label>
              <button className="btn danger" disabled={busy}>Reopen grievance</button>
            </form>
          </div>
        </div>
      )}
      <p className="small muted" style={{ marginTop: '1rem' }}>Last updated {fmtDate(g.updatedAt)}</p>
    </div>
  );
}
