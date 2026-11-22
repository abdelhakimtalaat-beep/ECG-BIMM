'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';

export default function Login() {
  const r = useRouter(); const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [guestOn, setGuestOn] = useState(false); const [mode, setMode] = useState<'password' | 'otp'>('password'); const [sent, setSent] = useState(false); const [code, setCode] = useState('');
  useEffect(() => { api('/api/auth/guest-config').then((g) => setGuestOn(!!g.enabled)).catch(() => {}); }, []);
  useEffect(() => { api('/api/auth/setup').then((s) => s.needsSetup && r.replace('/setup')).catch(() => {}); }, [r]);
  const sendCode = async () => { setBusy(true); setErr(''); try { await api('/api/auth/otp/request', { body: { email } }); setSent(true); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  const verifyCode = async () => { setBusy(true); setErr(''); try { await api('/api/auth/otp/verify', { body: { email, code } }); r.push('/'); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  if (mode === 'otp') return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-4">
      <form className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl" onSubmit={(e) => { e.preventDefault(); sent ? verifyCode() : sendCode(); }}>
        <img src="/api/logo" alt="ECG – Engineering Consultants Group, A Dorsch Global Company" className="mx-auto mb-6 h-16 object-contain" />
        <h1 className="text-center text-lg font-semibold text-brand-900">BIM Department Management Portal</h1>
        <p className="mb-6 mt-1 text-center text-sm text-slate-500">{sent ? 'Enter the 6-digit code we e-mailed you' : 'View-only access with a one-time password'}</p>
        <label className="label" htmlFor="gemail">Email</label><input id="gemail" type="email" required autoComplete="email" className="input mb-4" value={email} disabled={sent} onChange={(e) => setEmail(e.target.value)} />
        {sent && <><label className="label" htmlFor="gcode">One-time password</label><input id="gcode" inputMode="numeric" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus autoComplete="one-time-code" className="input mb-4 text-center text-xl tracking-[0.4em]" value={code} onChange={(e) => setCode(e.target.value)} /></>}
        {err && <p role="alert" className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : sent ? 'Verify and continue' : 'Send me a code'}</button>
        {sent && <button type="button" className="btn-ghost mt-2 w-full text-sm" disabled={busy} onClick={() => { setSent(false); setCode(''); setErr(''); }}>Use another e-mail / send a new code</button>}
        <button type="button" className="mt-3 w-full text-center text-sm text-brand-700 underline" onClick={() => { setMode('password'); setSent(false); setCode(''); setErr(''); }}>Back to password sign-in</button>
      </form>
    </div>);
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-4">
      <form className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await api('/api/auth/login', { body: { email, password: pw } }); r.push('/'); } catch (x: any) { setErr(x.message); setBusy(false); } }}>
        <img src="/api/logo" alt="ECG – Engineering Consultants Group, A Dorsch Global Company" className="mx-auto mb-6 h-16 object-contain" />
        <h1 className="text-center text-lg font-semibold text-brand-900">BIM Department Management Portal</h1>
        <p className="mb-6 mt-1 text-center text-sm text-slate-500">Sign in to continue</p>
        <label className="label" htmlFor="email">Email</label><input id="email" type="email" required autoComplete="username" className="input mb-4" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="label" htmlFor="pw">Password</label><input id="pw" type="password" required autoComplete="current-password" className="input mb-4" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p role="alert" className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {guestOn && <button type="button" className="mt-3 w-full text-center text-sm text-brand-700 underline" onClick={() => { setMode('otp'); setErr(''); }}>No account? View-only access with a one-time password</button>}
      </form>
    </div>
  );
}
