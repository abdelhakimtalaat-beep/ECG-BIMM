# Setup, deployment and backup

## 1. GitHub
1. Create a **private** repository.
2. From the project folder: `git init && git add . && git commit -m "Initial commit" && git branch -M main`
   then `git remote add origin <your repo URL> && git push -u origin main`.
3. `.gitignore` already excludes `node_modules`, `.next` and `.env*`. Never commit real secrets.

## 2. Supabase (database)
1. Create a project (choose a region close to your users; set a strong database password).
2. **SQL Editor → New query**: paste and run `db/schema.sql`, then paste and run `db/seed.sql`
   (the seed runs once; running it twice will duplicate data).
3. **Project Settings → Database → Connection string → Transaction pooler** (port 6543). Copy it and replace
   `[YOUR-PASSWORD]`. This is your `DATABASE_URL`.
4. Row-level security is enabled on every table with no policies, so the public anon/service keys cannot read the data
   through Supabase's REST API. The application connects as the database owner from the server only. You do not need the
   Supabase anon key anywhere in this project.
5. Turn on backups (see section 5).

## 3. Vercel (hosting)
1. **Add New → Project → import the GitHub repository** (framework: Next.js, defaults are fine).
2. **Environment variables** (Production and Preview):
   - `DATABASE_URL` — the Supabase pooler string.
   - `SESSION_SECRET` — at least 32 random characters (`openssl rand -base64 48`).
3. Deploy. Open the site: the first visit goes to **/setup**, where you create the administrator account for the BIM
   Department Manager (Abdelhakim Talaat, ID 5701). The setup page disappears once a user exists.
4. **Administration → Users & roles**: create accounts for BIM Managers, Coordinators and viewers and **link each user to
   their employee record** — project edit rights for managers/coordinators depend on that link.
5. Put the site behind your company domain / SSO as needed (Vercel password protection or custom domain settings).

Limits to know: Vercel request bodies are limited to ~4.5 MB (photos ≤ 3 MB, import files ≤ 4 MB are enforced).

## 4. First-day checklist
- [ ] Sign in, change nothing, open each of the six pages and the Administration area.
- [ ] **Administration → Status mapping**: confirm the three rules marked *ASSUMPTION*, then “Save and re-apply”.
- [ ] **Administration → Data quality**: work through the warnings (name mismatches, shared project numbers, area outliers).
- [ ] **Team Workload → Capacity settings**: enter approved limits (until then only relative comparisons appear).
- [ ] **BIM Reels**: fill in topics and mark past sessions Completed / Postponed / Cancelled.
- [ ] Upload project photos (project → Upload photo).

## 5. Backup and recovery
- **Supabase backups:** Project → Database → Backups. Daily backups are on by default on paid plans; enable Point-in-Time
  Recovery if you need restore-to-the-minute. Verify the schedule shows recent backups.
- **Your own copy (recommended weekly, stored outside Supabase):**
  `pg_dump "$DIRECT_DATABASE_URL" --no-owner --format=custom -f ecg-bim-$(date +%F).dump`
  (use the *direct* connection string, port 5432, for dumps).
- **Restore into a fresh database:** create a new Supabase project, then
  `pg_restore --no-owner -d "<new direct connection string>" ecg-bim-YYYY-MM-DD.dump`, and update `DATABASE_URL` in Vercel.
- **Test the restore once** before you rely on it.
- Photos and the logo are stored inside the database (table `attachments`), so they are included in every backup.
- Every change is also recorded in the audit log (Administration → Audit log) with user, time and old/new values.

## 6. Roles
| Role | Can do |
|---|---|
| Department Manager / Administrator | Everything: users, employees & reporting lines, projects, assignments, capacity, status mapping, imports, reels, branding |
| BIM Manager | View everything; edit details/status, comments, photo and the coordinators/members of **projects they manage**; bulk status on their projects |
| BIM Coordinator | View everything; add comments and photos on projects they are assigned to |
| Project Manager / Viewer | Read-only dashboards, portfolio, teams, workload and reels |

All checks run on the server (`lib/perm.ts`, `app/api/**`); hiding buttons in the UI is only a convenience.

## Upgrading an existing database: employee photos

Databases created before employee photos existed need one extra column. Run `db/migrations/001_employee_photo.sql`
(or just: `alter table employees add column if not exists photo_id uuid;`) once in the Supabase SQL Editor
**before** deploying this version. It is safe to run more than once. New installs get the column from `db/schema.sql`.

## Upgrading an existing database: extra project fields

Projects now also carry **Deltek Number, Project Manager, Technical Manager and Client**. Run
`db/migrations/002_project_extra_fields.sql` once in the Supabase SQL Editor **before** deploying this version
(safe to run more than once). New installs get the columns from `db/schema.sql`.
The Excel/CSV importer recognises columns named "Deltek Number", "Client", "Project Manager" and "Technical Manager".

## Upgrading an existing database: employee CVs and Reels software

Run `db/migrations/003_cv_and_reel_software.sql` once in the Supabase SQL Editor **before** deploying this version
(safe to run more than once):

```sql
alter table employees add column if not exists cv_id uuid;
alter table reel_sessions add column if not exists software text;
```

CV files (PDF, DOC, DOCX, up to 4 MB) are uploaded by the Department Manager / Administrator from an employee's card on the
Organization Chart page and can be downloaded only by administrators and BIM Managers.

## Update: engineer e-mails, user selection and role permissions

1. In Supabase > SQL Editor, run `db/migrations/004_employee_emails.sql` BEFORE deploying (adds `employees.email` and fills 21 e-mails). Reem Said has no employee record: add her under Org chart > Add employee (with her e-mail).
2. Administration > Users > Add user: pick an engineer e-mail, choose a role and a temporary password.
3. Permissions: Administrator = everything (only he adds/imports projects, edits assignments and changes reel statuses). BIM Manager and BIM Coordinator = edit only the projects they are assigned to in that role (not Project No.) and Planned BIM Reels; all other tabs read-only. Viewer = read-only. Deleting stays Administrator-only.

## Update: Workload Factors
Run `db/migrations/005_workload_factors.sql` in the Supabase SQL Editor BEFORE deploying. Then, in a project's details, the Administrator, and BIM Managers/Coordinators on their assigned projects, set Typicality, Function and Coordination; also run `db/migrations/006_rename_residential.sql` (renames Residential to Residential/Offices/Mixed Use); Workload = Built-up area x Typicality x Function x Coordination (shown in the project, the Projects table and the Teams > Matrix strip). Until all three factors and the area are set, the workload shows "not calculated".

## Update: Villas and BIM Standards
Run `db/migrations/007_bim_standards.sql` before deploying. Workload now = Built-up area x Typicality x Function x Coordination x BIM Standards; projects need all four factors set to show a workload.

## Update: Tasks tab
Run `db/migrations/008_tasks.sql` in the Supabase SQL Editor BEFORE deploying (creates `task_areas` and `tasks`). The Tasks tab shows one area per BIM Manager. The BIM Manager (and the BIM Coordinators assigned to his projects) add and track tasks (Start date, Due date, Assignee, Status); only the BIM Manager or the Administrator adds/removes the project sub-areas. Everyone else can view.

## Update: e-mail notifications and Outlook calendar invitations
When a task is assigned/changed, or a BIM Reel is planned, the assignee/speaker receives an e-mail with a calendar invitation (.ics). Outlook shows it as an invitation; one click adds it to the calendar. Changes and deletions send an update/cancellation, so the calendar entry follows.
Setup (no IT needed): use a Gmail account as the sender.
1. Google Account > Security > turn on 2-Step Verification.
2. Open https://myaccount.google.com/apppasswords, create an app password named "ECG Portal" (16 characters).
3. In Vercel > Project > Settings > Environment Variables add: `SMTP_USER` = the Gmail address, `SMTP_PASS` = the app password, optional `SMTP_FROM_NAME` = `ECG BIM Portal`.
4. Redeploy. Without these variables notifications are simply off. Engineers need their e-mail in the Org chart (already added).

## Update: task templates, Pending status, comment, overdue alarm
Run `db/migrations/009_task_pending_comment.sql` in Supabase BEFORE deploying (renames On Hold to Pending, adds the comment column).

## Update: Wish List and phone installation
Run `db/migrations/010_wishes.sql` in Supabase BEFORE deploying (creates `wishes` and `wish_votes`).
Install on a phone: open the portal in the phone browser. iPhone/iPad (Safari): Share > Add to Home Screen. Android (Chrome): menu > Install app. Or use "Install app on this device" in the user menu.

## Update: project location and photo cropping
Run `db/migrations/011_project_location.sql` in Supabase BEFORE deploying (adds `projects.country` and `projects.city`). Photos of engineers and projects now open a crop window (drag, zoom, choose the frame) before they are uploaded.

## Update: dark mode, Scope factor, Minimum Standards
Run `db/migrations/012_scope_minimum_standards.sql` in Supabase BEFORE deploying (adds `projects.scope_items`, renames No Standards to Minimum Standards). Dark mode: the moon/sun button in the top bar; it follows the device setting until you choose.
Workload = Built-up area x Typicality x Function x Coordination x BIM Standards x Scope, where Scope is the sum of the ticked disciplines (Architecture 0.3, Structure 0.2, MEP 0.5, Infrastructure 0.2, Landscape 0.2).
