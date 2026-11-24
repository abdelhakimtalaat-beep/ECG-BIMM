// Who may review BIM tickets: the Administrators plus the reviewers the Administrator added (stored in app_settings).
import { one, q } from './db';
import type { Actor } from './tickets';

export async function getReviewerIds(): Promise<string[]> {
  const r = await one<{ value: any }>(`select value from app_settings where key='ticket_reviewers'`); const v = r?.value?.ids; return Array.isArray(v) ? v.filter((x: unknown) => typeof x === 'string') : [];
}
export async function saveReviewerIds(ids: string[]) {
  await q(`insert into app_settings(key,value,updated_at) values('ticket_reviewers',$1,now()) on conflict (key) do update set value=excluded.value, updated_at=now()`, [JSON.stringify({ ids })]);
}
/** The user with the reviewer flag the permission rules need. */
export const actorOf = async (me: { id: string; role: string }): Promise<Actor> => ({ id: me.id, role: me.role, reviewer: me.role === 'admin' ? true : (await getReviewerIds()).includes(me.id) });
