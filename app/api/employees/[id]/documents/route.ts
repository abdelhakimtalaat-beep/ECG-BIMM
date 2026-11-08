import { z } from 'zod';
import { handle, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, tx } from '@/lib/db';
import { DOC_MAX_BYTES, DOC_TYPES, sniffDoc } from '@/lib/files';

/** Upload a document (header x-doc-type = National ID, Passport, ...). The Administrator or the employee himself. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(); const { id } = await ctx.params; z.string().uuid().parse(id);
    if (me.role !== 'admin' && me.employee_id !== id) throw new ApiError(403, 'You can only upload your own documents');
    const type = z.enum(DOC_TYPES).parse(decodeURIComponent(req.headers.get('x-doc-type') || ''));
    const name = decodeURIComponent(req.headers.get('x-filename') || 'document').replace(/[\\/\r\n"]/g, '_').slice(0, 120);
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length > DOC_MAX_BYTES) throw new ApiError(400, 'A document must be 4 MB or smaller');
    const kind = sniffDoc(buf, name);
    if (!kind) throw new ApiError(400, 'Only PDF, Word (DOC/DOCX) or image (PNG, JPG, WebP) files are accepted');
    const docId = await tx(async (c) => {
      const emp = (await c.query('select name from employees where id=$1 for update', [id])).rows[0];
      if (!emp) throw new ApiError(404, 'Employee not found');
      if ((await c.query('select count(*)::int n from employee_documents where employee_id=$1', [id])).rows[0].n >= 20) throw new ApiError(400, 'At most 20 documents per employee');
      const a = (await c.query(`insert into attachments(kind,filename,mime,size_bytes,data,created_by) values('employee_doc',$1,$2,$3,$4,$5) returning id`, [name, kind.mime, buf.length, buf, me.email])).rows[0];
      const d = (await c.query('insert into employee_documents(employee_id,doc_type,attachment_id,created_by) values($1,$2,$3,$4) returning id', [id, type, a.id, me.email])).rows[0];
      await audit(c, me.email, 'document', 'employee', id, `Uploaded ${type} (${name}) for ${emp.name}`);
      return d.id as string;
    });
    return ok({ id: docId }, 201);
  });
}
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(); const { id } = await ctx.params; z.string().uuid().parse(id);
    if (me.role !== 'admin' && me.employee_id !== id) throw new ApiError(403, 'You can only remove your own documents');
    const doc = z.string().uuid().parse(new URL(req.url).searchParams.get('doc'));
    await tx(async (c) => {
      const d = (await c.query('select attachment_id, doc_type from employee_documents where id=$1 and employee_id=$2', [doc, id])).rows[0];
      if (!d) throw new ApiError(404, 'Document not found');
      await c.query('delete from attachments where id=$1', [d.attachment_id]); // the document row goes with it
      await audit(c, me.email, 'document', 'employee', id, `Removed ${d.doc_type}`);
    });
    return ok();
  });
}
