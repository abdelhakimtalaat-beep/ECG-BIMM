// Draws the BIM Reel announcement picture (same layout as the department's template) on a canvas. Browser only.
export interface ReelImage { topic: string; speaker: string; day: string; time: string; link?: string | null }
export const REEL_IMG_W = 1267, REEL_IMG_H = 702;
const FONT = '"Segoe UI","Calibri","Helvetica Neue",Arial,sans-serif';
const BLUE = '#5B7B9A', DARK = '#3D5A80', ORANGE = '#ED7D31', CORAL = '#F4694C', NAVY = '#1F4E79', PALE = '#BDD7EE';

const COL2 = 1005; // left edge of the Schedule column; its box edges are COL2..COL2+220
const LEFT = 94; // common left edge of the left-hand column (title, banner, topic label, lines, topic text)
/** x that puts the first visible pixel of `t` exactly on `edge` (removes the font's left side-bearing). */
function inkX(ctx: CanvasRenderingContext2D, t: string, edge: number) { return edge + ctx.measureText(t[0] ?? '').actualBoundingBoxLeft; }
function spaced(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, gap: number) { for (const ch of t) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + gap; } }
function wrapWords(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []; let cur = '';
  for (const w of text.split(/\s+/).filter(Boolean)) { const t = cur ? cur + ' ' + w : w; if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function wrapChars(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []; let cur = '';
  for (const ch of text) { if (ctx.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; } else cur += ch; }
  if (cur) lines.push(cur); return lines;
}

export function drawReelImage(canvas: HTMLCanvasElement, r: ReelImage, scale = 2) {
  canvas.width = REEL_IMG_W * scale; canvas.height = REEL_IMG_H * scale;
  const ctx = canvas.getContext('2d')!; ctx.scale(scale, scale); ctx.textBaseline = 'alphabetic';
  // background, header, strips
  ctx.fillStyle = '#F8F9FB'; ctx.fillRect(0, 0, REEL_IMG_W, REEL_IMG_H);
  ctx.fillStyle = BLUE; ctx.fillRect(0, 0, REEL_IMG_W, 252);
  ctx.fillStyle = DARK; ctx.fillRect(8, 0, 67, 252);
  ctx.fillStyle = BLUE; ctx.fillRect(0, 690, REEL_IMG_W, 12);
  ctx.fillStyle = CORAL; ctx.fillRect(0, 0, 8, REEL_IMG_H);
  ctx.fillStyle = ORANGE; ctx.font = `400 28px ${FONT}`; spaced(ctx, 'ANNOUNCEMENT', inkX(ctx, 'A', LEFT), 60, 4.5);
  // banner
  const g = ctx.createLinearGradient(LEFT, 0, 1216, 0); g.addColorStop(0, BLUE); g.addColorStop(0.35, '#8E8FA6'); g.addColorStop(1, ORANGE);
  ctx.fillStyle = g; ctx.fillRect(LEFT, 121, 1216 - LEFT, 83);
  const tg = ctx.createLinearGradient(LEFT, 0, 460, 0); tg.addColorStop(0, '#FFFFFF'); tg.addColorStop(1, '#D4D0DC');
  ctx.fillStyle = tg; ctx.font = `700 74px ${FONT}`; ctx.fillText('BIM REELS', inkX(ctx, 'B', LEFT), 192);
  ctx.fillStyle = '#DCE6F2'; ctx.font = `700 36px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText('Quick Tips For Great Productivity', 1204, 177);
  ctx.font = `700 20px ${FONT}`; ctx.fillText('Organized by BIM Management Department', 1210, 225); ctx.textAlign = 'left';
  // topic
  ctx.fillStyle = NAVY; ctx.font = `700 20px ${FONT}`; spaced(ctx, 'REEL TOPIC', inkX(ctx, 'R', LEFT), 342, 3);
  ctx.fillStyle = CORAL; ctx.fillRect(LEFT, 351, 955 - LEFT, 7); ctx.fillRect(LEFT, 614, 955 - LEFT, 4);
  const topic = (r.topic || 'Topic to be announced').trim(); const maxW = 850; const boxTop = 372, boxBot = 604;
  let size = 84, lines: string[] = [];
  for (; size >= 28; size -= 2) { ctx.font = `700 ${size}px ${FONT}`; lines = wrapWords(ctx, topic, maxW); if (lines.length * size * 1.2 <= boxBot - boxTop && lines.every((l) => ctx.measureText(l).width <= maxW)) break; }
  const lh = size * 1.2, total = lines.length * lh; let y = boxTop + (boxBot - boxTop - total) / 2 + size * 0.95;
  ctx.fillStyle = '#000'; for (const l of lines) { ctx.fillText(l, inkX(ctx, l, LEFT), y); y += lh; }
  ctx.fillStyle = NAVY; ctx.font = `400 26px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(`Speaker, ${r.speaker}`, 955, 654); ctx.textAlign = 'left';
  // schedule panel
  ctx.fillStyle = DARK; ctx.fillRect(965, 303, 302, 355);
  ctx.fillStyle = '#fff'; ctx.font = `700 22px ${FONT}`; spaced(ctx, 'SCHEDULE', inkX(ctx, 'S', COL2), 339, 3.5);
  ctx.fillStyle = CORAL; ctx.fillRect(COL2, 351, 220, 6);
  ctx.fillStyle = PALE; ctx.fillRect(COL2, 377, 220, 94);
  ctx.fillStyle = NAVY; ctx.font = `700 31px ${FONT}`; ctx.fillText(r.day, inkX(ctx, r.day, COL2 + 12), 415); ctx.fillText(r.time, inkX(ctx, r.time, COL2 + 12), 456);
  if (r.link) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; ctx.fillStyle = PALE; ctx.fillRect(COL2, 492, 220, 154); ctx.restore();
    ctx.strokeStyle = '#8FB4D9'; ctx.lineWidth = 1.5; ctx.strokeRect(COL2 + 0.75, 492.75, 218.5, 152.5);
    ctx.fillStyle = NAVY; ctx.font = `700 31px ${FONT}`; ctx.fillText('Meeting Link', inkX(ctx, 'M', COL2 + 12), 530); ctx.fillRect(inkX(ctx, 'M', COL2 + 12), 534, ctx.measureText('Meeting Link').width, 2.5);
    ctx.fillStyle = '#0563C1'; ctx.font = `400 15.5px ${FONT}`;
    wrapChars(ctx, r.link, 198).slice(0, 5).forEach((l, i) => { const yy = 556 + i * 19; const lx = inkX(ctx, l, COL2 + 12); ctx.fillText(l, lx, yy); ctx.fillRect(lx, yy + 2, ctx.measureText(l).width, 1); });
  }
}
