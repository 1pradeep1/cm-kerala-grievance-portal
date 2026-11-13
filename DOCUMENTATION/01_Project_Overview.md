# 01. Project Overview

## Problem statement
Citizens of Kerala face issues with public infrastructure, healthcare, education and other public services, but have no single place to raise a grievance with the Chief Minister's Office (CMO), see who is acting on it, and learn the outcome. The CMO, in turn, needs to review grievances, route them to the right department, monitor delays and verify that action was really taken.

This project is a **working recruitment prototype** of such a portal. It is not an official government service and uses fictional data only.

## Objectives
- One reference number and one traceable status trail for every grievance.
- A strict, auditable workflow from submission to resolution (or reopening).
- Fast routing to the right department and officer, with deadlines and escalation.
- Human decisions at every official step, with AI used only to suggest.
- Clear communication back to the citizen.

## Scope
| Area | Included |
|---|---|
| Public website | Home, About, How It Works, Departments, Contact (saved to DB), FAQ |
| Citizen portal | Register, login, logout, submit grievance (with files), reference number, track by number, dashboard, CMO/officer remarks, feedback, reopen |
| CMO dashboard | All grievances, total/pending/resolved/overdue counts, filters, attachments, forward to department, internal remarks, escalation, review of action-taken reports, district and department statistics (charts and tables) |
| Officer dashboard | Secure login, grievances forwarded to own department, progress remarks, action-taken report (text and file), submit back to CMO |
| AI assistant | Suggests category, department, priority and CMO summary; flags possible duplicates; always reviewable |
| Security | Role-based access, hashed passwords, validated uploads, rate limiting |

**Out of scope (documented limitations):** email/SMS notifications (updates are shown in-app), multi-language UI, real government data or integrations, a user-management screen for creating staff accounts (staff accounts come from the seed script).

## Workflow
`Citizen submits -> reference ID generated -> CMO reviews -> CMO forwards to department -> officer investigates -> department submits action-taken report -> CMO reviews -> citizen sees update -> Resolved or Reopened`

Statuses: **Submitted, Under Review, In Progress, Resolved, Reopened.** Every change is stored with its timestamp and the responsible user (see `grievance_history`).

Deadlines (SLA) are set from priority: High 7 days, Medium 15 days, Low 30 days. A grievance past its deadline and not resolved is **overdue**.

## Key features beyond the minimum
- Database-level guarantee of one active assignment per grievance.
- Row locking so two people cannot change the same grievance at once.
- Citizens never see internal CMO remarks or a department report before the CMO has decided on it.
- Possible-duplicate detection shown to the CMO.
- Labelled fallback when the AI service is unavailable.

## Tools and third-party services used (disclosure)
- **AI coding assistant:** Claude (by Anthropic) was used to help design and write code and documentation. The author reviewed the result and can explain the implementation.
- **AI model at runtime:** Google Gemini API (free tier) via Google AI Studio.
- **Hosting and data:** Render (web service), Neon (PostgreSQL), GitHub.
- **Open-source libraries:** React, Vite, React Router, Recharts, Express, node-postgres (pg), bcryptjs, jsonwebtoken, helmet, cors, express-rate-limit, multer, dotenv.

## Disclaimer
This application is a recruitment prototype. It is not authorised by, affiliated with or endorsed by the Government of Kerala or the Chief Minister's Office. All names, grievances and credentials are fictional.
