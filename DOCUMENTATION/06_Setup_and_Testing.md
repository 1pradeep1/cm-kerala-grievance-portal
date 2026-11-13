# 06. Setup and Testing

## Prerequisites
Node.js 20 or newer, Git, a PostgreSQL database (Neon free tier recommended), and optionally a free Google AI Studio API key.

## Installation (local)
```bash
git clone https://github.com/1pradeep1/cm-kerala-grievance-portal.git
cd cm-kerala-grievance-portal

# API
cd server
npm install
cp .env.example .env          # then fill in the values below
npm run db:setup              # create tables
npm run db:seed               # load FICTIONAL demo data (wipes existing data)
npm run dev                   # API on http://localhost:4000

# Website (second terminal)
cd client
npm install
npm run dev                   # http://localhost:5173 (proxies /api to port 4000)
```
Production-style run from the repository root: `npm run build` then `npm start` (Express serves the built React app and the API on one port).

## Environment variables (`server/.env`, see `.env.example`)
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string (Neon: ends with `sslmode=require`) |
| `JWT_SECRET` | yes | Random string of 16+ characters (use 32+). Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_EXPIRES_IN` | no | Token lifetime, default `8h` |
| `PORT` | no | Default `4000` (Render sets it automatically) |
| `GEMINI_API_KEY` | for real AI | Free key from Google AI Studio. If empty, the labelled fallback is used |
| `GEMINI_MODEL` | no | Default `gemini-flash-latest` |
| `GEMINI_FALLBACK_MODELS` | no | Comma-separated backup models |
| `CLIENT_ORIGIN` | no | Restrict CORS to one origin (not needed when served from one URL) |

## Useful commands
| Command | What it does |
|---|---|
| `npm run db:setup` | Creates tables (safe to re-run) |
| `npm run db:seed` | Resets and loads demo data (20 grievances in all statuses) |
| `npm run ai:check` | Lists usable Gemini models and runs a live analysis |
| `npm test` | Runs the automated test suite (from `server/`, or the root) |

## Automated tests (`server/test/`)
Run with `npm test` against a seeded database. 18 tests, all passing:
| # | Test | Verifies |
|---|---|---|
| 1 | Login for three roles | Correct role returned; wrong password and unknown email give 401 |
| 2 | Registration | Validation, duplicate email 409, client-sent role ignored (always citizen) |
| 3 | Protected routes | Missing or garbage token gives 401 |
| 4 | Public endpoints | Departments and form lists |
| 5 | Happy path | Full workflow writes a complete, ordered history and correct status moves |
| 6 | Invalid transitions | Skipping steps is rejected (409) and leaves no history |
| 7 | Role rules | Citizen/officer cannot assign; officer of another department cannot act; non-owner cannot reopen |
| 8 | ATR rejection | Report returns to officer, resubmission works; feedback only after resolution and only once; reopen closes the assignment |
| 9 | Escalation | Works once; blocked on resolved grievances |
| 10 | Input validation | Bad district or subject rejected |
| 11 | Public stats, tracking, contact | Tracking hides personal data and ATR text; contact saved and validated |
| 12 | AI analyze | Needs login, validates input, returns labelled fallback with reviewable fields |
| 13 | Upload and file access | Owner, CMO allowed; other citizen/unassigned officer/anonymous denied |
| 14 | Upload safety | Fake content, wrong type and oversize files rejected |
| 15 | Role isolation | Citizens cannot reach CMO routes; officers see only their department |
| 16 | CMO dashboard | Stats consistency, filters, overdue filter, bad filter value 400 |
| 17 | End-to-end REST workflow | Visibility at each step (citizen never sees internal remarks or report before the CMO decides) |
| 18 | AI (Gemini path, mocked) | Valid answer gives `llm`; invented department or API error gives labelled fallback |

## Manual test cases
| ID | Steps | Expected |
|---|---|---|
| M1 | Register a new citizen, login, logout | Account created; logged in; logout returns to home |
| M2 | Submit grievance with a PNG and click *Get AI suggestions* | Reference number shown; AI label (or fallback label) visible; file opens from the detail page |
| M3 | Track by reference without logging in | Status, department and history; no personal data |
| M4 | CMO forwards a Submitted grievance | History shows Under Review then In Progress; officer of that department sees it |
| M5 | Officer submits action-taken report; CMO sends it back, then accepts | Status stays In Progress until accepted, then Resolved |
| M6 | Citizen gives feedback, then reopens | Feedback saved once; status Reopened; CMO sees it again |
| M7 | CMO filters by district, status, overdue; checks charts | Table and counts match the filters |
| M8 | Officer opens another department's grievance URL | "Grievance not found" |
| M9 | Upload a `.txt` renamed to `.png` | Rejected |

## Deployment on Render (free)
1. Push the repository to GitHub.
2. Render dashboard: **New > Web Service**, connect the repo.
3. Runtime Node. **Build command:** `npm run build`. **Start command:** `npm start`.
4. Environment variables: `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `NODE_VERSION=22`.
5. Deploy, then open `/api/health` and the home page. The free plan sleeps when idle, so the first request after a pause can take 30 to 60 seconds.
6. Seed the demo data once from your computer by pointing `server/.env` at the same Neon database and running `npm run db:setup` then `npm run db:seed`.
