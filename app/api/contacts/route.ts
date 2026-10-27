import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';

const contactBody = {
  name: z.string().trim().min(1).max(120),
  department: z.string().trim().max(120).nullish().transform((v) => v || null),
  job_title: z.string().trim().max(120).nullish().transform((v) => v || null),
  email: z.string().trim().toLowerCase().max(200).email().nullish().or(z.literal('')).transform((v) => v || null),
  mobile: z.string().trim().max(40).nullish().transform((v) => v || null),
  ext: z.string().trim().max(40).nullish().transform((v) => v || null),
  notes: z.string().trim().max(2000).nullish().transform((v) => v || null),
};
export async function GET() {
  return handle(async () => {
    const me = await requireUser();
    const rows = await q('select id,name,department,job_title,email,mobile,ext,notes,created_by,created_at from contacts order by lower(name)');
    return ok({ contacts: rows.map((r: any) => ({ ...r, mine: r.created_by === me.email })) });
  });
}
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const b = z.object(contactBody).parse(await json(req));
    const r = await one<{ id: string }>('insert into contacts(name,department,job_title,email,mobile,ext,notes,created_by) values($1,$2,$3,$4,$5,$6,$7,$8) returning id', [b.name, b.department, b.job_title, b.email, b.mobile, b.ext, b.notes, me.email]);
    await audit(null, me.email, 'create', 'contact', r!.id, `Added contact ${b.name}`);
    return ok({ id: r!.id }, 201);
  });
}
