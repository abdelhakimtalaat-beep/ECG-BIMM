'use strict';
// جسر بين الواجهة (التي تستخدم مسارات REST) وبين Supabase: يوجّه كل طلب إما إلى دالة قاعدة البيانات api
// أو ينفذه داخل المتصفح (تصدير/استيراد Excel، تقارير، صورة الكروكي، النسخة الاحتياطية).
const Adapter = (() => {
  const CAT = Compute.CAT_LABELS;
  const COLS = [
    ['full_name', 'الاسم الكامل', 26], ['country', 'الدولة', 16], ['phone', 'رقم الهاتف (مع مفتاح الدولة)', 22],
    ['category', 'التصنيف', 14], ['guide_name', 'اسم المرشد', 18], ['head', 'رب الأسرة (للتابع)', 22], ['group', 'اسم الفوج', 16], ['leader', 'قائد الفوج', 10],
    ['arrival_date', 'تاريخ الوصول', 14], ['arrival_time', 'وقت الوصول', 11], ['departure_date', 'تاريخ المغادرة', 14], ['flight_no', 'رقم الرحلة', 12],
    ['airline', 'شركة الطيران', 16], ['airport', 'مطار الوصول', 16], ['transport', 'يحتاج نقل', 10], ['notes', 'ملاحظات', 24],
  ];
  const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const norm = s => String(s ?? '').normalize('NFKC').replace(/[ً-ْٰـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase().replace(/\s+/g, ' ').trim();

  function tableBlob(name, columns, rows, format, extra) {
    if (format === 'csv') return new Blob([GX.toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' });
    return new Blob([GX.buildXlsx([{ name, columns, rows, ...(extra || {}) }])], { type: XLSX_TYPE });
  }
  function parseDateCell(v) {
    if (v === '' || v == null) return '';
    if (typeof v === 'number') { if (v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5).toISOString().slice(0, 10); return null; }
    const s = String(v).trim().replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c));
    if (Compute.isDate(s)) return s;
    const m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s);
    if (m) { const d = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; if (Compute.isDate(d)) return d; }
    return null;
  }
  function parseTimeCell(v) {
    if (v === '' || v == null) return '';
    if (typeof v === 'number') { if (v >= 0 && v < 1) { const mins = Math.round(v * 1440); return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`; } return null; }
    const m = /^(\d{1,2}):(\d{2})/.exec(String(v).trim()); if (!m) return null;
    const s = `${m[1].padStart(2, '0')}:${m[2]}`; return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null;
  }
  async function parseUpload(buf) {
    const u8 = new Uint8Array(buf); let table;
    try { table = u8[0] === 0x50 && u8[1] === 0x4B ? await GX.readXlsx(u8) : GX.parseCsv(new TextDecoder('utf-8').decode(u8)); }
    catch (e) { throw Object.assign(new Error('تعذر قراءة الملف: ' + e.message), { status: 400, data: {} }); }
    if (table.length < 2) throw Object.assign(new Error('الملف لا يحتوي على بيانات'), { status: 400, data: {} });
    const head = table[0].map(h => String(h).trim()); const idx = {}; COLS.forEach(c => { const i = head.indexOf(c[1]); if (i >= 0) idx[c[0]] = i; });
    if (idx.full_name === undefined || idx.country === undefined) throw Object.assign(new Error('الأعمدة الأساسية مفقودة (الاسم الكامل / الدولة). حمّل القالب واستخدمه'), { status: 400, data: {} });
    const get = (r, k) => (idx[k] === undefined || r[idx[k]] === undefined ? '' : r[idx[k]]);
    return table.slice(1).map((r, i) => ({ r, line: i + 2 })).filter(x => x.r.some(c => String(c).trim() !== '')).map(({ r, line }) => {
      const ad = parseDateCell(get(r, 'arrival_date')), dd = parseDateCell(get(r, 'departure_date')), at = parseTimeCell(get(r, 'arrival_time'));
      const row = { line, _bad_date: ad === null || dd === null, _bad_time: at === null };
      for (const c of COLS) row[c[0]] = String(get(r, c[0]) ?? '').trim();
      if (norm(row.category) === norm('تابع لأسرة')) row.category = 'تابع لعائلة'; // اسم التصنيف القديم تفهمه دالة الاستيراد
      row.arrival_date = ad || ''; row.departure_date = dd || ''; row.arrival_time = at || ''; return row;
    });
  }
  async function resizeImage(buf, type) {
    const bmp = await createImageBitmap(new Blob([buf], { type })); const MAX = 2000, k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
    for (const q of [0.88, 0.75, 0.6, 0.45]) { const d = cv.toDataURL('image/jpeg', q); if (d.length < 3400000) return d; }
    throw Object.assign(new Error('الصورة كبيرة جداً. صغّر حجمها'), { status: 400, data: {} });
  }
  const q2o = sp => Object.fromEntries([...sp.entries()]);

  async function call(method, url, body, opts = {}, ApiError) {
    const U = new URL(url, 'http://x'); const path = U.pathname, q = q2o(U.searchParams); const rpc = SB.rpc;
    const wrap = async fn => { try { return await fn(); } catch (e) { if (e instanceof ApiError) throw e; throw new ApiError(e.status ?? 0, e.data || { error: e.message }); } };
    return wrap(async () => {
      const me = async () => { const r = await rpc('GET', '/me'); return { user: r.user, roles: Compute.ROLE_LABELS }; };
      if (path === '/login') { await SB.loginPassword(body.username, body.password); return me(); }
      if (path === '/join-request') return SB.joinRequest(body);
      if (path === '/activate') { await SB.activate(body); return me(); }
      if (path === '/issue-code') return SB.call('admin_issue_code', { p_user_id: body.user_id });
      if (path === '/logout') { await SB.logout(); return { ok: true }; }
      if (path === '/me') return me();
      if (path === '/change-password') {
        const u = App.user; if (!body.new_password || body.new_password.length < 8 || !/[A-Za-z]/.test(body.new_password) || !/\d/.test(body.new_password)) throw Object.assign(new Error('كلمة المرور 8 أحرف على الأقل وتحتوي على حروف وأرقام'), { status: 400, data: {} });
        try { await SB.login(u.username, body.old_password); } catch (e) { throw Object.assign(new Error('كلمة المرور الحالية غير صحيحة'), { status: 400, data: {} }); }
        await SB.setPassword(body.new_password); return { ok: true };
      }
      if (path === '/dashboard') return Compute.dashboard(rpc, App.user, q);
      if (path === '/meals') return { days: Object.values(await Compute.mealsData(rpc, await ev(q.event_id))).map(Compute.stripPeople) };
      if (path === '/meals/day') { const days = await Compute.mealsData(rpc, await ev(q.event_id)); const d = Compute.isDate(q.date) ? q.date : Compute.today(); return { day: days[d] || { date: d, residents: 0, breakfast: 0, lunch: 0, dinner: 0, total: 0, people: [] } }; }
      if (path === '/transport/daily') return Compute.transportDaily(rpc, q);
      if (path === '/transport/summary') return Compute.transportSummary(rpc, q);
      if (path === '/report-list') return { reports: Compute.reportList(App.user) };
      if (path.startsWith('/reports/')) {
        const r = await Compute.report(rpc, App.user, path.slice(9), q);
        rpc('POST', '/audit-event', {}, { action: 'report', entity: 'report', event_id: r.ev.id, details: { type: path.slice(9), rows: r.rows.length } }).catch(() => {});
        if (q.format === 'csv' || q.format === 'xlsx') return tableBlob(r.def.title, r.cols.map(c => ({ label: c.label, width: Math.max(c.width || 12, 12) })), r.rows.map(x => r.cols.map(c => x[c.key] ?? '')), q.format, {
          head: ['جاؤوك — ' + r.def.title, [r.ev.name, r.subtitle].filter(Boolean).join(' — '), 'أُعدّ بواسطة ' + App.user.name + ' — ' + new Date().toLocaleString('ar-EG')],
          rowStyles: r.rows.map(x => x.country === 'الإجمالي' || x.date === 'الإجمالي' ? 'total' : x.flight === 'إجمالي اليوم' ? 'sub' : null) });
        return { title: r.def.title, event: r.ev.name, subtitle: r.subtitle || '', scope_note: App.user.role === 'country_supervisor' ? 'بيانات دولتك فقط' : '', columns: r.cols, rows: r.rows, generated_by: App.user.name, generated_at: new Date().toISOString() };
      }
      if (path === '/visitors-export') {
        const { visitors } = await rpc('GET', '/visitors', q);
        rpc('POST', '/audit-event', {}, { action: 'export', entity: 'visitor', event_id: +q.event_id, details: { count: visitors.length } }).catch(() => {});
        const rows = visitors.map(v => [v.full_name, v.country_name, v.phone, CAT[v.category], v.guide_name, v.head_name || '', v.group_name || '', v.is_leader ? 'نعم' : '', v.arrival_date, v.arrival_time, v.departure_date, v.flight_no, v.airline, v.airport, v.needs_transport ? 'نعم' : 'لا', v.notes]);
        return tableBlob('الزائرون', COLS.map(c => ({ label: c[1], width: c[2] })), rows, q.format);
      }
      if (path === '/visitors-template') {
        const sample = [['أحمد بن عبدالله', 'ماليزيا', '+60123456789', 'رب أسرة', 'الشيخ محمد', '', '', '', '2026-12-20', '14:30', '2026-12-27', 'MH123', 'Malaysia Airlines', 'مطار القاهرة', 'نعم', ''],
          ['فاطمة أحمد', 'ماليزيا', '', 'تابع لأسرة', '', 'أحمد بن عبدالله', '', '', '', '', '', '', '', '', '', '']];
        return tableBlob('قالب-الزائرين', COLS.map(c => ({ label: c[1], width: c[2] })), sample, 'xlsx');
      }
      if (path === '/visitors-import') {
        const rows = await parseUpload(body);
        const r = await rpc('POST', '/visitors-import', {}, { event_id: +q.event_id, dry: q.dry === '1', rows });
        return r;
      }
      let m;
      if ((m = /^\/floors\/(\d+)\/plan$/.exec(path))) {
        if (method === 'POST') { const image = await resizeImage(body, opts.type); return rpc('PUT', path, {}, { image }); }
        if (method === 'DELETE') return rpc('PUT', path, {}, { image: '' });
      }
      if (path === '/backups') return { files: [] };
      if (path === '/backup') { const data = await rpc('POST', '/backup'); return opts.blob ? new Blob([JSON.stringify(data)], { type: 'application/json' }) : { ok: true, data }; }
      return rpc(method, path, q, body && typeof body === 'object' && !(body instanceof ArrayBuffer) ? body : {});
    });
  }
  async function ev(id) { const e = (await SB.rpc('GET', '/events')).events.find(x => x.id === +id); if (!e) throw Object.assign(new Error('يجب اختيار مناسبة صحيحة'), { status: 400, data: {} }); return e; }
  return { call, norm, COLS };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Adapter;
