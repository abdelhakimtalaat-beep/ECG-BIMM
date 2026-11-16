'use strict';
// المستخدمون ومشرفو الدول، الدول، التقارير، سجل العمليات، النسخ الاحتياطي

/* ================= المستخدمون والمشرفون ================= */
App.view('people', async (page, ctx) => {
  const [{ users }, { buildings }] = await Promise.all([api('GET', '/users'), api('GET', '/structure')]); if (ctx.stale()) return;
  const tab = ctx.sub || 'all';
  const groups = { all: null, requests: ['pending'], country: ['country_supervisor'], building: ['building_supervisor'], other: ['admin', 'event_manager', 'transport', 'catering'] };
  const inTab = (u, k) => k === 'all' ? true : k === 'requests' ? u.status === 'pending' : u.status !== 'pending' && groups[k].includes(u.role);
  const list = users.filter(u => inTab(u, tab));
  const lastSeen = ts => { if (!ts) return '<span class="muted small">لم يستخدمه بعد</span>'; const d = new Date(ts), z = n => String(n).padStart(2, '0'); return fmtDate(`${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`, `${z(d.getHours())}:${z(d.getMinutes())}`); };
  const stBadge = u => u.status === 'pending' ? '<span class="badge warn">قيد المراجعة</span>' : u.status === 'active' ? '<span class="badge ok">نشط</span>' : '<span class="badge bad">موقوف</span>';
  const titles = { all: 'جميع الأشخاص', requests: 'طلبات الانضمام', country: 'مشرفو الدول', building: 'مشرفو المباني', other: 'بقية المستخدمين' };
  page.innerHTML = `<div class="page-head"><h1>المستخدمون والمشرفون</h1><div class="grow"></div>${tab === 'requests' || tab === 'country' || tab === 'all' ? '' : `<button class="btn" id="add">+ ${tab === 'country' ? 'مشرف دولة جديد' : tab === 'building' ? 'مشرف مبنى جديد' : 'مستخدم جديد'}</button>`}</div>
    <div class="tabs">${Object.entries(titles).map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" onclick="location.hash='#/people/${k}'">${l} (${users.filter(u => inTab(u, k)).length})</button>`).join('')}</div>
    ${tab === 'country' ? '<div class="alert info">لكل دولة مشرف أو أكثر. يرى مشرف الدولة ويعدّل بيانات دولته فقط، ولا يطّلع على الدول الأخرى إلا إذا فوّضته هنا بدولة إضافية.</div>' : ''}
    ${tab === 'all' ? `<div class="alert info">كل من طلب الانضمام يظهر هنا، سواء قُبل أو لم يُقبل بعد، مع تاريخ انضمامه وآخر مرة استخدم فيها التطبيق. من هنا تقبل الطلب أو تغيّر الصلاحية أو توقف الحساب أو تحذفه.</div>
    <div class="table-wrap"><table><thead><tr><th>الاسم</th><th>رقم الهاتف</th><th>الصلاحية</th><th>الحالة</th><th>تاريخ الانضمام</th><th>آخر استخدام</th><th></th></tr></thead><tbody>
    ${list.map(u => `<tr><td><b>${esc(u.name)}</b></td><td><span class="ltr">${esc(u.phone)}</span></td><td>${u.status === 'pending' ? '<span class="muted">—</span>' : esc(App.roleLabels[u.role]) + (u.role === 'country_supervisor' && u.countries.length ? `<div class="muted small">${u.countries.map(c => esc(c.name)).join('، ')}</div>` : '')}</td><td>${stBadge(u)}</td>
      <td>${fmtDate(String(u.created_at).slice(0, 10))}</td><td>${lastSeen(u.last_seen_at)}</td>
      <td class="actions">${u.status === 'pending' ? `<button class="btn sm" data-a="${u.id}">قبول وتحديد الصلاحيات</button> <button class="btn sm danger" data-r="${u.id}">رفض</button>` : `<button class="btn sm sec" data-e="${u.id}">تغيير الصلاحية</button> ${u.id !== App.user.id ? `<button class="btn sm sec" data-t="${u.id}">${u.status === 'active' ? 'إيقاف' : 'تنشيط'}</button> <button class="btn sm danger" data-d="${u.id}">حذف</button>` : ''}`}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">لا يوجد أشخاص</td></tr>'}</tbody></table></div>` : ''}
    ${tab === 'requests' ? `<div class="alert info">كل من يفتح رابط التطبيق ويسجّل اسمه ورقم هاتفه يظهر هنا. لا يستطيع الدخول قبل قبولك له وتحديد صلاحياته (مشرف عام، أو مشرف دولة/دول، أو مشرف مبنى/مبانٍ).</div>
    <div class="table-wrap"><table><thead><tr><th>الاسم</th><th>رقم الهاتف</th><th>اسم المستخدم</th><th>تاريخ الطلب</th><th></th></tr></thead><tbody>
    ${list.map(u => `<tr><td><b>${esc(u.name)}</b></td><td><span class="ltr">${esc(u.phone)}</span></td><td><span class="ltr">${esc(u.username)}</span></td><td>${fmtDate(String(u.created_at).slice(0, 10))}</td>
      <td class="actions"><button class="btn sm" data-a="${u.id}">قبول وتحديد الصلاحيات</button> <button class="btn sm danger" data-r="${u.id}">رفض</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">لا توجد طلبات انضمام معلقة</td></tr>'}</tbody></table></div>` : tab === 'all' ? '' : `
    <div class="table-wrap"><table><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الهاتف / البريد</th>${tab === 'country' ? '<th>الدولة المسؤول عنها</th>' : tab === 'building' ? '<th>المباني والأدوار</th>' : '<th>الدور</th>'}<th>تاريخ الانضمام</th><th>الحالة</th><th></th></tr></thead><tbody>
    ${list.map(u => `<tr><td><b>${esc(u.name)}</b>${u.notes ? `<div class="muted small">${esc(u.notes)}</div>` : ''}</td><td><span class="ltr">${esc(u.username)}</span></td><td><span class="ltr">${esc(u.phone)}</span><div class="muted small ltr">${esc(u.email)}</div></td>
      <td>${tab === 'country' ? u.countries.map(c => `<span class="badge ${c.is_primary ? 'ok' : 'info'}">${esc(c.name)}${c.is_primary ? '' : ' (تفويض)'}</span>`).join(' ') : tab === 'building' ? floorsText(u.floors) : esc(App.roleLabels[u.role])}</td>
      <td>${fmtDate(String(u.created_at).slice(0, 10))}</td>
      <td><span class="badge ${u.status === 'active' ? 'ok' : 'bad'}">${u.status === 'active' ? 'نشط' : 'موقوف'}</span></td>
      <td class="actions"><button class="btn sm sec" data-e="${u.id}">تعديل</button> ${u.id !== App.user.id ? `<button class="btn sm sec" data-t="${u.id}">${u.status === 'active' ? 'إيقاف' : 'تنشيط'}</button> <button class="btn sm danger" data-d="${u.id}">حذف</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">لا توجد حسابات</td></tr>'}</tbody></table></div>`}`;
  const form = u => {
    const role0 = u ? u.role : (tab === 'country' ? 'country_supervisor' : tab === 'building' ? 'building_supervisor' : 'event_manager');
    const roleOpts = tab === 'other' || tab === 'all' ? Object.entries(App.roleLabels) : [[role0, App.roleLabels[role0]]];
    const prim = u?.countries.find(c => c.is_primary)?.id, extra = (u?.countries || []).filter(c => !c.is_primary).map(c => c.id), myF = (u?.floors || []).map(f => f.id);
    const body = `<form id="uf" autocomplete="off"><div class="fgrid"><div class="field"><label>الاسم *</label><input name="name" required value="${esc(u?.name)}"></div><div class="field"><label>رقم الهاتف</label><input name="phone" dir="ltr" style="text-align:right" value="${esc(u?.phone)}"></div>
      <div class="field"><label>البريد الإلكتروني</label><input type="email" name="email" dir="ltr" style="text-align:right" value="${esc(u?.email)}"></div><div class="field"><label>الدور</label><select name="role" id="rl">${opts(roleOpts, role0)}</select></div>
      <div class="field"><label>اسم المستخدم * (إنجليزي)</label><input name="username" required dir="ltr" style="text-align:right" pattern="[A-Za-z0-9_.\\-]{3,40}" value="${esc(u?.username)}" autocomplete="off"></div>
      <div class="field"><label>كلمة المرور ${u ? '(اتركها فارغة للإبقاء عليها)' : '*'}</label><input type="password" name="password" ${u ? '' : 'required'} minlength="8" autocomplete="new-password" dir="ltr" style="text-align:right"></div>
      <div class="field"><label>حالة الحساب</label><select name="status">${opts([['active', 'نشط'], ['suspended', 'موقوف']], u?.status || 'active')}</select></div>
      <div id="cbox" class="field full" ${role0 === 'country_supervisor' ? '' : 'hidden'}><div class="fgrid"><div class="field"><label>الدولة المسؤول عنها *</label><select name="country_id">${countryOpts(prim, 'اختر…')}</select></div>
        <div class="field"><label>دول إضافية مفوَّض بها (اختياري)</label><div class="sel-list" style="max-height:130px">${App.countries.map(c => `<label><input type="checkbox" name="extra_country_ids[]" value="${c.id}" ${extra.includes(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}</div></div></div></div>
      <div id="fbox" class="field full" ${role0 === 'building_supervisor' ? '' : 'hidden'}><label>الأدوار المسؤول عنها (يمكن أكثر من دور أو مبنى)</label><div class="sel-list" style="max-height:200px">${buildings.map(b => `<div style="padding:4px 10px;background:#f6f8ec;font-weight:700">${esc(b.name)}</div>${b.floors.map(f => `<label><input type="checkbox" name="floor_ids[]" value="${f.id}" ${myF.includes(f.id) ? 'checked' : ''}> ${esc(f.name)}</label>`).join('')}`).join('')}</div></div>
      <div class="field full"><label>ملاحظات</label><textarea name="notes" style="min-height:56px">${esc(u?.notes)}</textarea></div></div></form>`;
    const m = modal({ title: u ? 'تعديل: ' + u.name : 'حساب جديد', width: 760, body, buttons: [{ label: 'حفظ', onClick: async mm => {
      const f = $('#uf', mm.el); if (!f.reportValidity()) return; const b = formData(f);
      if (u) { if (!b.password) delete b.password; await api('PUT', '/users/' + u.id, b); } else await api('POST', '/users', b);
      mm.close(); toast('تم الحفظ'); App.refresh();
    } }, { label: 'إلغاء', cls: 'sec', close: true }] });
    $('#rl', m.el).onchange = e => { $('#cbox', m.el).hidden = e.target.value !== 'country_supervisor'; $('#fbox', m.el).hidden = e.target.value !== 'building_supervisor'; };
  };
  const approve = u => {
    const roles = [['admin', 'مشرف عام — يتحكم في كامل التطبيق'], ['country_supervisor', 'مشرف دولة — يختار دولة أو أكثر'], ['building_supervisor', 'مشرف مبنى — يختار مبنى أو أكثر'], ['event_manager', 'مدير مناسبات'], ['transport', 'مسؤول النقل'], ['catering', 'مسؤول الإعاشة']];
    const body = `<form id="af"><div class="alert info" style="margin-top:0"><b>${esc(u.name)}</b> — <span class="ltr">${esc(u.phone)}</span></div>
      <div class="field"><label>نوع الصلاحية *</label><select name="role" id="arl" required>${opts(roles, '', 'اختر الصلاحية…')}</select></div>
      <div id="acb" class="field" hidden><label>الدول المسؤول عنها * (يمكن اختيار أكثر من دولة)</label><div class="sel-list" style="max-height:220px">${App.countries.map(c => `<label><input type="checkbox" name="cids[]" value="${c.id}"> ${esc(c.name)}</label>`).join('') || '<div class="empty">لا توجد دول. أضفها من «الدول والجنسيات»</div>'}</div></div>
      <div id="abb" class="field" hidden><label>المباني المسؤول عنها * (يمكن اختيار أكثر من مبنى، ويشمل كل أدواره)</label><div class="sel-list" style="max-height:220px">${buildings.map(b => `<label><input type="checkbox" name="bids[]" value="${b.id}" data-f="${b.floors.map(f => f.id).join(',')}"> ${esc(b.name)} <span class="muted small">(${b.floors.length} أدوار)</span></label>`).join('')}</div></div></form>`;
    const m = modal({ title: 'قبول طلب الانضمام', width: 560, body, buttons: [{ label: 'قبول وتفعيل الحساب', onClick: async mm => {
      const f = $('#af', mm.el); if (!f.reportValidity()) return; const role = f.role.value;
      const b = { name: u.name, phone: u.phone, notes: u.notes, role, status: 'active' };
      if (role === 'country_supervisor') { const ids = $$('input[name="cids[]"]:checked', f).map(x => +x.value); if (!ids.length) return toast('اختر دولة واحدة على الأقل', 'warn'); b.country_id = ids[0]; b.extra_country_ids = ids.slice(1); }
      if (role === 'building_supervisor') { const fl = $$('input[name="bids[]"]:checked', f).flatMap(x => x.dataset.f.split(',').filter(Boolean).map(Number)); if (!fl.length) return toast('اختر مبنى واحداً على الأقل (له أدوار)', 'warn'); b.floor_ids = fl; }
      await api('PUT', '/users/' + u.id, b); mm.close(); App.refresh();
      toast('تم القبول. سيعمل التطبيق تلقائياً على جهاز ' + u.name);
    } }, { label: 'إلغاء', cls: 'sec', close: true }] });
    $('#arl', m.el).onchange = e => { $('#acb', m.el).hidden = e.target.value !== 'country_supervisor'; $('#abb', m.el).hidden = e.target.value !== 'building_supervisor'; };
  };
  if ($('#add')) $('#add').onclick = () => form();
  page.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; const id = +(b.dataset.e || b.dataset.t || b.dataset.d || b.dataset.a || b.dataset.r); const u = users.find(x => x.id === id); if (!u) return;
    if (b.dataset.a) return approve(u);
    if (b.dataset.r) { if (await confirmBox(`رفض طلب «${u.name}»؟ سيُحذف الطلب ولن يستطيع الدخول.`, { danger: true, okText: 'رفض' })) { await api('DELETE', '/users/' + id); toast('تم رفض الطلب'); App.refresh(); } return; }
    if (b.dataset.e) form(u);
    if (b.dataset.t) { await api('PUT', '/users/' + id, { ...u, country_id: u.countries.find(c => c.is_primary)?.id, extra_country_ids: u.countries.filter(c => !c.is_primary).map(c => c.id), floor_ids: u.floors.map(f => f.id), status: u.status === 'active' ? 'suspended' : 'active' }); toast(u.status === 'active' ? 'تم إيقاف الحساب' : 'تم تنشيط الحساب'); App.refresh(); }
    if (b.dataset.d && await confirmBox(`حذف حساب «${u.name}»؟ يبقى اسمه في سجل العمليات.`, { danger: true, okText: 'حذف' })) { await api('DELETE', '/users/' + id); toast('تم الحذف'); App.refresh(); }
  };
});
function floorsText(floors) {
  if (!floors.length) return '<span class="muted">لا شيء</span>';
  const m = new Map(); floors.forEach(f => (m.get(f.building_name) || m.set(f.building_name, []).get(f.building_name)).push(f.floor_name));
  return [...m.entries()].map(([b, fs]) => `<div><b>${esc(b)}:</b> ${esc(fs.join('، '))}</div>`).join('');
}

/* ================= الدول ================= */
App.view('countries', async (page, ctx) => {
  const [{ countries }, { users }] = await Promise.all([api('GET', '/countries'), api('GET', '/users')]); App.countries = countries;
  let stats = {}; if (App.eventId) { try { const r = await api('GET', `/reports/by_country?event_id=${App.eventId}`); r.rows.forEach(x => (stats[x.country] = x.total)); } catch (_) {} }
  if (ctx.stale()) return;
  page.innerHTML = `<div class="page-head"><h1>الدول والجنسيات</h1><div class="grow"></div><button class="btn" id="add">+ دولة</button></div>
    <div class="table-wrap"><table><thead><tr><th>الدولة</th><th>مفتاح الدولة</th><th>مشرفو الدولة</th><th>زائرو المناسبة الحالية</th><th></th></tr></thead><tbody>
    ${countries.map(c => { const sups = users.filter(u => u.role === 'country_supervisor' && u.countries.some(x => x.id === c.id && x.is_primary)); return `<tr><td><b>${esc(c.name)}</b></td><td><span class="ltr">${esc(c.dial_code)}</span></td><td>${sups.map(s => `<span class="badge ${s.status === 'active' ? 'ok' : 'bad'}">${esc(s.name)}</span>`).join(' ') || '<span class="badge warn">بلا مشرف</span>'}</td><td>${stats[c.name] || 0}</td><td class="actions"><button class="btn sm sec" data-e="${c.id}">تعديل</button> <button class="btn sm danger" data-d="${c.id}">حذف</button></td></tr>`; }).join('')}</tbody></table></div>`;
  const form = c => modal({ title: c ? 'تعديل دولة' : 'دولة جديدة', width: 460, body: `<form id="cf"><div class="field"><label>اسم الدولة *</label><input name="name" required value="${esc(c?.name)}"></div><div class="field"><label>مفتاح الدولة</label><input name="dial_code" dir="ltr" style="text-align:right" placeholder="+60" value="${esc(c?.dial_code)}"></div></form>`,
    buttons: [{ label: 'حفظ', onClick: async m => { const f = $('#cf', m.el); if (!f.reportValidity()) return; const b = formData(f); c ? await api('PUT', '/countries/' + c.id, b) : await api('POST', '/countries', b); m.close(); toast('تم الحفظ'); App.refresh(); } }, { label: 'إلغاء', cls: 'sec', close: true }] });
  $('#add').onclick = () => form();
  page.onclick = async e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.e) form(countries.find(x => x.id === +b.dataset.e)); if (b.dataset.d) { const c = countries.find(x => x.id === +b.dataset.d); if (await confirmBox(`حذف «${c.name}»؟`, { danger: true, okText: 'حذف' })) { await api('DELETE', '/countries/' + c.id); toast('تم الحذف'); App.refresh(); } } };
});

/* ================= التقارير ================= */
App.view('reports', async (page, ctx) => {
  const { reports } = await api('GET', '/report-list'); if (ctx.stale()) return;
  const R = (App._rp ||= { type: null, country_id: '', date: '', from: '', to: '', building_id: '' }); if (!reports.find(r => r.key === R.type)) R.type = reports[0]?.key;
  const needDate = ['rooms_status'], needRange = ['arrivals_departures', 'arrivals_counts', 'drivers_tasks'], needBld = ['housing'], needCountry = ['visitors_all', 'families_groups', 'arrivals_departures', 'arrivals_counts'];
  const structure = can('admin', 'event_manager', 'building_supervisor') ? (await api('GET', '/structure')).buildings : [];
  const cs = App.user.role === 'country_supervisor';
  page.innerHTML = `<div class="page-head"><h1>مركز التقارير</h1></div>${cs ? '<div class="alert info">التقارير تعرض بيانات دولتك فقط.</div>' : ''}
    <div class="card" style="margin-bottom:14px"><div class="filters" style="margin:0"><div><label>التقرير</label><select id="rt">${opts(reports.map(r => [r.key, r.title]), R.type)}</select></div>
    <div id="rc"><label>الدولة</label><select id="rcountry">${countryOpts(R.country_id, 'الكل')}</select></div><div id="rd"><label>التاريخ (اختياري)</label><input type="date" id="rdate" value="${R.date}"></div>
    <div id="rr"><label>الفترة: من</label><input type="date" id="rfrom" value="${R.from}"></div><div id="rr2"><label>إلى</label><input type="date" id="rto" value="${R.to}"></div><div id="rr3" style="align-self:flex-end"><button class="btn ghost sm" id="rall" type="button" style="white-space:nowrap">كل أيام المناسبة</button></div><div class="muted small" id="rr4" style="flex-basis:100%">الفترة: اترك «من» و«إلى» فارغين لكل أيام المناسبة، أو حدّد يوماً واحداً (نفس التاريخ في الحقلين) أو مجموعة أيام متتالية.</div>
    <div id="rb"><label>المبنى</label><select id="rbld">${opts(structure.map(b => [b.id, b.name]), R.building_id, 'الكل')}</select></div>
    <div class="row"><button class="btn" id="run">عرض</button></div></div></div><div id="out"></div>`;
  const sync = () => { R.type = $('#rt').value; $('#rc').hidden = !needCountry.includes(R.type) || cs && App.countries.length < 2; $('#rd').hidden = !needDate.includes(R.type); for (const i of ['rr', 'rr2', 'rr3', 'rr4']) $('#' + i).hidden = !needRange.includes(R.type); $('#rb').hidden = !needBld.includes(R.type); }; sync();
  $('#rt').onchange = () => { sync(); run(); };
  const params = () => ({ event_id: App.eventId, country_id: $('#rc').hidden ? '' : $('#rcountry').value, date: $('#rd').hidden ? '' : $('#rdate').value, date_from: $('#rr').hidden ? '' : $('#rfrom').value, date_to: $('#rr').hidden ? '' : $('#rto').value, building_id: $('#rb').hidden ? '' : $('#rbld').value });
  async function run() {
    R.country_id = $('#rcountry').value; R.date = $('#rdate').value; R.from = $('#rfrom').value; R.to = $('#rto').value; R.building_id = $('#rbld').value; const p = params();
    const d = await api('GET', `/reports/${R.type}?` + qs(p)); if (ctx.stale()) return;
    $('#out').innerHTML = `<div class="card" id="sheet"><div class="row no-print" style="margin-bottom:10px"><h2 style="margin:0">${esc(d.title)}</h2><span class="badge">${d.rows.length} سطر</span><div class="grow"></div><button class="btn" id="pdf">PDF — فتح ومشاركة</button><button class="btn sec" id="xl">تصدير Excel</button></div>
      <div class="print-only tc" style="margin-bottom:10px"><h2>جاؤوك — ${esc(d.title)}</h2><div>${esc(d.event)} ${d.subtitle ? '— ' + esc(d.subtitle) : ''}</div><div class="small">أُعدّ بواسطة ${esc(d.generated_by)} — ${new Date(d.generated_at).toLocaleString('ar-EG')}</div></div>
      ${d.subtitle ? `<div class="muted" style="margin-bottom:8px">${esc(d.subtitle)}</div>` : ''}<div class="table-wrap"><table><thead><tr>${d.columns.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>
      ${d.rows.map(r => `<tr${r.country === 'الإجمالي' || r.date === 'الإجمالي' ? ' style="font-weight:700;background:#fdf1b8"' : r.flight === 'إجمالي اليوم' ? ' style="font-weight:700;background:#f1f6df"' : ''}>${d.columns.map(c => `<td>${esc(r[c.key] ?? '')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${d.columns.length}" class="empty">لا توجد بيانات لهذا التقرير</td></tr>`}</tbody></table></div></div>`;
    $('#pdf').onclick = () => sharePdf(d, `gaouk-${R.type}-${todayStr()}.pdf`); $('#xl').onclick = () => download(`/reports/${R.type}?` + qs({ ...p, format: 'xlsx' }), `gaouk-${R.type}-${todayStr()}.xlsx`);
  }
  $('#rall').onclick = () => { $('#rfrom').value = ''; $('#rto').value = ''; run(); };
  $('#run').onclick = run; await run();
});

/* ================= سجل العمليات ================= */
const FIELD_AR = { full_name: 'الاسم', country_id: 'الدولة', phone: 'الهاتف', email: 'البريد', category: 'التصنيف', guide_name: 'المرشد', group_id: 'الفوج', arrival_date: 'تاريخ الوصول', arrival_time: 'وقت الوصول', departure_date: 'تاريخ المغادرة', flight_no: 'رقم الرحلة', airline: 'شركة الطيران', airport: 'المطار', needs_transport: 'يحتاج نقل', diet_notes: 'ملاحظات الطعام', notes: 'ملاحظات', relation: 'القرابة', is_leader: 'قائد الفوج', name: 'الاسم', username: 'اسم المستخدم', role: 'الدور', status: 'الحالة', capacity: 'السعة', number: 'رقم الغرفة', visitor: 'الزائر', room: 'الغرفة', from_room: 'من غرفة', to_room: 'إلى غرفة', from: 'من', to: 'إلى', password: 'كلمة المرور', members: 'عدد التابعين', removed_members: 'تابعون محذوفون', added_members: 'تابعون مضافون', start_date: 'البداية', end_date: 'النهاية', count: 'العدد', date: 'التاريخ', passengers: 'الركاب', driver: 'السائق', created: 'تمت إضافتهم', skipped: 'متخطاة', errors: 'أخطاء', meals: 'الوجبات', type: 'النوع', rows: 'الأسطر', countries: 'الدول' };
function detailsHtml(s) {
  let o; try { o = JSON.parse(s); } catch (_) { return esc(s); }
  const val = v => (Array.isArray(v) ? v.join('، ') : v === null || v === '' || v === undefined ? '—' : String(v));
  return Object.entries(o).map(([k, v]) => Array.isArray(v) && v.length === 2 && !['members', 'removed_members', 'added_members', 'meals', 'countries'].includes(k) ? `<div><b>${esc(FIELD_AR[k] || k)}:</b> <s class="muted">${esc(val(v[0]))}</s> ← ${esc(val(v[1]))}</div>` : `<div><b>${esc(FIELD_AR[k] || k)}:</b> ${esc(val(v))}</div>`).join('');
}
App.view('audit', async (page, ctx) => {
  const f = (App._af ||= { username: '', entity: '', action: '', country_id: '', from: '', to: '' });
  const users = (await api('GET', '/users')).users;
  page.innerHTML = `<div class="page-head"><h1>سجل العمليات</h1></div><div class="filters card" style="padding:12px"><div><label>المستخدم</label><select id="a_username">${opts(users.map(u => [u.username, `${u.name} (${u.username})`]), f.username, 'الكل')}</select></div>
    <div><label>العنصر</label><select id="a_entity">${opts(Object.entries(ENTITY_AR), f.entity, 'الكل')}</select></div><div><label>نوع العملية</label><select id="a_action">${opts(Object.entries(ACTION_AR), f.action, 'الكل')}</select></div>
    <div><label>الدولة</label><select id="a_country_id">${countryOpts(f.country_id, 'الكل')}</select></div><div><label>من تاريخ</label><input type="date" id="a_from" value="${f.from}"></div><div><label>إلى تاريخ</label><input type="date" id="a_to" value="${f.to}"></div></div><div id="alist"></div>`;
  const load = async () => {
    const { rows } = await api('GET', '/audit?' + qs({ ...f, limit: 500 })); if (ctx.stale()) return;
    $('#alist').innerHTML = `<div class="muted small" style="margin-bottom:6px">${rows.length} عملية (الأحدث أولاً)</div><div class="table-wrap"><table><thead><tr><th>التاريخ والوقت</th><th>المستخدم</th><th>العملية</th><th>العنصر</th><th>الدولة</th><th>التفاصيل</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><span class="ltr">${esc(new Date(r.at.replace(' ', 'T') + 'Z').toLocaleString('en-GB', { hour12: false }).replace(',', ''))}</span></td><td><b>${esc(r.username) || '—'}</b></td><td><span class="badge ${r.action === 'delete' || r.action === 'login_failed' ? 'bad' : r.action === 'create' ? 'ok' : ''}">${esc(ACTION_AR[r.action] || r.action)}</span></td><td>${esc(ENTITY_AR[r.entity] || r.entity)}${r.entity_id ? ` <span class="muted small">#${r.entity_id}</span>` : ''}</td><td>${esc(r.country_name) || ''}</td><td class="small">${detailsHtml(r.details)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">لا توجد عمليات</td></tr>'}</tbody></table></div>`;
  };
  $$('[id^=a_]', page).forEach(el => (el.onchange = () => { f[el.id.slice(2)] = el.value; load(); })); await load();
});

/* ================= النسخ الاحتياطي ================= */
App.view('system', async page => {
  page.innerHTML = `<div class="page-head"><h1>النسخ الاحتياطي</h1><div class="grow"></div><button class="btn" id="bk">تنزيل نسخة احتياطية كاملة الآن</button></div>
    <div class="alert info">قاعدة البيانات على Supabase. النسخة التي تنزّلها هنا ملف JSON يحوي كل الجداول (الزائرين، الحجوزات، الغرف، السائقين…) دون كلمات المرور. نزّلها دورياً وقبل أي مناسبة كبيرة وبعد انتهائها.</div>
    <div class="card"><h3>نسخ Supabase التلقائية</h3><p class="small">في الخطة المدفوعة (Pro) يحتفظ Supabase بنسخ يومية تلقائية للقاعدة كاملة تجدها في لوحة Supabase ← Database ← Backups. الخطة المجانية لا تتضمن نسخاً تلقائية، فاعتمد على التنزيل اليدوي من هنا.</p></div>
    <div class="card" style="margin-top:14px"><h3>الاستعادة</h3><p class="small">الاستعادة الكاملة تتم من لوحة Supabase (Restore) في الخطة المدفوعة، أو بإعادة تنفيذ ملفات SQL في مشروع جديد ثم إدراج بيانات ملف JSON بمساعدة المطور. لا تُجرِ استعادة أثناء مناسبة جارية دون الرجوع للمطور.</p></div>`;
  $('#bk').onclick = async () => {
    try { const blob = await api('POST', '/backup', {}, { blob: true }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `gaouk-backup-${todayStr()}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('تم تنزيل النسخة الاحتياطية'); }
    catch (e) { toast(e.message, 'err'); }
  };
});

/* PDF حقيقي من التقرير المعروض: يُفتح مباشرة ويمكن مشاركته (واتساب أو أي تطبيق) أو تنزيله */
async function sharePdf(d, name) {
  const w = window.open('', '_blank'); // يُفتح قبل الانتظار كي لا تحجبه المتصفحات
  const btn = $('#pdf'); const old = btn.textContent; btn.disabled = true;
  try {
    const blob = await Pdf.report(d, (i, n) => { btn.textContent = `جارٍ التجهيز ${i}/${n}…`; });
    const url = URL.createObjectURL(blob); const file = new File([blob], name, { type: 'application/pdf' });
    if (w) { try { w.location.href = url; } catch (_) {} }
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    const buttons = [];
    if (canShare) buttons.push({ label: 'مشاركة', onClick: async m => { try { await navigator.share({ files: [file], title: d.title }); m.close(); } catch (e) { if (e.name !== 'AbortError') toast('تعذّرت المشاركة، استخدم «فتح» أو «تنزيل»', 'warn'); } } });
    buttons.push({ label: 'فتح PDF', cls: canShare ? 'sec' : '', onClick: () => { window.open(url, '_blank'); } });
    buttons.push({ label: 'تنزيل', cls: 'sec', onClick: () => { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); } });
    buttons.push({ label: 'إغلاق', cls: 'sec', close: true });
    modal({ title: 'ملف PDF جاهز', width: 460, body: `<div class="alert ok">تم تجهيز «${esc(d.title)}» (${d.rows.length} سطر).${w ? ' فُتح في تبويب جديد.' : ''}</div><p class="muted small">${canShare ? 'اضغط «مشاركة» لاختيار واتساب أو أي تطبيق آخر.' : 'من المتصفح المفتوح يمكنك مشاركة الملف أو حفظه. «تنزيل» يحفظه على جهازك لترسله لمن تشاء.'}</p>`, buttons });
  } catch (e) { if (w) w.close(); toast(e.message || 'تعذّر إنشاء PDF', 'err'); }
  finally { btn.disabled = false; btn.textContent = old; }
}
