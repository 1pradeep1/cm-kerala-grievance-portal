import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fmtDay } from '../api.js';
import { Alert, StatusBadge, Timeline } from '../components.jsx';

export default function Track() {
  const { ref: refParam } = useParams();
  const navigate = useNavigate();
  const [ref, setRef] = useState(refParam || '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const search = async (value) => {
    setError(''); setResult(null); setBusy(true);
    try { setResult(await api(`/grievances/track/${encodeURIComponent(value.trim())}`)); }
    catch (err) { setError(err.message); }
    setBusy(false);
  };
  useEffect(() => { if (refParam) { setRef(refParam); search(refParam); } }, [refParam]); // eslint-disable-line

  const submit = (e) => { e.preventDefault(); navigate(`/track/${ref.trim().toUpperCase()}`); };
  const g = result?.grievance;
  return (
    <div className="mid">
      <h1>Track a grievance</h1>
      <form className="row card" onSubmit={submit}>
        <input style={{ flex: 1, minWidth: 220 }} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Reference number, e.g. CMK-2026-000001" required aria-label="Reference number" />
        <button className="btn" disabled={busy}>{busy ? 'Searching...' : 'Track'}</button>
      </form>
      <Alert>{error}</Alert>
      {g && (
        <>
          <div className="card" style={{ margin: '1rem 0' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>{g.ref_no}</h2>
              <span><StatusBadge status={g.status} /> {g.overdue && <span className="badge flag">Overdue</span>}</span>
            </div>
            <p><b>{g.subject}</b></p>
            <div className="grid" style={{ fontSize: '.92rem' }}>
              <div><span className="muted">District</span><br />{g.district}</div>
              <div><span className="muted">Category</span><br />{g.category}</div>
              <div><span className="muted">Assigned department</span><br />{g.department_name || 'Not yet assigned'}</div>
              <div><span className="muted">Submitted</span><br />{fmtDay(g.created_at)}</div>
              <div><span className="muted">Target date</span><br />{fmtDay(g.due_date)}</div>
            </div>
          </div>
          <h2>Status history</h2>
          <div className="card"><Timeline items={result.history} /></div>
        </>
      )}
    </div>
  );
}
