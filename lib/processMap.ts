// BIM Process Map: the "Design Stage BIM Workflow" as data (lanes, nodes, connectors). Every node and connector has an id, so the
// diagram is drawn from this list (not from a picture) and each node carries its own status. Pure; unit tested.
// Coordinates are in diagram units (the original sheet was ~2000 x 820).
export const PROCESS_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Completed'] as const;
export type ProcessStatus = (typeof PROCESS_STATUSES)[number];
export const PROCESS_COLORS: Record<ProcessStatus, string> = { 'Not Started': '#8b95a5', 'In Progress': '#1f6fc9', 'On Hold': '#f59e0b', Completed: '#2fa24f' };
export const PROCESS_COLOR_NAMES: Record<ProcessStatus, string> = { 'Not Started': 'Grey', 'In Progress': 'Blue', 'On Hold': 'Amber', Completed: 'Green' };

export interface Lane { id: string; label: string; y0: number; y1: number }
export const LANES: Lane[] = [
  { id: 'pm', label: 'Project Management', y0: 0, y1: 98 },
  { id: 'bim', label: 'BIM Management', y0: 98, y1: 258 },
  { id: 'trc', label: 'TRC & Document Control', y0: 258, y1: 330 },
  { id: 'arch', label: 'Architect / Interior Designer', y0: 330, y1: 438 },
  { id: 'urban', label: 'Urban / Landscape', y0: 438, y1: 527 },
  { id: 'struct', label: 'Structural Engineer', y0: 527, y1: 617 },
  { id: 'mep', label: 'MEP Engineer', y0: 617, y1: 706 },
  { id: 'infra', label: 'Infrastructure Engineer', y0: 706, y1: 795 },
];
export const DIAGRAM_W = 2000, DIAGRAM_H = 795, LANE_LABEL_W = 34;

export type NodeKind = 'task' | 'input' | 'decision' | 'start' | 'end';
export interface PNode { id: string; lane: string; x: number; y: number; label: string; kind: NodeKind; w?: number; h?: number; note?: string }
const N = (id: string, lane: string, x: number, y: number, label: string, kind: NodeKind = 'task', extra: Partial<PNode> = {}): PNode => ({ id, lane, x, y, label, kind, ...extra });

export const NODES: PNode[] = [
  // Project Management
  N('pm_mob', 'pm', 85, 42, 'Mobilization and Kick-Off', 'input', { w: 96, h: 38, note: 'Project Information, Data Collection, Contact List, Contract, EIR, Pre-Appointment BEP, Proposal, SOW, RACI matrix, Schedules, Milestones, and Stakeholders data' }),
  N('pm_client', 'pm', 270, 42, "Get The Client's Approval", 'task', { note: 'For the BEP including the project Title Block and the Building Coding System' }),
  N('pm_squad_dates', 'pm', 1297, 42, 'Squad Check Dates'),
  N('pm_sub_dates', 'pm', 1500, 42, 'Submittal Dates'),
  N('pm_guidelines', 'pm', 1770, 42, 'Prepare Submittal Guidelines'),
  N('pm_release', 'pm', 1863, 42, 'Release Submittal Package'),
  N('pm_close', 'pm', 1953, 42, 'Close Out', 'end'),
  // BIM Management
  N('bm_midp', 'bim', 85, 152, 'Create MIDP', 'start'),
  N('bm_bep', 'bim', 169, 152, 'Create BEP', 'task', { note: 'Naming Convention, Model Segregation, SOW, RACI, Linking/Grouping Scenario' }),
  N('bm_kickoff', 'bim', 270, 152, 'BIM Kick-Off Meeting'),
  N('bm_pinfo', 'bim', 358, 152, 'Pinfo Preparation'),
  N('bm_folder', 'bim', 443, 152, 'Provide The Folder Structure Tree'),
  N('bm_validate', 'bim', 536, 152, 'Validate The Architecture Base Model'),
  N('bm_zoning', 'bim', 626, 152, 'Prepare Coordination Zoning'),
  N('bm_rcp', 'bim', 701, 152, 'RCP Validation'),
  N('bm_valid1', 'bim', 793, 152, 'Valid?', 'decision'),
  N('bm_valid2', 'bim', 990, 152, 'Valid?', 'decision'),
  N('bm_coord', 'bim', 1297, 152, 'Coordination Meeting/s Internal & External'),
  N('bm_squad', 'bim', 1297, 196, 'Squad Check Workshop/s', 'task', { h: 28 }),
  N('bm_visual', 'bim', 1297, 233, 'Visual Check, Hard Clashes, Audit Report, Assign Issues', 'task', { h: 44 }),
  N('bm_appr1', 'bim', 1398, 152, 'Approved?', 'decision'),
  N('bm_qcc', 'bim', 1702, 238, 'BIM Quality Control Check'),
  N('bm_appr2', 'bim', 1770, 152, 'Approved?', 'decision'),
  N('bm_subfolder', 'bim', 1863, 152, 'Create submission folder structure'),
  N('bm_lessons', 'bim', 1953, 152, 'Prepare Learned Lessons'),
  // TRC & Document Control
  N('trc_qc', 'trc', 1702, 308, 'TRC & DC Quality Control Review'),
  // Architect / Interior Designer
  N('ar_consult', 'arch', 169, 368, 'Provide Consultation', 'input', { note: 'For Model Segregation, Linking, and Grouping Scenarios' }),
  N('ar_tidp', 'arch', 164, 418, 'Provide TIDP', 'input', { w: 66, h: 28 }),
  N('ar_keyplan', 'arch', 284, 368, 'Provide KeyPlan/s', 'input', { note: 'As a single line building boundary, Match Lines, and Building/Parts number' }),
  N('ar_datum', 'arch', 395, 368, 'Create Datum Model', 'task', { w: 60 }),
  N('ar_dummy', 'arch', 466, 368, 'Create Structure Dummy Model', 'task', { w: 60, h: 40 }),
  N('ar_model', 'arch', 537, 368, 'Create Architectural Model', 'task', { w: 60, h: 40, note: 'Basic Elements (e.g. Blockwork, openings, ceilings)' }),
  N('ar_ceiling', 'arch', 545, 418, 'Provide Ceiling Level and Design', 'input'),
  N('ar_reflected', 'arch', 701, 368, 'Confirm Reflected Ceiling Fixtures Layout'),
  N('ar_wallfin', 'arch', 866, 368, 'Complete Modelling Internal Wall Finishes', 'task', { h: 44 }),
  N('ar_adjust', 'arch', 990, 368, 'Adjust The project Coordinates (Datum Model)', 'task', { h: 44 }),
  N('ar_acquire', 'arch', 1120, 368, 'Acquire Coordinates to Architecture Model', 'task', { w: 62, h: 44 }),
  N('ar_publish', 'arch', 1198, 368, 'Provide Published views/ NWC files', 'task', { w: 62, h: 44 }),
  N('ar_resolve', 'arch', 1345, 368, 'Resolve Issues', 'task', { w: 66 }),
  N('ar_refine', 'arch', 1497, 368, 'Refine modelling and Generate 2D sheets', 'task', { w: 66, h: 40 }),
  N('ar_review', 'arch', 1585, 368, 'Internal Review Approved?', 'decision', { w: 82, h: 52 }),
  N('ar_upload', 'arch', 1812, 368, 'Upload Submission Files', 'task', { w: 66 }),
  // Urban / Landscape
  N('ur_site', 'urban', 357, 485, 'Provide The Site Key Plan and North Arrow', 'input', { w: 96, h: 46, note: 'As a single line, Match Lines, Building Distribution, Survey Point and the North Arrow' }),
  N('ur_master', 'urban', 990, 482, 'Provide Confirmed Site Master Plan', 'input', { w: 96, h: 40, note: 'Include buildings Distribution and Numbering "as per the numbering system mentioned at the project BEP"' }),
  // Structural Engineer
  N('st_tidp', 'struct', 164, 572, 'Provide TIDP', 'input', { w: 66, h: 28 }),
  N('st_statical', 'struct', 532, 572, 'Provide Statical System Requirements', 'input', { w: 96, h: 40 }),
  N('st_super', 'struct', 748, 572, 'Provide Superstructure 3D Model'),
  N('st_complete', 'struct', 990, 572, 'Complete Super and substructure 3D Model', 'task', { w: 92, h: 40 }),
  N('st_acquire', 'struct', 1120, 572, 'Acquire Coordinates to Structure Model', 'task', { w: 62, h: 44 }),
  N('st_publish', 'struct', 1198, 572, 'Provide Published views/ NWC files', 'task', { w: 62, h: 44 }),
  N('st_resolve', 'struct', 1348, 572, 'Resolve Issues', 'task', { w: 66 }),
  N('st_refine', 'struct', 1497, 572, 'Refine modelling and Generate 2D sheets', 'task', { w: 66, h: 40 }),
  N('st_review', 'struct', 1585, 572, 'Internal Review Approved?', 'decision', { w: 82, h: 52 }),
  N('st_upload', 'struct', 1812, 572, 'Upload Submission Files', 'task', { w: 66 }),
  // MEP Engineer
  N('me_tidp', 'mep', 160, 662, 'Provide TIDP', 'input', { w: 66, h: 28 }),
  N('me_req', 'mep', 532, 662, 'Provide MEP Requirements', 'input', { w: 96 }),
  N('me_ceil', 'mep', 748, 662, 'Provide MEP 3D Models (Ceiling Fixtures Only)', 'task', { w: 64, h: 50 }),
  N('me_complete', 'mep', 866, 662, 'Complete MEP 3D Models (Add Above Ceiling Connections, and wall Fixtures)', 'task', { w: 72, h: 62 }),
  N('me_acquire', 'mep', 1120, 662, 'Acquire Coordinates to MEP Models', 'task', { w: 62, h: 44 }),
  N('me_publish', 'mep', 1198, 662, 'Provide Published views/ NWC files', 'task', { w: 62, h: 44 }),
  N('me_resolve', 'mep', 1348, 662, 'Resolve Issues', 'task', { w: 66 }),
  N('me_refine', 'mep', 1497, 662, 'Refine modelling and Generate 2D sheets', 'task', { w: 66, h: 40 }),
  N('me_review', 'mep', 1585, 662, 'Internal Review Approved?', 'decision', { w: 82, h: 52 }),
  N('me_upload', 'mep', 1812, 662, 'Upload Submission Files', 'task', { w: 66 }),
  // Infrastructure Engineer
  N('in_tidp', 'infra', 164, 755, 'Provide TIDP', 'input', { w: 66, h: 28 }),
  N('in_utility', 'infra', 536, 755, 'Provide Utility Corridor Requirements', 'input', { w: 96, h: 40 }),
  N('in_civil', 'infra', 990, 755, 'Create Civil3D Model', 'task', { w: 70 }),
  N('in_nwc', 'infra', 1198, 755, 'Provide NWC files', 'task', { w: 62 }),
  N('in_resolve', 'infra', 1348, 755, 'Resolve Issues', 'task', { w: 66 }),
  N('in_gen', 'infra', 1497, 755, 'Generate 2D sheets', 'task', { w: 66 }),
  N('in_review', 'infra', 1585, 755, 'Internal Review Approved?', 'decision', { w: 82, h: 52 }),
  N('in_upload', 'infra', 1812, 755, 'Upload Submission Files', 'task', { w: 66 }),
];

export interface PEdge { id: string; from: string; to: string; label?: string; dashed?: boolean; bx?: number }
let _e = 0;
const E = (from: string, to: string, o: Partial<PEdge> = {}): PEdge => ({ id: `e${++_e}_${from}_${to}`, from, to, ...o });
export const EDGES: PEdge[] = [
  // main spine (solid)
  E('bm_midp', 'bm_bep'), E('bm_kickoff', 'bm_pinfo'), E('bm_pinfo', 'bm_folder'), E('bm_folder', 'bm_validate'), E('bm_validate', 'bm_zoning'), E('bm_zoning', 'bm_rcp'), E('bm_rcp', 'bm_valid1'),
  E('bm_valid1', 'bm_valid2', { label: 'Yes', bx: 793 }), E('bm_valid2', 'bm_coord', { label: 'Yes' }),
  E('bm_coord', 'bm_squad'), E('bm_squad', 'bm_visual'), E('bm_visual', 'bm_appr1', { bx: 1352 }), E('bm_appr1', 'bm_coord', { label: 'No', bx: 1350 }),
  E('bm_appr2', 'bm_subfolder', { label: 'Yes' }), E('bm_qcc', 'bm_appr2', { bx: 1770 }), E('bm_subfolder', 'bm_lessons'),
  E('pm_guidelines', 'pm_release'), E('pm_release', 'pm_close'),
  // kick-off and BEP (dashed = information / deliverable)
  E('pm_mob', 'bm_midp', { dashed: true }), E('bm_bep', 'pm_client', { dashed: true, bx: 222 }), E('pm_client', 'bm_kickoff', { dashed: true }),
  E('bm_bep', 'bm_kickoff', { dashed: true }),
  E('ar_tidp', 'bm_midp', { dashed: true, bx: 85 }), E('st_tidp', 'bm_midp', { dashed: true, bx: 85 }), E('me_tidp', 'bm_midp', { dashed: true, bx: 85 }), E('in_tidp', 'bm_midp', { dashed: true, bx: 85 }),
  E('ar_consult', 'bm_bep', { dashed: true }),
  E('ar_keyplan', 'bm_pinfo', { dashed: true, bx: 321 }), E('ur_site', 'bm_pinfo', { dashed: true, bx: 321 }),
  E('ar_keyplan', 'ar_datum', { dashed: true }), E('ar_datum', 'ar_dummy', { dashed: true }), E('ar_dummy', 'ar_model', { dashed: true }),
  E('ar_model', 'bm_validate', { dashed: true }),
  E('ar_ceiling', 'bm_zoning', { dashed: true, bx: 627 }), E('st_statical', 'bm_zoning', { dashed: true, bx: 627 }), E('me_req', 'bm_zoning', { dashed: true, bx: 627 }), E('in_utility', 'bm_zoning', { dashed: true, bx: 627 }),
  // RCP validation inputs
  E('ar_reflected', 'bm_rcp', { dashed: true }), E('st_super', 'bm_rcp', { dashed: true, bx: 724 }), E('me_ceil', 'bm_rcp', { dashed: true, bx: 725 }),
  E('bm_valid1', 'me_ceil', { label: 'No', dashed: true, bx: 793 }),
  E('bm_valid1', 'ar_wallfin', { label: 'Yes', dashed: true, bx: 866 }), E('ar_wallfin', 'me_complete', { dashed: true }),
  // second validation: coordinates and master plan
  E('ur_master', 'ar_adjust', { dashed: true }), E('ar_adjust', 'bm_valid2', { dashed: true }), E('bm_valid2', 'ar_adjust', { label: 'No', dashed: true, bx: 942 }),
  E('ur_master', 'in_civil', { dashed: true, bx: 928 }), E('st_complete', 'bm_valid2', { dashed: true, bx: 1035 }),
  E('bm_valid2', 'ar_acquire', { label: 'Yes', dashed: true, bx: 1077 }), E('bm_valid2', 'st_acquire', { dashed: true, bx: 1077 }), E('bm_valid2', 'me_acquire', { dashed: true, bx: 1077 }),
  E('ar_acquire', 'ar_publish'), E('st_acquire', 'st_publish'), E('me_acquire', 'me_publish'), E('in_civil', 'in_nwc'),
  E('ar_publish', 'bm_coord', { dashed: true, bx: 1250 }), E('st_publish', 'bm_coord', { dashed: true, bx: 1250 }), E('me_publish', 'bm_coord', { dashed: true, bx: 1250 }), E('in_nwc', 'bm_coord', { dashed: true, bx: 1250 }),
  E('pm_squad_dates', 'bm_coord', { dashed: true }),
  // issues, refinement, internal review
  E('bm_visual', 'ar_resolve', { dashed: true, bx: 1297 }), E('bm_visual', 'st_resolve', { dashed: true, bx: 1297 }), E('bm_visual', 'me_resolve', { dashed: true, bx: 1297 }), E('bm_visual', 'in_resolve', { dashed: true, bx: 1297 }),
  E('bm_appr1', 'pm_sub_dates', { label: 'Yes', dashed: true, bx: 1445 }),
  E('ar_resolve', 'ar_refine'), E('st_resolve', 'st_refine'), E('me_resolve', 'me_refine'), E('in_resolve', 'in_gen'),
  E('pm_sub_dates', 'ar_refine', { dashed: true }),
  E('ar_refine', 'ar_review'), E('st_refine', 'st_review'), E('me_refine', 'me_review'), E('in_gen', 'in_review'),
  E('ar_review', 'ar_refine', { label: 'No', bx: 1541 }), E('st_review', 'st_refine', { label: 'No', bx: 1541 }), E('me_review', 'me_refine', { label: 'No', bx: 1541 }), E('in_review', 'in_gen', { label: 'No', bx: 1541 }),
  // quality control and submission
  E('ar_review', 'bm_qcc', { label: 'Yes', bx: 1652 }), E('st_review', 'bm_qcc', { label: 'Yes', bx: 1652 }), E('me_review', 'bm_qcc', { label: 'Yes', bx: 1652 }), E('in_review', 'bm_qcc', { label: 'Yes', bx: 1652 }),
  E('bm_qcc', 'trc_qc', { dashed: true }), E('trc_qc', 'bm_appr2', { dashed: true, bx: 1736 }),
  E('bm_appr2', 'pm_guidelines', { label: 'Yes', dashed: true }), E('bm_appr2', 'ar_refine', { label: 'No', bx: 1448 }),
  E('ar_upload', 'bm_subfolder', { dashed: true, bx: 1863 }), E('st_upload', 'bm_subfolder', { dashed: true, bx: 1863 }), E('me_upload', 'bm_subfolder', { dashed: true, bx: 1863 }), E('in_upload', 'bm_subfolder', { dashed: true, bx: 1863 }),
  E('bm_subfolder', 'pm_release', { dashed: true }),
];

export const NODE_KEYS = new Set(NODES.map((n) => n.id));
export const nodeById = new Map(NODES.map((n) => [n.id, n]));
export const laneOf = (id: string) => LANES.find((l) => l.id === nodeById.get(id)?.lane);
export const nodeSize = (n: PNode) => ({ w: n.w ?? (n.kind === 'decision' ? 60 : n.kind === 'start' || n.kind === 'end' ? 66 : 76), h: n.h ?? (n.kind === 'decision' ? 36 : n.kind === 'start' || n.kind === 'end' ? 28 : 34) });

export type Pt = [number, number];
/** Orthogonal connector between two nodes: straight when aligned, otherwise horizontal - vertical - horizontal around a bend column. */
export function routeEdge(e: PEdge): Pt[] {
  const a = nodeById.get(e.from)!, b = nodeById.get(e.to)!; const sa = nodeSize(a), sb = nodeSize(b);
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dy) < 6) { const dir = dx >= 0 ? 1 : -1; return [[a.x + dir * sa.w / 2, a.y], [b.x - dir * sb.w / 2, b.y]]; }
  if (Math.abs(dx) < 14 && e.bx == null) { const dir = dy >= 0 ? 1 : -1; return [[a.x, a.y + dir * sa.h / 2], [a.x, b.y - dir * sb.h / 2]]; }
  if (e.bx != null && Math.abs(e.bx - a.x) < 3 && Math.abs(e.bx - b.x) < 3) { const dir = dy >= 0 ? 1 : -1; return [[a.x, a.y + dir * sa.h / 2], [a.x, b.y - dir * sb.h / 2]]; }
  const dir = dx >= 0 ? 1 : -1;
  const x0 = a.x + dir * sa.w / 2, x1 = b.x - dir * sb.w / 2;
  const bx = e.bx ?? (x0 + x1) / 2;
  return [[x0, a.y], [bx, a.y], [bx, b.y], [x1, b.y]];
}
/** Where an edge label sits: just after the start of the connector (clear of the target), nudged off the line. */
export function labelPos(pts: Pt[]): { x: number; y: number } {
  const [p0, p1] = [pts[0], pts[1]];
  if (Math.abs(p1[1] - p0[1]) < 1) { const d = p1[0] >= p0[0] ? 1 : -1; return { x: p0[0] + d * 14, y: p0[1] - 4 }; }
  const d = p1[1] >= p0[1] ? 1 : -1; return { x: p0[0] + 4, y: p0[1] + d * 14 };
}
export const pathOf = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');

/** Greedy word wrap into lines of at most `max` characters (a longer single word stays whole). */
export function wrapLabel(text: string, max: number): string[] {
  const out: string[] = []; let cur = '';
  for (const w of text.split(/\s+/).filter(Boolean)) { if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) out.push(cur); return out;
}

export interface NodeState { status: ProcessStatus; comment?: string | null; updated_by?: string | null; updated_at?: string | null }
export type StateMap = Record<string, NodeState | undefined>;
export const statusOf = (s: StateMap, id: string): ProcessStatus => s[id]?.status ?? 'Not Started';
export function progressOf(s: StateMap) {
  const by: Record<ProcessStatus, number> = { 'Not Started': 0, 'In Progress': 0, 'On Hold': 0, Completed: 0 };
  for (const n of NODES) by[statusOf(s, n.id)]++;
  return { total: NODES.length, by, pct: Math.round((by.Completed / NODES.length) * 100) };
}
