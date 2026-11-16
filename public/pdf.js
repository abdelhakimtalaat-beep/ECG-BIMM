'use strict';
/* مولّد PDF داخل المتصفح (بلا مكتبات): يرسم صفحات التقرير بالمتصفح نفسه (فيُشكَّل العربي صحيحاً) ثم يضعها في ملف PDF حقيقي */
const Pdf = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FONT = "font-family:'Segoe UI',Tahoma,'Noto Naskh Arabic','Noto Sans Arabic',Arial,sans-serif;";
  const PAD = 28, FOOT = 26;

  function rowStyle(r, i) {
    if (r.country === 'الإجمالي' || r.date === 'الإجمالي') return 'font-weight:700;background:#fdf1b8;';
    if (r.flight === 'إجمالي اليوم') return 'font-weight:700;background:#f1f6df;';
    return i % 2 ? 'background:#f6f8f4;' : '';
  }
  const td = 'border:1px solid #c9d3c4;padding:5px 7px;text-align:right;vertical-align:top;word-break:break-word;';
  const th = 'border:1px solid #14502a;padding:6px 7px;text-align:right;background:#1d5a34;color:#fff;font-weight:700;';

  function titleHtml(d, first) {
    return first
      ? `<div style="text-align:center;margin-bottom:10px"><div style="font-size:22px;font-weight:800;color:#14502a">جاؤوك — ${esc(d.title)}</div><div style="font-size:14px;margin-top:3px">${esc(d.event)}${d.subtitle ? ' — ' + esc(d.subtitle) : ''}</div><div style="font-size:11px;color:#666;margin-top:2px">أُعدّ بواسطة ${esc(d.generated_by)} — ${esc(new Date(d.generated_at || Date.now()).toLocaleString('ar-EG'))} — ${d.rows.length} سطر</div></div>`
      : `<div style="font-size:12px;color:#14502a;font-weight:700;margin-bottom:6px">جاؤوك — ${esc(d.title)} (تابع)</div>`;
  }
  const tableHtml = (d, rows, widths) => `<table style="border-collapse:collapse;table-layout:fixed;width:${widths.reduce((a, b) => a + b, 0)}px;font-size:12.5px"><colgroup>${widths.map(w => `<col style="width:${w}px"/>`).join('')}</colgroup>
    <thead><tr>${d.columns.map(c => `<th style="${th}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(({ r, i }) => `<tr style="${rowStyle(r, i)}">${d.columns.map(c => `<td style="${td}">${esc(r[c.key] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const wrap = (W, H, inner) => `<div xmlns="http://www.w3.org/1999/xhtml" dir="rtl" style="${FONT}width:${W}px;height:${H}px;box-sizing:border-box;padding:${PAD}px;background:#fff;color:#111;position:relative;overflow:hidden">${inner}</div>`;

  async function toJpeg(html, W, H, S) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">${html}</foreignObject></svg>`;
    const img = new Image(); img.decoding = 'async';
    await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('تعذّر تجهيز صفحة PDF')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    const c = document.createElement('canvas'); c.width = Math.round(W * S); c.height = Math.round(H * S);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.9));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), w: c.width, h: c.height };
  }

  function buildPdf(pages, ptW, ptH) {
    const enc = new TextEncoder(); const chunks = []; const offs = []; let len = 0;
    const put = x => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; };
    const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); put(body); put('\nendobj\n'); };
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const n = pages.length; const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
    pages.forEach((p, i) => {
      const pg = 3 + i * 3, ct = pg + 1, im = pg + 2; const cs = `q ${ptW} 0 0 ${ptH} 0 0 cm /Im0 Do Q`;
      obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
      obj(ct, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
      offs[im] = len; put(`${im} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`); put(p.bytes); put('\nendstream\nendobj\n');
    });
    const total = 3 + n * 3; const xr = len;
    put(`xref\n0 ${total}\n0000000000 65535 f \n`); for (let i = 1; i < total; i++) put(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
    put(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  }

  /** d: بيانات التقرير {title,event,subtitle,generated_by,generated_at,columns:[{key,label}],rows:[{}]} */
  async function report(d, onProgress) {
    const landscape = d.columns.length > 6;
    const W = landscape ? 1123 : 794, H = landscape ? 794 : 1123, S = 1.6;
    const items = d.rows.map((r, i) => ({ r, i }));
    // قياس الأعمدة والصفوف على جدول كامل خارج الشاشة
    const stage = document.createElement('div'); stage.style.cssText = `position:fixed;left:-30000px;top:0;width:${W}px;`;
    stage.innerHTML = `<div dir="rtl" style="${FONT}width:${W}px;padding:${PAD}px;box-sizing:border-box">${titleHtml(d, true)}<div id="m">${items.length ? '' : ''}</div></div>`;
    document.body.appendChild(stage);
    let widths, titleH, headH, rowH;
    try {
      const inner = stage.firstChild; titleH = inner.firstChild.offsetHeight + 10;
      const m = inner.querySelector('#m'); m.innerHTML = `<table style="border-collapse:collapse;font-size:12.5px;width:${W - 2 * PAD}px"><thead><tr>${d.columns.map(c => `<th style="${th}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${items.map(({ r, i }) => `<tr style="${rowStyle(r, i)}">${d.columns.map(c => `<td style="${td}">${esc(r[c.key] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      const t = m.firstChild; const ths = [...t.tHead.rows[0].cells]; widths = ths.map(x => x.getBoundingClientRect().width); headH = t.tHead.offsetHeight; rowH = [...t.tBodies[0].rows].map(x => x.getBoundingClientRect().height);
      const sum = widths.reduce((a, b) => a + b, 0), target = W - 2 * PAD; widths = widths.map(w => Math.floor(w * target / sum));
    } finally { stage.remove(); }
    // توزيع الصفوف على الصفحات
    const avail = H - 2 * PAD - FOOT; const pages = []; let cur = [], used = titleH + headH + 4;
    items.forEach((it, k) => { const h = rowH[k] + 2; if (cur.length && used + h > avail) { pages.push(cur); cur = []; used = 26 + headH + 4; } cur.push(it); used += h; });
    pages.push(cur);
    const out = [];
    for (let p = 0; p < pages.length; p++) {
      const body = titleHtml(d, p === 0) + (pages[p].length ? tableHtml(d, pages[p], widths) : `<div style="text-align:center;padding:40px;color:#666">لا توجد بيانات لهذا التقرير</div>`) +
        `<div style="position:absolute;bottom:10px;left:0;right:0;text-align:center;font-size:11px;color:#777">صفحة ${p + 1} من ${pages.length}</div>`;
      out.push(await toJpeg(wrap(W, H, body), W, H, S)); if (onProgress) onProgress(p + 1, pages.length);
    }
    return buildPdf(out, landscape ? 841.89 : 595.28, landscape ? 595.28 : 841.89);
  }
  return { report };
})();
