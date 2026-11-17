import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, q } from '@/lib/db';
import { exchangeCode, findHub, seal, setupRequests } from '@/lib/accApi';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
/** Autodesk sends the administrator back here with a one-time code. */
export async function GET(req: Request) {
  return handle(async () => {
   try {
    const me = await requireUser(['admin']); const url = new URL(req.url);
    const done = (msg: string) => NextResponse.redirect(new URL(`/admin?acc=${encodeURIComponent(msg)}`, req.url));
    if (url.searchParams.get('error')) return done('Autodesk sign-in was cancelled: ' + (url.searchParams.get('error_description') || url.searchParams.get('error')));
    const state = url.searchParams.get('state'), code = url.searchParams.get('code');
    const cookie = /(?:^|;\s*)acc_state=([^;]+)/.exec(req.headers.get('cookie') ?? '')?.[1];
    if (!code || !state || !cookie || cookie !== state) throw new ApiError(400, 'The sign-in could not be verified. Start again from Administration > ACC.');
    const redirect = process.env.APS_CALLBACK_URL || new URL('/api/acc/callback', req.url).toString();
    const t = await exchangeCode(code, redirect); if (!t.refresh_token) throw new ApiError(502, 'Autodesk did not return a refresh token');
    const hub = await findHub(t.access_token);
    await q(`insert into acc_connection(id,account_id,hub_name,refresh_token,connected_by,connected_at,request_id,last_status,last_error) values(1,$1,$2,$3,$4,now(),null,'connected',null)
      on conflict (id) do update set account_id=excluded.account_id,hub_name=excluded.hub_name,refresh_token=excluded.refresh_token,connected_by=excluded.connected_by,connected_at=now(),request_id=null,last_status='connected',last_error=null`, [hub.account_id, hub.name, seal(t.refresh_token), me.email]);
    let note = 'connected'; try { note = 'connected. ' + (await setupRequests(t.access_token, hub.account_id)).message; } catch (e: any) { note = 'connected, but setting up the projects failed: ' + String(e?.message ?? e).slice(0, 250); }
    await audit(null, me.email, 'update', 'acc', null, `ACC connected (hub ${hub.name})`);
    const res = done(note); res.cookies.set('acc_state', '', { path: '/api/acc', maxAge: 0 }); return res;
   } catch (e: any) { if (e instanceof ApiError && e.status === 401) throw e; return NextResponse.redirect(new URL(`/admin?acc=${encodeURIComponent(String(e?.message ?? e).slice(0, 400))}`, req.url)); }   // show the reason in Administration > ACC instead of a raw error page
  });
}
