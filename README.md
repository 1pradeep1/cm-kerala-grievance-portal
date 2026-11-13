# CM Kerala: Chief Minister's Public Grievance Redressal Portal (recruitment prototype)

A working full-stack prototype for the **WhiteMatrix Software Solutions AI Full Stack Engineer machine test**. Citizens submit grievances to the Chief Minister's Office (CMO), the CMO forwards them to departments, officers act and report, and the citizen sees the outcome, with an **AI Grievance Assistant** that suggests (never decides).

> **Recruitment prototype.** Not affiliated with, or endorsed by, the Government of Kerala or the Chief Minister's Office. All data is fictional.

## Links
- **Live application:**https://cm-kerala-grievance-portal-utnb.onrender.com
- **Repository:** https://github.com/1pradeep1/cm-kerala-grievance-portal
- **Demo video:** `<ADD-LINK-HERE>`

## Demo credentials (fictional test accounts)
| Role | Email | Password |
|---|---|---|
| CMO administrator | `cmo@cmkerala-demo.test` | `Cmo@12345` |
| Department officer (Public Works) | `officer.pwd@cmkerala-demo.test` | `Officer@123` |
| Other officers | `officer.health@`, `officer.education@`, `officer.water@`, `officer.kseb@`, `officer.lsgd@`, `officer.transport@`, `officer.revenue@`, `officer.socialjustice@` `cmkerala-demo.test` | `Officer@123` |
| Citizen | `anjali@cmkerala-demo.test` (also `rahul@`, `fathima@`, `joseph@`) | `Citizen@123` |

You can also register your own citizen account. Please use fictional details only.

## Suggested evaluation path
1. Login as the **citizen**, submit a grievance with a photo and try the AI suggestions; note the reference number.
2. Login as the **CMO**, open it, forward it to a department, check the charts and filters.
3. Login as that department's **officer**, add a progress update and submit an action-taken report.
4. Back as the **CMO**, accept the report. As the **citizen**, see it Resolved, give feedback or reopen.
5. Track the reference number on the public **Track** page.

## Tech stack
| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router, Recharts |
| Backend | Node.js, Express 5, REST API |
| Database | PostgreSQL (Neon) |
| Auth | JWT, bcrypt, role-based access (citizen, CMO, officer) |
| AI | Google Gemini API (free tier) with a labelled fallback |
| Files | Stored in PostgreSQL (`BYTEA`), role-checked download |
| Hosting | Render (single web service), Neon |

## Project structure
```
client/            React app (pages, API client, auth)
server/
  src/routes/      HTTP endpoints
  src/services/    workflow rules, queries, AI service
  src/db/          schema.sql, setup and seed scripts
  test/            automated tests (18)
DOCUMENTATION/     01 to 07 documents, architecture and ER diagrams
.env.example       configuration template (no secrets)
```

## Quick start
See [`DOCUMENTATION/06_Setup_and_Testing.md`](DOCUMENTATION/06_Setup_and_Testing.md). In short: `cd server && npm install`, copy `.env.example` to `.env`, `npm run db:setup`, `npm run db:seed`, `npm run dev`; in `client/` run `npm install` and `npm run dev`.

## Documentation
1. [Project Overview](DOCUMENTATION/01_Project_Overview.md)
2. [System Architecture](DOCUMENTATION/02_System_Architecture.md) (includes the architecture diagram)
3. [Database Design](DOCUMENTATION/03_Database_Design.md) (includes the ER diagram)
4. [API Documentation](DOCUMENTATION/04_API_Documentation.md)
5. [AI Integration](DOCUMENTATION/05_AI_Integration.md)
6. [Setup and Testing](DOCUMENTATION/06_Setup_and_Testing.md)
7. [User Guide](DOCUMENTATION/07_User_Guide.md)

Diagrams as standalone files: [`DOCUMENTATION/diagrams/`](DOCUMENTATION/diagrams/).

## Tools and services used
AI coding assistant: **Claude (Anthropic)** helped design and write code and documentation; I reviewed it and can explain every part. Runtime AI: **Google Gemini API**. Services: **Render**, **Neon**, **GitHub**. Open-source libraries are listed in the `package.json` files.

## Security notes
No secrets are committed. Passwords are bcrypt-hashed, access is role-based with record-level checks, SQL is parameterised, uploads are type- and content-checked, and sensitive endpoints are rate-limited.

## Known limitations
No email/SMS notifications (updates are in-app), English-only UI, staff accounts come from the seed script, free hosting sleeps when idle, and files are limited to 5 MB because they live in the database.
