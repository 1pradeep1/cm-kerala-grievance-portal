import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from './auth.jsx';
import { Home, About, HowItWorks, Departments, Contact, FAQ } from './pages/Public.jsx';
import { Login, Register } from './pages/AuthPages.jsx';
import { RequireRole } from './components.jsx';
import Submit from './pages/Submit.jsx';
import Track from './pages/Track.jsx';
import { CitizenDashboard, CitizenDetail } from './pages/Citizen.jsx';
import { CmoDashboard, CmoDetail } from './pages/Cmo.jsx';
import { OfficerDashboard, OfficerDetail } from './pages/Officer.jsx';

function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <>
      <div className="banner">Recruitment prototype built for a technical assessment. Not affiliated with, or endorsed by, the Government of Kerala or the Chief Minister's Office. All data is fictional.</div>
      <header className="top">
        <div className="wrap">
          <Link to="/" className="brand">CM Kerala Grievance Portal<small>Chief Minister's Public Grievance Redressal (prototype)</small></Link>
          <nav aria-label="Main">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/about">About</NavLink>
            <NavLink to="/how-it-works">How it works</NavLink>
            <NavLink to="/departments">Departments</NavLink>
            <NavLink to="/faq">FAQ</NavLink>
            <NavLink to="/contact">Contact</NavLink>
            <NavLink to="/track">Track</NavLink>
            {user ? (
              <>
                <NavLink to={homeFor(user)}>{user.role === 'citizen' ? 'My grievances' : 'Dashboard'}</NavLink>
                <button className="link" onClick={() => { logout(); navigate('/'); }}>Logout ({user.name.split(' ')[0]})</button>
              </>
            ) : (
              <>
                <NavLink to="/login">Login</NavLink>
                <NavLink to="/register">Register</NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main><div className="wrap">{children}</div></main>
      <footer>
        <div className="wrap">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>CM Kerala Grievance Portal: recruitment prototype for WhiteMatrix Software Solutions. Fictional data only.</span>
            <span><Link to="/about">About</Link> · <Link to="/faq">FAQ</Link> · <Link to="/contact">Contact</Link></span>
          </div>
        </div>
      </footer>
    </>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/departments" element={<Departments />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/track/:ref?" element={<Track />} />
        <Route path="/submit" element={<RequireRole role="citizen"><Submit /></RequireRole>} />
        <Route path="/dashboard" element={<RequireRole role="citizen"><CitizenDashboard /></RequireRole>} />
        <Route path="/grievance/:id" element={<RequireRole role="citizen"><CitizenDetail /></RequireRole>} />
        <Route path="/cmo" element={<RequireRole role="cmo"><CmoDashboard /></RequireRole>} />
        <Route path="/cmo/grievance/:id" element={<RequireRole role="cmo"><CmoDetail /></RequireRole>} />
        <Route path="/officer" element={<RequireRole role="officer"><OfficerDashboard /></RequireRole>} />
        <Route path="/officer/grievance/:id" element={<RequireRole role="officer"><OfficerDetail /></RequireRole>} />
        <Route path="*" element={<div className="card"><h2>Page not found</h2><p><Link to="/">Go to the home page</Link></p></div>} />
      </Routes>
    </Layout>
  );
}
