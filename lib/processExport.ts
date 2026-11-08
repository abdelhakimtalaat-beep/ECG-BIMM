// Exports the drawn Process Map (an inline SVG) as a PNG: the styles that come from CSS classes / variables are copied onto each element first.
import { PROCESS_COLORS, PROCESS_COLOR_NAMES, PROCESS_STATUSES } from './processMap.ts';

const PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-dasharray', 'font-family', 'font-size', 'font-weight', 'paint-order', 'opacity'];
export async function processMapPng(svg: SVGSVGElement, title: string, subtitle: string, scale = 2): Promise<Blob> {
  const vb = svg.viewBox.baseVal; const W = vb.width, H = vb.height;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = [svg, ...Array.from(svg.querySelectorAll('*'))], dst = [clone, ...Array.from(clone.querySelectorAll('*'))];
  src.forEach((el, i) => { const cs = getComputedStyle(el); const d = dst[i] as SVGElement; for (const p of PROPS) d.style.setProperty(p, cs.getPropertyValue(p)); d.removeAttribute('class'); });
  clone.setAttribute('width', String(W)); clone.setAttribute('height', String(H)); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.querySelectorAll('title').forEach((t) => t.remove());
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not draw the map')); i.src = url; });
    const top = 64, cv = document.createElement('canvas'); cv.width = Math.round(W * scale); cv.height = Math.round((H + top) * scale);
    const c = cv.getContext('2d')!; c.scale(scale, scale); c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H + top);
    c.fillStyle = '#0f172a'; c.font = 'bold 20px Arial, sans-serif'; c.textBaseline = 'alphabetic'; c.fillText(title, 16, 28);
    c.fillStyle = '#475569'; c.font = '12px Arial, sans-serif'; c.fillText(subtitle, 16, 46);
    let x = W - 16; c.font = '12px Arial, sans-serif';
    for (const s of [...PROCESS_STATUSES].reverse()) { const t = PROCESS_COLOR_NAMES[s] === s ? s : `${s}`; const w = c.measureText(t).width; x -= w; c.fillStyle = '#334155'; c.fillText(t, x, 28); x -= 16; c.fillStyle = PROCESS_COLORS[s]; c.fillRect(x, 18, 12, 12); x -= 18; }
    c.drawImage(img, 0, top, W, H);
    return await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Could not create the image'))), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
