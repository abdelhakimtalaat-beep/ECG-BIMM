import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, checkPassword, hash, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';

export async function GET() {
  return handle(async () => {
    await requireUser(['admin']);
    return ok(await q('select id,email,full_name,role,employee_id,active,last_login_at,created_at from users order by email'));
  });
}
// A portal user is created FROM an employee: the sign-in e-mail is the employee's work e-mail, so it cannot be mistyped or invented.
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const b = z.object({ employee_id: z.string().uuid(), password: z.string(), role: z.enum(['admin', 'bim_manager', 'bim_coordinator', 'viewer', 'rd_engineer', 'bim_specialist']) }).parse(await json(req));
    checkPassword(b.password);
    const e = await one<{ name: string; email: string | null }>('select name,email from employees where id=$1', [b.employee_id]);
    if (!e) throw new ApiError(404, 'Employee not found');
    if (!e.email) throw new ApiError(400, `${e.name} has no e-mail on file. Add it on the Organization Chart page first.`);
    const email = e.email.toLowerCase();
    if (await one('select 1 from users where lower(email)=$1', [email])) throw new ApiError(409, `A user with the e-mail ${email} already exists.`);
    const u = await one<{ id: string }>('insert into users(email,full_name,password_hash,role,employee_id,must_change_password) values($1,$2,$3,$4,$5,true) returning id',
      [email, e.name, await hash(b.password), b.role, b.employee_id]);
    await audit(null, me.email, 'create', 'user', u!.id, `Created user ${email} (${b.role}) for ${e.name}`);
    return ok({ id: u!.id }, 201);
  });
}
