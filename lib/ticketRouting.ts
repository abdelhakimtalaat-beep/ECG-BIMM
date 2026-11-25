// Who a BIM ticket goes to, and who it can be handed over to. People are matched to portal users by e-mail (the org chart e-mail is the sign-in name).
import { q } from './db';

export interface Person { id: string; email: string; name: string }
const uniq = (rows: Person[]) => [...new Map(rows.map((r) => [r.id, r])).values()];

/** Troubleshooting -> the BIM Managers and BIM Coordinators assigned to the project. New Tool -> the R&D BIM Engineers. The sender is never his own recipient. */
export async function routeRecipients(type: string, projectId: string, exceptId?: string | null): Promise<Person[]> {
  const rows = type === 'New Tool'
    ? await q<Person>(`select u.id, u.email, coalesce(e.name, u.full_name, u.email) as name from users u left join employees e on lower(e.email)=lower(u.email) where u.active and (u.role='rd_engineer' or (e.active and e.job_category='rd_engineer'))`)
    : await q<Person>(`select u.id, u.email, coalesce(e.name, u.full_name, u.email) as name from project_assignments pa join employees e on e.id=pa.employee_id and e.active join users u on lower(u.email)=lower(e.email) and u.active where pa.project_id=$1 and pa.role in ('manager','coordinator')`, [projectId]);
  return uniq(rows).filter((r) => r.id !== exceptId).sort((a, b) => a.name.localeCompare(b.name));
}
export interface OrgPerson { id: string; name: string; job_title: string; job_category: string }
/** The people from the org chart who have a portal account (a ticket can only be handed to them). */
export const orgPeople = (exceptId?: string) => q<OrgPerson>(`select u.id, e.name, e.job_title, e.job_category from employees e join users u on lower(u.email)=lower(e.email) and u.active where e.active and u.id <> coalesce($1::uuid, '00000000-0000-0000-0000-000000000000') order by lower(e.name)`, [exceptId ?? null]);
