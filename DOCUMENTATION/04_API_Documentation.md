# 04. API Documentation

Base URL: `/api` (for example `https://<your-app>.onrender.com/api`). All bodies are JSON unless marked *multipart*. Protected routes need `Authorization: Bearer <token>` from login. Errors return `{ "error": "message" }` with a suitable HTTP status (400 validation, 401 not logged in, 403 wrong role, 404 not found or not visible, 409 workflow conflict).

## Authentication
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/auth/register` | public | Register a **citizen** (`name`, `email`, `mobile` 10 digits, `password` 8 to 72 chars) |
| POST | `/auth/login` | public | Login for any role; returns `{ token, user }` |
| GET | `/auth/me` | any | Current user |

```http
POST /api/auth/login
{ "email": "anjali@cmkerala-demo.test", "password": "Citizen@123" }

200 { "token": "eyJhbGci...", "user": { "id": 11, "name": "Anjali Menon", "role": "citizen", "departmentId": null } }
401 { "error": "Incorrect email or password" }
```

## Public
| Method | Path | Description |
|---|---|---|
| GET | `/departments` | List departments |
| GET | `/meta` | Districts, categories, priorities, statuses (used by forms) |
| GET | `/stats/public` | Homepage statistics |
| POST | `/contact` | Save a contact enquiry (`name`, `email`, `subject`, `message`) |
| GET | `/grievances/track/:refNo` | Track by reference number: status, department, history. No personal data. ATR text is hidden. |
| GET | `/health` | Health check |

```http
GET /api/grievances/track/CMK-2026-000003
200 {
  "grievance": { "ref_no": "CMK-2026-000003", "subject": "...", "status": "In Progress",
                 "department_name": "Health & Family Welfare Department", "due_date": "...", "overdue": false },
  "history": [ { "event_type": "created", "new_status": "Submitted", "actor_name": "Citizen", "created_at": "..." },
               { "event_type": "status_change", "old_status": "Under Review", "new_status": "In Progress", "remark": "Forwarded to ..." } ]
}
```

## Citizen (role: citizen)
| Method | Path | Description |
|---|---|---|
| POST | `/grievances` | *multipart.* Fields: `district`, `category`, `subject` (5-150), `description` (20-2000), `priority`, optional `aiSuggestion` (JSON string), up to 3 files in `attachments` (PDF/JPG/PNG/WebP, 5 MB each) |
| GET | `/grievances/mine` | Own grievances with `summary: { total, pending, resolved }` |
| GET | `/grievances/:id` | Own grievance detail (history, evidence files, feedback) |
| POST | `/grievances/:id/feedback` | `{ "rating": 1-5, "comment": "..." }`, only when Resolved, once |
| POST | `/grievances/:id/reopen` | `{ "remark": "..." }` (10+ chars), only when Resolved |

```http
POST /api/grievances            (multipart/form-data)
201 { "message": "Your grievance has been submitted...",
      "grievance": { "id": 25, "refNo": "CMK-2026-000025", "status": "Submitted", "dueDate": "2026-11-27T..." } }
```

## AI assistant (roles: citizen, CMO)
| Method | Path | Description |
|---|---|---|
| POST | `/ai/analyze` | `{ "district": "Kollam", "description": "..." }` (limit 10 per minute per user) |

```json
200 { "category": "Electricity", "department": "Kerala State Electricity Board", "departmentId": 5,
      "priority": "Medium", "summary": "Street light near a school is not working.",
      "reasoning": "Lighting fault affecting children's safety.",
      "source": "llm", "model": "gemini-...", "duplicates": [], "notice": null }
```
`source` is `"llm"` or `"fallback"`. When it is `"fallback"`, `notice` explains why, and the UI labels it clearly. Nothing is saved by this endpoint.

## CMO (role: cmo)
| Method | Path | Description |
|---|---|---|
| GET | `/cmo/stats` | Totals, by status, by district, by department, by category, by priority |
| GET | `/cmo/grievances` | List. Query: `district, category, priority, status, departmentId, overdue=true, escalated=true, q, page, limit` |
| GET | `/cmo/grievances/:id` | Full detail: citizen contact, AI output, assignment and report, internal remarks, full history |
| GET | `/cmo/officers?departmentId=` | Officers for the "forward to" dropdown |
| PATCH | `/cmo/grievances/:id/status` | `{ "status": "Under Review" }`. Other statuses are reached only through the workflow. |
| PATCH | `/cmo/grievances/:id/priority` | `{ "priority": "High" }` (deadline recalculated) |
| POST | `/cmo/grievances/:id/assign` | `{ "departmentId": 1, "officerId": 3, "instructions": "..." }` |
| POST | `/cmo/grievances/:id/remarks` | `{ "remark": "..." }` internal only |
| POST | `/cmo/grievances/:id/escalate` | `{ "remark": "..." }` |
| POST | `/cmo/grievances/:id/review-atr` | `{ "decision": "accept" \| "reject", "remark": "..." }` accept resolves; reject returns it to the officer |

```http
GET /api/cmo/stats
200 { "totals": { "total": 20, "pending": 15, "resolved": 5, "overdue": 3, "escalated": 2, "reopened": 1, "atr_awaiting_review": 2 },
      "byStatus": [ { "status": "Submitted", "count": 4 }, ... ],
      "byDistrict": [ { "name": "Kollam", "total": 2, "pending": 1, "resolved": 1, "overdue": 0 }, ... ],
      "byDepartment": [ { "id": 1, "name": "Public Works Department", "total": 4, "pending": 2, "resolved": 2, "overdue": 1, "avg_days_to_resolve": 4.2 }, ... ] }
```

## Department officer (role: officer)
| Method | Path | Description |
|---|---|---|
| GET | `/officer/grievances` | Only grievances forwarded to the officer's department (`status`, `page`, `limit`) |
| GET | `/officer/grievances/:id` | Detail (no internal remarks, no citizen contact details) |
| PATCH | `/officer/grievances/:id/status` | `{ "remark": "...", "workStatus": "Investigating" }` progress update |
| POST | `/officer/grievances/:id/atr` | *multipart.* `atrText` (20+ chars) and optional `file` |

## Files
| Method | Path | Description |
|---|---|---|
| GET | `/attachments/:id` | Download/view a file. Citizen: own evidence only. Officer: files of grievances assigned to their department. CMO: all. |

## Workflow rules (HTTP 409 when violated)
Allowed moves: Submitted -> Under Review -> In Progress -> Resolved -> Reopened -> Under Review. Forwarding a Submitted or Reopened grievance performs the first steps automatically. A resolved grievance can only be reopened by its own citizen.
