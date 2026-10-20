# User guide — Department Manager and BIM Managers

## Signing in
Use the email and password created for you in **Administration → Users & roles**. Change a temporary password from the
user menu (top right → Change password).

## Executive Dashboard (home)
- **KPI cards** are calculated from the database each time; nothing is typed in by hand. Hover a card for its definition.
- **Filters** at the top apply to the dashboard, Projects, Teams and Workload (and the training date range to BIM Reels).
  **Click a chart slice or bar** to filter by it; click again to remove it. **Reset filters** clears everything.
- **Management alerts** list unassigned projects, missing information, projects on hold, people above their peers (or over
  capacity if you defined one), upcoming BIM Reels and past sessions without an outcome. Click an alert to jump to the page.
- “Portfolio trend” stays empty until status changes have been recorded in at least two different months — the imported
  workbook contains no dates, so no history is invented.

## Department Organization Chart
Drag to pan, scroll to zoom, **Fit to screen** to reset. Click ▾ under a card to collapse a branch. Search by name, ID, role
or discipline: the card is highlighted and its reporting chain turns amber. Click a card for details and assigned projects.
Administrators can **Add employee**, **Edit / transfer** (change *Reports to* — loops are refused), **Deactivate** and add a
direct report. Export the chart as PNG or PDF.

## Projects Portfolio
Card or table view (your choice is remembered). Search, filter, sort, select rows for **bulk status updates** (you confirm
and can give a reason). Click a project for the detail panel: edit fields you are allowed to edit, upload/replace the photo,
see status history, add management comments, export the project as PDF. Administrators can add, import and delete projects.
Built-up area is shown only when a valid number exists; the original cell text is kept in the tooltip.

**Status mapping:** the workbook’s Open / Hold / Closed (+ Active / Not Active) are mapped to Not Started / In Progress /
On Hold / Closed in *Administration → Status mapping*. Change the rules, then “Save and re-apply”. Projects whose status
someone changed by hand keep that status.

## Teams & Project Assignments
- **Team hierarchy:** Department Manager → BIM Manager → BIM Coordinator → projects, with counts, area and status mix.
- **Matrix:** one coloured square per project (colour = status). Click to open the project.
- **Checks:** projects without a manager, coordinators who report elsewhere in the org chart, possible duplicates, and people
  with no projects.
- The person icon beside a project opens **Assignments**: add, replace or remove the manager/coordinators/members. BIM Managers
  can change coordinators and members on their own projects; only the Department Manager can change a project’s manager.
  Every change is written to the audit log with who made it.

## Team Workload
Shows assigned / in-progress / on-hold / closed counts, active projects, active assignments, built-up area of *unique*
projects and direct reports for each manager and coordinator. **Until an administrator defines capacity, no percentages are
shown** — you see a relative index (1.0 = peer average) and “above/below peers” flags. Count and area are proxies for
workload, not measured effort. Use **Capacity settings** to enter limits (projects, area, hours).
**Reassignment simulator:** pick a project, the person to move it to, and compare before/after. Nothing changes until you press
“Apply this reassignment…” and confirm. Export the report to Excel or PDF (it records the date, filters, assumptions and capacity).

## Weekly BIM Reels Plan
Calendar, weekly, monthly, table and upcoming views. Administrators add sessions, edit topic/presenter/date/status, add links and
notes, and mark sessions Planned / Completed / Postponed / Cancelled. The weekday must match the date (the form enforces it);
two sessions on one day, or one person presenting twice, are flagged. Export to Excel, PDF or a calendar file (.ics).
Sessions in the supplied plan start as **Not recorded** because the plan has no status column — mark the past ones so the
completion rate means something.

## Administration (Department Manager)
Users & roles · Status mapping · Data quality (everything the import cleaned or could not match) · Import & history (upload a
workbook/CSV: preview, column mapping, validation, duplicate detection, confirm; downloadable report) · Audit log · Branding & backup.
