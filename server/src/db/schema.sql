-- CM Kerala Grievance Portal (recruitment prototype) - PostgreSQL schema.
-- Safe to run more than once (IF NOT EXISTS everywhere).

CREATE SEQUENCE IF NOT EXISTS grievance_ref_seq START 1;

CREATE TABLE IF NOT EXISTS departments (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,         -- always stored lower-case
  mobile        VARCHAR(15),
  password_hash TEXT NOT NULL,
  role          VARCHAR(10) NOT NULL CHECK (role IN ('citizen', 'cmo', 'officer')),
  department_id INT REFERENCES departments(id),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (role <> 'officer' OR department_id IS NOT NULL)  -- an officer must belong to a department
);

CREATE TABLE IF NOT EXISTS grievances (
  id            SERIAL PRIMARY KEY,
  ref_no        VARCHAR(20) NOT NULL UNIQUE,           -- e.g. CMK-2026-000123
  citizen_id    INT NOT NULL REFERENCES users(id),
  district      VARCHAR(40) NOT NULL,
  category      VARCHAR(60) NOT NULL,
  subject       VARCHAR(150) NOT NULL,
  description   TEXT NOT NULL,
  priority      VARCHAR(6) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  status        VARCHAR(15) NOT NULL DEFAULT 'Submitted'
                CHECK (status IN ('Submitted', 'Under Review', 'In Progress', 'Resolved', 'Reopened')),
  department_id INT REFERENCES departments(id),        -- department currently handling it
  ai_summary    TEXT,                                  -- AI output, for human review only
  ai_suggestion JSONB,
  ai_source     VARCHAR(10) CHECK (ai_source IN ('llm', 'fallback')),
  due_date      TIMESTAMPTZ NOT NULL,
  escalated     BOOLEAN NOT NULL DEFAULT false,
  escalated_at  TIMESTAMPTZ,
  reopen_count  INT NOT NULL DEFAULT 0,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grievances_status   ON grievances(status);
CREATE INDEX IF NOT EXISTS idx_grievances_district ON grievances(district);
CREATE INDEX IF NOT EXISTS idx_grievances_category ON grievances(category);
CREATE INDEX IF NOT EXISTS idx_grievances_citizen  ON grievances(citizen_id);
CREATE INDEX IF NOT EXISTS idx_grievances_dept     ON grievances(department_id);

-- Every event in a grievance's life. Status changes carry old/new status.
CREATE TABLE IF NOT EXISTS grievance_history (
  id           SERIAL PRIMARY KEY,
  grievance_id INT NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  event_type   VARCHAR(20) NOT NULL CHECK (event_type IN (
                 'created', 'status_change', 'assignment', 'officer_remark', 'atr_submitted',
                 'atr_rejected', 'escalation', 'priority_change', 'feedback')),
  old_status   VARCHAR(15),
  new_status   VARCHAR(15),
  changed_by   INT NOT NULL REFERENCES users(id),
  actor_role   VARCHAR(10) NOT NULL,
  remark       TEXT,                                   -- citizen-visible
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_history_grievance ON grievance_history(grievance_id, created_at);

-- Files are stored in the database (BYTEA) because free hosting disks are ephemeral.
CREATE TABLE IF NOT EXISTS attachments (
  id            SERIAL PRIMARY KEY,
  grievance_id  INT NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  uploaded_by   INT NOT NULL REFERENCES users(id),
  kind          VARCHAR(10) NOT NULL DEFAULT 'evidence' CHECK (kind IN ('evidence', 'atr')),
  original_name VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  size_bytes    INT NOT NULL,
  data          BYTEA NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachments_grievance ON attachments(grievance_id);

-- Forwarding of a grievance to a department/officer, plus the action-taken report (ATR).
CREATE TABLE IF NOT EXISTS assignments (
  id                SERIAL PRIMARY KEY,
  grievance_id      INT NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  department_id     INT NOT NULL REFERENCES departments(id),
  officer_id        INT REFERENCES users(id),          -- NULL = any officer of the department
  assigned_by       INT NOT NULL REFERENCES users(id),
  instructions      TEXT,                              -- internal note from CMO to officer
  work_status       VARCHAR(15) NOT NULL DEFAULT 'Assigned'
                    CHECK (work_status IN ('Assigned', 'Investigating', 'ATR Submitted')),
  atr_text          TEXT,
  atr_attachment_id INT REFERENCES attachments(id),
  atr_submitted_at  TIMESTAMPTZ,
  cmo_decision      VARCHAR(10) NOT NULL DEFAULT 'pending'
                    CHECK (cmo_decision IN ('pending', 'accepted', 'rejected')),
  decision_remark   TEXT,
  decided_at        TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- At most one active assignment per grievance, enforced by the database itself.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_assignment ON assignments(grievance_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS feedback (
  id           SERIAL PRIMARY KEY,
  grievance_id INT NOT NULL UNIQUE REFERENCES grievances(id) ON DELETE CASCADE,
  citizen_id   INT NOT NULL REFERENCES users(id),
  rating       INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CMO-only notes; never shown to citizens.
CREATE TABLE IF NOT EXISTS internal_remarks (
  id           SERIAL PRIMARY KEY,
  grievance_id INT NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  author_id    INT NOT NULL REFERENCES users(id),
  remark       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_enquiries (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  subject    VARCHAR(150) NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
