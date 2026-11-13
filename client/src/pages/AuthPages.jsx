import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../auth.jsx';
import { Alert } from '../components.jsx';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { const u = await login(form.email, form.password); navigate(location.state?.from || homeFor(u), { replace: true }); }
    catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <div className="narrow">
      <h1>Login</h1>
      <form className="stack card" onSubmit={submit}>
        <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="username" /></label>
        <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="current-password" /></label>
        <Alert>{error}</Alert>
        <button className="btn" disabled={busy}>{busy ? 'Signing in... (first load may take a few seconds)' : 'Login'}</button>
        <span className="small muted">New citizen? <Link to="/register">Create an account</Link>. Staff accounts (CMO and officers) are issued by the administrator.</span>
      </form>
    </div>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', mobile: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await register(form); navigate('/dashboard', { replace: true }); }
    catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <div className="narrow">
      <h1>Citizen registration</h1>
      <form className="stack card" onSubmit={submit}>
        <label>Full name<input value={form.name} onChange={set('name')} required minLength={2} maxLength={100} autoComplete="name" /></label>
        <label>Email<input type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></label>
        <label>Mobile number<input value={form.mobile} onChange={set('mobile')} required inputMode="numeric" pattern="[6-9][0-9]{9}" title="10-digit Indian mobile number" autoComplete="tel" /></label>
        <label>Password (8 or more characters)<input type="password" value={form.password} onChange={set('password')} required minLength={8} maxLength={72} autoComplete="new-password" /></label>
        <p className="small muted" style={{ margin: 0 }}>Prototype notice: please do not enter real personal details or real grievances.</p>
        <Alert>{error}</Alert>
        <button className="btn" disabled={busy}>{busy ? 'Creating account...' : 'Register'}</button>
        <span className="small muted">Already registered? <Link to="/login">Login</Link></span>
      </form>
    </div>
  );
}
