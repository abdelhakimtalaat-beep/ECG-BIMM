import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireTab } from '@/lib/auth';
import { audit, q } from '@/lib/db';
import { cleanLabels } from '@/lib/evaluation';

/** Administrator: change the wording of the evaluation items and section titles (applies to every evaluation; empty text = back to the original). */
export async function PUT(req: Request) {
  return handle(async () => {
    const me = await requireTab('/evaluation'); if (me.role !== 'admin') throw new ApiError(403, 'Only the Administrator can edit the evaluation items');
    const b = z.object({ items: z.record(z.string(), z.string().max(300)), sections: z.record(z.string(), z.string().max(200)) }).parse(await json(req));
    const v = cleanLabels(b);
    await q(`insert into app_settings(key,value,updated_at) values('evaluation_labels',$1,now()) on conflict (key) do update set value=excluded.value, updated_at=now()`, [JSON.stringify(v)]);
    await audit(null, me.email, 'update', 'evaluation_items', null, `Edited the evaluation item wording (${Object.keys(v.items).length} item(s), ${Object.keys(v.sections).length} section title(s) changed)`);
    return ok(v);
  });
}
