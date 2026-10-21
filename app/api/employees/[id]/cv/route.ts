import { z } from 'zod';
import { handle, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, tx } from '@/lib/db';
import { CV_MAX_BYTES, sniffCv } from '@/lib/files';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const name = decodeURIComponent(req.headers.get('x-filename') || 'cv').replace(/[\\/\r\n"]/g, '_').slice(0, 120);
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length > CV_MAX_BYTES) throw new ApiError(400, 'The CV must be 4 MB or smaller');
    const kind = sniffCv(buf, name);
    if (!kind) throw new ApiError(400, 'Only PDF, DOC or DOCX files are accepted');
    await tx(async (c) => {
      const old = (await c.query('select cv_id,name from employees where id=$1 for update', [id])).rows[0];
      if (!old) throw new ApiError(404, 'Employee not found');
      const a = (await c.query(`insert into attachments(kind,filename,mime,size_bytes,data,created_by) values('employee_cv',$1,$2,$3,$4,$5) returning id`, [name, kind.mime, buf.length, buf, me.email])).rows[0];
      await c.query('update employees set cv_id=$1,updated_at=now() where id=$2', [a.id, id]);
      if (old.cv_id) await c.query('delete from attachments where id=$1', [old.cv_id]);
      await audit(c, me.email, 'cv', 'employee', id, `Uploaded CV for ${old.name} (${name})`);
    });
    return ok();
  });
}
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    await tx(async (c) => {
      const old = (await c.query('select cv_id,name from employees where id=$1 for update', [id])).rows[0];
      if (!old) throw new ApiError(404, 'Employee not found');
      if (old.cv_id) { await c.query('update employees set cv_id=null,updated_at=now() where id=$1', [id]); await c.query('delete from attachments where id=$1', [old.cv_id]); }
      await audit(c, me.email, 'cv', 'employee', id, `Removed CV of ${old.name}`);
    });
    return ok();
  });
}
