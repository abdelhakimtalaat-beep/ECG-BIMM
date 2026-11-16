'use strict';
// عنوان التطبيق: صورة شفافة بلونين (داكن للخلفيات الفاتحة، وفاتح للقائمة الجانبية)
const WORDMARK = '<img class="wordmark" src="title.png" alt="جاؤوك">', WORDMARK_LIGHT = '<img class="wordmark" src="title-light.png" alt="جاؤوك">';
// «جاؤوك» — النواة: الاتصال بالخادم، الصلاحيات، الهيكل العام، أدوات مشتركة
const App = { user: null, roleLabels: {}, events: [], eventId: null, countries: [], views: {}, nav: [], cache: {} };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const dayName = s => (s ? DAYS[new Date(s + 'T00:00:00Z').getUTCDay()] : '');
const CAT = { individual: 'فرد', family_head: 'رب أسرة', family_member: 'تابع لأسرة', group_member: 'عضو في فوج' };
const TASK_STATUS = { not_started: 'لم يبدأ', on_the_way: 'في الطريق', received: 'تم الاستقبال', done: 'انتهت المهمة' };
const MEAL_AR = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };
const STATE_AR = { free: 'متاحة', partial: 'مشغولة جزئياً', full: 'مكتملة', unavailable: 'خارج الخدمة' };
const ACTION_AR = { create: 'إضافة', update: 'تعديل', delete: 'حذف', transfer: 'نقل غرفة', login: 'دخول', login_failed: 'دخول فاشل', export: 'تصدير', import: 'استيراد', report: 'تقرير', backup: 'نسخ احتياطي', meal_exclude: 'استثناء وجبة', meal_include: 'إلغاء استثناء' };
const ENTITY_AR = { visitor: 'زائر', booking: 'حجز غرفة', group: 'فوج', user: 'مستخدم', event: 'مناسبة', country: 'دولة', building: 'مبنى', floor: 'دور', room: 'غرفة', driver: 'سائق', transport: 'مهمة نقل', report: 'تقرير', system: 'النظام' };

// ---------- الاتصال ----------
class ApiError extends Error { constructor(status, data) { super(data.error || 'خطأ'); this.status = status; this.data = data; } }
async function api(method, url, body, opts = {}) {
  try { return await Adapter.call(method, url, body, opts, ApiError); }
  catch (e) {
    if (e instanceof ApiError && e.status === 401 && App.user && url !== '/login') { App.user = null; App.showLogin('انتهت الجلسة، سجّل الدخول مرة أخرى'); }
    throw e;
  }
}
async function download(url, filename) {
  try {
    const blob = await api('GET', url, undefined, { blob: true });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (e) { toast(e.message, 'err'); }
}
const qs = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

// ---------- واجهة مشتركة ----------
function toast(msg, type = '') {
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; $('#toasts').append(t);
  setTimeout(() => t.remove(), type === 'err' ? 6500 : 3500);
}
function modal({ title, body, buttons = [], width = 760, onClose, noClose }) {
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="modal" style="--w:${width}px" role="dialog" aria-modal="true"><div class="modal-h"><h2>${esc(title)}</h2>${noClose ? '' : '<button class="x" aria-label="إغلاق">×</button>'}</div><div class="modal-b"></div>${buttons.length ? '<div class="modal-f"></div>' : ''}</div>`;
  const b = $('.modal-b', ov); if (typeof body === 'string') b.innerHTML = body; else b.append(body);
  const close = () => { ov.remove(); document.removeEventListener('keydown', esc_); if (onClose) onClose(); };
  const esc_ = e => { if (e.key === 'Escape' && ov === [...document.querySelectorAll('.overlay')].pop()) close(); };
  if (!noClose) { $('.x', ov).onclick = close; document.addEventListener('keydown', esc_); }
  const api_ = { el: ov, body: b, close, setBusy(v) { $$('.modal-f button', ov).forEach(x => (x.disabled = v)); } };
  buttons.forEach(bt => {
    const el = document.createElement('button'); el.className = 'btn ' + (bt.cls || ''); el.textContent = bt.label; el.type = 'button';
    el.onclick = async () => { if (bt.close) return close(); api_.setBusy(true); try { await bt.onClick(api_); } catch (e) { if (!(e instanceof ApiError && e.status === 401)) toast(e.message, 'err'); } finally { api_.setBusy(false); } };
    $('.modal-f', ov).append(el);
  });
  document.body.append(ov); const f = $('input,select,textarea', b); if (f && !f.disabled && !noClose) f.focus();
  return api_;
}
function confirmBox(msg, { okText = 'تأكيد', danger = false, title = 'تأكيد' } = {}) {
  return new Promise(res => {
    let done = false; const fin = v => { if (!done) { done = true; res(v); } };
    modal({ title, width: 480, body: `<p style="margin:0;white-space:pre-line">${esc(msg)}</p>`, onClose: () => fin(false),
      buttons: [{ label: okText, cls: danger ? 'danger' : '', onClick: m => { fin(true); m.close(); } }, { label: 'إلغاء', cls: 'sec', close: true }] });
  });
}
const opts = (list, sel, ph) => (ph !== undefined ? `<option value="">${esc(ph)}</option>` : '') + list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(sel ?? '') ? ' selected' : ''}>${esc(l)}</option>`).join('');
const countryOpts = (sel, ph) => opts(App.countries.map(c => [c.id, c.name]), sel, ph);
function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') { if (el.name.endsWith('[]')) { const k = el.name.slice(0, -2); (o[k] ||= []); if (el.checked) o[k].push(el.value); } else o[el.name] = el.checked; }
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value;
  }
  return o;
}
const fmtDate = (d, t) => (d ? `<span class="ltr">${esc(d)}</span>${t ? ` <span class="muted ltr">${esc(t)}</span>` : ''}` : '<span class="muted">—</span>');
const roomLabel = b => `${b.building_name} / ${b.floor_name} / ${b.room_number}`;
const can = (...roles) => App.user && roles.includes(App.user.role);
const isMgr = () => can('admin', 'event_manager');
const curEvent = () => App.events.find(e => e.id === App.eventId) || null;
function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function printNow(target) {
  $$('.print-target').forEach(x => x.classList.remove('print-target'));
  if (target) { target.classList.add('print-target'); document.body.classList.add('print-one'); }
  const clean = () => { document.body.classList.remove('print-one'); $$('.print-target').forEach(x => x.classList.remove('print-target')); window.removeEventListener('afterprint', clean); };
  window.addEventListener('afterprint', clean); setTimeout(() => window.print(), 50);
}

// ---------- الأيقونات والقائمة ----------
const ICONS = {
  home: '<path d="M3 11 12 3l9 8M5 10v10h14V10"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.6 3-6 7-6s7 2.4 7 6M16 4.5a3.5 3.5 0 0 1 0 7M22 20c0-2.6-1.6-4.5-4-5.4"/>',
  bed: '<path d="M3 18V6M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11" r="1.6"/>', car: '<path d="M5 16 6.5 10a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5L19 16M3 16h18v3H3zM7 19v2M17 19v2"/>',
  meal: '<path d="M6 3v8a2 2 0 0 0 2 2v8M10 3v8M8 3v8M18 3c-2 2-3 5-3 8h3v10"/>', shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  build: '<path d="M4 21V8l8-5 8 5v13M9 21v-6h6v6M9 11h.01M15 11h.01"/>', log: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7"/>', key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3"/>', db: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
};
const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
App.nav = [
  ['dashboard', 'لوحة التحكم', 'home', null],
  ['events', 'المناسبات', 'cal', ['admin', 'event_manager']],
  ['visitors', 'الزائرون', 'users', ['admin', 'event_manager', 'country_supervisor', 'transport', 'catering', 'building_supervisor']],
  ['persons', 'قاعدة البيانات', 'db', ['admin', 'event_manager', 'country_supervisor']],
  ['housing', 'تسكين الغرف', 'bed', ['admin', 'event_manager', 'building_supervisor']],
  ['drivers', 'السائقون والسيارات', 'car', ['admin', 'event_manager', 'transport']],
  ['meals', 'الوجبات والإعاشة', 'meal', ['admin', 'event_manager', 'catering']],
  ['reports', 'التقارير والطباعة', 'chart', null],
  ['countries', 'الدول والجنسيات', 'globe', ['admin']],
  ['people', 'المستخدمون والمشرفون', 'shield', ['admin']],
  ['audit', 'سجل العمليات', 'log', ['admin']],
  ['system', 'النسخ الاحتياطي', 'db', ['admin']],
  ['account', 'حسابي', 'key', null],
];
App.view = (id, fn) => { App.views[id] = fn; };

// ---------- الدخول ----------
App.showLogin = function (msg) {
  document.body.classList.remove('printing-modal');
  $('#root').innerHTML = `<div class="login-wrap"><div class="login-card">
    <div class="brand"><h1 class="wm">${WORDMARK}<span class="sr">جاؤوك</span></h1></div>
    ${msg ? `<div class="alert warn">${esc(msg)}</div>` : ''}
    <div id="newbox" class="tc"><p class="muted" style="margin-top:0">${SB.hasDevice() ? 'هذا الجهاز مربوط بحساب. ادخل إلى حسابك، أو سجّل دخول المشرف بكلمة المرور من الأسفل.' : 'للدخول أرسل طلب انضمام باسمك ورقم هاتفك. وبمجرد موافقة المشرف يعمل التطبيق على هذا الجهاز تلقائياً.'}</p>
      ${SB.hasDevice() ? '<button type="button" class="btn dark" id="mydev" style="width:100%;justify-content:center;padding:11px">الدخول إلى حسابي على هذا الجهاز</button>' : '<button type="button" class="btn dark" id="joinbtn" style="width:100%;justify-content:center;padding:11px">طلب انضمام</button>'}</div>
    <form id="lf" autocomplete="on" hidden>
      <p class="muted small tc" style="margin-top:0">دخول المشرف العام بكلمة المرور</p>
      <div class="field"><label for="u">اسم المستخدم</label><input id="u" name="username" type="text" autocomplete="username" required dir="ltr" style="text-align:right"></div>
      <div class="field"><label for="p">كلمة المرور</label><input id="p" name="password" type="password" autocomplete="current-password" required dir="ltr" style="text-align:right"></div>
      <div id="lerr" class="alert err" hidden></div>
      <button class="btn dark" style="width:100%;justify-content:center;padding:11px">تسجيل الدخول</button></form>
    <div class="tc" style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--sand-d)">
      <button type="button" class="btn ghost sm" id="toadmin">دخول المشرف العام بكلمة المرور</button></div></div></div>`;
  if ($('#joinbtn')) $('#joinbtn').onclick = App.joinDialog;
  if ($('#mydev')) $('#mydev').onclick = async () => { if (await SB.useDevice()) App.start(); else toast('تعذر الدخول من هذا الجهاز. تواصل مع المشرف', 'err'); };
  const mode = m => { $('#newbox').hidden = m !== 'new'; $('#lf').hidden = m !== 'admin'; $('#toadmin').textContent = m === 'admin' ? 'العودة إلى طلب الانضمام' : 'دخول المشرف العام بكلمة المرور'; };
  $('#toadmin').onclick = () => mode($('#lf').hidden ? 'admin' : 'new');
  $('#lf').onsubmit = async e => {
    e.preventDefault(); const f = formData(e.target); const btn = $('button', e.target); btn.disabled = true;
    try { const r = await api('POST', '/login', f); App.user = r.user; await App.boot(); }
    catch (err) { const b = $('#lerr'); b.hidden = false; b.textContent = err.message; btn.disabled = false; }
  };
};

// قفل اختياري بالبصمة/الوجه (WebAuthn): قفل محلي على هذا الجهاز يمنع من يستعير الهاتف المفتوح من فتح التطبيق
const Bio = {
  KEY: 'gaouk_bio',
  enabled: () => { try { return !!localStorage.getItem(Bio.KEY); } catch (_) { return false; } },
  async supported() { try { return !!(window.PublicKeyCredential && window.isSecureContext && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (_) { return false; } },
  rnd: n => crypto.getRandomValues(new Uint8Array(n)),
  async enable() {
    const c = await navigator.credentials.create({ publicKey: { challenge: Bio.rnd(32), rp: { name: 'جاؤوك' }, user: { id: Bio.rnd(16), name: App.user.username, displayName: App.user.name },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' }, timeout: 60000 } });
    localStorage.setItem(Bio.KEY, btoa(String.fromCharCode(...new Uint8Array(c.rawId))));
  },
  async verify() {
    const id = Uint8Array.from(atob(localStorage.getItem(Bio.KEY)), ch => ch.charCodeAt(0));
    await navigator.credentials.get({ publicKey: { challenge: Bio.rnd(32), allowCredentials: [{ type: 'public-key', id }], userVerification: 'required', timeout: 60000 } });
  },
  disable() { try { localStorage.removeItem(Bio.KEY); } catch (_) {} },
  // شاشة القفل: لا يستمر التطبيق حتى تنجح البصمة
  gate() {
    return new Promise(res => {
      $('#root').innerHTML = `<div class="login-wrap"><div class="login-card tc"><div class="brand"><h1 class="wm">${WORDMARK}<span class="sr">جاؤوك</span></h1></div>
        <p class="muted">التطبيق مقفل. افتحه ببصمتك أو وجهك.</p><div id="gerr" class="alert err" hidden></div>
        <button class="btn dark" id="gbtn" style="width:100%;justify-content:center;padding:12px">فتح بالبصمة / الوجه</button>
      </div></div>`;
      const go = async () => { try { await Bio.verify(); res(); } catch (_) { $('#gerr').hidden = false; $('#gerr').textContent = 'لم يتم التحقق. حاول مرة أخرى'; } };
      $('#gbtn').onclick = go;
      go();
    });
  },
};
// عرض تفعيل البصمة بعد أول تفعيل للجهاز (اختياري)
App.offerBio = async function () {
  if (Bio.enabled() || !(await Bio.supported())) return;
  modal({ title: 'حماية إضافية (اختياري)', width: 440, body: '<div class="alert info" style="margin:0">هل تريد قفل التطبيق ببصمة الإصبع أو الوجه؟ هذا اختياري، ويمكنك تفعيله أو إيقافه لاحقاً من «حسابي».</div>',
    buttons: [{ label: 'تفعيل القفل', onClick: async m => { try { await Bio.enable(); toast('تم تفعيل القفل بالبصمة'); m.close(); } catch (e) { toast('لم يكتمل التفعيل: ' + (e.name === 'NotAllowedError' ? 'تم الإلغاء' : 'غير مدعوم'), 'err'); } } }, { label: 'ليس الآن', cls: 'sec', close: true }] });
};

// طلب الانضمام: يرسل الاسم والهاتف وبيانات الدخول، ولا يعمل الحساب حتى يقبله المشرف ويحدد صلاحياته
App.joinDialog = function () {
  const body = `<form id="jf" autocomplete="off"><p class="muted" style="margin-top:0">اكتب اسمك ورقم هاتفك فقط. سيصل طلبك إلى المشرف، وبمجرد موافقته يعمل التطبيق على هذا الجهاز تلقائياً دون رمز أو كلمة مرور.</p>
    <div class="field"><label>الاسم *</label><input name="name" required></div>
    <div class="field"><label>رقم الهاتف (مع مفتاح الدولة) *</label><input name="phone" type="tel" required dir="ltr" style="text-align:right" placeholder="+966500000000"></div></form>`;
  modal({ title: 'طلب انضمام', width: 460, body, buttons: [{ label: 'إرسال الطلب', onClick: async m => {
    const f = $('#jf', m.el); if (!f.reportValidity()) return;
    await api('POST', '/join-request', formData(f)); m.close(); App.showPending();
  } }, { label: 'إلغاء', cls: 'sec', close: true }] });
};

// شاشة الانتظار: الجهاز مربوط من لحظة إرسال الطلب، وتفتح الصفحة تلقائياً عند قبول المشرف
App.showPending = function () {
  document.body.classList.remove('printing-modal');
  $('#root').innerHTML = `<div class="login-wrap"><div class="login-card tc" id="pw">
    <div class="brand"><h1 class="wm">${WORDMARK}<span class="sr">جاؤوك</span></h1></div>
    <div class="alert info"><b>وصل طلبك إلى المشرف</b><br>بمجرد موافقته يُفتح التطبيق هنا تلقائياً على هذا الجهاز. اترك هذه الصفحة مفتوحة أو عد إليها لاحقاً.</div>
    <p class="muted small">الحساب مرتبط بهذا الجهاز فقط.</p>
    <button type="button" class="btn ghost sm" id="pcancel">إلغاء الطلب والعودة</button></div></div>`;
  let busy = false;
  const timer = setInterval(async () => {
    if (!$('#pw')) return clearInterval(timer);
    if (busy) return; busy = true;
    try { const r = await api('GET', '/me'); clearInterval(timer); App.user = r.user; await App.boot(); App.offerBio(); }
    catch (e) { if (!SB.hasDevice()) { clearInterval(timer); App.showLogin('لم يُقبل طلبك أو أُلغي. يمكنك إرسال طلب جديد'); } }
    busy = false;
  }, 4000);
  $('#pcancel').onclick = async () => { clearInterval(timer); await SB.logout(); App.showLogin(); };
};

// عدّاد طلبات الانضمام المعلقة (للمدير فقط) بجانب «المستخدمون والمشرفون»
App.refreshPending = async function () {
  if (!App.user || App.user.role !== 'admin') return;
  try {
    const { users } = await api('GET', '/users'); App.pendingCount = users.filter(u => u.status === 'pending').length;
    const a = document.querySelector('#nav a[data-id=people]'); if (!a) return;
    let b = a.querySelector('.nav-badge'); if (!b) { b = document.createElement('b'); b.className = 'nav-badge'; a.append(b); }
    b.textContent = App.pendingCount; b.hidden = !App.pendingCount;
  } catch (_) {}
};

// ---------- الإقلاع والهيكل ----------
App.start = async function () {
  const had = SB.hasDevice();
  if (Bio.enabled() && SB.hasDevice() && !SB.pwMode()) await Bio.gate();
  try { const r = await api('GET', '/me'); App.user = r.user; App.roleLabels = r.roles; await App.boot(); }
  catch (e) { if (SB.hasDevice() && !SB.pwMode() && /قيد المراجعة/.test(e.message || '')) return App.showPending(); App.showLogin(had && !SB.hasDevice() ? 'أُلغي ربط هذا الجهاز أو انتهت صلاحيته. تواصل مع المشرف' : undefined); }
};
App.boot = async function () {
  const [ev, co, me] = await Promise.all([api('GET', '/events'), api('GET', '/countries'), api('GET', '/me')]);
  App.events = ev.events; App.countries = co.countries; App.roleLabels = me.roles; App.user = me.user;
  const saved = parseInt(localStorage.getItem('gaouk_event') || '0', 10);
  App.eventId = App.events.find(e => e.id === saved)?.id || App.pickDefaultEvent();
  App.buildShell(); window.onhashchange = App.route; App.route(); App.startPulse(); App.refreshPending();
};
App.pickDefaultEvent = function () {
  const t = todayStr(); const e = App.events.find(x => x.start_date <= t && x.end_date >= t) || App.events.find(x => x.start_date >= t) || App.events[0]; return e ? e.id : null;
};
App.visibleNav = () => App.nav.filter(n => !n[3] || n[3].includes(App.user.role));
App.buildShell = function () {
  const u = App.user;
  $('#root').innerHTML = `<div class="app"><aside class="side" id="side">
    <div class="brand"><h1 class="wm">${WORDMARK_LIGHT}<span class="sr">جاؤوك</span></h1></div>
    <nav id="nav">${App.visibleNav().map(n => `<a data-id="${n[0]}" href="#/${n[0]}">${icon(n[2])}<span>${n[1]}</span></a>`).join('')}</nav>
    <div class="foot">${esc(App.roleLabels[u.role])}</div></aside>
    <div class="main"><header class="top"><button class="btn sec menu-btn" id="mb" aria-label="القائمة">☰</button>
      <div class="row"><span class="curev" id="curev"></span><select id="evsel" aria-label="المناسبة الحالية"></select></div><div class="grow"></div>
      <div class="user-chip"><span class="av">${esc(u.name.slice(0, 1))}</span><div><div style="font-weight:700;line-height:1.1">${esc(u.name)}</div><div class="muted small">${esc(App.roleLabels[u.role])}${u.role === 'country_supervisor' ? ' — ' + esc(App.countries.map(c => c.name).join('، ')) : ''}</div></div></div>
      ${SB.hasDevice() && !SB.pwMode() ? '<button class="btn sec sm" id="sw">دخول كمشرف</button>' : (SB.hasDevice() ? '<button class="btn sec sm" id="back">حسابي على هذا الجهاز</button> ' : '') + '<button class="btn sec sm" id="lo">خروج</button>'}</header><main class="page" id="page"></main></div></div>`;
  App.fillEventSelect();
  $('#evsel').onchange = e => { App.eventId = parseInt(e.target.value, 10) || null; localStorage.setItem('gaouk_event', App.eventId || ''); App.fillEventSelect(); App.route(); };
  if ($('#lo')) $('#lo').onclick = async () => {
    try { await api('POST', '/logout', {}); } catch (_) {} if (!SB.hasDevice()) Bio.disable(); App.user = null; App.showLogin();
  };
  if ($('#sw')) $('#sw').onclick = async () => { await SB.switchToPassword(); App.user = null; App.showLogin(); $('#toadmin').click(); };
  if ($('#back')) $('#back').onclick = async () => { await SB.logout(); if (await SB.useDevice()) { App.user = null; App.start(); } else App.showLogin(); };
  $('#mb').onclick = () => $('#side').classList.toggle('open');
  $('#nav').onclick = () => $('#side').classList.remove('open');
};
App.fillEventSelect = function () {
  const s = $('#evsel'); if (!s) return;
  const ce = App.events.find(e => e.id === App.eventId); const cb = $('#curev');
  if (cb) cb.innerHTML = ce ? `<span class="muted small">المناسبة الحالية</span> <b>${esc(ce.name)}</b> <span class="small">${esc(ce.start_date)} ← ${esc(ce.end_date)}</span>` : '<span class="muted small">لا توجد مناسبة حالية</span>';
  s.innerHTML = App.events.length ? App.events.map(e => `<option value="${e.id}"${e.id === App.eventId ? ' selected' : ''}>${esc(e.name)} (${e.start_date} ← ${e.end_date})</option>`).join('') : '<option value="">لا توجد مناسبات</option>';
};
App.reloadEvents = async function () { App.events = (await api('GET', '/events')).events; if (!App.events.find(e => e.id === App.eventId)) App.eventId = App.pickDefaultEvent(); App.fillEventSelect(); };
App.route = async function () {
  if (!App.user) return;
  const parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/'); let id = parts[0];
  if (!App.visibleNav().find(n => n[0] === id)) id = 'dashboard';
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.id === id));
  const page = $('#page'); if (!page) return;
  const token = (App._tok = (App._tok || 0) + 1);
  page.innerHTML = '<div class="empty">جاري التحميل…</div>';
  const needsEvent = !['events', 'people', 'countries', 'audit', 'system', 'account'].includes(id);
  if (needsEvent && !App.eventId) {
    page.innerHTML = `<div class="card empty"><h2>لا توجد مناسبة محددة</h2><p>${isMgr() ? 'أنشئ مناسبة أولاً من قسم «المناسبات».' : 'لم تُنشأ أي مناسبة بعد. تواصل مع مدير النظام.'}</p>${isMgr() ? '<a class="btn" href="#/events">إنشاء مناسبة</a>' : ''}</div>`; return;
  }
  try { await App.views[id](page, { sub: parts[1], token, stale: () => token !== App._tok }); }
  catch (e) { if (token === App._tok && !(e instanceof ApiError && e.status === 401)) page.innerHTML = `<div class="alert err">${esc(e.message)}</div>`; }
};
App.refresh = () => { App.route(); App.refreshPending && App.refreshPending(); };

// ---------- مكونات مشتركة ----------
function tabsHtml(items, cur) { return `<div class="tabs">${items.map(([k, l]) => `<button data-tab="${k}" class="${k === cur ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`; }
function bars(items, { max, alt } = {}) {
  const m = max || Math.max(1, ...items.map(i => i.n));
  return `<div class="bars">${items.map(i => `<div class="bar"><span>${esc(i.name)}</span><div class="track"><div class="fill${alt ? ' alt' : ''}" style="width:${Math.max(1, Math.round(i.n * 100 / m))}%"></div></div><b>${i.n}${i.suffix || ''}</b></div>`).join('') || '<div class="empty">لا توجد بيانات</div>'}</div>`;
}
function statCard(n, l, cls = '') { return `<div class="stat ${cls}"><div class="n">${n}</div><div class="l">${esc(l)}</div></div>`; }
const pickFile = accept => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0] || null); i.click(); });

App.planCache = {};
App.hydratePlans = async root => {
  for (const img of $$('img[data-plan]', root)) {
    const k = img.dataset.plan + ':' + (App._planV || 0);
    if (!App.planCache[k]) { try { App.planCache[k] = (await api('GET', `/floors/${img.dataset.plan}/plan`)).image; } catch (_) { continue; } }
    img.src = App.planCache[k];
  }
};

// ---------- التحديث التلقائي: مراقبة نشاط المستخدمين الآخرين كل 25 ثانية ----------
App.startPulse = function () {
  clearInterval(App._pulse); App._pulseLast = null;
  const tick = async () => {
    if (!App.user || document.hidden) return;
    try {
      const { last } = await api('GET', '/pulse');
      if (App._pulseLast === null) { App._pulseLast = last; return; }
      if (last !== App._pulseLast) {
        App._pulseLast = last;
        if (document.querySelector('.overlay') || document.querySelector('.mapbox.editing') || document.querySelector('.modal')) { App._pulseDirty = true; return; }
        App.showUpdateBar();
      }
    } catch (_) {}
  };
  App._pulse = setInterval(tick, 25000); tick();
};
App.showUpdateBar = function () {
  if (document.getElementById('upbar')) return;
  const d = document.createElement('div'); d.id = 'upbar'; d.className = 'toast'; d.style.cssText = 'cursor:pointer;background:#14532d;color:#fff';
  d.innerHTML = 'تم تحديث البيانات من مستخدم آخر — <b>اضغط للتحديث</b>';
  d.onclick = () => { d.remove(); App.refresh(); }; document.getElementById('toasts').append(d); setTimeout(() => d.remove(), 60000);
};
