import type { Project } from './types';

export interface PortfolioTeam { manager?: string; coordinator?: string; members?: string }
type RGB = [number, number, number];
const NAVY: RGB = [11, 37, 69], BLUE: RGB = [15, 85, 168], GOLD: RGB = [196, 154, 62], INK: RGB = [30, 41, 59], GREY: RGB = [100, 116, 139], SOFT: RGB = [241, 245, 249], LINE: RGB = [214, 222, 232];
const STATUS_COLOR: Record<string, RGB> = { 'In Progress': [22, 140, 90], 'Not Started': [71, 105, 160], 'On Hold': [200, 130, 20], Closed: [100, 110, 125] };
const num = (n: number | null | undefined) => (n == null ? '' : Math.round(n).toLocaleString('en-US'));
const fmtLong = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

async function toDataUrl(url: string, kind: 'png' | 'jpeg', box?: { w: number; h: number }): Promise<string | null> {
  try {
    const b = await (await fetch(url)).blob(); const raw: string = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(b); });
    if (!box) return raw;
    const img: HTMLImageElement = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = raw; });
    /* crop to the frame's proportions ("cover") so every photo fills its frame without being stretched */
    const W = 1400, H = Math.round(W * box.h / box.w); const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); const k = Math.max(W / img.width, H / img.height); const sw = W / k, sh = H / k;
    g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H); return c.toDataURL(kind === 'png' ? 'image/png' : 'image/jpeg', 0.86);
  } catch { return null; }
}

/** Builds the client-facing portfolio: cover page, then one page per project. Everything is drawn directly (no screenshots), so the text stays sharp. */
export async function buildPortfolioPdf(projects: Project[], team: (id: string) => PortfolioTeam, opts: { preparedBy?: string; onProgress?: (done: number, total: number) => void } = {}): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' }); const PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight(); const M = 40;
  const logo = await toDataUrl('/ecg-logo.png', 'png'); const LH = 34, LW = LH * (820 / 387);
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]); const ink = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]); const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const header = (right: string) => {
    fill([255, 255, 255]); doc.rect(0, 0, PW, 66, 'F'); if (logo) doc.addImage(logo, 'PNG', M, 16, LW, LH);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); ink(GREY); doc.text(right, PW - M, 38, { align: 'right' });
    fill(GOLD); doc.rect(0, 64, PW, 2.5, 'F'); fill(NAVY); doc.rect(0, 66.5, PW, 2, 'F');
  };
  const footer = (n: number, total: number) => { stroke(LINE); doc.setLineWidth(0.6); doc.line(M, PH - 30, PW - M, PH - 30); doc.setFontSize(8); ink(GREY); doc.setFont('helvetica', 'normal'); doc.text('ECG BIM Department · Prepared by BIM Department', M, PH - 16); doc.text(`Page ${n} of ${total}`, PW - M, PH - 16, { align: 'right' }); };

  /* ---- cover */
  const now = new Date(); header('ECG BIM Projects');
  fill(NAVY); doc.rect(0, 68.5, PW, PH - 68.5, 'F');
  fill(BLUE); doc.triangle(PW, 68.5, PW, PH, PW - 330, PH, 'F'); fill([22, 62, 120]); doc.triangle(PW, PH - 170, PW, PH, PW - 190, PH, 'F');
  fill(GOLD); doc.rect(M + 20, 215, 70, 4, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(46); ink([255, 255, 255]); doc.text('ECG BIM Projects', M + 20, 285);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(16); ink([190, 205, 228]); doc.text('Project Portfolio', M + 20, 315);
  doc.setFontSize(12); ink([255, 255, 255]); doc.text(`Date of extraction:  ${fmtLong(now)}`, M + 20, 400); doc.text('Prepared by:  BIM Department', M + 20, 422);
  const withArea = projects.reduce((a, p) => a + (p.built_up_area && p.built_up_area > 0 ? p.built_up_area : 0), 0);
  doc.setFontSize(10); ink([160, 180, 212]); doc.text(`${projects.length} project${projects.length === 1 ? '' : 's'}${withArea ? ` · ${num(withArea)} total built-up area` : ''}`, M + 20, 450);
  const total = projects.length + 1; footer(1, total);

  /* ---- one page per project */
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i]; opts.onProgress?.(i, projects.length); doc.addPage(); header(p.project_no ? `Project ${p.project_no}` : 'ECG BIM Projects'); const t = team(p.id);
    const PX = M, PY = 92, PWD = 340, PHT = 215;
    fill(SOFT); doc.roundedRect(PX, PY, PWD, PHT, 6, 6, 'F');
    const photo = p.photo_id ? await toDataUrl(`/api/files/${p.photo_id}`, 'jpeg', { w: PWD, h: PHT }) : null;
    if (photo) { doc.addImage(photo, 'JPEG', PX, PY, PWD, PHT); stroke(LINE); doc.setLineWidth(0.8); doc.roundedRect(PX, PY, PWD, PHT, 6, 6, 'S'); }
    else { doc.setFont('helvetica', 'bold'); doc.setFontSize(12); ink([160, 175, 195]); doc.text('Project photo not available', PX + PWD / 2, PY + PHT / 2 + 4, { align: 'center' }); }

    /* title block (right of photo) */
    const RX = PX + PWD + 28, RW = PW - M - RX; const col = STATUS_COLOR[p.status] ?? GREY;
    fill(col); doc.roundedRect(RX, PY, 86, 18, 9, 9, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); ink([255, 255, 255]); doc.text(p.status.toUpperCase(), RX + 43, PY + 12, { align: 'center' });
    if (p.project_no) { doc.setFontSize(9); ink(GOLD); doc.text(`PROJECT NO. ${p.project_no}`, RX + 98, PY + 12); }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); ink(NAVY); const tl = (doc.splitTextToSize(p.name, RW) as string[]).slice(0, 3); doc.text(tl, RX, PY + 44, { lineHeightFactor: 1.15 });
    const loc = [p.city, p.country].filter(Boolean).join(', '); let ty = PY + 44 + tl.length * 23;
    if (loc) { doc.setFont('helvetica', 'normal'); doc.setFontSize(11); ink(GREY); doc.text(loc, RX, ty - 4); ty += 14; }
    stroke(GOLD); doc.setLineWidth(1.5); doc.line(RX, ty, RX + 48, ty);

    /* information cards (empty fields are left out) */
    const fields: [string, string][] = ([
      ['Client', p.client ?? ''], ['Built-up area', num(p.built_up_area)], ['Plot area', num(p.plot_area)], ['Project type', p.type ?? ''], ['Function', p.function_type ?? ''],
      ['Project Manager', p.project_manager ?? ''], ['Technical Manager', p.technical_manager ?? ''], ['BIM Manager', t.manager ?? ''], ['BIM Coordinator', t.coordinator ?? ''],
      ['Common data environment', p.cde ?? ''], ['Revit version', p.revit_version ?? ''], ['Coordination', p.coordination_type ?? ''], ['Typicality', p.typicality ?? ''], ['BIM standards', p.bim_standards ?? ''], ['Deltek no.', p.deltek_number ?? ''],
    ] as [string, string][]).filter((f) => f[1].trim());
    const cw = (RW - 10) / 2, chh = 38; let gy = ty + 14; const maxRows = Math.floor((PH - 40 - gy) / (chh + 6));
    fields.slice(0, maxRows * 2).forEach(([l, v], k) => {
      const cx = RX + (k % 2) * (cw + 10), cy = gy + Math.floor(k / 2) * (chh + 6);
      fill(SOFT); doc.roundedRect(cx, cy, cw, chh, 4, 4, 'F'); fill(BLUE); doc.rect(cx, cy + 5, 2.5, chh - 10, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); ink(GREY); doc.text(l.toUpperCase(), cx + 10, cy + 13);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); ink(INK); doc.text((doc.splitTextToSize(v, cw - 18) as string[]).slice(0, 1), cx + 10, cy + 29);
    });

    /* lower-left: stages, LOD, scope, team members */
    let ly = PY + PHT + 24; const LWID = PWD;
    const block = (title: string, items: string[]) => {
      if (!items.length || ly > PH - 70) return; doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); ink(BLUE); doc.text(title.toUpperCase(), PX, ly); ly += 8;
      let x = PX, y = ly; doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      for (const it of items) { const w = doc.getTextWidth(it) + 14; if (x + w > PX + LWID) { x = PX; y += 19; } if (y > PH - 48) break; fill([226, 236, 250]); doc.roundedRect(x, y, w, 15, 7.5, 7.5, 'F'); ink(NAVY); doc.text(it, x + 7, y + 10.5); x += w + 6; }
      ly = y + 28;
    };
    block('Stages', p.stages ?? []); block('Level of development', p.lods ?? []); block('Scope', [...(p.scope_items ?? []), ...(p.scope_site ?? [])]);
    footer(i + 2, total);
  }
  opts.onProgress?.(projects.length, projects.length);
  return doc.output('blob');
}
