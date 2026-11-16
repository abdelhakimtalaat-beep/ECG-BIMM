'use strict';
// رمز السرير: أبيض = شاغر، أصفر = مشغول
const bedIcon = on => `<svg class="bed ${on ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="5" width="3" height="14" rx="1"/><rect x="1.5" y="11" width="21" height="6" rx="1.5"/><rect x="6" y="8" width="6" height="3.2" rx="1.4"/><rect x="19.5" y="17" width="3" height="2.5" rx=".8"/></svg>`;
const bedsRow = r => r.status === 'active' && r.capacity > 0 ? `<div class="beds" title="${r.booked} مشغول من ${r.capacity}">${Array.from({ length: Math.min(r.capacity, 12) }, (_, i) => bedIcon(i < r.booked)).join('')}${r.capacity > 12 ? '<small>+' + (r.capacity - 12) + '</small>' : ''}</div>` : '';
const roomFeat = r => `<span class="badge ${r.has_ac ? 'ok' : 'info'}">${r.has_ac ? 'بتكييف' : 'بدون تكييف'}</span> <span class="badge ${r.bath_count ? 'ok' : 'info'}">${['بدون حمام', 'حمام واحد', '2 حمام'][r.bath_count || 0]}</span>`;
// تسكين الغرف (الخريطة التفاعلية + محرر الكروكي)، السائقون والنقل، الوجبات والإعاشة

/* ================= تسكين الغرف ================= */
App.view('housing', async (page, ctx) => {
  const admin = can('admin'); const houser = can('admin', 'event_manager', 'building_supervisor');
  const ev = curEvent();
  const S = (App._hs ||= { b: null, f: null, date: null });
  if (!S.date || S.date < ev.start_date || S.date > ev.end_date) S.date = todayStr() >= ev.start_date && todayStr() <= ev.end_date ? todayStr() : ev.start_date;
  let editing = false, dirty = false, layout = {};
  const structure = (await api('GET', '/structure')).buildings;
  if (ctx.stale()) return;
  if (!structure.length) { page.innerHTML = `<div class="page-head"><h1>تسكين الغرف</h1><div class="grow"></div>${admin ? '<button class="btn" id="mgb">إدارة المباني والأدوار</button>' : ''}</div><div class="card empty">${can('building_supervisor') ? 'لم يُعيَّن لك أي دور بعد. تواصل مع مدير النظام.' : 'لا توجد مبانٍ.'}</div>`; if (admin) $('#mgb').onclick = () => manageBuildings(structure); return; }
  if (!structure.find(b => b.id === S.b)) S.b = structure[0].id;
  const bld = () => structure.find(b => b.id === S.b);
  if (!bld().floors.find(f => f.id === S.f)) S.f = bld().floors[0]?.id;
  let data = null;

  // إحصائية مجملة لكل مبنى (كل أدواره) في التاريخ المعروض
  let stats = null;
  const statsHtml = () => !stats ? '<div class="muted small">جارٍ حساب إحصائية المباني…</div>' : `<h3 style="margin-top:0">إحصائية المباني — ${S.date}</h3><div class="table-wrap"><table class="bstats"><thead><tr><th>المبنى</th><th>السعة الإجمالية</th><th>المحجوز</th><th>المتبقي</th></tr></thead><tbody>${stats.map(s => `<tr><td><b>${esc(s.name)}</b></td><td>${s.cap}</td><td>${s.booked}</td><td><b>${s.cap - s.booked}</b></td></tr>`).join('')}${stats.length > 1 ? `<tr class="tot"><td>الإجمالي</td><td>${stats.reduce((a, s) => a + s.cap, 0)}</td><td>${stats.reduce((a, s) => a + s.booked, 0)}</td><td>${stats.reduce((a, s) => a + s.cap - s.booked, 0)}</td></tr>` : ''}</tbody></table></div>`;
  const loadStats = async () => {
    const date = S.date, key = structure.map(b => b.id + ':' + b.floors.length).join(','); const mine = ++loadStats.n;
    try {
      const res = await Promise.all(structure.map(async b => { let cap = 0, booked = 0; for (const f of b.floors) { const d = await api('GET', `/occupancy?floor_id=${f.id}&date=${date}`); for (const r of d.rooms) if (r.status === 'active') { cap += r.capacity; booked += r.booked; } } return { name: b.name, cap, booked }; }));
      if (mine !== loadStats.n || ctx.stale()) return; stats = res; const el = $('#bstats'); if (el) el.innerHTML = statsHtml();
    } catch (_) {}
  };
  loadStats.n = 0;
  const load = async () => {
    if (!S.f) { data = null; return render(); }
    data = await api('GET', `/occupancy?floor_id=${S.f}&date=${S.date}`); if (ctx.stale()) return;
    layout = {}; data.rooms.forEach(r => (layout[r.id] = { x: r.x, y: r.y, w: r.w, h: r.h })); dirty = false; render(); loadStats();
  };
  const render = () => {
    const b = bld(); const fl = b.floors.find(f => f.id === S.f);
    const rooms = data ? data.rooms : [];
    const cap = rooms.filter(r => r.status === 'active').reduce((a, r) => a + r.capacity, 0), booked = rooms.filter(r => r.status === 'active').reduce((a, r) => a + r.booked, 0);
    const grouped = !editing && rooms.some(r => r.place);   // تجميع الغرف حسب «المكان» في عرض الكروكي
    const tile = (r, st) => `<div class="room ${r.state}" data-r="${r.id}" style="${st}" title="غرفة ${esc(r.number)} — ${STATE_AR[r.state]}${r.occupants.length ? '\n' + esc(r.occupants.map(o => o.full_name).join('، ')) : ''}"><span style="font-size:1.05em">${esc(r.number)}</span><small>${r.status === 'active' ? `${r.booked}/${r.capacity}` : 'خارج الخدمة'}</small>${bedsRow(r)}${editing ? '<span class="rsz" data-rsz></span>' : ''}</div>`;
    const groupsHtml = rs => { const m = new Map(); for (const r of rs) { const k = (r.place || '').trim(); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
      const keys = [...m.keys()].sort((a, b) => (a === '') - (b === '') || a.localeCompare(b, 'ar'));
      return keys.map(k => { const g = m.get(k), cp = g.filter(r => r.status === 'active').reduce((a, r) => a + r.capacity, 0), bk = g.filter(r => r.status === 'active').reduce((a, r) => a + r.booked, 0);
        return `<div class="pgroup"><div class="pname"><b>${esc(k || 'بدون مكان')}</b><small>${bk}/${cp}</small></div><div class="prooms">${g.map(r => tile(r, '')).join('')}</div></div>`; }).join(''); };
    page.innerHTML = `<div class="page-head"><h1>تسكين الغرف</h1><div class="grow"></div>${admin ? '<button class="btn sec" id="mgb">إدارة المباني والأدوار</button>' : ''}</div>
      <div class="card" id="bstats" style="margin-bottom:14px">${statsHtml()}</div>
      <div class="card" style="margin-bottom:14px"><div class="map-toolbar"><div class="row"><label style="margin:0">المبنى</label><select id="sb" style="width:auto">${opts(structure.map(x => [x.id, x.name]), S.b)}</select></div>
      <div class="tabs" style="margin:0;border:0" id="floors">${b.floors.map(f => `<button data-f="${f.id}" class="${f.id === S.f ? 'on' : ''}">${esc(f.name)}</button>`).join('')}</div><div class="grow"></div>
      <div class="row"><label style="margin:0">التاريخ</label><input type="date" id="sd" value="${S.date}" style="width:auto"><span class="muted small">${dayName(S.date)}</span></div></div>
      <div class="legend"><span><i style="background:var(--free)"></i>متاحة بالكامل</span><span><i style="background:var(--partial)"></i>مشغولة جزئياً</span><span><i style="background:var(--full)"></i>مكتملة الحجز</span><span><i style="background:var(--unavail)"></i>غير متاحة / خارج الخدمة</span></div></div>
      ${!fl ? '<div class="card empty">لا توجد أدوار في هذا المبنى</div>' : `
      <div class="card"><div class="row" style="margin-bottom:10px"><h2 style="margin:0">${esc(b.name)} — ${esc(fl.name)}</h2><span class="badge">السعة ${cap}</span><span class="badge partial">محجوز ${booked}</span><span class="badge free">متبقي ${cap - booked}</span>
        ${data && data.floor.supervisors.length ? `<span class="muted small">المشرف: ${esc(data.floor.supervisors.map(s => s.name).join('، '))}</span>` : ''}<div class="grow"></div>
        ${dirty ? '<span class="dirty">تعديلات غير محفوظة</span>' : ''}
        ${admin ? (editing ? `<button class="btn sm sec" id="e_add">+ غرفة</button><button class="btn sm sec" id="e_up">رفع الكروكي</button>${fl.has_plan ? '<button class="btn sm sec" id="e_rmplan">إزالة الكروكي</button>' : ''}<button class="btn sm sec" id="e_auto">ترتيب تلقائي</button><button class="btn sm" id="e_save" ${dirty ? '' : 'disabled'}>حفظ المواضع</button><button class="btn sm dark" id="e_end">إنهاء التحرير</button>` : '<button class="btn sm sec" id="e_start">تحرير الكروكي والغرف</button>') : ''}</div>
        ${editing ? '<div class="alert info">وضع التحرير: اسحب الغرفة لتحريكها، واسحب المربع الأبيض في ركنها لتغيير حجمها، وانقر عليها لتعديل رقمها وسعتها. ارفع صورة الكروكي لتظهر كخلفية ترسم فوقها الغرف بنفس توزيعها الحقيقي.</div>' : ''}
        ${!rooms.length ? `<div class="empty">لا توجد غرف في هذا الدور بعد.${admin ? ' اضغط «تحرير الكروكي والغرف» ثم «+ غرفة»، أو ارفع الكروكي أولاً.' : ''}</div>` : ''}
        <div class="mapbox ${editing ? 'editing' : ''} ${grouped ? 'grouped' : ''}" id="map">${data && data.floor.has_plan && !grouped ? `<img class="plan" alt="" data-plan="${S.f}" src="${(App.planCache || {})[S.f + ':' + (App._planV || 0)] || ''}">` : ''}
        ${grouped ? groupsHtml(rooms) : rooms.map(r => tile(r, (() => { const L = layout[r.id] || r; return `left:${L.x}%;top:${L.y}%;width:${L.w}%;height:${L.h}%`; })())).join('')}</div></div>
      ${rooms.length ? `<div class="card" style="margin-top:14px"><h3>قائمة الغرف</h3><div class="table-wrap"><table><thead><tr><th>الغرفة</th><th>المكان</th><th>السعة</th><th>المحجوز</th><th>المتبقي</th><th>الحالة</th><th>المواصفات</th><th>المقيمون</th></tr></thead><tbody>${rooms.map(r => `<tr data-rr="${r.id}" style="cursor:pointer"><td><b>${esc(r.number)}</b></td><td>${esc(r.place || '—')}</td><td>${r.capacity}</td><td>${r.booked}</td><td>${r.remaining}</td><td><span class="badge ${r.state}">${STATE_AR[r.state]}</span></td><td>${roomFeat(r)}</td><td>${esc(r.occupants.map(o => o.full_name).join('، ')) || '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`}`;
    wire();
  };
  const wire = () => {
    App.hydratePlans(page);
    $('#sb').onchange = e => { if (!confirmLeave()) return render(); S.b = +e.target.value; S.f = bld().floors[0]?.id; editing = false; load(); };
    $('#floors').onclick = e => { const b = e.target.closest('[data-f]'); if (b && confirmLeave()) { S.f = +b.dataset.f; editing = false; load(); } };
    $('#sd').onchange = e => { if (e.target.value && confirmLeave()) { S.date = e.target.value; load(); } };
    if ($('#mgb')) $('#mgb').onclick = () => manageBuildings(structure);
    $$('[data-rr]').forEach(tr => (tr.onclick = () => openRoom(+tr.dataset.rr)));
    if (!data) return;
    if (!editing) { $$('.room').forEach(el => (el.onclick = () => openRoom(+el.dataset.r))); }
    if (admin) {
      if ($('#e_start')) $('#e_start').onclick = () => { editing = true; render(); };
      if (editing) {
        $('#e_end').onclick = () => { if (dirty && !confirm('توجد تعديلات غير محفوظة. تجاهلها؟')) return; editing = false; load(); };
        $('#e_save').onclick = async () => { await api('PUT', `/floors/${S.f}/layout`, { rooms: Object.entries(layout).map(([id, l]) => ({ id: +id, ...l })) }); toast('تم حفظ مواضع الغرف'); dirty = false; await load(); };
        $('#e_add').onclick = () => roomEditor(null);
        $('#e_up').onclick = async () => { const f = await pickFile('image/png,image/jpeg,image/webp'); if (!f) return; try { await api('POST', `/floors/${S.f}/plan`, await f.arrayBuffer(), { raw: true, type: f.type }); App._planV = (App._planV || 0) + 1; const f0 = bld().floors.find(f => f.id === S.f); if (f0) f0.has_plan = true; toast('تم رفع الكروكي'); const bk = layout; await load(); layout = bk; } catch (e) { toast(e.message, 'err'); } };
        if ($('#e_rmplan')) $('#e_rmplan').onclick = async () => { if (await confirmBox('إزالة صورة الكروكي لهذا الدور؟ (لا تتأثر الغرف)', { danger: true })) { await api('DELETE', `/floors/${S.f}/plan`); const fl = bld().floors.find(f => f.id === S.f); fl.has_plan = false; await load(); } };
        $('#e_auto').onclick = () => { data.rooms.forEach((r, i) => { layout[r.id] = { x: 2 + (i % 6) * 16, y: 3 + Math.floor(i / 6) * 22, w: 14, h: 18 }; }); dirty = true; render(); };
        enableDrag();
      }
    }
  };
  const confirmLeave = () => !dirty || confirm('توجد تعديلات غير محفوظة على مواضع الغرف. تجاهلها؟');
  function enableDrag() {
    const map = $('#map'); let drag = null;
    $$('.room', map).forEach(el => {
      el.onpointerdown = e => {
        const id = +el.dataset.r; const rect = map.getBoundingClientRect(); const L = layout[id];
        drag = { id, el, mode: e.target.dataset.rsz !== undefined ? 'rsz' : 'move', sx: e.clientX, sy: e.clientY, orig: { ...L }, rect, moved: false };
        el.setPointerCapture(e.pointerId); e.preventDefault();
      };
      el.onpointermove = e => {
        if (!drag || drag.el !== el) return; const dx = (e.clientX - drag.sx) * 100 / drag.rect.width, dy = (e.clientY - drag.sy) * 100 / drag.rect.height;
        if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) drag.moved = true; if (!drag.moved) return;
        const L = layout[drag.id];
        if (drag.mode === 'move') { L.x = Math.round(Math.min(100 - L.w, Math.max(0, drag.orig.x + dx)) * 10) / 10; L.y = Math.round(Math.min(100 - L.h, Math.max(0, drag.orig.y + dy)) * 10) / 10; }
        else { L.w = Math.round(Math.min(100 - L.x, Math.max(4, drag.orig.w + dx)) * 10) / 10; L.h = Math.round(Math.min(100 - L.y, Math.max(5, drag.orig.h + dy)) * 10) / 10; }
        Object.assign(el.style, { left: L.x + '%', top: L.y + '%', width: L.w + '%', height: L.h + '%' });
      };
      el.onpointerup = e => {
        if (!drag || drag.el !== el) return; const d = drag; drag = null;
        if (d.moved) { dirty = true; const sv = $('#e_save'); if (sv) sv.disabled = false; if (!$('.dirty', page)) $('#e_end').insertAdjacentHTML('beforebegin', ''); const h = $('.dirty'); if (!h) { const span = document.createElement('span'); span.className = 'dirty'; span.textContent = 'تعديلات غير محفوظة'; $('#e_add').before(span); } }
        else roomEditor(data.rooms.find(r => r.id === d.id));
      };
    });
  }
  function freeSpot() { // أول موضع لا يتقاطع مع الغرف الحالية
    const w = 14, h = 18, L = Object.values(layout);
    for (let y = 3; y <= 100 - h; y += 4) for (let x = 2; x <= 100 - w; x += 2) if (!L.some(o => x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y)) return { x, y, w, h };
    return { x: 2, y: 2, w, h };
  }
  function roomEditor(r) {
    const body = `<form id="rf"><div class="fgrid"><div class="field"><label>رقم الغرفة *</label><input name="number" required value="${esc(r?.number)}"></div><div class="field"><label>السعة (عدد الأسرّة/الأماكن) *</label><input type="number" min="0" max="200" name="capacity" required value="${esc(r?.capacity ?? '')}"></div>
      <div class="field"><label>المكان</label><input name="place" list="plc" maxlength="80" placeholder="مثال: الجناح الشرقي" value="${esc(r?.place || '')}"><datalist id="plc">${[...new Set((data?.rooms || []).map(x => x.place).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist></div><div class="field"><label>الحالة</label><select name="status">${opts([['active', 'في الخدمة'], ['out_of_service', 'خارج الخدمة']], r?.status || 'active')}</select></div><div class="field"><label>التكييف</label><select name="has_ac">${opts([['true', 'بتكييف'], ['false', 'بدون تكييف']], String(!!r?.has_ac))}</select></div><div class="field"><label>الحمام</label><select name="bath_count">${opts([['1', 'حمام واحد'], ['2', '2 حمام'], ['0', 'بدون حمام']], String(r?.bath_count ?? 0))}</select></div><div class="field full"><label>ملاحظات</label><textarea name="notes">${esc(r?.notes)}</textarea></div></div></form>`;
    modal({ title: r ? 'تعديل الغرفة ' + r.number : 'غرفة جديدة', width: 540, body, buttons: [{ label: 'حفظ', onClick: async m => {
      const f = $('#rf', m.el); if (!f.reportValidity()) return; const b = formData(f);
      if (r) { await api('PUT', '/rooms/' + r.id, { ...b, ...layout[r.id] }); } else { const sp = freeSpot(); await api('POST', '/rooms', { ...b, floor_id: S.f, ...sp }); }
      m.close(); toast('تم الحفظ'); const keep = dirty ? { ...layout } : null; const bk = await api('GET', '/structure'); structure.splice(0, structure.length, ...bk.buildings); await load(); if (keep) { Object.assign(layout, keep); dirty = true; render(); }
    } }, ...(r ? [{ label: 'حذف الغرفة', cls: 'danger', onClick: async m => { if (!(await confirmBox(`حذف الغرفة ${r.number}؟`, { danger: true, okText: 'حذف' }))) return; await api('DELETE', '/rooms/' + r.id); m.close(); toast('تم الحذف'); const bk = await api('GET', '/structure'); structure.splice(0, structure.length, ...bk.buildings); await load(); } }] : []), { label: 'إلغاء', cls: 'sec', close: true }] });
  }

  // ---- نافذة الغرفة ----
  async function openRoom(id) {
    const room = data.rooms.find(r => r.id === id); const fl = bld().floors.find(f => f.id === S.f);
    const all = (await api('GET', `/rooms/${id}/bookings`)).bookings;
    const body = document.createElement('div');
    const draw = () => {
      const free = room.status === 'active' ? Math.max(0, room.capacity - room.booked) : 0;
      body.innerHTML = `<div class="fgrid" style="margin-bottom:10px"><div><b>رقم الغرفة:</b> ${esc(room.number)}</div><div><b>المبنى والدور:</b> ${esc(bld().name)} — ${esc(fl.name)}</div><div><b>السعة الإجمالية:</b> ${room.capacity}</div><div><b>المواصفات:</b> ${roomFeat(room)}</div>
        <div><b>المحجوزون (${S.date}):</b> ${room.booked}</div><div><b>المتبقي:</b> ${free}</div><div><b>الحالة:</b> <span class="badge ${room.state}">${STATE_AR[room.state]}</span></div>
        <div class="full"><b>المشرف المسؤول:</b> ${data.floor.supervisors.length ? esc(data.floor.supervisors.map(s => s.name + (s.phone ? ' (' + s.phone + ')' : '')).join('، ')) : '<span class="muted">غير محدد</span>'}</div>
        ${room.notes ? `<div class="full"><b>ملاحظات:</b> ${esc(room.notes)}</div>` : ''}</div>
        <h3>المقيمون بتاريخ ${S.date}</h3>${room.occupants.length ? `<div class="table-wrap"><table><thead><tr><th>الاسم</th><th>الدولة</th><th>الوصول</th><th>المغادرة</th><th>المناسبة</th><th></th></tr></thead><tbody>${room.occupants.map(o => `<tr><td><b>${esc(o.full_name)}</b></td><td>${esc(o.country_name)}</td><td>${fmtDate(o.from_date)}</td><td>${fmtDate(o.to_date)}</td><td class="muted small">${esc(o.event_name)}</td>
          <td class="actions">${houser ? `<button class="btn sm sec" data-tr="${o.booking_id}">نقل</button> <button class="btn sm danger" data-rm="${o.booking_id}">إلغاء الحجز</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted">لا يوجد مقيمون في هذا التاريخ</div>'}
        ${all.length > room.occupants.length ? `<details style="margin-top:10px"><summary>جميع حجوزات الغرفة (${all.length})</summary><div class="table-wrap"><table><tbody>${all.map(b => `<tr><td>${esc(b.full_name)}</td><td>${esc(b.country_name)}</td><td>${fmtDate(b.from_date)} ← ${fmtDate(b.to_date)}</td><td class="muted small">${esc(b.event_name)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
        ${houser && free > 0 ? '<hr><h3>تسكين زائرين</h3><div id="addbox"></div>' : (houser && room.status === 'active' ? '<div class="alert warn" style="margin-top:10px">الغرفة مكتملة في هذا التاريخ</div>' : '')}`;
      if (houser && free > 0) addBox($('#addbox', body), room, free);
    };
    const m = modal({ title: `غرفة ${room.number}`, width: 860, body, buttons: [...(admin ? [{ label: 'تعديل بيانات الغرفة', cls: 'sec', onClick: mm => { mm.close(); roomEditor(room); } }] : []), { label: 'إغلاق', cls: 'sec', close: true }] });
    body.onclick = async e => {
      const t = e.target.closest('[data-tr],[data-rm]'); if (!t) return;
      if (t.dataset.rm) { const o = room.occupants.find(x => x.booking_id === +t.dataset.rm); if (await confirmBox(`إلغاء حجز «${o.full_name}» من غرفة ${room.number}؟`, { danger: true })) { await api('DELETE', '/bookings/' + o.booking_id); toast('أُلغي الحجز'); m.close(); await load(); openRoom(id); } }
      if (t.dataset.tr) { const o = room.occupants.find(x => x.booking_id === +t.dataset.tr); transferDialog(o, async () => { m.close(); await load(); }); }
    };
    draw();
    async function done() { m.close(); await load(); openRoom(id); }
    m.done = done; body._done = done;
  }
  function addBox(box, room, free) {
    box.innerHTML = '<div class="muted small">جاري تحميل الزائرين غير المسكَّنين…</div>';
    api('GET', '/visitors?' + qs({ event_id: App.eventId, unhoused: 1 })).then(r => {
      const vs = r.visitors; const groupsIn = [...new Map(vs.filter(v => v.group_id).map(v => [v.group_id, v.group_name])).entries()];
      box.innerHTML = `<div class="fgrid"><div class="field"><label>بحث</label><input id="as" type="search" placeholder="اسم الزائر…"></div>
        ${groupsIn.length ? `<div class="field"><label>تحديد فوج كامل</label><select id="ag">${opts(groupsIn, '', 'اختر…')}</select></div>` : ''}
        <div class="field"><label>من (اختياري)</label><input type="date" id="af"></div><div class="field"><label>إلى (اختياري)</label><input type="date" id="at"></div></div>
        <div class="muted small" style="margin-bottom:6px">إذا تُركت التواريخ فارغة تُستخدم تواريخ إقامة كل زائر. المتاح في الغرفة: ${free}. اختيار رب الأسرة يحدد أفراد أسرته تلقائياً. الحجز ذرّي: إمّا تسكين الجميع أو لا أحد.</div>
        <div class="sel-list" id="al">${vs.map(v => `<label data-n="${esc(v.full_name)}"><input type="checkbox" value="${v.id}" data-head="${v.head_id || ''}" data-hid="${v.category === 'family_head' ? v.id : ''}" data-g="${v.group_id || ''}"> <b>${esc(v.full_name)}</b> <span class="muted small">${esc(v.country_name)} — ${CAT[v.category]}${v.head_name ? ' (' + esc(v.head_name) + ')' : ''}${v.group_name ? ' (' + esc(v.group_name) + ')' : ''} — ${v.arrival_date || '؟'} ← ${v.departure_date || '؟'}</span></label>`).join('') || '<div class="empty">لا يوجد زائرون بانتظار التسكين</div>'}</div>
        <div class="row" style="margin-top:8px"><button class="btn" id="go">تسكين المحدَّدين (<span id="sc">0</span>)</button></div>`;
      const cnt = () => ($('#sc', box).textContent = $$('#al input:checked', box).length);
      $('#al', box).onchange = e => { const c = e.target; if (c.dataset.hid) $$(`#al input[data-head="${c.dataset.hid}"]`, box).forEach(x => (x.checked = c.checked)); cnt(); };
      $('#as', box).oninput = e => { const q = e.target.value.trim(); $$('#al label', box).forEach(l => (l.hidden = q && !l.dataset.n.includes(q))); };
      if ($('#ag', box)) $('#ag', box).onchange = e => { if (!e.target.value) return; $$(`#al input[data-g="${e.target.value}"]`, box).forEach(x => (x.checked = true)); cnt(); };
      $('#go', box).onclick = async () => {
        const ids = $$('#al input:checked', box).map(x => +x.value); if (!ids.length) return toast('اختر زائراً واحداً على الأقل', 'warn');
        try { await api('POST', '/bookings/bulk', { event_id: App.eventId, room_id: room.id, visitor_ids: ids, from_date: $('#af', box).value || undefined, to_date: $('#at', box).value || undefined }); toast(`تم تسكين ${ids.length}`);
          // الكروكي يعرض إشغال تاريخ واحد: انتقل إلى تاريخ الحجز الجديد إن لم يشمل التاريخ المعروض
          try { const bs = (await api('GET', `/rooms/${room.id}/bookings`)).bookings.filter(x => ids.includes(x.visitor_id)); if (bs.length && !bs.some(x => x.from_date <= S.date && x.to_date > S.date)) { const d = bs.map(x => x.from_date).sort()[0]; S.date = d < ev.start_date ? ev.start_date : d > ev.end_date ? ev.end_date : d; toast(`انتقلنا إلى ${S.date} (تاريخ بدء الإقامة) لتظهر الحجوزات في الكروكي`); } } catch (_) {}
          const mm = box.closest('.overlay'); mm.remove(); await load(); openRoom(room.id); }
        catch (e) { toast(e.message, 'err'); }
      };
    }).catch(e => (box.innerHTML = `<div class="alert err">${esc(e.message)}</div>`));
  }
  function transferDialog(o, done) {
    const targets = structure.flatMap(b => b.floors.flatMap(f => f.rooms.filter(r => r.status === 'active').map(r => ({ id: r.id, label: `${b.name} / ${f.name} / غرفة ${r.number} (السعة ${r.capacity})` }))));
    modal({ title: `نقل «${o.full_name}» إلى غرفة أخرى`, width: 540, body: `<div class="field"><label>الغرفة الجديدة</label><select id="tt">${opts(targets.map(t => [t.id, t.label]), '', 'اختر…')}</select></div><p class="muted small">يتحقق النظام من السعة وتعارض الفترات، ويُحدَّث الإشغال تلقائياً.</p>`,
      buttons: [{ label: 'نقل', onClick: async m => { const v = $('#tt', m.el).value; if (!v) return toast('اختر الغرفة', 'warn'); await api('PUT', '/bookings/' + o.booking_id, { room_id: +v }); m.close(); toast('تم النقل'); done(); } }, { label: 'إلغاء', cls: 'sec', close: true }] });
  }
  await load();
});

function manageBuildings(structure) {
  const body = document.createElement('div');
  const draw = () => {
    body.innerHTML = `<p class="muted small">أضف المباني والأدوار حسب واقع المزرعة. لا يمكن حذف مبنى أو دور به حجوزات.</p>${structure.map(b => `<div class="card" style="margin-bottom:10px"><div class="row"><b style="font-size:1.1rem">${esc(b.name)}</b><div class="grow"></div><button class="btn sm sec" data-rb="${b.id}">إعادة تسمية</button><button class="btn sm danger" data-db="${b.id}">حذف</button></div>
      <div style="margin-top:8px">${b.floors.map(f => `<span class="badge" style="margin:3px;padding:5px 12px">${esc(f.name)} <small>(${f.rooms.length} غرفة)</small> <button class="btn ghost sm" data-rf="${f.id}" title="إعادة تسمية">✎</button><button class="btn ghost sm" style="color:var(--danger)" data-df="${f.id}" title="حذف">×</button></span>`).join('') || '<span class="muted">لا أدوار</span>'}
      <button class="btn sm sec" data-af="${b.id}">+ دور</button></div></div>`).join('')}<button class="btn" id="ab">+ مبنى جديد</button>`;
  };
  draw();
  const ask = (title, val = '') => new Promise(res => { let fin = false; const f = v => { if (!fin) { fin = true; res(v); } };
    modal({ title, width: 420, onClose: () => f(null), body: `<input id="nm" value="${esc(val)}">`, buttons: [{ label: 'حفظ', onClick: m => { f($('#nm', m.el).value.trim()); m.close(); } }, { label: 'إلغاء', cls: 'sec', close: true }] }); });
  const m = modal({ title: 'إدارة المباني والأدوار', width: 720, body, buttons: [{ label: 'إغلاق وتحديث', cls: 'sec', onClick: x => { x.close(); App.refresh(); } }] });
  body.onclick = async e => {
    const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
    try {
      if (t.id === 'ab') { const n = await ask('اسم المبنى'); if (n) await api('POST', '/buildings', { name: n }); }
      else if (d.rb) { const b = structure.find(x => x.id === +d.rb); const n = await ask('اسم المبنى', b.name); if (n) await api('PUT', '/buildings/' + d.rb, { name: n }); }
      else if (d.db) { const b = structure.find(x => x.id === +d.db); if (await confirmBox(`حذف المبنى «${b.name}» بكل أدواره وغرفه؟`, { danger: true, okText: 'حذف' })) await api('DELETE', '/buildings/' + d.db); else return; }
      else if (d.af) { const n = await ask('اسم الدور'); if (n) await api('POST', '/floors', { building_id: +d.af, name: n }); }
      else if (d.rf) { const f = structure.flatMap(b => b.floors).find(x => x.id === +d.rf); const n = await ask('اسم الدور', f.name); if (n) await api('PUT', '/floors/' + d.rf, { name: n }); }
      else if (d.df) { const f = structure.flatMap(b => b.floors).find(x => x.id === +d.df); if (await confirmBox(`حذف الدور «${f.name}» وكل غرفه؟`, { danger: true, okText: 'حذف' })) await api('DELETE', '/floors/' + d.df); else return; }
      else return;
      structure.splice(0, structure.length, ...(await api('GET', '/structure')).buildings); draw(); toast('تم');
    } catch (er) { toast(er.message, 'err'); }
  };
}

/* ================= السائقون والنقل ================= */
App.view('drivers', async (page, ctx) => {
  const tab = ctx.sub || 'daily'; const ev = curEvent();
  let date = App._tdate && App._tdate >= addDays(ev.start_date, -3) && App._tdate <= addDays(ev.end_date, 3) ? App._tdate : (todayStr() >= ev.start_date && todayStr() <= ev.end_date ? todayStr() : ev.start_date);
  const drivers = (await api('GET', '/drivers?event_id=' + App.eventId)).drivers; if (ctx.stale()) return;
  const head = `<div class="page-head"><h1>السائقون والسيارات</h1></div><div class="tabs"><button class="${tab === 'daily' ? 'on' : ''}" onclick="location.hash='#/drivers'">الجدول اليومي</button><button class="${tab === 'list' ? 'on' : ''}" onclick="location.hash='#/drivers/list'">السائقون</button><button class="${tab === 'days' ? 'on' : ''}" onclick="location.hash='#/drivers/days'">احتياج الأيام</button></div>`;
  if (tab === 'list') {
    page.innerHTML = head + `<div class="row" style="margin-bottom:10px"><button class="btn" id="ad">+ سائق جديد</button></div><div class="table-wrap"><table><thead><tr><th>السائق</th><th>الهاتف</th><th>نوع السيارة</th><th>رقم السيارة</th><th>السعة</th><th>ملاحظات</th><th></th></tr></thead><tbody>
      ${drivers.map(d => `<tr><td><b>${esc(d.name)}</b></td><td><span class="ltr">${esc(d.phone)}</span></td><td>${esc(d.car_type)}</td><td><span class="ltr">${esc(d.car_number)}</span></td><td>${d.capacity}</td><td>${esc(d.notes)}</td><td class="actions"><button class="btn sm sec" data-e="${d.id}">تعديل</button> <button class="btn sm danger" data-d="${d.id}">حذف</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">لا يوجد سائقون. أضف السائقين والسيارات.</td></tr>'}</tbody></table></div>`;
    const form = d => modal({ title: d ? 'تعديل سائق' : 'سائق جديد', width: 560, body: `<form id="df"><div class="fgrid"><div class="field"><label>اسم السائق *</label><input name="name" required value="${esc(d?.name)}"></div><div class="field"><label>رقم الهاتف</label><input name="phone" dir="ltr" style="text-align:right" value="${esc(d?.phone)}"></div>
      <div class="field"><label>نوع السيارة</label><input name="car_type" value="${esc(d?.car_type)}"></div><div class="field"><label>رقم السيارة</label><input name="car_number" value="${esc(d?.car_number)}"></div><div class="field"><label>سعة السيارة (عدد الركاب) *</label><input type="number" min="1" max="80" name="capacity" required value="${esc(d?.capacity ?? 4)}"></div><div class="field full"><label>ملاحظات</label><textarea name="notes">${esc(d?.notes)}</textarea></div></div></form>`,
      buttons: [{ label: 'حفظ', onClick: async m => { const f = $('#df', m.el); if (!f.reportValidity()) return; const b = formData(f); d ? await api('PUT', '/drivers/' + d.id, b) : await api('POST', '/drivers', { ...b, event_id: App.eventId }); m.close(); toast('تم الحفظ'); App.refresh(); } }, { label: 'إلغاء', cls: 'sec', close: true }] });
    $('#ad').onclick = () => form();
    page.onclick = async e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.e) form(drivers.find(x => x.id === +b.dataset.e));
      if (b.dataset.d) { const d = drivers.find(x => x.id === +b.dataset.d); if (await confirmBox(`حذف السائق «${d.name}»؟`, { danger: true, okText: 'حذف' })) { try { await api('DELETE', '/drivers/' + d.id, {}); } catch (er) { if (er.status === 409 && await confirmBox(er.message + '\nهل تريد المتابعة؟', { danger: true })) await api('DELETE', '/drivers/' + d.id, { force: true }); else if (er.status !== 409) throw er; } App.refresh(); } } };
    return;
  }
  if (tab === 'days') {
    const { days } = await api('GET', '/transport/summary?event_id=' + App.eventId); if (ctx.stale()) return;
    page.innerHTML = head + `<div class="table-wrap"><table><thead><tr><th>اليوم</th><th>يحتاجون استقبالاً</th><th>يحتاجون توصيلاً</th><th>الركاب المكلَّفون</th><th>سعة السيارات المتاحة</th><th>بلا سيارة</th><th>المهام</th></tr></thead><tbody>
      ${days.map(d => `<tr style="cursor:pointer" data-d="${d.date}"><td><b>${d.date}</b> <span class="muted small">${dayName(d.date)}</span></td><td>${d.need_pickup}</td><td>${d.need_dropoff}</td><td>${d.assigned}</td><td>${d.fleet_capacity} ${Math.max(d.need_pickup, d.need_dropoff) > d.fleet_capacity ? '<span class="badge bad">لا تكفي</span>' : ''}</td><td>${d.unassigned ? `<span class="badge warn">${d.unassigned}</span>` : '<span class="badge ok">0</span>'}</td><td>${d.tasks}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">لا توجد بيانات</td></tr>'}</tbody></table></div><p class="muted small">انقر على أي يوم لفتح جدوله التفصيلي.</p>`;
    page.onclick = e => { const tr = e.target.closest('[data-d]'); if (tr) { App._tdate = tr.dataset.d; location.hash = '#/drivers'; } };
    return;
  }
  // ---- الجدول اليومي ----
  const draw = async () => {
    const d = await api('GET', `/transport/daily?event_id=${App.eventId}&date=${date}`); if (ctx.stale()) return;
    const need = Math.max(d.need_pickup, d.need_dropoff);
    const grp = list => { const m = new Map(); list.forEach(v => { const k = v.group_id ? 'g' + v.group_id : (v.head_id ? 'h' + v.head_id : 'v' + v.id); const e = m.get(k) || { key: k, n: 0, name: v.group_id ? 'فوج (عدد ' : v.full_name, v, group: !!v.group_id, rep: v.head_id || v.id }; e.n++; m.set(k, e); }); return [...m.values()]; };
    page.innerHTML = head + `<div class="card" style="margin-bottom:14px"><div class="row"><button class="btn sec sm" id="pd">◀ السابق</button><input type="date" id="td" value="${date}" style="width:auto"><button class="btn sec sm" id="nd">التالي ▶</button><b>${dayName(date)}</b><div class="grow"></div>
      <button class="btn" id="at">+ تكليف سائق</button><button class="btn sec" id="pr">طباعة الجدول</button></div></div>
      <div id="tsheet"><h2 class="print-only tc">جدول حركة السيارات — ${esc(ev.name)} — ${date}</h2>
      <div class="grid stats">${statCard(d.need_pickup, 'يحتاجون استقبالاً من المطار')}${statCard(d.need_dropoff, 'يحتاجون توصيلاً للمغادرة')}${statCard(d.assigned_passengers, 'ركاب مكلَّف لهم سيارات', 'ok')}${statCard(d.fleet_capacity, `سعة السيارات المتاحة (${d.fleet_cars} سيارة)`, need > d.fleet_capacity ? 'bad' : '')}${statCard(d.cars_used, 'سيارات مستخدمة اليوم')}${statCard(d.free_drivers, 'سائقون متاحون', 'ok')}</div>
      ${need > d.fleet_capacity ? `<div class="alert err" style="margin-top:12px">عدد الزائرين (${need}) يتجاوز السعة الإجمالية للسيارات المتاحة (${d.fleet_capacity}). أضف سيارات أو سائقين.</div>` : ''}
      ${[['pickup', 'بلا سيارة استقبال', d.unassigned_pickup], ['dropoff', 'بلا سيارة توصيل', d.unassigned_dropoff]].map(([k, t, l]) => l.length ? `<div class="alert warn no-print" style="margin-top:12px"><b>${t}:</b> ${grp(l).map(g => `<span class="badge warn" style="margin:2px">${g.group ? 'فوج ' + esc(g.v.group_id) : esc(g.name)} (${g.n}) <button class="btn ghost sm" data-assign="${g.group ? 'g' + g.v.group_id : 'v' + g.rep}" data-k="${k}">تكليف</button></span>`).join('')}</div>` : '').join('')}
      <h3 style="margin-top:16px">مهام اليوم</h3><div class="table-wrap"><table><thead><tr><th>الوقت</th><th>المهمة</th><th>الزائر / الفوج</th><th>الدولة</th><th>الركاب</th><th>السائق</th><th>السيارة</th><th>الرحلة / المطار</th><th>الحالة</th><th class="no-print"></th></tr></thead><tbody>
      ${d.tasks.map(t => `<tr><td>${esc(t.task_time) || '—'}</td><td>${t.kind === 'pickup' ? 'استقبال' : 'توصيل'}</td><td><b>${esc(t.visitor_name || 'فوج: ' + t.group_name)}</b></td><td>${esc(t.country_name)}</td><td>${t.passengers} ${t.passengers > t.car_capacity ? '<span class="badge bad">> السعة</span>' : ''}</td><td>${esc(t.driver_name)}<div class="muted small ltr">${esc(t.driver_phone)}</div></td><td>${esc(t.car_type)} <span class="ltr">${esc(t.car_number)}</span><div class="muted small">سعة ${t.car_capacity}</div></td><td>${esc(t.flight_info)}<div class="muted small">${esc(t.airport)}</div></td>
      <td><select data-st="${t.id}" style="min-width:120px" class="no-print">${opts(Object.entries(TASK_STATUS), t.status)}</select><span class="print-only">${TASK_STATUS[t.status]}</span></td><td class="actions no-print"><button class="btn sm sec" data-te="${t.id}">تعديل</button> <button class="btn sm danger" data-td="${t.id}">×</button></td></tr>`).join('') || '<tr><td colspan="10" class="empty">لا توجد مهام في هذا اليوم</td></tr>'}</tbody></table></div></div>`;
    $('#td').onchange = e => { if (e.target.value) { date = App._tdate = e.target.value; draw(); } };
    $('#pd').onclick = () => { date = App._tdate = addDays(date, -1); draw(); }; $('#nd').onclick = () => { date = App._tdate = addDays(date, 1); draw(); };
    $('#at').onclick = () => taskForm(null, {}); $('#pr').onclick = () => printNow($('#tsheet'));
    page.onchange = async e => { if (e.target.dataset.st) { await api('PUT', '/transports/' + e.target.dataset.st, { status: e.target.value }); toast('تم تحديث الحالة'); } };
    page.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.assign) { const k = b.dataset.assign; taskForm(null, { kind: b.dataset.k, target: k[0] === 'g' ? 'group' : 'visitor', id: +k.slice(1) }); }
      if (b.dataset.te) taskForm(d.tasks.find(t => t.id === +b.dataset.te), {});
      if (b.dataset.td && await confirmBox('حذف هذه المهمة؟', { danger: true, okText: 'حذف' })) { await api('DELETE', '/transports/' + b.dataset.td); toast('تم الحذف'); draw(); }
    };
  };
  async function taskForm(t, pre) {
    if (!drivers.length) return toast('أضف سائقاً أولاً من تبويب «السائقون»', 'warn');
    const [vs, gs] = await Promise.all([api('GET', '/visitors?event_id=' + App.eventId), api('GET', '/groups?event_id=' + App.eventId)]);
    const heads = vs.visitors.filter(v => v.category !== 'family_member'); const target = t ? (t.group_id ? 'group' : 'visitor') : (pre.target || 'visitor'); const tid = t ? (t.group_id || t.visitor_id) : pre.id;
    const body = `<form id="tf"><div class="fgrid"><div class="field"><label>المهمة</label><select name="kind">${opts([['pickup', 'استقبال من المطار'], ['dropoff', 'توصيل للمغادرة']], t?.kind || pre.kind || 'pickup')}</select></div>
      <div class="field"><label>السائق *</label><select name="driver_id" required>${opts(drivers.map(d => [d.id, `${d.name} — ${d.car_type || 'سيارة'} (سعة ${d.capacity})`]), t?.driver_id, 'اختر…')}</select></div>
      <div class="field"><label>الجهة</label><select id="tg">${opts([['visitor', 'زائر / رب أسرة'], ['group', 'فوج']], target)}</select></div>
      <div class="field" id="fv"><label>الزائر *</label><select name="visitor_id">${opts(heads.map(v => [v.id, `${v.full_name} — ${v.country_name}${v.members_count ? ' (+' + v.members_count + ')' : ''}`]), target === 'visitor' ? tid : '', 'اختر…')}</select></div>
      <div class="field" id="fg"><label>الفوج *</label><select name="group_id">${opts(gs.groups.map(g => [g.id, `${g.name} — ${g.country_name}`]), target === 'group' ? tid : '', 'اختر…')}</select></div>
      <div class="field"><label>التاريخ</label><input type="date" name="task_date" value="${esc(t?.task_date || date)}"></div><div class="field"><label>الوقت</label><input type="time" name="task_time" value="${esc(t?.task_time)}"></div>
      <div class="field"><label>المطار</label><input name="airport" value="${esc(t?.airport)}"></div><div class="field"><label>بيانات الرحلة</label><input name="flight_info" value="${esc(t?.flight_info)}"></div>
      <div class="field"><label>عدد الركاب (يُحسب تلقائياً إن ترك فارغاً)</label><input type="number" min="1" name="passengers" value="${esc(t?.passengers || '')}"></div><div class="field"><label>الحالة</label><select name="status">${opts(Object.entries(TASK_STATUS), t?.status || 'not_started')}</select></div>
      <div class="field full"><label>ملاحظات</label><textarea name="notes">${esc(t?.notes)}</textarea></div></div><p class="muted small">للفوج الكبير أضف أكثر من مهمة بسيارات مختلفة وحدد عدد ركاب كل سيارة.</p></form>`;
    const m = modal({ title: t ? 'تعديل مهمة' : 'تكليف سائق', width: 760, body, buttons: [{ label: 'حفظ', onClick: async mm => {
      const f = $('#tf', mm.el); const b = formData(f); if ($('#tg', mm.el).value === 'group') { delete b.visitor_id; } else delete b.group_id;
      Object.keys(b).forEach(k => b[k] === '' && delete b[k]); b.event_id = App.eventId;
      const r = t ? await api('PUT', '/transports/' + t.id, b) : await api('POST', '/transports', b); mm.close(); toast(r.warning || 'تم الحفظ', r.warning ? 'warn' : ''); draw();
    } }, { label: 'إلغاء', cls: 'sec', close: true }] });
    const sw = () => { const g = $('#tg', m.el).value === 'group'; $('#fv', m.el).hidden = g; $('#fg', m.el).hidden = !g; }; $('#tg', m.el).onchange = sw; sw();
  }
  await draw();
});

/* ================= الوجبات والإعاشة ================= */
App.view('meals', async (page, ctx) => {
  const ev = curEvent(); let sel = App._mday && App._mday >= ev.start_date ? App._mday : (todayStr() >= ev.start_date && todayStr() <= ev.end_date ? todayStr() : ev.start_date);
  const { days } = await api('GET', '/meals?event_id=' + App.eventId); if (ctx.stale()) return;
  const draw = async () => {
    const { day } = await api('GET', `/meals/day?event_id=${App.eventId}&date=${sel}`); if (ctx.stale()) return;
    const mx = Math.max(1, ...days.map(d => d.total)); const tot = days.reduce((a, d) => ({ b: a.b + d.breakfast, l: a.l + d.lunch, d: a.d + d.dinner, t: a.t + d.total }), { b: 0, l: 0, d: 0, t: 0 });
    page.innerHTML = `<div class="page-head"><h1>الوجبات والإعاشة</h1><div class="grow"></div></div>
      <div class="grid cols2"><div class="card"><h3>الجدول اليومي للوجبات</h3><p class="muted small">يُحسب تلقائياً من تواريخ إقامة الزائرين (من يوم الوصول إلى يوم المغادرة شاملين)، بعد خصم الاستثناءات. انقر يوماً لعرض كشف المطبخ.</p>
      <div class="table-wrap" style="max-height:460px"><table><thead><tr><th>التاريخ</th><th>المقيمون</th><th>إفطار</th><th>غداء</th><th>عشاء</th><th>الإجمالي</th></tr></thead><tbody>
      ${days.map(d => `<tr data-d="${d.date}" style="cursor:pointer;${d.date === sel ? 'background:#e5f4e9' : ''}"><td><b>${d.date}</b> <span class="muted small">${dayName(d.date)}</span></td><td>${d.residents}</td><td>${d.breakfast}</td><td>${d.lunch}</td><td>${d.dinner}</td><td><b>${d.total}</b></td></tr>`).join('')}
      <tr><td><b>المجموع</b></td><td></td><td><b>${tot.b}</b></td><td><b>${tot.l}</b></td><td><b>${tot.d}</b></td><td><b>${tot.t}</b></td></tr></tbody></table></div></div>
      <div class="card"><h3>احتياج الوجبات يومياً</h3><div class="cols-chart">${days.map(d => `<div class="c" title="${d.date}: ${d.total}"><div class="pair"><div class="b m" style="height:${d.total * 100 / mx}%"></div></div><span>${d.date.slice(8)}</span></div>`).join('')}</div></div></div>
      <div class="card" style="margin-top:14px" id="kitchen"><div class="row no-print" style="margin-bottom:8px"><h2 style="margin:0">كشف المطبخ — ${sel} (${dayName(sel)})</h2><div class="grow"></div><input type="date" id="md" value="${sel}" style="width:auto"><button class="btn" id="kp">طباعة كشف المطبخ</button></div>
      <h2 class="print-only tc">كشف المطبخ اليومي — ${esc(ev.name)}<br>${sel} — ${dayName(sel)}</h2>
      <div class="grid stats" style="margin-bottom:12px">${statCard(day.residents, 'المقيمون')}${statCard(day.breakfast, 'إفطار')}${statCard(day.lunch, 'غداء')}${statCard(day.dinner, 'عشاء')}${statCard(day.total, 'إجمالي الوجبات', 'ok')}</div>
            <div class="table-wrap"><table><thead><tr><th>#</th><th>الاسم</th><th>الدولة</th><th>إفطار</th><th>غداء</th><th>عشاء</th><th class="no-print">كل الأيام</th></tr></thead><tbody>
      ${day.people.map((p, i) => `<tr><td>${i + 1}</td><td><b>${esc(p.full_name)}</b></td><td>${esc(p.country_name)}</td>${['breakfast', 'lunch', 'dinner'].map(m => `<td class="tc"><input type="checkbox" class="no-print" data-v="${p.id}" data-m="${m}" ${p.has[m] ? 'checked' : ''} style="width:auto"><span class="print-only">${p.has[m] ? '✔' : '✘'}</span></td>`).join('')}
      <td class="no-print">${['breakfast', 'lunch', 'dinner'].map(m => p.star[m] ? `<button class="btn ghost sm" data-all="${p.id}" data-m="${m}" data-undo="1" title="إعادة ${MEAL_AR[m]} لكل الأيام">↺${MEAL_AR[m].slice(0, 2)}</button>` : `<button class="btn ghost sm" data-all="${p.id}" data-m="${m}" title="استثناء ${MEAL_AR[m]} من كل الأيام">✘${MEAL_AR[m].slice(0, 2)}</button>`).join('')}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">لا يوجد مقيمون في هذا اليوم</td></tr>'}</tbody></table></div>
      <p class="muted small no-print">إزالة العلامة تستثني الزائر من الوجبة في هذا اليوم فقط. للاستثناء من كل أيام الإقامة استخدم أزرار «✘» في آخر السطر، ويُلغى بزر «↺».</p></div>`;
    page.onclick = e => { const tr = e.target.closest('tr[data-d]'); if (tr) { sel = App._mday = tr.dataset.d; draw(); } const a = e.target.closest('[data-all]'); if (a) allDays(+a.dataset.all, a.dataset.m, !!a.dataset.undo); };
    page.onchange = async e => { const c = e.target; if (c.dataset.v) { try { await api('POST', '/meal-exclusions', { visitor_id: +c.dataset.v, date: sel, meals: [c.dataset.m], excluded: !c.checked }); const r = await api('GET', '/meals?event_id=' + App.eventId); days.splice(0, days.length, ...r.days); const st = page.scrollTop; await draw(); } catch (er) { c.checked = !c.checked; toast(er.message, 'err'); } } if (c.id === 'md' && c.value) { sel = App._mday = c.value; draw(); } };
    $('#kp').onclick = () => printNow($('#kitchen'));
  };
  async function allDays(vid, meal, undo) {
    if (!(await confirmBox(undo ? `إعادة ${MEAL_AR[meal]} لهذا الزائر في كل الأيام؟` : `استثناء هذا الزائر من ${MEAL_AR[meal]} في كل أيام إقامته؟`))) return;
    await api('POST', '/meal-exclusions', { visitor_id: vid, date: '*', meals: [meal], excluded: !undo }); toast(undo ? 'تمت الإعادة' : 'تم الاستثناء'); const r = await api('GET', '/meals?event_id=' + App.eventId); days.splice(0, days.length, ...r.days); draw();
  }
  await draw();
});
