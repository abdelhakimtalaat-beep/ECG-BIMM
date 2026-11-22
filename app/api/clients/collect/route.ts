import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { audit, tx } from '@/lib/db';
import { clientKey, clusterNames, mostCommon, pickName, tidyName } from '@/lib/clients';

export const dynamic = 'force-dynamic';
interface CRow { id: string; name: string; key: string; country: string | null; logo_id: string | null; created_at: string }
/**
 * Administrator / BIM Manager: collects the client names written in the projects and puts every spelling of the same client into ONE card
 * (case, spaces, punctuation, Mostafa/Moustafa, "Ltd", "Group", "Developments", acronyms like TMG). Cards that already exist are merged too:
 * the card with a logo (or the most projects) is kept, the others are removed, and every project gets the unified client name.
 */
export async function POST() {
  return handle(async () => {
    const me = await requireUser(['admin', 'bim_manager']);
    return await tx(async (c) => {
      const projects = (await c.query(`select id, client, country from projects where client is not null and btrim(client)<>''`)).rows as { id: string; client: string; country: string | null }[];
      const cards = (await c.query('select id,name,key,country,logo_id,created_at from clients order by created_at')).rows as CRow[];
      const clusters = clusterNames([...projects.map((p) => p.client), ...cards.map((x) => x.name)]);
      let created = 0, merged = 0, unified = 0;
      for (const names of clusters) {
        const set = new Set(names); const ps = projects.filter((p) => set.has(tidyName(p.client))); const cs = cards.filter((x) => set.has(tidyName(x.name)));
        const nOf = (x: CRow) => ps.filter((p) => tidyName(p.client) === tidyName(x.name)).length;
        const primary = [...cs].sort((a, b) => Number(!!b.logo_id) - Number(!!a.logo_id) || nOf(b) - nOf(a) || +new Date(a.created_at) - +new Date(b.created_at))[0];
        const counts = new Map<string, number>(); for (const n of names) counts.set(n, ps.filter((p) => tidyName(p.client) === n).length);
        const name = primary ? primary.name : pickName(counts); const country = primary?.country || mostCommon(ps.map((p) => p.country)) || cs.find((x) => x.country)?.country || null;
        let id: string;
        if (!primary) { id = (await c.query('insert into clients(name,key,country) values($1,$2,$3) on conflict (key) do update set country=coalesce(clients.country, excluded.country) returning id', [name, clientKey(name), country])).rows[0].id; created++; }
        else { id = primary.id; if (!primary.country && country) await c.query('update clients set country=$2, updated_at=now() where id=$1', [id, country]); }
        let logo = primary?.logo_id ?? null;
        for (const o of cs.filter((x) => x.id !== id)) {   /* the other cards of the same client are merged into the kept one */
          if (o.logo_id && !logo) { logo = o.logo_id; await c.query('update clients set logo_id=$2, updated_at=now() where id=$1', [id, o.logo_id]); await c.query('update clients set logo_id=null where id=$1', [o.id]); }
          await c.query('delete from clients where id=$1', [o.id]); if (o.logo_id && o.logo_id !== logo) await c.query('delete from attachments where id=$1', [o.logo_id]); merged++;
        }
        const wrong = ps.filter((p) => p.client !== name).map((p) => p.id);
        if (wrong.length) { await c.query('update projects set client=$2 where id = any($1::uuid[])', [wrong, name]); unified += wrong.length; }
      }
      await audit(c, me.email, 'update', 'client', null, `Clients collected: ${created} new, ${merged} duplicate card(s) merged, ${unified} project name(s) unified`);
      return ok({ created, merged, unified, clients: clusters.length, projects: projects.length });
    });
  });
}
