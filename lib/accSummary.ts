// Reads the CSV files of an ACC "Data Connector" extract and summarises them per ACC project. Pure; runs in the browser and on the server; unit tested.
// No personal data is kept: names and e-mail addresses of members are never read.

/** RFC 4180 CSV (quoted fields, doubled quotes, line breaks inside quotes) into objects keyed by the header row. */
export function parseCsv(text: string): Record<string, string>[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = []; let row: string[] = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const h = rows.shift() ?? [];
  return rows.filter((r) => r.length > 1 || r[0] !== '').map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}

export interface AccStats {
  project_id: string; name: string;
  issues: { total: number; open: number; closed: number; by_status: Record<string, number>; by_type: { name: string; count: number }[]; by_root_cause: { name: string; count: number }[]; avg_close_days: number | null; overdue: number; with_due_date: number; monthly: { month: string; opened: number; closed: number }[] };
  reviews: { total: number; by_status: Record<string, number>; open_tasks: number; unclaimed_tasks: number };
  clashes: { tests: number; by_status: Record<string, number> };
  assignees: { key: string; name: string; kind: 'role' | 'user' | 'company' | 'none'; total: number; by_status: Record<string, number> }[];
  photos: number; meetings: number;
}
const day = (s: string) => (s || '').slice(0, 10);
const top = (m: Map<string, number>, n = 8) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([name, count]) => ({ name, count }));
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
const obj = (m: Map<string, number>) => Object.fromEntries([...m.entries()].sort());
const OPEN = new Set(['open', 'in_dispute', 'draft', 'answered', 'in_review', 'pending']);
const CLOSED = new Set(['closed', 'completed', 'not_approved']);
export const lastMonths = (today: string, n: number) => { const [y, m] = today.split('-').map(Number); return Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }); };

/** `files` = CSV text by file name (e.g. 'issues_issues.csv'); returns one summary per ACC project found in admin_projects. `today` = yyyy-mm-dd. */
export function summarize(files: Record<string, string>, today: string): AccStats[] {
  const t = (n: string) => (files[n] ? parseCsv(files[n]) : []);
  const projects = t('admin_projects.csv'); const types = new Map(t('issues_issue_types.csv').map((r) => [r.issue_type_id, r.issue_type])); const subtypes = new Map(t('issues_issue_subtypes.csv').map((r) => [r.issue_subtype_id ?? r.subtype_id ?? r.id, r.title ?? r.issue_subtype ?? r.name]));
  const causes = new Map(t('issues_root_causes.csv').map((r) => [r.root_cause_id, r.title]));
  const issues = t('issues_issues.csv').filter((r) => !r.deleted_at); const reviews = t('reviews_reviews.csv'); const rtasks = t('reviews_review_tasks.csv'); const clashes = t('clashes_clash_test.csv');
  const roleName = new Map([...t('admin_roles.csv').map((r) => [r.id, r.name]), ...t('admin_project_roles.csv').flatMap((r) => [[r.role_oxygen_id, r.name], [r.role_id, r.name]])].filter(([k]) => k) as [string, string][]);
  const userName = new Map(t('admin_users.csv').flatMap((r) => [[r.autodesk_id, r.name], [r.id, r.name]]).filter(([k]) => k) as [string, string][]);
  const photos = t('photos_photos.csv'); const meetings = t('meetingminutes_meetings.csv'); const months = lastMonths(today, 12);
  const ids = new Set<string>(projects.map((p) => p.id)); for (const r of [...issues, ...reviews, ...clashes]) if (r.bim360_project_id) ids.add(r.bim360_project_id);
  return [...ids].map((pid) => {
    const mine = issues.filter((r) => r.bim360_project_id === pid); const st = new Map<string, number>(), ty = new Map<string, number>(), rc = new Map<string, number>(); const mo = new Map(months.map((m) => [m, { month: m, opened: 0, closed: 0 }]));
    let closeDays = 0, closeN = 0, overdue = 0, withDue = 0; const asg = new Map<string, AccStats['assignees'][number]>();
    for (const r of mine) {
      { const kind = r.assignee_id ? (r.assignee_type === 'role' ? 'role' : r.assignee_type === 'company' ? 'company' : 'user') : 'none'; const key = `${kind}:${r.assignee_id}`;
        const a = asg.get(key) ?? asg.set(key, { key, kind, name: kind === 'none' ? 'Unassigned' : (kind === 'role' ? roleName.get(r.assignee_id) : kind === 'user' ? userName.get(r.assignee_id) : undefined) ?? (kind === 'role' ? 'Role' : kind === 'company' ? 'Company' : 'Unknown user'), total: 0, by_status: {} }).get(key)!;
        a.total++; a.by_status[r.status || 'unknown'] = (a.by_status[r.status || 'unknown'] ?? 0) + 1; }
      bump(st, r.status || 'unknown'); bump(ty, types.get(r.type_id) ?? 'No type');
      if (r.root_cause_id) bump(rc, causes.get(r.root_cause_id) ?? 'Other');
      const o = day(r.created_at || r.opened_at), c = day(r.closed_at);
      if (o && mo.has(o.slice(0, 7))) mo.get(o.slice(0, 7))!.opened++;
      if (c && mo.has(c.slice(0, 7))) mo.get(c.slice(0, 7))!.closed++;
      if (o && c) { const d = (Date.parse(c) - Date.parse(o)) / 86400000; if (d >= 0) { closeDays += d; closeN++; } }
      if (r.due_date) { withDue++; if (OPEN.has(r.status) && day(r.due_date) < today) overdue++; }
    }
    void subtypes;
    const rv = reviews.filter((r) => r.bim360_project_id === pid && r.is_archived !== 't'); const rs = new Map<string, number>(); for (const r of rv) bump(rs, r.status || 'unknown');
    const live = new Set(rv.filter((r) => r.status !== 'closed' && r.status !== 'void').map((r) => r.id)); const tk = rtasks.filter((r) => r.bim360_project_id === pid && live.has(r.review_id)); const cl = clashes.filter((r) => r.bim360_project_id === pid); const cs = new Map<string, number>(); for (const r of cl) bump(cs, r.status || 'unknown');
    const open = [...st].filter(([k]) => OPEN.has(k)).reduce((a, [, v]) => a + v, 0), closed = [...st].filter(([k]) => CLOSED.has(k)).reduce((a, [, v]) => a + v, 0);
    return { project_id: pid, name: projects.find((p) => p.id === pid)?.name ?? '', issues: { total: mine.length, open, closed, by_status: obj(st), by_type: top(ty), by_root_cause: top(rc), avg_close_days: closeN ? Math.round((closeDays / closeN) * 10) / 10 : null, overdue, with_due_date: withDue, monthly: [...mo.values()] },
      reviews: { total: rv.length, by_status: obj(rs), open_tasks: tk.filter((r) => r.state === 'claimed' || r.state === 'unclaimed').length, unclaimed_tasks: tk.filter((r) => r.state === 'unclaimed').length }, clashes: { tests: cl.length, by_status: obj(cs) },
      assignees: [...asg.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)).slice(0, 60),
      photos: photos.filter((r) => r.bim360_project_id === pid).length, meetings: meetings.filter((r) => r.bim360_project_id === pid).length };
  });
}
export const WANTED = ['admin_projects.csv', 'issues_issues.csv', 'issues_issue_types.csv', 'issues_root_causes.csv', 'reviews_reviews.csv', 'reviews_review_tasks.csv', 'clashes_clash_test.csv', 'photos_photos.csv', 'meetingminutes_meetings.csv', 'admin_roles.csv', 'admin_project_roles.csv', 'admin_users.csv'];
