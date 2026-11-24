import { handle } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { one } from '@/lib/db';
import { getReviewerIds } from '@/lib/ticketAccess';
import { z } from 'zod';
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const a = await one<any>('select kind,mime,data,filename from attachments where id=$1', [id]);
    if (!a) throw new ApiError(404, 'File not found');
    if (a.kind === 'employee_cv' && me.role !== 'admin' && me.role !== 'bim_manager' && !(me.employee_id && await one('select 1 from employees where id=$1 and cv_id=$2', [me.employee_id, id]))) throw new ApiError(403, 'You do not have permission to open CVs');
    if (a.kind === 'employee_doc' && me.role !== 'admin' && !(me.employee_id && await one('select 1 from employee_documents where attachment_id=$1 and employee_id=$2', [id, me.employee_id]))) throw new ApiError(403, 'This document is private');
    if (a.kind === 'ticket_image' && me.role !== 'admin' && !(await getReviewerIds()).includes(me.id) && !(await one('select 1 from tickets where (image_id=$1 or draft_image_id=$1 or final_image_id=$1) and (requester_id=$2 or assignee_id=$2)', [id, me.id])) && !(await one(`select 1 from attachments where id=$1 and created_by=$2`, [id, me.email]))) throw new ApiError(403, 'You cannot open this image');
    const isImage = String(a.mime).startsWith('image/');
    const safe = String(a.filename || 'file').replace(/[^\w.\- ]+/g, '_');
    const disposition = isImage ? 'inline' : `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(String(a.filename || 'file'))}`;
    return new Response(new Uint8Array(a.data), { headers: { 'Content-Type': a.mime, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': disposition } });
  });
}
