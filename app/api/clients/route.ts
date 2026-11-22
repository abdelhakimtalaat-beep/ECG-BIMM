import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { clientKey } from '@/lib/clients';

export const dynamic = 'force-dynamic';
const body = z.object({ name: z.string().trim().min(1).max(200), country: z.string().trim().max(120).nullish() });
/** Administrator / BIM Manager: add a client by hand. */
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser(['admin', 'bim_manager']); const b = body.parse(await json(req)); const key = clientKey(b.name); if (!key) throw new ApiError(400, 'Enter the client name');
    if (await one('select 1 from clients where key=$1', [key])) throw new ApiError(409, 'This client already exists');
    const r = await one<{ id: string }>('insert into clients(name,key,country) values($1,$2,$3) returning id', [b.name, key, b.country || null]);
    await audit(null, me.email, 'create', 'client', r!.id, `Client added: ${b.name}`); return ok({ id: r!.id });
  });
}
