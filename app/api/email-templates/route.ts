import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { newTemplateStatus } from '@/lib/emailTemplates';

export async function GET() {
  return handle(async () => {
    const me = await requireUser();
    const rows = await q(`select id,title,body,status,requested_by,requested_name,review_note,created_at,updated_at,(requested_by = $2) as mine
      from email_templates where status='approved' or $1='admin' or requested_by=$2 order by (status='pending') desc, lower(title)`, [me.role, me.email]);
    return ok({ templates: rows });
  });
}
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const b = z.object({ title: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(10000) }).parse(await json(req));
    const status = newTemplateStatus(me.role);
    const r = await one<{ id: string }>('insert into email_templates(title,body,status,requested_by,requested_name) values($1,$2,$3,$4,$5) returning id', [b.title, b.body, status, me.email, me.full_name || me.email]);
    await audit(null, me.email, 'create', 'email_template', r!.id, status === 'approved' ? `Email template added: ${b.title}` : `Email template requested: ${b.title}`);
    return ok({ id: r!.id, status }, 201);
  });
}
