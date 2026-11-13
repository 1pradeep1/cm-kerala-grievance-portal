import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from './auth.jsx';
import { fmtDate } from './api.js';

export const statusClass = (s) => s.split(' ')[1] === 'Review' ? 'Under' : s.split(' ')[1] === 'Progress' ? 'Progress' : s;
export const StatusBadge = ({ status }) => <span className={`badge ${statusClass(status)}`}>{status}</span>;
export const PriorityBadge = ({ priority }) => <span className={`badge ${priority}`}>{priority}</span>;

export const Alert = ({ kind = 'err', children }) => (children ? <div className={`alert ${kind}`} role={kind === 'err' ? 'alert' : 'status'}>{children}</div> : null);

// Keeps each dashboard for its own role; anyone else is sent to login or to their own home.
export function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="muted">Loading...</p>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return children;
}

const EVENT_LABEL = {
  created: 'Grievance submitted', assignment: 'Forwarded to another department', officer_remark: 'Officer update',
  atr_submitted: 'Department report submitted', atr_rejected: 'Report returned by the CMO', escalation: 'Escalated',
  priority_change: 'Priority changed', feedback: 'Citizen feedback',
};
const eventLabel = (h) => (h.event_type === 'status_change' ? `${h.old_status} → ${h.new_status}` : EVENT_LABEL[h.event_type] || h.event_type);

// Full lifecycle of a grievance. Staff see names; citizens and the public see roles only.
export function Timeline({ items, staff = false }) {
  return (
    <ol className="timeline">
      {items.map((h) => (
        <li key={h.id}>
          <b>{eventLabel(h)}</b>
          <span className="muted small"> · {fmtDate(h.created_at)} · {staff ? `${h.actor_name} (${h.actor_role})` : h.actor_name}</span>
          {h.remark && <div>{h.remark}</div>}
        </li>
      ))}
    </ol>
  );
}
