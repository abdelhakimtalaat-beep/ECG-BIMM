import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { audit, q } from '@/lib/db';
import { getGuestCfg, saveGuestCfg } from '@/lib/guestServer';
import { parseDomains } from '@/lib/guest';
import { TAB_HREFS } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
const guests = () => q('select id,email,full_name,active,last_login_at,created_at from users where is_guest order by last_login_at desc nulls last, email limit 500');
/** Administrator: general-access settings (on/off, e-mail domains, tabs) and the list of guests. */
export async function GET() { return handle(async () => { await requireUser(['admin']); return ok({ cfg: await getGuestCfg(), guests: await guests() }); }); }
const body = z.object({
  enabled: z.boolean().optional(), tabs: z.array(z.string()).max(40).optional(), domains: z.union([z.string().max(2000), z.array(z.string().max(100)).max(50)]).optional(),
  set_active: z.object({ id: z.string().uuid(), active: z.boolean() }).optional(),
});
export async function PUT(req: Request) {
  return handle(async () => {
    const me = await requireUser(['admin']); const b = body.parse(await json(req));
    if (b.set_active) { await q('update users set active=$2 where id=$1 and is_guest', [b.set_active.id, b.set_active.active]); await audit(null, me.email, 'update', 'guest', b.set_active.id, b.set_active.active ? 'Guest unblocked' : 'Guest blocked'); }
    else {
      const cur = await getGuestCfg();
      const next = { enabled: b.enabled ?? cur.enabled, tabs: b.tabs ? b.tabs.filter((t) => TAB_HREFS.includes(t) && t !== '/admin' && t !== '/troubleshooting') : cur.tabs, domains: b.domains !== undefined ? parseDomains(b.domains) : cur.domains };
      await saveGuestCfg(next); await audit(null, me.email, 'update', 'guest_access', null, `General access ${next.enabled ? 'ON' : 'OFF'}; ${next.tabs.length} tab(s); domains: ${next.domains.join(', ') || 'any'}`);
    }
    return ok({ cfg: await getGuestCfg(), guests: await guests() });
  });
}
