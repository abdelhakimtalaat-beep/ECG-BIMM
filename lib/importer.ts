// Pure helpers for the Excel/CSV import (unit tested in tests/importer.test.ts). No database access here.
export const FIELDS = ['manager', 'coordinator', 'project_no', 'name', 'cde', 'type', 'area', 'status', 'activity', 'deltek', 'client', 'project_manager', 'technical_manager'] as const;
export type Field = (typeof FIELDS)[number];

const SYNONYMS: Record<Field, string[]> = {
  manager: ['bim manager', 'manager'],
  coordinator: ['bim coordinator', 'coordinator'],
  project_no: ['project no', 'project no.', 'project number', 'project #', 'no.', 'number'],
  name: ['project name', 'name', 'project'],
  cde: ['cde', 'cde platform'],
  type: ['type', 'project type'],
  area: ['built-up area', 'built up area', 'builtup area', 'area', 'bua'],
  status: ['status', 'project status'],
  activity: ['activity', 'active', 'active/not active', 'activity status'],
  deltek: ['deltek', 'deltek number', 'deltek no', 'deltek no.', 'deltek #', 'deltek id'],
  client: ['client', 'client name'],
  project_manager: ['project manager', 'pm'],
  technical_manager: ['technical manager', 'tm'],
};
export function autoMap(headers: (string | number | null)[]): Record<Field, number | null> {
  const out = {} as Record<Field, number | null>;
  const norm = headers.map((h) => (h || '').toString().trim().toLowerCase());
  for (const f of FIELDS) {
    const idx = norm.findIndex((h) => SYNONYMS[f].includes(h));
    out[f] = idx >= 0 ? idx : null;
  }
  return out;
}

export const normName = (s: string | null | undefined) => (s || '').replace(/[\s ]+/g, ' ').trim().toLowerCase();
export const normKey = (s: string | null | undefined) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Only plain numbers (or numbers cleaned of spaces/commas/NBSP) become built-up area. Everything else is kept as a note. */
export function parseArea(v: unknown): { value: number | null; note: string | null } {
  if (v == null || v === '') return { value: null, note: null };
  if (typeof v === 'number') return Number.isFinite(v) ? { value: v, note: null } : { value: null, note: `invalid number ${v}` };
  const s = String(v).replace(/ /g, ' ').trim();
  if (/^[\d\s,.]+$/.test(s)) {
    const n = Number(s.replace(/[\s,]/g, ''));
    if (Number.isFinite(n)) return { value: n, note: `cleaned from text ${JSON.stringify(String(v))}` };
  }
  return { value: null, note: `non-numeric text kept as note: ${JSON.stringify(s)}` };
}

export function splitPeople(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return String(raw).split(/\s+and\s+|\s*\/\s*|\s*&\s*|\s*;\s*|\s*,\s*/i).map((p) => p.trim()).filter(Boolean);
}

export function normFlag(f: string | null | undefined): '' | 'Active' | 'Not Active' {
  const s = (f || '').trim().toLowerCase();
  return s === 'active' ? 'Active' : s === 'not active' ? 'Not Active' : '';
}

export function resolvePerson(name: string, employees: { id: string; name: string; employee_code: string | null }[], aliases: { alias: string; employee_id: string }[]): string | null {
  const k = normName(name);
  const direct = employees.find((e) => normName(e.name) === k || (e.employee_code && normName(e.employee_code) === k));
  if (direct) return direct.id;
  const al = aliases.find((a) => normName(a.alias) === k);
  return al ? al.employee_id : null;
}

export function csvToRows(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') inQ = false; else cur += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}
export const csvEscape = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
