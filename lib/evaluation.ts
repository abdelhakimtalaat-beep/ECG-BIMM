// Annual performance evaluation: form definition, scoring and who-may-do-what. Pure (no I/O); unit tested. Mirrored by the API, which enforces it.
export type Stage = 'self' | 'manager' | 'department';
export type EvStatus = Stage | 'completed';
export const STAGES: { key: Stage; label: string }[] = [{ key: 'self', label: 'Self evaluation' }, { key: 'manager', label: 'Direct manager' }, { key: 'department', label: 'Department manager' }];
export const stageLabel = (s: EvStatus) => (s === 'completed' ? 'Completed' : STAGES.find((x) => x.key === s)!.label);

export interface EvSection { code: string; title: string; weight: number; extra?: boolean; items: { key: string; text: string }[] }
const mk = (code: string, title: string, weight: number, items: string[], extra = false): EvSection => ({ code, title, weight, extra, items: items.map((text, i) => ({ key: `${extra ? 'E' : ''}${code}.${i + 1}`, text })) });
export const SECTIONS: EvSection[] = [
  mk('1', 'Planning and Organization Skills', 13.39, ['Critical understanding of the requirements and scope of jobs', 'Organizing of one\'s own work', 'Managing time effectivley']),
  mk('2', 'Interpersonal Skills', 28.57, ['Keeping focused, Reliable & Dependable', 'Maintaining social attitudes towards colleagues and others', 'Demonstrating mental Curiosity including willingness to try other skills and, ', 'Responding to supervisor\'s guidance', 'Working under time and environmental pressures', 'Observing attendance and punctuality', 'Spreading productive impact / positive spirit within the organization']),
  mk('3', 'Self Improvement', 7.14, ['Attending professional development & training programs', 'Keeping up to date in field, seeking personal growth & developing of  Know']),
  mk('4', 'Communication Skills', 8.04, ['Participating effectively, working within a team, listening carefully, interacti', 'Expressing ideas & disseminating information clearly to individuals and gro']),
  mk('5', 'Professional / Technical Skills', 42.86, ['Demonstratng  knowledge of BIM handbook modules', 'Demonstrating knowledge with BIM related programs, including but not lim', 'Ability to prepare project workflow and related scenarios', 'Participating in BIM Dimensions implementations', 'Ability to prepare Projects record story', 'Ability to follow up with notices, reports & drafting', 'Ability to follow up with standards/system & technical modeling', 'Ability to present BIM PXP (project excution plan ) in a proper, professional', 'Analytical & problem solving skills including defining the parameters of a p', 'Managing quality of work according to ECG\'s standards and procedures', 'Following up the coordination clashes with the team']),
  mk('1', 'EXTRA ACTIVITIES', 5, ['Department\'s Trainer', 'Summer Training Coordinator', 'Training Materials Developer', 'University To Work Trainer', 'Training Administrator ( U2W)', 'University to Work Coordinator', 'Conferences & Exhibitions Attendance', 'Others.... Please Specify'], true),
  mk('2', 'BUSINESS DEVELOPMENT', 5, ['Introduce a client or a project', 'Make presentation to client', 'Provide accurate inomfrmation to produce good proposal', 'Project contract has been signed'], true),
];
export const ITEM_KEYS = SECTIONS.flatMap((s) => s.items.map((i) => i.key));

export const BANDS = [
  { k: 'A', label: 'Always (Exceeds Requirements)', ar: 'دائماً (يتجاوز المتطلبات)', range: '8-10', min: 8, pick: 9, bg: '#7FDD7F', text: '#14532d' },
  { k: 'F', label: 'Frequently (Meet Requirements)', ar: 'بشكل متكرر (يُلبي المتطلبات)', range: '6-7.5', min: 6, pick: 7, bg: '#C2E07F', text: '#365314' },
  { k: 'O', label: 'Often (Meet Requirements)', ar: 'غالباً (يُلبي المتطلبات)', range: '4-5.5', min: 4, pick: 5, bg: '#FFFF80', text: '#713f12' },
  { k: 'S', label: 'Sometimes (Marginal)', ar: 'أحياناً (هامشي / دون المستوى المطلوب قليلاً)', range: '2-3.5', min: 2, pick: 3, bg: '#FFBF80', text: '#7c2d12' },
  { k: 'R', label: 'Rarely (Unsatisfactory)', ar: 'نادراً (غير مرضي)', range: '0.5-1.5', min: 0.5, pick: 1, bg: '#E08080', text: '#7f1d1d' },
  { k: 'N', label: 'Not at all', ar: 'على الإطلاق / لا تقييم', range: '0', min: 0, pick: 0, bg: '#B0B0B0', text: '#1f2937' },
] as const;
export const LEVELS = [{ k: 'A', range: '91-100', min: 91 }, { k: 'B+', range: '80-90', min: 80 }, { k: 'B', range: '66-79', min: 66 }, { k: 'C+', range: '56-65', min: 56 }, { k: 'C', range: '0-55', min: 0 }] as const;

export const bandOf = (score: number | null | undefined) => (score == null ? null : BANDS.find((b) => score >= b.min)!.k);
export const cleanScore = (v: unknown): number | null => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 10 ? Math.round(n * 2) / 2 : null; };
export const levelOf = (total: number) => { const r = Math.round(total); return LEVELS.find((l) => r >= l.min)!.k; };

export type Scores = Record<string, number | null | undefined>;
/** Weighted score of one section. Core sections: every item counts (not rated = 0). Extra sections: only the items that were rated count (not every extra activity applies to everyone). */
export function sectionScore(sec: EvSection, scores: Scores): number {
  const vals = sec.items.map((i) => scores[i.key]).map((v) => (typeof v === 'number' ? v : null));
  const rated = vals.filter((v): v is number => v !== null);
  if (!rated.length) return 0;
  const avg = sec.extra ? rated.reduce((a, b) => a + b, 0) / rated.length : rated.reduce((a, b) => a + b, 0) / sec.items.length;
  return (avg / 10) * sec.weight;
}
export function totals(scores: Scores) {
  const core = SECTIONS.filter((s) => !s.extra).reduce((a, s) => a + sectionScore(s, scores), 0);
  const extra = SECTIONS.filter((s) => s.extra).reduce((a, s) => a + sectionScore(s, scores), 0);
  const total = Math.min(100, core + extra);
  return { core, extra, total, level: levelOf(total), rated: ITEM_KEYS.filter((k) => typeof scores[k] === 'number').length };
}

// ---------------------------------------------------------------- who may do what
export interface Actors { employeeId: string; managerId: string | null; deptIds: string[]; /** the Administrator removed the direct-manager step of this form */ skipManager?: boolean }
/** The form passes through the direct manager only when the employee has one and the step was not removed. */
export const hasManagerStep = (a: Actors) => !!a.managerId && !a.skipManager;
export interface Who { role: string; employee_id: string | null }
export const isAdmin = (me: Who) => me.role === 'admin';
const isSelf = (me: Who, a: Actors) => !!me.employee_id && me.employee_id === a.employeeId;
const isManager = (me: Who, a: Actors) => !!me.employee_id && !!a.managerId && me.employee_id === a.managerId;
const isDept = (me: Who, a: Actors) => !!me.employee_id && a.deptIds.includes(me.employee_id) && me.employee_id !== a.employeeId;
export const stageActor = (me: Who, a: Actors, stage: Stage) => isAdmin(me) || (stage === 'self' ? isSelf(me, a) : stage === 'manager' ? isManager(me, a) : isDept(me, a));
/** The stage the form is waiting on is the only one its owner can edit; the Administrator can edit any part at any time (even after it was submitted or the form was completed). */
export const canEditStage = (me: Who, a: Actors, status: EvStatus, stage: Stage) => isAdmin(me) || (status === stage && stageActor(me, a, stage));
/** Submitting moves the form on, so it is only possible for the stage the form is waiting on. */
export const canSubmitStage = (me: Who, a: Actors, status: EvStatus): Stage | null => (status !== 'completed' && stageActor(me, a, status) ? status : null);
/** Vacation / sick / late figures are HR data: the Administrator only. */
export const canEditHr = (me: Who, _a: Actors, _status: EvStatus) => isAdmin(me);
/** Stages whose scores the person may see; null = the form is not visible to him at all. The employee sees only his own part until the form is completed. */
export function visibleStages(me: Who, a: Actors, status: EvStatus): Stage[] | null {
  const all: Stage[] = ['self', 'manager', 'department'];
  if (isAdmin(me) || isDept(me, a)) return all;
  if (status === 'completed' && (isSelf(me, a) || isManager(me, a))) return all;
  if (isManager(me, a)) return ['self', 'manager'];
  if (isSelf(me, a)) return ['self'];
  return null;
}
export const nextStatus = (s: EvStatus, hasManager: boolean): EvStatus => (s === 'self' ? (hasManager ? 'manager' : 'department') : s === 'manager' ? 'department' : 'completed');
/** Who may create a form for this employee. */
export const canCreate = (me: Who, a: Actors) => isAdmin(me) || isDept(me, a) || isManager(me, a);

// ---------------------------------------------------------------- editable wording (Administrator)
export interface Labels { items: Record<string, string>; sections: Record<string, string> }
export const secKey = (s: EvSection) => `${s.extra ? 'E' : ''}${s.code}`;
export const itemText = (it: { key: string; text: string }, l?: Labels | null) => l?.items?.[it.key] || it.text;
export const secTitle = (s: EvSection, l?: Labels | null) => l?.sections?.[secKey(s)] || s.title;
/** Keeps only known keys whose text differs from the built-in wording; returns what is stored. */
export function cleanLabels(raw: Partial<Labels> | null | undefined): Labels {
  const out: Labels = { items: {}, sections: {} };
  for (const s of SECTIONS) {
    const t = raw?.sections?.[secKey(s)]; if (typeof t === 'string' && t.trim() && t.trim() !== s.title) out.sections[secKey(s)] = t.trim().slice(0, 200);
    for (const i of s.items) { const x = raw?.items?.[i.key]; if (typeof x === 'string' && x.trim() && x.trim() !== i.text.trim()) out.items[i.key] = x.trim().slice(0, 300); }
  }
  return out;
}
