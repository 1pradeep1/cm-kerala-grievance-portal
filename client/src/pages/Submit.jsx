import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, PriorityBadge } from '../components.jsx';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export default function Submit() {
  const [meta, setMeta] = useState({ districts: [], categories: [], priorities: [] });
  const [form, setForm] = useState({ district: '', category: '', subject: '', description: '', priority: 'Medium' });
  const [files, setFiles] = useState([]);
  const [ai, setAi] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => { api('/meta').then(setMeta).catch((e) => setError(e.message)); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onFiles = (e) => {
    const picked = Array.from(e.target.files);
    const bad = picked.find((f) => !TYPES.includes(f.type) || f.size > MAX_BYTES);
    if (picked.length > 3) setError('You can attach at most 3 files.');
    else if (bad) setError(`"${bad.name}" cannot be attached. Use PDF, JPG, PNG or WebP up to 5 MB.`);
    else { setError(''); setFiles(picked); return; }
    e.target.value = ''; setFiles([]);
  };

  const askAi = async () => {
    setAiError(''); setAi(null);
    if (!form.district) return setAiError('Please choose a district first.');
    if (form.description.trim().length < 20) return setAiError('Please describe the problem in at least 20 characters first.');
    setAiBusy(true);
    try { setAi(await api('/ai/analyze', { method: 'POST', body: { district: form.district, description: form.description } })); }
    catch (err) { setAiError(err.message); }
    setAiBusy(false);
  };
  const applyAi = () => setForm({ ...form, category: ai.category, priority: ai.priority });

  const submit = async (e) => {
    e.preventDefault(); setError('');
    setBusy(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    files.forEach((f) => fd.append('attachments', f));
    if (ai) {
      fd.append('aiSuggestion', JSON.stringify({
        category: ai.category, department: ai.department, priority: ai.priority, summary: ai.summary,
        reasoning: ai.reasoning, model: ai.model, source: ai.source,
        citizenEdited: form.category !== ai.category || form.priority !== ai.priority,
      }));
    }
    try { setDone((await api('/grievances', { method: 'POST', form: fd })).grievance); }
    catch (err) { setError(err.message); }
    setBusy(false);
  };

  if (done) {
    return (
      <div className="narrow card" style={{ textAlign: 'center' }}>
        <h1>Grievance submitted</h1>
        <p className="muted">Please keep your reference number. You can track progress with it at any time.</p>
        <p style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--green)', margin: '.5rem 0' }}>{done.refNo}</p>
        <p className="small muted">Target resolution date: {new Date(done.dueDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn" to={`/track/${done.refNo}`}>Track this grievance</Link>
          <Link className="btn ghost" to="/dashboard">My grievances</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mid">
      <h1>Submit a grievance</h1>
      <p className="muted">Prototype notice: please use fictional details only. Do not enter real personal information.</p>
      <form className="stack card" onSubmit={submit}>
        <div className="grid two">
          <label>District<select value={form.district} onChange={set('district')} required><option value="">Select district</option>{meta.districts.map((d) => <option key={d}>{d}</option>)}</select></label>
          <label>Category<select value={form.category} onChange={set('category')} required><option value="">Select category</option>{meta.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        </div>
        <label>Subject<input value={form.subject} onChange={set('subject')} required minLength={5} maxLength={150} placeholder="Short title of the problem" /></label>
        <label>Detailed description<textarea value={form.description} onChange={set('description')} required minLength={20} maxLength={2000} placeholder="What happened, where, since when, and who is affected?" /></label>
        <div className="small muted" style={{ marginTop: '-.5rem' }}>{form.description.length}/2000</div>

        <div className="card" style={{ background: '#f1f7f3' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div><b>AI Grievance Assistant</b><div className="small muted">Suggests a category, priority and summary. You stay in control and can change everything.</div></div>
            <button type="button" className="btn ghost small" onClick={askAi} disabled={aiBusy}>{aiBusy ? 'Analysing...' : 'Get AI suggestions'}</button>
          </div>
          <Alert>{aiError}</Alert>
          {ai && (
            <div style={{ marginTop: '.75rem' }}>
              <span className={`badge ${ai.source === 'llm' ? 'Resolved' : 'Under'}`}>{ai.source === 'llm' ? `AI suggestion (${ai.model})` : 'Fallback: keyword match, not AI'}</span>
              <Alert kind="info">{ai.notice}</Alert>
              <table style={{ marginTop: '.5rem' }}><tbody>
                <tr><th>Category</th><td>{ai.category}</td></tr>
                <tr><th>Department</th><td>{ai.department || 'Not sure'}</td></tr>
                <tr><th>Priority</th><td><PriorityBadge priority={ai.priority} /></td></tr>
                <tr><th>Summary</th><td>{ai.summary}</td></tr>
                {ai.reasoning && <tr><th>Why</th><td>{ai.reasoning}</td></tr>}
              </tbody></table>
              {ai.duplicates.length > 0 && <Alert kind="info">You may already have reported something similar: {ai.duplicates.map((d) => `${d.refNo} (${d.subject})`).join('; ')}. Please check before submitting again.</Alert>}
              <div className="row" style={{ marginTop: '.6rem' }}>
                <button type="button" className="btn small" onClick={applyAi}>Use this category and priority</button>
                <span className="small muted">This is only a suggestion. The Chief Minister's Office makes the final decision.</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid two">
          <label>Priority (your view)<select value={form.priority} onChange={set('priority')}>{meta.priorities.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label>Supporting files (optional)<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={onFiles} /><span className="small muted">Up to 3 files, 5 MB each: PDF, JPG, PNG or WebP</span></label>
        </div>
        <Alert>{error}</Alert>
        <button className="btn" disabled={busy}>{busy ? 'Submitting...' : 'Submit grievance'}</button>
      </form>
    </div>
  );
}
