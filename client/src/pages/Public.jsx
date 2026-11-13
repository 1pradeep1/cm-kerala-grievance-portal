import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert } from '../components.jsx';

export function Home() {
  const [stats, setStats] = useState(null);
  const [depts, setDepts] = useState([]);
  useEffect(() => {
    api('/stats/public').then(setStats).catch(() => {});
    api('/departments').then((d) => setDepts(d.departments.slice(0, 6))).catch(() => {});
  }, []);
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <h1>Your voice, directly to the Chief Minister's Office</h1>
          <p>Submit a public grievance, follow every step of its journey to the right department, and see the outcome. Built as a working prototype.</p>
          <div className="row" style={{ marginTop: '1rem' }}>
            <Link className="btn gold" to="/submit">Submit Grievance</Link>
            <Link className="btn ghost" to="/track">Track Grievance</Link>
          </div>
        </div>
      </section>
      <h2>Portal at a glance</h2>
      <div className="grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card stat"><b>{stats ? stats.total : '-'}</b><span>Grievances received</span></div>
        <div className="card stat"><b>{stats ? stats.in_action : '-'}</b><span>Being acted on</span></div>
        <div className="card stat"><b>{stats ? stats.resolved : '-'}</b><span>Resolved</span></div>
        <div className="card stat"><b>{stats && stats.avg_days_to_resolve != null ? `${stats.avg_days_to_resolve} days` : '-'}</b><span>Average time to resolve</span></div>
      </div>
      <h2>Featured departments</h2>
      <div className="grid">
        {depts.map((d) => <div className="card" key={d.id}><h3>{d.name}</h3><p>{d.description}</p></div>)}
      </div>
      <p><Link to="/departments">See all departments</Link></p>
    </>
  );
}

export const About = () => (
  <div className="mid">
    <h1>About this initiative</h1>
    <div className="card"><h3>Purpose</h3><p>To give every citizen of Kerala one simple, transparent channel to raise public grievances with the Chief Minister's Office and see them through to a result.</p></div>
    <div className="grid two" style={{ margin: '1rem 0' }}>
      <div className="card"><h3>Vision</h3><p>A responsive administration where no genuine grievance is lost, delayed without explanation, or closed without the citizen knowing.</p></div>
      <div className="card"><h3>Mission</h3><p>Receive grievances, route them to the right department quickly, track the action taken, and communicate outcomes clearly.</p></div>
    </div>
    <div className="card"><h3>Objectives</h3>
      <ul><li>One reference number and one status trail for every grievance</li><li>Faster routing to the responsible department and officer</li><li>Accountability through deadlines, escalation and action-taken reports</li><li>Human review of every decision, with AI used only to suggest</li></ul>
    </div>
    <p className="muted small">This site is a recruitment prototype using fictional data. It is not an official government service.</p>
  </div>
);

export const HowItWorks = () => (
  <div className="mid">
    <h1>How it works</h1>
    <ol className="steps">
      <li><b>Submit</b>Register, describe your grievance, choose the district and category, and attach a photo or document if you wish. An AI assistant can suggest the category and priority, and you can change them.</li>
      <li><b>Reference number</b>You receive a unique number such as CMK-2026-000123. Use it any time to track progress.</li>
      <li><b>CMO review</b>The Chief Minister's Office reviews your grievance and decides which department should act.</li>
      <li><b>Department assignment</b>The grievance is forwarded to the responsible department and officer with a deadline based on its priority.</li>
      <li><b>Action</b>The officer investigates, records progress and submits an action-taken report.</li>
      <li><b>Resolution</b>The CMO checks the report. If it is accepted, your grievance is marked Resolved and you can give feedback. If the problem persists, you can reopen it.</li>
    </ol>
  </div>
);

export function Departments() {
  const [depts, setDepts] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api('/departments').then((d) => setDepts(d.departments)).catch((e) => setError(e.message)); }, []);
  return (
    <>
      <h1>Departments</h1>
      <p className="muted">Sample departments used in this prototype.</p>
      <Alert>{error}</Alert>
      <div className="grid">{depts.map((d) => <div className="card" key={d.id}><h3>{d.name}</h3><p>{d.description}</p></div>)}</div>
    </>
  );
}

export function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [msg, setMsg] = useState({ ok: '', err: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg({ ok: '', err: '' });
    try { const d = await api('/contact', { method: 'POST', body: form }); setMsg({ ok: d.message, err: '' }); setForm({ name: '', email: '', subject: '', message: '' }); }
    catch (err) { setMsg({ ok: '', err: err.message }); }
    setBusy(false);
  };
  return (
    <div className="narrow">
      <h1>Contact us</h1>
      <p className="muted">For questions about the portal. To report a public issue, please use Submit Grievance.</p>
      <form className="stack card" onSubmit={submit}>
        <label>Name<input value={form.name} onChange={set('name')} required maxLength={100} /></label>
        <label>Email<input type="email" value={form.email} onChange={set('email')} required /></label>
        <label>Subject<input value={form.subject} onChange={set('subject')} required maxLength={150} /></label>
        <label>Message<textarea value={form.message} onChange={set('message')} required minLength={10} maxLength={2000} /></label>
        <Alert>{msg.err}</Alert><Alert kind="ok">{msg.ok}</Alert>
        <button className="btn" disabled={busy}>{busy ? 'Sending...' : 'Send message'}</button>
      </form>
    </div>
  );
}

const FAQS = [
  ['Who can submit a grievance?', 'Any citizen who registers with a name, email, mobile number and password.'],
  ['What can I complain about?', 'Public infrastructure, healthcare, education, water, electricity, sanitation, transport, land and revenue, social welfare and other public services.'],
  ['How do I track my grievance?', 'Use Track Grievance and enter your reference number (for example CMK-2026-000123). Logged-in citizens can also see everything under My grievances.'],
  ['What do the statuses mean?', 'Submitted: received. Under Review: the CMO is examining it. In Progress: a department is acting on it. Resolved: the CMO accepted the department\'s report. Reopened: you told us the problem persists.'],
  ['How long will it take?', 'Each grievance gets a deadline based on priority: High 7 days, Medium 15 days, Low 30 days. Overdue grievances can be escalated by the CMO.'],
  ['What if the issue is not really fixed?', 'Open the resolved grievance and choose Reopen with a short explanation. It returns to the CMO.'],
  ['Does AI decide my case?', 'No. AI only suggests a category, priority and summary, which you and the CMO can review and change. People make every decision.'],
  ['Which files can I attach?', 'PDF, JPG, PNG or WebP files, up to 5 MB each, three files at most.'],
];
export const FAQ = () => (
  <div className="mid">
    <h1>Frequently asked questions</h1>
    {FAQS.map(([q, a]) => <details className="faq" key={q}><summary>{q}</summary><p>{a}</p></details>)}
  </div>
);
