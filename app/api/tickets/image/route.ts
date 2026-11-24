import { handle, ok } from '@/lib/api';
import { ApiError, requireTab } from '@/lib/auth';
import { one } from '@/lib/db';
import { sniffImage } from '@/lib/files';

export const dynamic = 'force-dynamic';
/** Uploads one image (a screenshot of the problem, or of the answer). The returned id is then sent with the query or the answer. */
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireTab('/troubleshooting');
    const buf = Buffer.from(await req.arrayBuffer()); const mime = sniffImage(buf); if (!mime) throw new ApiError(400, 'Only PNG, JPEG or WebP images are accepted');
    if (buf.length > 3 * 1024 * 1024) throw new ApiError(400, 'The image must be 3 MB or smaller');
    const name = decodeURIComponent(req.headers.get('x-filename') || 'image').slice(0, 120);
    const r = await one<{ id: string }>(`insert into attachments(kind,filename,mime,size_bytes,data,created_by) values('ticket_image',$1,$2,$3,$4,$5) returning id`, [name, mime, buf.length, buf, me.email]);
    return ok({ id: r!.id });
  });
}
