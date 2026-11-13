import { fmtDay, fmtDate, openAttachment } from '../api.js';
import { PriorityBadge, StatusBadge } from '../components.jsx';

// Case summary used by both the CMO and officer screens.
export function CaseInfo({ g, contact = false, onError = () => {} }) {
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>{g.refNo}</h1>
        <span><StatusBadge status={g.status} /> <PriorityBadge priority={g.priority} /> {g.escalated && <span className="badge flag">Escalated</span>} {g.overdue && <span className="badge flag">Overdue</span>}</span>
      </div>
      <h3 style={{ marginTop: '.5rem' }}>{g.subject}</h3>
      <p style={{ whiteSpace: 'pre-wrap' }}>{g.description}</p>
      <div className="grid small">
        <div><span className="muted">District</span><br />{g.district}</div>
        <div><span className="muted">Category</span><br />{g.category}</div>
        <div><span className="muted">Department</span><br />{g.departmentName || 'Not assigned'}</div>
        <div><span className="muted">Deadline</span><br />{fmtDay(g.dueDate)}</div>
        <div><span className="muted">Submitted</span><br />{fmtDate(g.createdAt)}</div>
        <div><span className="muted">Reopened</span><br />{g.reopenCount} time(s)</div>
        <div><span className="muted">Citizen</span><br />{g.citizen.name}{contact && <><br />{g.citizen.email}<br />{g.citizen.mobile}</>}</div>
      </div>
      {g.attachments.length > 0 && (
        <p className="small" style={{ marginBottom: 0 }}>Files: {g.attachments.map((a) => (
          <button key={a.id} className="btn ghost small" style={{ marginRight: 6 }} onClick={() => openAttachment(a.id).catch((e) => onError(e.message))}>
            {a.kind === 'atr' ? '[Report] ' : ''}{a.original_name}
          </button>
        ))}</p>
      )}
    </div>
  );
}

// AI output is shown for human review only. It never changes a grievance by itself.
export function AiCard({ ai }) {
  if (!ai || (!ai.summary && !ai.source)) return null;
  const s = ai.suggestion || {};
  return (
    <div className="card" style={{ background: '#f1f7f3' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>AI assistant (suggestion only)</h3>
        <span className={`badge ${ai.source === 'llm' ? 'Resolved' : 'Under'}`}>{ai.source === 'llm' ? `AI${s.model ? ` (${s.model})` : ''}` : 'Fallback keyword match, not AI'}</span>
      </div>
      {ai.summary && <p style={{ margin: '.5rem 0' }}><b>Summary for CMO:</b> {ai.summary}</p>}
      <p className="small muted" style={{ margin: 0 }}>
        Suggested: {s.category || '-'} · {s.department || '-'} · priority {s.priority || '-'}
        {s.citizenEdited ? ' · the citizen changed the AI suggestion' : ''}
      </p>
      {s.reasoning && <p className="small muted" style={{ margin: '.25rem 0 0' }}>Reasoning: {s.reasoning}</p>}
      {s.possibleDuplicates?.length > 0 && (
        <div className="alert info" style={{ marginBottom: 0 }}>
          <b>Possible duplicates (please review):</b>
          <ul style={{ margin: '.25rem 0 0', paddingLeft: '1.2rem' }}>
            {s.possibleDuplicates.map((d) => <li key={d.refNo}>{d.refNo}: {d.subject} ({d.status}, {Math.round(d.similarity * 100)}% similar)</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export const Pager = ({ page, limit, total, onPage }) => (
  <div className="row" style={{ justifyContent: 'space-between', margin: '.6rem 0' }}>
    <span className="small muted">{total} grievance(s)</span>
    <span className="row">
      <button className="btn ghost small" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span className="small">Page {page} of {Math.max(1, Math.ceil(total / limit))}</span>
      <button className="btn ghost small" disabled={page * limit >= total} onClick={() => onPage(page + 1)}>Next</button>
    </span>
  </div>
);
