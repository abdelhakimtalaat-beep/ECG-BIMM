'use strict';
// عميل Supabase خفيف (بدون مكتبات): تسجيل الدخول، تجديد الجلسة، واستدعاء دالة api في قاعدة البيانات
const SB = (() => {
  const cfg = () => window.GAOUK_CONFIG || {};
  const KEY = 'gaouk_session';
  const store = (() => { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; } catch (_) { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => (m[k] = v), removeItem: k => delete m[k] }; } })();
  const DEV = 'gaouk_device', MODE = 'gaouk_mode';   // MODE=pw: جلسة المشرف بكلمة المرور على جهاز مربوط (لا تُستبدل بحساب الجهاز تلقائياً)
  const pw = () => store.getItem(MODE) === 'pw';
  const dev = () => { try { return JSON.parse(store.getItem(DEV) || 'null'); } catch (_) { return null; } };
  let sess = null; try { sess = JSON.parse(store.getItem(KEY) || 'null'); } catch (_) {}
  const save = s => { sess = s; if (s) store.setItem(KEY, JSON.stringify(s)); else store.removeItem(KEY); };
  const hdr = extra => ({ apikey: cfg().SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...extra });
  const err = (status, message, extra) => Object.assign(new Error(message), { status, data: { error: message, ...extra } });
  const configured = () => cfg().SUPABASE_URL && !/YOUR-PROJECT/.test(cfg().SUPABASE_URL) && cfg().SUPABASE_ANON_KEY && !/YOUR-ANON/.test(cfg().SUPABASE_ANON_KEY);

  async function raw(path, init) {
    try { return await fetch(cfg().SUPABASE_URL + path, init); } catch (_) { throw err(0, 'تعذر الاتصال بالخادم. تحقق من الإنترنت'); }
  }
  function setSession(j) { save({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000 }); }

  async function login(username, password) {
    if (!configured()) throw err(0, 'لم يتم ضبط ملف config.js بعد (رابط المشروع والمفتاح)');
    const r = await raw('/auth/v1/token?grant_type=password', { method: 'POST', headers: hdr(), body: JSON.stringify({ email: (/^[+\d\s()-]+$/.test(String(username).trim()) ? String(username).replace(/\D/g, '') : String(username).trim().toLowerCase()) + '@gaouk.app', password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw err(r.status === 400 ? 401 : r.status, 'بيانات الدخول غير صحيحة، أو أن طلب انضمامك ما زال قيد المراجعة');
    setSession(j);
  }
  async function refresh() {
    if (!sess || !sess.refresh_token) throw err(401, 'انتهت الجلسة');
    const r = await raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: hdr(), body: JSON.stringify({ refresh_token: sess.refresh_token }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { save(null); throw err(401, 'انتهت الجلسة'); }
    setSession(j);
  }
  // الجهاز المربوط يدخل تلقائياً بمفتاحه السري المحفوظ (لا كلمة مرور)
  async function relogin() { const d = dev(); if (!d || pw()) return false; try { await login(d.u, d.s); return true; } catch (e) { if (e.status === 401) store.removeItem(DEV); return false; } }
  async function token() {
    if (!sess && !(await relogin())) throw err(401, 'يجب تسجيل الدخول');
    if (sess.expires_at - Date.now() < 60000) { try { await refresh(); } catch (e) { if (!(await relogin())) throw e; } }
    return sess.access_token;
  }
  async function logout() {
    try { if (sess) await raw('/auth/v1/logout', { method: 'POST', headers: hdr({ Authorization: 'Bearer ' + sess.access_token }) }); } catch (_) {}
    const keep = pw(); save(null); store.removeItem(MODE); if (!keep) store.removeItem(DEV);   // خروج المشرف لا يفك ربط جهاز المستخدم
  }
  async function loginPassword(u, p) { await login(u, p); store.setItem(MODE, 'pw'); }
  async function useDevice() { store.removeItem(MODE); save(null); return relogin(); }
  async function switchToPassword() { try { if (sess) await raw('/auth/v1/logout', { method: 'POST', headers: hdr({ Authorization: 'Bearer ' + sess.access_token }) }); } catch (_) {} save(null); store.setItem(MODE, 'pw'); }
  async function setPassword(pw) {
    const r = await raw('/auth/v1/user', { method: 'PUT', headers: hdr({ Authorization: 'Bearer ' + (await token()) }), body: JSON.stringify({ password: pw }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw err(r.status, j.msg || j.message || j.error_description || 'تعذر تغيير كلمة المرور');
  }
  // استدعاء نقطة الدخول الوحيدة public.api
  async function rpc(method, path, query, body, retry = true) {
    const r = await raw('/rest/v1/rpc/api', { method: 'POST', headers: hdr({ Authorization: 'Bearer ' + (await token()) }), body: JSON.stringify({ p_method: method, p_path: path, p_query: query || {}, p_body: body || {} }) });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const code = j && j.code, msg = (j && (j.message || j.msg)) || 'خطأ في الخادم';
      if ((code === 'PT401' || code === 'PGRST301' || r.status === 401) && retry) {
        let ok = false; if (sess) { try { await refresh(); ok = true; } catch (_) {} }
        if (!ok) ok = await relogin(); if (ok) return rpc(method, path, query, body, false);
      }
      if (code === 'PT401' || code === 'PGRST301' || r.status === 401) { save(null); throw err(401, msg === 'JWT expired' ? 'انتهت الجلسة' : msg); }
      if (code === 'PT403') throw err(403, msg);
      if (code === 'PT404') throw err(404, msg);
      if (code === '42501') throw err(403, 'غير مصرح');
      throw err(400, msg);
    }
    if (j && typeof j === 'object' && j._status) throw err(j._status, j.error || 'خطأ', j);
    return j;
  }
  // طلب انضمام: لا يحتاج تسجيل دخول (ينشئ حساباً معلقاً حتى يقبله المشرف)
  const newSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  async function joinRequest(p) {
    if (!configured()) throw err(0, 'لم يتم ضبط ملف config.js بعد (رابط المشروع والمفتاح)');
    const secret = newSecret();
    const r = await raw('/rest/v1/rpc/join_request', { method: 'POST', headers: hdr(), body: JSON.stringify({ p_name: p.name, p_phone: p.phone, p_secret: secret }) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw err(400, (j && (j.message || j.msg)) || 'تعذر إرسال الطلب، حاول لاحقاً');
    store.setItem(DEV, JSON.stringify({ u: j.username, s: secret }));   // الجهاز الذي أرسل الطلب هو الجهاز المربوط
    return j;
  }
  // تفعيل الجهاز برمز المشرف: يولّد المتصفح مفتاحاً سرياً عشوائياً يصبح كلمة مرور الحساب، وبذلك لا يعمل الحساب إلا على هذا الجهاز
  async function activate(p) {
    if (!configured()) throw err(0, 'لم يتم ضبط ملف config.js بعد (رابط المشروع والمفتاح)');
    const secret = newSecret();
    const r = await raw('/rest/v1/rpc/activate_device', { method: 'POST', headers: hdr(), body: JSON.stringify({ p_name: p.name, p_phone: p.phone, p_code: p.code, p_secret: secret }) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw err(400, (j && (j.message || j.msg)) || 'تعذر التفعيل، حاول لاحقاً');
    if (j && j.error) throw err(400, j.error);
    store.setItem(DEV, JSON.stringify({ u: j.username, s: secret }));
    try { await login(j.username, secret); } catch (e) { store.removeItem(DEV); throw e; }
    return j;
  }
  // استدعاء دالة عامة (مثل admin_issue_code) بجلسة المستخدم
  async function call(fn, args) {
    const r = await raw('/rest/v1/rpc/' + fn, { method: 'POST', headers: hdr({ Authorization: 'Bearer ' + (await token()) }), body: JSON.stringify(args || {}) });
    const j = await r.json().catch(() => null);
    if (!r.ok) { const m = (j && (j.message || j.msg)) || 'خطأ في الخادم'; throw err(j && j.code === 'PT403' ? 403 : 400, m); }
    return j;
  }
  return { login, loginPassword, useDevice, switchToPassword, pwMode: pw, logout, rpc, setPassword, joinRequest, activate, call, hasDevice: () => !!dev(), configured, hasSession: () => !!sess };
})();
