import { handle } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { one } from '@/lib/db';
import { z } from 'zod';
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const a = await one<any>('select kind,mime,data,filename from attachments where id=$1', [id]);
    if (!a) throw new ApiError(404, 'File not found');
    if (a.kind === 'employee_cv' && me.role !== 'admin' && me.role !== 'bim_manager') throw new ApiError(403, 'You do not have permission to open CVs');
    const isImage = String(a.mime).startsWith('image/');
    const safe = String(a.filename || 'file').replace(/[^\w.\- ]+/g, '_');
    const disposition = isImage ? 'inline' : `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(String(a.filename || 'file'))}`;
    return new Response(new Uint8Array(a.data), { headers: { 'Content-Type': a.mime, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': disposition } });
  });
}
