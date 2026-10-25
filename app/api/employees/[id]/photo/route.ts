import { z } from 'zod';
import { handle, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, tx } from '@/lib/db';
import { sniffImage } from '@/lib/files';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params; z.string().uuid().parse(id);
    if (me.role !== 'admin' && me.employee_id !== id) throw new ApiError(403, 'You can only upload your own data');
    const buf = Buffer.from(await req.arrayBuffer());
    const mime = sniffImage(buf);
    if (!mime) throw new ApiError(400, 'Only PNG, JPEG or WebP images are accepted');
    if (buf.length > 3 * 1024 * 1024) throw new ApiError(400, 'Image must be 3 MB or smaller');
    const name = decodeURIComponent(req.headers.get('x-filename') || 'photo').slice(0, 120);
    await tx(async (c) => {
      const old = (await c.query('select photo_id,name from employees where id=$1 for update', [id])).rows[0];
      if (!old) throw new ApiError(404, 'Employee not found');
      const a = (await c.query(`insert into attachments(kind,filename,mime,size_bytes,data,created_by) values('employee_photo',$1,$2,$3,$4,$5) returning id`, [name, mime, buf.length, buf, me.email])).rows[0];
      await c.query('update employees set photo_id=$1,updated_at=now() where id=$2', [a.id, id]);
      if (old.photo_id) await c.query('delete from attachments where id=$1', [old.photo_id]);
      await audit(c, me.email, 'photo', 'employee', id, `Updated photo of ${old.name}`);
    });
    return ok();
  });
}
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    await tx(async (c) => {
      const old = (await c.query('select photo_id,name from employees where id=$1 for update', [id])).rows[0];
      if (!old) throw new ApiError(404, 'Employee not found');
      if (old.photo_id) { await c.query('update employees set photo_id=null,updated_at=now() where id=$1', [id]); await c.query('delete from attachments where id=$1', [old.photo_id]); }
      await audit(c, me.email, 'photo', 'employee', id, `Removed photo of ${old.name}`);
    });
    return ok();
  });
}
