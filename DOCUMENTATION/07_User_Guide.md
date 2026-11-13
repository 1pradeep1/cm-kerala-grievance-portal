# 07. User Guide

All data in this prototype is fictional. Demo accounts are listed in the README.

## Citizens
1. **Register** (name, email, 10-digit mobile, password of 8+ characters) and **login**.
2. **Submit a grievance:** choose district and category, write a subject and a detailed description, optionally attach up to 3 files (PDF, JPG, PNG, WebP, 5 MB each).
3. **AI assistant (optional):** click *Get AI suggestions*. Review the suggested category, priority and summary. Use *Use this category and priority* or change them yourself. If a "Fallback" label appears, the AI was unavailable and a basic keyword match was used. If it lists possible duplicates, check whether you already reported the issue.
4. **Submit** and note your **reference number** (for example `CMK-2026-000123`) and target date.
5. **Track** any time from *Track* (no login needed) or from *My grievances*, which also shows pending and resolved counts and the latest update.
6. Open a grievance to read the **status history** and remarks from the CMO and officers.
7. When it is **Resolved**, rate the outcome (1 to 5). If the problem is not really fixed, use **Reopen** and explain why; it returns to the CMO.

## CMO administrators
1. Login. The dashboard shows totals (total, pending, resolved, overdue, escalated, reports awaiting review), a district chart, a status chart and a department table.
2. **Filter** the list by district, category, priority, status, department, overdue only, or search by reference or subject.
3. Open a grievance to see the description, citizen contact details, attachments, the **AI summary and suggestion** (labelled; for your review only) and possible duplicates.
4. **Forward** it to a department (optionally a named officer, with internal instructions). The grievance moves to *In Progress*; the citizen sees the department name.
5. Change **priority** if needed (the deadline is recalculated), add **internal remarks** (never shown to citizens) and **escalate** delayed grievances with a reason.
6. When an officer submits an **action-taken report**, read it (and its file) and either **accept** (the grievance becomes *Resolved* and your remark is shown to the citizen) or **send it back** with instructions.
7. If the citizen reopens a grievance, review and forward it again.

## Department officers
1. Login with the credentials issued to you. You only see grievances forwarded to **your department**.
2. Open a grievance to read the details, attachments and the CMO's instructions.
3. **Update progress:** add an investigation remark (visible to the citizen) and mark the work *Investigating*.
4. **Submit the action-taken report:** describe the action taken (20+ characters) and optionally attach a file. It goes to the CMO for review.
5. If the CMO sends the report back, the reason is shown; fix the issue and submit again.

## Tips
- The free server may take up to a minute to wake after idle time. Wait a moment and retry.
- Passwords are never shown or emailed in this prototype; use the demo credentials from the README.
