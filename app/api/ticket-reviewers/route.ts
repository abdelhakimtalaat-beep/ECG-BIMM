import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, q } from '@/lib/db';
import { getReviewerIds, saveReviewerIds } from '@/lib/ticketAccess';

export const dynamic = 'force-dynamic';
const users = () => q<{ id: string; name: string; email: string; role: string }>(`select id, coalesce(full_name, email) as name, email, role from users where active and not coalesce(is_guest,false) order by lower(coalesce(full_name, email))`).catch(() => q<{ id: string; name: string; email: string; role: string }>(`select id, coalesce(full_name, email) as name, email, role from users where active order by lower(coalesce(full_name, email))`));
/** Administrator: the people who review, edit and confirm the answers of BIM tickets (besides the Administrators). */
export async function GET() { return handle(async () => { await requireUser(['admin']); return ok({ ids: await getReviewerIds(), users: await users() }); }); }
export async function PUT(req: Request) {
  return handle(async () => {
    const me = await requireUser(['admin']); const b = z.object({ ids: z.array(z.string().uuid()).max(50) }).parse(await json(req));
    const valid = new Set((await users()).map((u) => u.id)); const ids = [...new Set(b.ids)].filter((i) => valid.has(i)); if (ids.length !== new Set(b.ids).size) throw new ApiError(400, 'A chosen user was not found or is not active');
    await saveReviewerIds(ids); await audit(null, me.email, 'update', 'settings', null, `BIM Ticket reviewers: ${ids.length} person(s)`); return ok({ ids });
  });
}
