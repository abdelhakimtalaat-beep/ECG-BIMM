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
/** Horizontal spread of the hand-placed sheet (x as drawn on the original ~2250 wide sheet): gives every box clear space around it for arrows. */
export const X_SCALE = 1.5;
const sx = (x: number) => Math.round(34 + (x - 34) * X_SCALE);
export const DIAGRAM_W = sx(2250), DIAGRAM_H = 795, LANE_LABEL_W = 34;

/** The four phases (groups) of the workflow, as column ranges of the sheet. */
export interface Phase { id: string; label: string; x0: number; x1: number; tint: string }
export const PHASES: Phase[] = [
  { id: 'mob', label: 'Mobilization', x0: 0, x1: sx(543), tint: '#6366f1' },
  { id: 'prod', label: 'Production', x0: sx(543), x1: sx(1409), tint: '#0d9488' },
  { id: 'coord', label: 'Coordination', x0: sx(1409), x1: sx(1799), tint: '#d97706' },
  { id: 'qc', label: 'Quality Control & Submission', x0: sx(1799), x1: sx(2250), tint: '#7c3aed' },
];
export const PHASE_H = 26;
export const phaseOf = (n: PNode) => PHASES.find((p) => n.x < p.x1) ?? PHASES[PHASES.length - 1];

export type NodeKind = 'task' | 'input' | 'decision' | 'start' | 'end';
export interface PNode { id: string; lane: string; x: number; y: number; label: string; kind: NodeKind; w?: number; h?: number; note?: string }
const N = (id: string, lane: string, x: number, y: number, label: string, kind: NodeKind = 'task', extra: Partial<PNode> = {}): PNode => ({ id, lane, x: sx(x), y, label, kind, ...extra });

export const NODES: PNode[] = [
  // Project Management
  N('pm_mob', 'pm', 110, 42, 'Project BIM Requirements / EIR / SOW / Contract / TLs', 'input', { w: 96, h: 38, note: 'Project Information, Data Collection, Contact List, Contract, EIR, Pre-Appointment BEP, Proposal, SOW, RACI matrix, Schedules, Milestones, and Stakeholders data' }),
  N('pm_client', 'pm', 270, 42, 'Client BEP Approval', 'decision', { w: 112, h: 54, note: 'Gate: the Client approves the BEP, including the project Title Block and the Building Coding System' }),
  N('pm_squad_dates', 'pm', 1547, 42, 'Squad Check Dates'),
  N('pm_sub_dates', 'pm', 1750, 42, 'Submittal Dates'),
  N('pm_guidelines', 'pm', 2020, 42, 'Prepare Submittal Guidelines'),
  N('pm_release', 'pm', 2113, 42, 'Release Submittal Package'),
  N('pm_close', 'pm', 2203, 42, 'Close Out', 'end'),
  // BIM Management
  N('bm_midp', 'bim', 500, 152, 'Create MIDP', 'task', { note: 'Master Information Delivery Plan, consolidated from the Task Teams\' TIDPs after the BIM Kick-Off Meeting' }),
  N('pm_midp_gate', 'pm', 500, 42, 'Client MIDP Approval', 'decision', { w: 112, h: 54, note: 'Gate: the Client approves the MIDP once all Task Teams have completed their TIDPs' }),
  N('bm_bep', 'bim', 190, 152, 'Create BEP', 'task', { note: 'Naming Convention, Model Segregation, SOW, RACI, Linking/Grouping Scenario' }),
  N('bm_cde', 'bim', 110, 152, 'CDE Setup', 'task', { note: 'Common Data Environment setup, right after the project requirements' }),
  N('bm_kickoff', 'bim', 270, 152, 'BIM Kick-Off Meeting'),
  N('bm_tidpt', 'bim', 345, 152, 'TIDP Template', 'task', { note: 'Template issued to the Task Teams to prepare their TIDPs' }),
  N('bm_pinfo', 'bim', 608, 152, 'Pinfo Preparation'),
  N('bm_folder', 'bim', 693, 152, 'Provide The Folder Structure Tree'),
  N('bm_validate', 'bim', 786, 152, 'Validate The Architecture Base Model'),
  N('bm_zoning', 'bim', 876, 152, 'Prepare Coordination Zoning'),
  N('bm_rcp', 'bim', 951, 152, 'RCP Validation'),
  N('bm_valid1', 'bim', 1043, 152, 'Valid?', 'decision'),
  N('bm_valid2', 'bim', 1240, 152, 'Valid?', 'decision'),
  N('bm_coord', 'bim', 1547, 146, 'Coordination Meeting/s Internal & External', 'task', { w: 170 }),
  N('bm_squad', 'bim', 1547, 190, 'Squad Check Workshop/s', 'task', { w: 170, h: 28 }),
  N('bm_visual', 'bim', 1547, 238, 'Visual Check, Hard Clashes, Audit Report, Assign Issues', 'task', { w: 170 }),
  N('bm_appr1', 'bim', 1648, 152, 'Approved?', 'decision'),
  N('bm_qcc', 'bim', 1952, 232, 'BIM Quality Control Check', 'task', { w: 104 }),
  N('bm_appr2', 'bim', 2020, 152, 'Approved?', 'decision'),
  N('bm_subfolder', 'bim', 2113, 152, 'Create submission folder structure'),
  N('bm_lessons', 'bim', 2203, 152, 'Prepare Learned Lessons'),
  // TRC & Document Control
  N('trc_qc', 'trc', 1952, 300, 'TRC & DC Quality Control Review', 'task', { w: 104 }),
  // Architect / Interior Designer
  N('ar_consult', 'arch', 190, 368, 'Provide Consultation', 'input', { note: 'For Model Segregation, Linking, and Grouping Scenarios' }),
  N('ar_tidp', 'arch', 400, 418, 'Provide TIDP', 'input', { w: 66, h: 28 }),
  N('ar_keyplan', 'arch', 608, 419, 'Provide KeyPlan/s', 'input', { note: 'As a single line building boundary, Match Lines, and Building/Parts number' }),
  N('ar_datum', 'arch', 645, 368, 'Create Datum Model', 'task', { w: 60 }),
  N('ar_dummy', 'arch', 716, 368, 'Create Structure Dummy Model', 'task', { w: 60, h: 40 }),
  N('ar_model', 'arch', 787, 364, 'Create Architectural Model', 'task', { w: 60, h: 40, note: 'Basic Elements (e.g. Blockwork, openings, ceilings)' }),
  N('ar_ceiling', 'arch', 795, 419, 'Provide Ceiling Level and Design', 'input', { w: 110 }),
  N('ar_reflected', 'arch', 951, 368, 'Confirm Reflected Ceiling Fixtures Layout'),
  N('ar_wallfin', 'arch', 1116, 368, 'Complete Modelling Internal Wall Finishes', 'task', { h: 44 }),
  N('ar_adjust', 'arch', 1240, 368, 'Adjust The project Coordinates (Datum Model)', 'task', { h: 44 }),
  N('ar_acquire', 'arch', 1370, 368, 'Acquire Coordinates to Architecture Model', 'task', { w: 62, h: 44 }),
  N('ar_publish', 'arch', 1472, 368, 'Provide Published views/ NWC files', 'task', { w: 62, h: 44 }),
  N('ar_resolve', 'arch', 1595, 368, 'Resolve Issues', 'task', { w: 66 }),
  N('ar_refine', 'arch', 1747, 368, 'Refine modelling and Generate 2D sheets', 'task', { w: 66, h: 40 }),
  N('ar_review', 'arch', 1835, 368, 'Internal Review Approved?', 'decision', { w: 82, h: 52 }),
  N('ar_upload', 'arch', 2062, 368, 'Upload Submission Files', 'task', { w: 66 }),
  // Urban / Landscape
  N('ur_site', 'urban', 608, 485, 'Provide The Site Key Plan and North Arrow', 'input', { w: 96, h: 46, note: 'As a single line, Match Lines, Building Distribution, Survey Point and the North Arrow' }),
  N('ur_master', 'urban', 1240, 482, 'Provide Confirmed Site Master Plan', 'input', { w: 96, h: 40, note: 'Include buildings Distribution and Numbering "as per the numbering system mentioned at the project BEP"' }),
  // Structural Engineer
  N('st_tidp', 'struct', 400, 572, 'Provide TIDP', 'input', { w: 66, h: 28 }),
  N('st_statical', 'struct', 782, 572, 'Provide Statical System Requirements', 'input', { w: 96, h: 40 }),
  N('st_super', 'struct', 998, 572, 'Provide Superstructure 3D Model'),
  N('st_complete', 'struct', 1240, 572, 'Complete Super and substructure 3D Model', 'task', { w: 92, h: 40 }),
  N('st_acquire', 'struct', 1370, 572, 'Acquire Coordinates to Structure Model', 'task', { w: 62, h: 44 }),
  N('st_publish', 'struct', 1472, 572, 'Provide Published views/ NWC files', 'task', { w: 62, h: 44 }),
  N('st_resolve', 'struct', 1598, 572, 'Resolve Issues', 'task', { w: 66 }),
  N('st_refine', 'struct', 1747, 572, 'Refine modelling and Generate 2D sheets', 'task', { w: 66, h: 40 }),
  N('st_review', 'struct', 1835, 572, 'Internal Review Approved?', 'decision', { w: 82, h: 52 }),
  N('st_upload', 'struct', 2062, 572, 'Upload Submission Files', 'task', { w: 66 }),
  // MEP Engineer
  N('me_tidp', 'mep', 400, 662, 'Provide TIDP', 'input', { w: 66, h: 28 }),
  N('me_req', 'mep', 782, 662, 'Provide MEP Requirements', 'input', { w: 96 }),
  N('me_ceil', 'mep', 998, 662, 'Provide MEP 3D Models (Ceiling Fixtures Only)', 'task', { w: 100, h: 50 }),
  N('me_complete', 'mep', 1116, 662, 'Complete MEP 3D Models (Add Above Ceiling Connections, and wall Fixtures)', 'task', { w: 72, h: 62 }),
  N('me_acquire', 'mep', 1370, 662, 'Acquire Coordinates to MEP Models', 'task', { w: 62, h: 44 }),
  N('me_publish', 'mep', 1472, 662, 'Provide Published views/ NWC files', 'task', { w: 62, h: 44 }),
  N('me_resolve', 'mep', 1598, 662, 'Resolve Issues', 'task', { w: 66 }),
  N('me_refine', 'mep', 1747, 662, 'Refine modelling and Generate 2D sheets', 'task', { w: 66, h: 40 }),
  N('me_review', 'mep', 1835, 662, 'Internal Review Approved?', 'decision', { w: 82, h: 52 }),
  N('me_upload', 'mep', 2062, 662, 'Upload Submission Files', 'task', { w: 66 }),
  // Infrastructure Engineer
  N('in_tidp', 'infra', 400, 755, 'Provide TIDP', 'input', { w: 66, h: 28 }),
  N('in_utility', 'infra', 786, 755, 'Provide Utility Corridor Requirements', 'input', { w: 96, h: 40 }),
  N('in_civil', 'infra', 1240, 755, 'Create Civil3D Model', 'task', { w: 70 }),
  N('in_nwc', 'infra', 1472, 755, 'Provide NWC files', 'task', { w: 62 }),
  N('in_resolve', 'infra', 1598, 755, 'Resolve Issues', 'task', { w: 66 }),
  N('in_gen', 'infra', 1747, 755, 'Generate 2D sheets', 'task', { w: 66 }),
  N('in_review', 'infra', 1835, 755, 'Internal Review Approved?', 'decision', { w: 82, h: 52 }),
  N('in_upload', 'infra', 2062, 755, 'Upload Submission Files', 'task', { w: 66 }),
];

import { Router, polyHitsBox, type Box, type Pt } from './processRoute.ts';
export type { Pt };
export interface PEdge { id: string; from: string; to: string; label?: string; dashed?: boolean; bx?: number; enter?: 'top' | 'bottom' }
let _e = 0;
const E = (from: string, to: string, o: Partial<PEdge> = {}): PEdge => ({ id: `e${++_e}_${from}_${to}`, from, to, ...o, ...(o.bx != null ? { bx: sx(o.bx) } : {}) });
export const EDGES: PEdge[] = [
  // main spine (solid)
  E('bm_cde', 'bm_bep'), E('bm_bep', 'bm_kickoff'), E('bm_kickoff', 'bm_tidpt'), E('bm_tidpt', 'bm_midp'), E('bm_midp', 'bm_pinfo'), E('bm_pinfo', 'bm_folder'), E('bm_folder', 'bm_validate'), E('bm_validate', 'bm_zoning'), E('bm_zoning', 'bm_rcp'), E('bm_rcp', 'bm_valid1'),
  E('bm_valid1', 'bm_valid2', { label: 'Yes', bx: 1043 }), E('bm_valid2', 'bm_coord', { label: 'Yes' }),
  E('bm_coord', 'bm_squad'), E('bm_squad', 'bm_visual'), E('bm_visual', 'bm_appr1', { bx: 1602 }), E('bm_appr1', 'bm_coord', { label: 'No', bx: 1600 }),
  E('bm_appr2', 'bm_subfolder', { label: 'Yes' }), E('bm_qcc', 'bm_appr2', { bx: 2020 }), E('bm_subfolder', 'bm_lessons'),
  E('pm_guidelines', 'pm_release'), E('pm_release', 'pm_close'),
  // kick-off and BEP (dashed = information / deliverable)
  E('pm_mob', 'bm_cde', { dashed: true }), E('bm_bep', 'pm_client', { dashed: true, bx: 230 }), E('pm_client', 'bm_kickoff', { label: 'Approved', dashed: true }),
  // after the kick-off: Task Teams provide TIDPs, the BIM Manager consolidates the MIDP, the Client approves it (gate)
  E('bm_tidpt', 'ar_tidp', { dashed: true, bx: 345 }), E('bm_tidpt', 'st_tidp', { dashed: true, bx: 345 }), E('bm_tidpt', 'me_tidp', { dashed: true, bx: 345 }), E('bm_tidpt', 'in_tidp', { dashed: true, bx: 345 }),
  E('ar_tidp', 'bm_midp', { dashed: true, bx: 452 }), E('st_tidp', 'bm_midp', { dashed: true, bx: 452 }), E('me_tidp', 'bm_midp', { dashed: true, bx: 452 }), E('in_tidp', 'bm_midp', { dashed: true, bx: 452 }),
  E('bm_midp', 'pm_midp_gate', { dashed: true }), E('pm_midp_gate', 'bm_pinfo', { label: 'Approved', dashed: true, bx: 560 }),
  E('ar_consult', 'bm_bep', { dashed: true }),
  E('ar_keyplan', 'bm_pinfo', { dashed: true }), E('ur_site', 'bm_pinfo', { dashed: true, enter: 'bottom', bx: 565 }),
  E('ar_datum', 'ar_dummy', { dashed: true }), E('ar_dummy', 'ar_model', { dashed: true }),
  E('ar_model', 'bm_validate', { dashed: true }),
  E('ar_ceiling', 'bm_zoning', { dashed: true, bx: 877 }), E('st_statical', 'bm_zoning', { dashed: true, bx: 877 }), E('me_req', 'bm_zoning', { dashed: true, bx: 877 }), E('in_utility', 'bm_zoning', { dashed: true, bx: 877 }),
  // RCP validation inputs
  E('ar_reflected', 'bm_rcp', { dashed: true }), E('st_super', 'bm_rcp', { dashed: true, enter: 'bottom' }), E('me_ceil', 'ar_reflected', { dashed: true, bx: 951 }),
  E('bm_valid1', 'me_ceil', { label: 'No', dashed: true, bx: 1043 }),
  E('bm_valid1', 'ar_wallfin', { label: 'Yes', dashed: true, bx: 1116 }), E('ar_wallfin', 'me_complete', { dashed: true }),
  // second validation: coordinates and master plan
  E('ur_master', 'ar_adjust', { dashed: true }), E('ar_adjust', 'bm_valid2', { dashed: true }), E('bm_valid2', 'ar_adjust', { label: 'No', dashed: true, bx: 1192 }),
  E('ur_master', 'in_civil', { dashed: true, bx: 1178 }), E('st_complete', 'bm_valid2', { dashed: true, bx: 1285 }),
  E('bm_valid2', 'ar_acquire', { label: 'Yes', dashed: true, bx: 1327 }), E('bm_valid2', 'st_acquire', { dashed: true, bx: 1327 }), E('bm_valid2', 'me_acquire', { dashed: true, bx: 1327 }),
  E('ar_acquire', 'ar_publish'), E('st_acquire', 'st_publish'), E('me_acquire', 'me_publish'), E('in_civil', 'in_nwc'),
  E('ar_publish', 'bm_coord', { dashed: true, bx: 1516 }), E('st_publish', 'bm_coord', { dashed: true, bx: 1516 }), E('me_publish', 'bm_coord', { dashed: true, bx: 1516 }), E('in_nwc', 'bm_coord', { dashed: true, bx: 1516 }),
  E('pm_squad_dates', 'bm_coord', { dashed: true }),
  // issues, refinement, internal review
  E('bm_visual', 'ar_resolve', { dashed: true, bx: 1547 }), E('bm_visual', 'st_resolve', { dashed: true, bx: 1547 }), E('bm_visual', 'me_resolve', { dashed: true, bx: 1547 }), E('bm_visual', 'in_resolve', { dashed: true, bx: 1547 }),
  E('bm_appr1', 'pm_sub_dates', { label: 'Yes', dashed: true, bx: 1695 }),
  E('ar_resolve', 'ar_refine'), E('st_resolve', 'st_refine'), E('me_resolve', 'me_refine'), E('in_resolve', 'in_gen'),
  E('pm_sub_dates', 'ar_refine', { dashed: true }),
  E('ar_refine', 'ar_review'), E('st_refine', 'st_review'), E('me_refine', 'me_review'), E('in_gen', 'in_review'),
  E('ar_review', 'ar_refine', { label: 'No', bx: 1791 }), E('st_review', 'st_refine', { label: 'No', bx: 1791 }), E('me_review', 'me_refine', { label: 'No', bx: 1791 }), E('in_review', 'in_gen', { label: 'No', bx: 1791 }),
  // quality control and submission
  E('ar_review', 'bm_qcc', { label: 'Yes', bx: 1902 }), E('st_review', 'bm_qcc', { label: 'Yes', bx: 1902 }), E('me_review', 'bm_qcc', { label: 'Yes', bx: 1902 }), E('in_review', 'bm_qcc', { label: 'Yes', bx: 1902 }),
  E('bm_qcc', 'trc_qc', { dashed: true }), E('trc_qc', 'bm_appr2', { dashed: true, bx: 1986 }),
  E('bm_appr2', 'pm_guidelines', { label: 'Yes', dashed: true }), E('bm_appr2', 'ar_refine', { label: 'No', bx: 1790 }),
  E('ar_upload', 'bm_subfolder', { dashed: true, bx: 2113 }), E('st_upload', 'bm_subfolder', { dashed: true, bx: 2113 }), E('me_upload', 'bm_subfolder', { dashed: true, bx: 2113 }), E('in_upload', 'bm_subfolder', { dashed: true, bx: 2113 }),
  E('bm_subfolder', 'pm_release', { dashed: true }),
];

export const NODE_KEYS = new Set(NODES.map((n) => n.id));
export const nodeById = new Map(NODES.map((n) => [n.id, n]));
export const laneOf = (id: string) => LANES.find((l) => l.id === nodeById.get(id)?.lane);
/** Text metrics of the 8.5px bold label and the box that fully holds it (explicit w / h are minimums). */
const CHAR_W = 5.4, LINE_H = 10.1;
const layoutCache = new Map<string, { w: number; h: number; lines: string[] }>();
export function nodeLayout(n: PNode): { w: number; h: number; lines: string[] } {
  const hit = layoutCache.get(n.id); if (hit) return hit;
  const minW = n.w ?? (n.kind === 'decision' ? 60 : n.kind === 'start' || n.kind === 'end' ? 66 : 90), minH = n.h ?? (n.kind === 'decision' ? 36 : n.kind === 'start' || n.kind === 'end' ? 28 : 34);
  const usable = (ww: number) => n.kind === 'decision' ? ww * 0.58 : n.kind === 'input' ? ww - 22 : n.kind === 'start' || n.kind === 'end' ? ww - 18 : ww - 12;
  const grow = (need: number) => n.kind === 'decision' ? Math.ceil(need / 0.58) : Math.ceil(need + (n.kind === 'input' ? 22 : n.kind === 'start' || n.kind === 'end' ? 18 : 12));
  // widen (up to 150) until the label fits in at most 3 lines; the box is then exactly as wide as its longest line needs
  let w = minW, lines = wrapLabel(n.label, Math.max(6, Math.floor(usable(minW) / CHAR_W)));
  for (let ww = minW; ww <= 150; ww += 6) {
    const ls = wrapLabel(n.label, Math.max(6, Math.floor(usable(ww) / CHAR_W)));
    lines = ls; w = Math.max(minW, grow(Math.max(...ls.map((t) => t.length)) * CHAR_W));
    if (ls.length <= 3) break;
  }
  const textH = lines.length * LINE_H;
  const h = Math.max(minH, Math.ceil(n.kind === 'decision' ? textH / 0.5 : textH + 12));
  const r = { w: Math.ceil(w / 2) * 2, h: Math.ceil(h / 2) * 2, lines }; layoutCache.set(n.id, r); return r;
}
export const nodeSize = (n: PNode) => { const { w, h } = nodeLayout(n); return { w, h }; };

/** Orthogonal connector between two nodes: straight when aligned, otherwise horizontal - vertical - horizontal around a bend column. */
function legacyRoute(e: PEdge, byId: Map<string, PNode> = nodeById): Pt[] {
  const a = byId.get(e.from)!, b = byId.get(e.to)!; const sa = nodeSize(a), sb = nodeSize(b);
  const dx = b.x - a.x, dy = b.y - a.y;
  // merge into the target's bottom / top: up (down) the source's column, along a rail just outside the target, then into it
  if (e.enter && e.bx != null) { const up = e.enter === 'bottom'; const rail = up ? b.y + sb.h / 2 + 12 : b.y - sb.h / 2 - 12; const hd = e.bx >= a.x ? 1 : -1; return [[a.x + hd * sa.w / 2, a.y], [e.bx, a.y], [e.bx, rail], [b.x, rail], [b.x, b.y + (up ? 1 : -1) * sb.h / 2]]; }
  if (e.enter) { const up = e.enter === 'bottom'; const rail = up ? b.y + sb.h / 2 + 12 : b.y - sb.h / 2 - 12; const sy = a.y + (up ? -1 : 1) * sa.h / 2; return [[a.x, sy], [a.x, rail], [b.x, rail], [b.x, b.y + (up ? 1 : -1) * sb.h / 2]]; }
  if (Math.abs(dy) < 6) { const dir = dx >= 0 ? 1 : -1; return [[a.x + dir * sa.w / 2, a.y], [b.x - dir * sb.w / 2, b.y]]; }
  if (Math.abs(dx) < 14 && e.bx == null) { const dir = dy >= 0 ? 1 : -1; return [[a.x, a.y + dir * sa.h / 2], [a.x, b.y - dir * sb.h / 2]]; }
  if (e.bx != null && Math.abs(e.bx - a.x) < 3 && Math.abs(e.bx - b.x) < 3) { const dir = dy >= 0 ? 1 : -1; return [[a.x, a.y + dir * sa.h / 2], [a.x, b.y - dir * sb.h / 2]]; }
  // bend column over the source: leave through its top / bottom, then run into the target's side
  if (e.bx != null && Math.abs(e.bx - a.x) < 3) { const vd = dy >= 0 ? 1 : -1, hd = dx >= 0 ? 1 : -1; return [[a.x, a.y + vd * sa.h / 2], [a.x, b.y], [b.x - hd * sb.w / 2, b.y]]; }
  // bend column over the target: leave through the source's side, then enter the target's top / bottom
  if (e.bx != null && Math.abs(e.bx - b.x) < 3) { const vd = dy >= 0 ? 1 : -1, hd = dx >= 0 ? 1 : -1; return [[a.x + hd * sa.w / 2, a.y], [b.x, a.y], [b.x, b.y - vd * sb.h / 2]]; }
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
const boxOf = (n: PNode): Box => { const s = nodeSize(n); return { id: n.id, x0: n.x - s.w / 2, y0: n.y - s.h / 2, x1: n.x + s.w / 2, y1: n.y + s.h / 2 }; };
/** What the router needs for one set of visible nodes. */
interface RouteCtx { byId: Map<string, PNode>; boxes: Box[]; height: number; router: Router | null; cache: Map<string, Pt[]> }
const mkCtx = (nodes: PNode[], height: number): RouteCtx => ({ byId: new Map(nodes.map((n) => [n.id, n])), boxes: nodes.map(boxOf), height, router: null, cache: new Map() });
/** Connector geometry. The hand-tuned route (bend column `bx`) is used when it keeps a clear margin to every other node; otherwise the router finds a clear one. */
function routeIn(c: RouteCtx, e: PEdge): Pt[] {
  const hit = c.cache.get(e.id); if (hit) return hit;
  const legacy = legacyRoute(e, c.byId);
  let out = legacy;
  const A = c.byId.get(e.from)!, B = c.byId.get(e.to)!;
  const ownHit = (b: Box, pts: Pt[]) => polyHitsBox(pts.slice(1, -1).length ? pts : [pts[0], pts[pts.length - 1]], b, -1);
  if (c.boxes.some((b) => b.id !== e.from && b.id !== e.to && polyHitsBox(legacy, b, 7)) || ownHit(boxOf(A), legacy) || ownHit(boxOf(B), legacy)) {
    c.router ??= new Router(c.boxes, DIAGRAM_W, c.height);
    out = c.router.route(boxOf(A), boxOf(B)) ?? legacy;
  }
  c.cache.set(e.id, out); return out;
}
const FULL = mkCtx(NODES, DIAGRAM_H);
export const NODE_BOXES: Box[] = FULL.boxes;
export const routeEdge = (e: PEdge): Pt[] => routeIn(FULL, e);

/** The map as drawn when some rows (lanes) are removed: the rows below move up, the activities and connectors of removed rows are left out. */
export interface MapView { hidden: string[]; lanes: Lane[]; nodes: PNode[]; edges: PEdge[]; height: number; hiddenNodes: ReadonlySet<string>; route: (e: PEdge) => Pt[] }
const NO_SKIP: ReadonlySet<string> = new Set();
const _views = new Map<string, MapView>();
export function viewOf(hiddenLanes: readonly string[] = []): MapView {
  let hidden = LANES.map((l) => l.id).filter((id) => hiddenLanes.includes(id));
  if (hidden.length >= LANES.length) hidden = [];
  const key = hidden.join(','); const hit = _views.get(key); if (hit) return hit;
  let v: MapView;
  if (!hidden.length) v = { hidden, lanes: LANES, nodes: NODES, edges: EDGES, height: DIAGRAM_H, hiddenNodes: NO_SKIP, route: routeEdge };
  else {
    const shift = new Map<string, number>(); const lanes: Lane[] = []; let y = 0;
    for (const l of LANES) { if (hidden.includes(l.id)) continue; shift.set(l.id, y - l.y0); lanes.push({ ...l, y0: y, y1: y + (l.y1 - l.y0) }); y += l.y1 - l.y0; }
    const nodes = NODES.filter((n) => shift.has(n.lane)).map((n) => ({ ...n, y: n.y + shift.get(n.lane)! }));
    const ids = new Set(nodes.map((n) => n.id));
    const ctx = mkCtx(nodes, y);
    v = { hidden, lanes, nodes, edges: EDGES.filter((e) => ids.has(e.from) && ids.has(e.to)), height: y, hiddenNodes: new Set(NODES.filter((n) => !ids.has(n.id)).map((n) => n.id)), route: (e) => routeIn(ctx, e) };
  }
  _views.set(key, v); return v;
}
export const pathOf = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');

/** Greedy word wrap into lines of at most `max` characters (a longer single word stays whole). */
export function wrapLabel(text: string, max: number): string[] {
  const out: string[] = []; let cur = '';
  for (const w of text.split(/\s+/).filter(Boolean)) { if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) out.push(cur); return out;
}

export interface NodeState { status: ProcessStatus; comment?: string | null; outcome?: 'yes' | 'no' | null; outcome_date?: string | null; updated_by?: string | null; updated_at?: string | null }
export type StateMap = Record<string, NodeState | undefined>;
export const statusOf = (s: StateMap, id: string): ProcessStatus => s[id]?.status ?? 'Not Started';
/** Rework connectors (labelled "No") go back to an earlier step; every other incoming connector is a prerequisite. */
export const PREREQS: Map<string, string[]> = (() => { const m = new Map<string, string[]>(); for (const e of EDGES) { if (e.label === 'No') continue; (m.get(e.to) ?? m.set(e.to, []).get(e.to)!).push(e.from); } return m; })();
export const STARTED: ProcessStatus[] = ['In Progress', 'Completed'];
/** Previous activities that are not Completed yet. */
export const unmetPrereqs = (s: StateMap, id: string, skip: ReadonlySet<string> = NO_SKIP): string[] => (PREREQS.get(id) ?? []).filter((p) => !skip.has(p) && statusOf(s, p) !== 'Completed');
/** A gate answered "No" sends the work back: the "No" target(s) and every activity between them and the gate, plus the activities feeding the gate when no loop exists. */
export function reworkSet(gateId: string): string[] {
  const fwd = new Map<string, string[]>(), back = new Map<string, string[]>();
  for (const e of EDGES) { if (e.label === 'No') continue; (fwd.get(e.from) ?? fwd.set(e.from, []).get(e.from)!).push(e.to); (back.get(e.to) ?? back.set(e.to, []).get(e.to)!).push(e.from); }
  const reach = (starts: string[], g: Map<string, string[]>) => { const seen = new Set<string>(starts); const st = [...starts]; while (st.length) { const x = st.pop()!; for (const y of g.get(x) ?? []) if (!seen.has(y)) { seen.add(y); st.push(y); } } return seen; };
  const targets = EDGES.filter((e) => e.from === gateId && e.label === 'No').map((e) => e.to);
  const f = reach(targets, fwd), b = reach([gateId], back);
  const out = new Set<string>(targets);
  for (const id of f) if (b.has(id)) out.add(id);
  if (out.size === targets.length) for (const p of PREREQS.get(gateId) ?? []) out.add(p);
  out.delete(gateId);
  return [...out];
}
/** A gate that was completed with the answer "No". */
export const isRejected = (s: StateMap, id: string) => nodeById.get(id)?.kind === 'decision' && statusOf(s, id) === 'Completed' && s[id]?.outcome === 'no';
/** Alarms: activities that are In Progress / Completed while a previous activity is not Completed. */
export function alarmsOf(s: StateMap, skip: ReadonlySet<string> = NO_SKIP): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const n of NODES) if (!skip.has(n.id) && STARTED.includes(statusOf(s, n.id)) && !isRejected(s, n.id)) { const u = unmetPrereqs(s, n.id, skip); if (u.length) out[n.id] = u; }
  return out;
}
export function phaseProgress(s: StateMap, skip: ReadonlySet<string> = NO_SKIP) {
  return PHASES.map((p) => { const ns = NODES.filter((n) => !skip.has(n.id) && phaseOf(n).id === p.id); const done = ns.filter((n) => statusOf(s, n.id) === 'Completed' && !isRejected(s, n.id)).length; return { ...p, total: ns.length, done, pct: ns.length ? Math.round((done / ns.length) * 100) : 0 }; });
}
export function progressOf(s: StateMap, skip: ReadonlySet<string> = NO_SKIP) {
  const by: Record<ProcessStatus, number> = { 'Not Started': 0, 'In Progress': 0, 'On Hold': 0, Completed: 0 };
  const total = NODES.filter((n) => !skip.has(n.id)).length;
  for (const n of NODES) if (!skip.has(n.id)) by[statusOf(s, n.id)]++;
  return { total, by, pct: total ? Math.round((by.Completed / total) * 100) : 0 };
}
