// The un-cropped original of a project / employee photo, kept so the photo can be re-cropped later without losing quality.
// Stored as an attachment (kind 'photo_original', filename = the owner's id); no schema change.
import { z } from 'zod';
import { handle, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { one, tx } from '@/lib/db';
import { assertScope } from '@/lib/perm';
import { sniffImage } from '@/lib/files';

export const dynamic = 'force-dynamic';
const params = (req: Request) => { const sp = new URL(req.url).searchParams; return z.object({ kind: z.enum(['employee', 'project']), id: z.string().uuid() }).parse({ kind: sp.get('kind'), id: sp.get('id') }); };
async function allow(me: any, kind: 'employee' | 'project', id: string) {
  if (kind === 'employee') { if (me.role !== 'admin' && me.employee_id !== id) throw new ApiError(403, 'You can only edit your own photo'); }
  else await assertScope(me, id, 'coordinator');
}
export async function GET(req: Request) {
  return handle(async () => {
    const me = await requireUser(); const { kind, id } = params(req);
    const a = await one<any>(`select mime,data from attachments where kind='photo_original' and filename=$1 order by created_at desc limit 1`, [`${kind}:${id}`]);
    if (!a) throw new ApiError(404, 'No original photo');
    void me; return new Response(new Uint8Array(a.data), { headers: { 'Content-Type': a.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  });
}
export async function PUT(req: Request) {
  return handle(async () => {
    const me = await requireUser(); const { kind, id } = params(req); await allow(me, kind, id);
    const buf = Buffer.from(await req.arrayBuffer()); const mime = sniffImage(buf);
    if (!mime) throw new ApiError(400, 'Only PNG, JPEG or WebP images are accepted');
    if (buf.length > 4 * 1024 * 1024) throw new ApiError(400, 'Image must be 4 MB or smaller');
    await tx(async (c) => {
      await c.query(`delete from attachments where kind='photo_original' and filename=$1`, [`${kind}:${id}`]);
      await c.query(`insert into attachments(kind,filename,mime,size_bytes,data,created_by) values('photo_original',$1,$2,$3,$4,$5)`, [`${kind}:${id}`, mime, buf.length, buf, me.email]);
    });
    return ok();
  });
}
export async function DELETE(req: Request) {
  return handle(async () => { const me = await requireUser(); const { kind, id } = params(req); await allow(me, kind, id); await one(`with d as (delete from attachments where kind='photo_original' and filename=$1 returning 1) select count(*) from d`, [`${kind}:${id}`]); return ok(); });
}
