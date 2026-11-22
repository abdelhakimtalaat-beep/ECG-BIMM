import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { audit, q } from '@/lib/db';
import { clientKey, mostCommon, unifyNames } from '@/lib/clients';

export const dynamic = 'force-dynamic';
/**
 * Administrator / BIM Manager: collects the client names written in the projects, unifies the spellings (case, spaces, punctuation, "Ltd" ...)
 * and creates a client for each new one. Project client names are rewritten to the unified spelling so every project links to its client.
 */
export async function POST() {
  return handle(async () => {
    const me = await requireUser(['admin', 'bim_manager']);
    const rows = await q<{ id: string; client: string; country: string | null }>(`select id, client, country from projects where client is not null and btrim(client)<>''`);
    const groups = unifyNames(rows.map((r) => r.client)); const existing = new Map((await q<{ key: string; name: string; country: string | null }>('select key,name,country from clients')).map((c) => [c.key, c]));
    let created = 0, renamed = 0;
    for (const g of groups) {
      const inGroup = rows.filter((r) => clientKey(r.client) === g.key); const country = mostCommon(inGroup.map((r) => r.country)); let name = g.name; const have = existing.get(g.key);
      if (!have) { await q('insert into clients(name,key,country) values($1,$2,$3) on conflict (key) do nothing', [g.name, g.key, country]); created++; }
      else { name = have.name; if (!have.country && country) await q('update clients set country=$2, updated_at=now() where key=$1', [g.key, country]); }
      const wrong = inGroup.filter((r) => r.client !== name).map((r) => r.id);
      if (wrong.length) { await q('update projects set client=$2 where id = any($1::uuid[])', [wrong, name]); renamed += wrong.length; }
    }
    await audit(null, me.email, 'update', 'client', null, `Clients collected from projects: ${created} new, ${renamed} project name(s) unified`);
    return ok({ created, unified: renamed, clients: groups.length, projects: rows.length });
  });
}
