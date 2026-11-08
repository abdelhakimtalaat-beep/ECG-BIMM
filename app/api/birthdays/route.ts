import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { birthdaysFrom } from '@/lib/birthday';

export const dynamic = 'force-dynamic';
/** Administrator only: employees whose birthday is today (and in the next 7 days). Birthdays are private, so this is not part of the shared data. */
export async function GET() {
  return handle(async () => {
    await requireUser(['admin']);
    const today = (await q<{ d: string }>(`select (now() at time zone 'Africa/Cairo')::date::text d`))[0].d;
    const people = await q<{ id: string; name: string; birth_date: string }>(`select id,name,birth_date::text birth_date from employees where active and birth_date is not null`);
    const hits = birthdaysFrom(people, today, 7);
    return ok({ today, birthdays_today: hits.filter((h) => h.days === 0), upcoming: hits.filter((h) => h.days > 0) });
  });
}
