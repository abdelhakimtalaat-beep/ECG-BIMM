# Assumptions, unresolved data issues and future enhancements

## Assumptions made (all editable or reviewable in the app)
1. **Status mapping** (Administration → Status mapping): Open + Active → In Progress; Open + Not Active → Not Started;
   Open with no flag → In Progress; Hold → On Hold; Closed → Closed; Terminated → Closed. The Open+Not Active, Open+blank and
   Terminated rules are assumptions awaiting department approval. The workbook’s unlabeled last column (Active / Not Active)
   is treated as an activity flag.
2. **Names:** the org chart spelling is canonical. Workbook spellings are stored as aliases:
   Nesrin Elgohary → Nesrin Mahmoud, Mais Talaat → Mais Atwan (different surnames — **please confirm**), and spelling variants
   of Hagar, Fatma, Mohamed, Mariam, Ibrahim Elghannam, Maha.
3. **Combined coordinator cells** (“A and B”) became two assignments, one per person.
4. **Moataz Belal** is a BIM Manager (reports to Ibrahim Afify) who appears as the coordinator on Afify’s projects. He is shown
   as a coordinator in the workload tables and as a member of Afify’s team; he is not listed as a team head.
5. **Built-up area** is used only when the cell holds a valid number (spaces/commas/non-breaking spaces cleaned; formulas use
   their calculated value). Text such as “Special case” or “2000 per site (5 Sites)” is kept as a note and excluded from totals.
   The unit is as supplied (assumed m²). Values ≥ 5,000,000 are flagged as likely typos but **are still counted**.
6. **Workload** counts active projects (In Progress + Not Started by default; configurable) per person, each project once.
7. **Reel plan** transcribed from the image: 16 sessions, 16 Aug – 7 Oct 2026; topics exist only for the first two; no statuses.
8. **Org chart “year”** (e.g. Architect-2002) is stored as supplied; it is labelled “Year (as supplied)” because the source does
   not say whether it is experience or graduation year.
9. **Dashboard “Avg projects per BIM team”**: a team = a manager plus their coordinators, so this is average active projects
   per manager who currently manages projects.
10. **Arabic / RTL:** not included in this release (English only). Layout uses standard Tailwind classes; RTL can be added later.
11. **Notifications:** reminders are in-app banners; no email/push is sent.
12. **Photos and the logo** are stored in the database (≤ 3 MB / ≤ 2 MB). The supplied ECG logo image is 192×105 px — low
    resolution; upload a higher-resolution official file in Administration → Branding.

## Unresolved source-data issues (see db/reconciliation.md for the complete list of 117 items)
- ZED MADISON EAST appears under both Ibrahim Elghannam (Hold) and Mahmoud Mostafa (Closed) with conflicting statuses.
- Project numbers shared by differently named projects: 2856, 3574, 3631 (kept as separate records and flagged).
- “CFC Mall Renovation and Expansion” exists as 3699 and I279.
- 28 open projects miss a number, area, CDE or type; 3 projects have no coordinator; 6 areas are text.
- Possible area typos: Talah Park 53,000,000; Alam Elroom 20,611,400; SouthMED 23,000,000; Palm x 15,691,207; Modon OD01 5,030,000.
- **Reem Saied (C455)** presents on 23 Sep but is not in the org chart. Mais Atwan, Muhammed Ghareeb, and Mohamed Alzawawy have no
  employee ID in the supplied chart (Alzawawy shows 9934).
- Workbook subtotal formulas (e.g. `=SUM(G2:G4)`) do not cover their blocks and were ignored.
- The BIM Reel Plan has no status or topics for 14 of 16 sessions.

## Not done / future enhancements
Arabic & RTL · email/Teams reminders · SSO (Microsoft Entra) · per-project complexity weighting · full historical trend (needs
dated history) · bulk photo upload · versioned reporting-line history UI (the data model already stores valid-from/to) ·
integration with Autodesk Construction Cloud for live project data · automated end-to-end tests (Playwright) once the app is
running in CI.

## Known limitations
- Never built or browser-tested in the authoring environment (see README → Verification status).
- Login throttling is per server instance (best effort on serverless).
- The weekday validation and the dashboard use the browser’s local date for “today”.
- Pagination for card view caps at 60 cards (table view shows all with paging).
