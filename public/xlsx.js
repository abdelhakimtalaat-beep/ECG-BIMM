'use strict';
// قراءة وكتابة Excel (.xlsx) وCSV داخل المتصفح بلا أي مكتبة خارجية.
// الكتابة بدون ضغط (stored) والقراءة تدعم الملفات المضغوطة عبر DecompressionStream المدمج في المتصفحات الحديثة.
(function (root) {
  const enc = new TextEncoder(), dec = new TextDecoder('utf-8');
  const xmlEsc = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const colName = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const colIndex = ref => { const m = /^([A-Z]+)/.exec(ref); let n = 0; for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const cat = parts => { const n = parts.reduce((a, p) => a + p.length, 0); const o = new Uint8Array(n); let p = 0; for (const x of parts) { o.set(x, p); p += x.length; } return o; };

  function zipFiles(files) { // [{name, data:Uint8Array}] — بدون ضغط
    const locals = [], centrals = []; let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name), crc = crc32(f.data), len = f.data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(12, 0x21, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, len, true); lh.setUint32(22, len, true); lh.setUint16(26, name.length, true);
      locals.push(new Uint8Array(lh.buffer), name, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, len, true); ch.setUint32(24, len, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      centrals.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + len;
    }
    const cd = cat(centrals); const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cd.length, true); end.setUint32(16, offset, true);
    return cat([...locals, cd, new Uint8Array(end.buffer)]);
  }
  async function inflateRaw(u8) {
    const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(u8); w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  async function unzip(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf); const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('الملف ليس بصيغة xlsx صحيحة');
    const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true); const out = {};
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen)); p += 46 + nlen + elen + clen;
      if (usize > 50 * 1024 * 1024) throw new Error('ملف كبير جداً');
      const ln = dv.getUint16(lho + 26, true), le = dv.getUint16(lho + 28, true);
      const raw = u8.subarray(lho + 30 + ln + le, lho + 30 + ln + le + csize);
      if (/^xl\/(worksheets\/sheet\d+|sharedStrings)\.xml$/.test(name)) out[name] = method === 0 ? raw : await inflateRaw(raw);
    }
    return out;
  }

  // sheets: [{ name, columns:[{label,width}], rows:[[...]], head?:[أسطر عنوان], rowStyles?:[null|'total'|'sub'] }]  → Uint8Array
  // الأنماط: 0 عادي | 1 رأس الجدول | 2 عنوان | 3 سطر فرعي | 4 خلية بحدود | 5 إجمالي (أصفر عريض) | 6 إجمالي يوم (أخضر عريض) | 7 رقم بحدود
  function buildXlsx(sheets) {
    const F = (name, s) => ({ name, data: enc.encode(s) }); const files = []; const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const sst = [], sstMap = new Map(); let sstCount = 0;
    const si = v => { const k = String(v); sstCount++; if (!sstMap.has(k)) { sstMap.set(k, sst.length); sst.push(k); } return sstMap.get(k); };
    files.push(F('[Content_Types].xml', `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`));
    files.push(F('_rels/.rels', `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`));
    files.push(F('docProps/core.xml', `${X}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Gaouk</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`));
    files.push(F('docProps/app.xml', `${X}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application></Properties>`));
    files.push(F('xl/workbook.xml', `${X}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(String(s.name).replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet' + (i + 1))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`));
    files.push(F('xl/_rels/workbook.xml.rels', `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`));
    const bd = '<border><left style="thin"><color rgb="FFB9C4B3"/></left><right style="thin"><color rgb="FFB9C4B3"/></right><top style="thin"><color rgb="FFB9C4B3"/></top><bottom style="thin"><color rgb="FFB9C4B3"/></bottom><diagonal/></border>';
    const xf = (font, fill, border, al, extra = '') => `<xf numFmtId="0" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${extra}><alignment horizontal="${al}" vertical="center" wrapText="1"/></xf>`;
    files.push(F('xl/styles.xml', `${X}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FF14502A"/><sz val="15"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts>`
      + `<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D5A34"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDF1B8"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F6DF"/><bgColor indexed="64"/></patternFill></fill></fills>`
      + `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${bd}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
      + `<cellXfs count="8">${xf(0, 0, 0, 'right')}${xf(1, 2, 1, 'center')}${xf(2, 0, 0, 'center')}${xf(0, 0, 0, 'center')}${xf(0, 0, 1, 'right')}${xf(3, 3, 1, 'right')}${xf(3, 4, 1, 'right')}${xf(0, 0, 1, 'right')}</cellXfs>`
      + `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`));
    sheets.forEach((s, si_) => {
      const cols = s.columns || []; const nc = Math.max(1, cols.length); const head = s.head || []; const merges = []; let r = 0; let rowsXml = '';
      const cell = (ref, v, st) => (v === null || v === undefined || v === '') ? `<c r="${ref}" s="${st}"/>` : (typeof v === 'number' && Number.isFinite(v)) ? `<c r="${ref}" s="${st}"><v>${v}</v></c>` : `<c r="${ref}" s="${st}" t="s"><v>${si(v)}</v></c>`;
      head.forEach((line, i) => { r++; const st = i === 0 ? 2 : 3; let c = ''; for (let k = 0; k < nc; k++) c += cell(colName(k) + r, k === 0 ? line : '', st); rowsXml += `<row r="${r}"${i === 0 ? ' ht="26" customHeight="1"' : ''}>${c}</row>`; if (nc > 1) merges.push(`A${r}:${colName(nc - 1)}${r}`); });
      if (head.length) { r++; rowsXml += `<row r="${r}"/>`; }
      const hdr = r + 1; r++; rowsXml += `<row r="${r}" ht="22" customHeight="1">${cols.map((c, k) => cell(colName(k) + r, c.label, 1)).join('')}</row>`;
      const styled = head.length > 0 || !!s.rowStyles;
      s.rows.forEach((row, ri) => { r++; const rs = s.rowStyles && s.rowStyles[ri]; const bs = rs === 'total' ? 5 : rs === 'sub' ? 6 : styled ? 4 : 0;
        rowsXml += `<row r="${r}">${row.map((v, k) => cell(colName(k) + r, v, bs)).join('')}</row>`; });
      const last = r; const widths = cols.map(c => c.width || 18);
      const xml = `${X}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${colName(nc - 1)}${Math.max(last, 1)}"/><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="${hdr}" topLeftCell="A${hdr + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${hdr + 1}" sqref="A${hdr + 1}"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>`
        + (cols.length ? '<cols>' + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>' : '')
        + `<sheetData>${rowsXml}</sheetData>` + (merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '')
        + `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${nc > 6 ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/></worksheet>`;
      files.push(F(`xl/worksheets/sheet${si_ + 1}.xml`, xml));
    });
    files.push(F('xl/sharedStrings.xml', `${X}<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sstCount}" uniqueCount="${sst.length}">${sst.map(t => `<si><t xml:space="preserve">${xmlEsc(t)}</t></si>`).join('')}</sst>`));
    return zipFiles(files);
  }

  const unxml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');

  async function readXlsx(buf) { // مصفوفة صفوف (الورقة الأولى)
    const z = await unzip(buf); const shared = [];
    if (z['xl/sharedStrings.xml']) for (const m of dec.decode(z['xl/sharedStrings.xml']).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) { let t = ''; for (const tm of m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) t += unxml(tm[1]); shared.push(t); }
    const sn = Object.keys(z).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/(\d+)\.xml/)[1]) - parseInt(b.match(/(\d+)\.xml/)[1]))[0];
    if (!sn) throw new Error('لا توجد ورقة بيانات في الملف');
    const rows = [];
    for (const rm of dec.decode(z[sn]).matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const row = [];
      for (const cm of (rm[1] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[1], inner = cm[2] || ''; const ref = /\br="([A-Z]+\d+)"/.exec(attrs); if (!ref) continue;
        const type = (/\bt="(\w+)"/.exec(attrs) || [])[1]; let val = '';
        if (type === 'inlineStr') { for (const tm of inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) val += unxml(tm[1]); }
        else { const v = /<v>([\s\S]*?)<\/v>/.exec(inner); if (v) { if (type === 's') val = shared[+v[1]] ?? ''; else if (type === 'str' || type === 'e') val = unxml(v[1]); else if (type === 'b') val = v[1] === '1' ? 'نعم' : 'لا'; else val = Number(v[1]); } }
        row[colIndex(ref[1])] = val;
      }
      for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
      rows.push(row);
    }
    return rows;
  }
  function parseCsv(text) {
    text = text.replace(/^﻿/, ''); const first = text.split(/\r?\n/, 1)[0] || '';
    const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : (first.includes('\t') ? '\t' : ',');
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim() !== ''));
  }
  function toCsv(columns, rows) {
    const e = v => { v = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return '﻿' + [columns.map(c => e(c.label)).join(','), ...rows.map(r => r.map(e).join(','))].join('\r\n');
  }
  const api = { buildXlsx, readXlsx, parseCsv, toCsv };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GX = api;
})(typeof self !== 'undefined' ? self : globalThis);
