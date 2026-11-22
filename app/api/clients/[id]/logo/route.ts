import { z } from 'zod';
import { handle, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, tx } from '@/lib/db';
import { sniffImage } from '@/lib/files';

export const dynamic = 'force-dynamic';
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin', 'bim_manager']); const id = z.string().uuid().parse((await ctx.params).id);
    const buf = Buffer.from(await req.arrayBuffer()); const mime = sniffImage(buf); if (!mime) throw new ApiError(400, 'Only PNG, JPEG or WebP images are accepted');
    if (buf.length > 2 * 1024 * 1024) throw new ApiError(400, 'The logo must be 2 MB or smaller');
    const name = decodeURIComponent(req.headers.get('x-filename') || 'logo').slice(0, 120);
    await tx(async (c) => {
      const old = (await c.query('select name,logo_id from clients where id=$1 for update', [id])).rows[0]; if (!old) throw new ApiError(404, 'Client not found');
      const a = (await c.query(`insert into attachments(kind,filename,mime,size_bytes,data,created_by) values('client_logo',$1,$2,$3,$4,$5) returning id`, [name, mime, buf.length, buf, me.email])).rows[0];
      await c.query('update clients set logo_id=$1, updated_at=now() where id=$2', [a.id, id]);
      if (old.logo_id) await c.query('delete from attachments where id=$1', [old.logo_id]);
      await audit(c, me.email, 'update', 'client', id, `Logo uploaded for ${old.name}`);
    });
    return ok();
  });
}
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin', 'bim_manager']); const id = z.string().uuid().parse((await ctx.params).id);
    await tx(async (c) => { const old = (await c.query('select name,logo_id from clients where id=$1 for update', [id])).rows[0]; if (old?.logo_id) { await c.query('update clients set logo_id=null where id=$1', [id]); await c.query('delete from attachments where id=$1', [old.logo_id]); await audit(c, me.email, 'update', 'client', id, `Logo removed for ${old.name}`); } });
    return ok();
  });
}
