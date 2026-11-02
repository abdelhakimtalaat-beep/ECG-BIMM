import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { syncEmployee } from '@/lib/calendarSync';

export const maxDuration = 60;
/** "Sync now": your own calendar, or (Administrator / BIM Manager) every connected calendar. */
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser(); const b = z.object({ all: z.boolean().optional() }).parse(await json(req).catch(() => ({})));
    if (b.all) {
      if (me.role !== 'admin' && me.role !== 'bim_manager') throw new ApiError(403, 'Only the Administrator or a BIM Manager can sync every calendar.');
      const ids = (await q<{ employee_id: string }>('select employee_id from calendar_feeds')).map((r) => r.employee_id);
      const res = await Promise.all(ids.map((i) => syncEmployee(i))); return ok({ synced: res.filter((r) => r.ok).length, failed: res.filter((r) => !r.ok).length });
    }
    if (!me.employee_id) throw new ApiError(400, 'Your account is not linked to an employee record.');
    const r = await syncEmployee(me.employee_id); if (!r.ok) throw new ApiError(400, r.error ?? 'Sync failed'); return ok({ synced: 1, count: r.count });
  });
}
