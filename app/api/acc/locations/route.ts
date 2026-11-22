import { handle, ok } from '@/lib/api';
import { requireTab, requireUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { accessToken } from '@/lib/accApi';
import { refreshLocations } from '@/lib/accGeo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
/** Map pins of the projects (read only). Open to everyone who may open the Map tab, general access included. */
export async function GET() {
  return handle(async () => {
    await requireTab('/projects/map');
    const rows = await q('select id, geo_lat as lat, geo_lng as lng, geo_precision as precision, geo_address as address, geo_note as note, geo_updated as updated from projects');
    return ok({ rows });
  });
}
/** Administrator / BIM Manager: read the addresses from ACC again. Locations are only ever changed in ACC. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireUser(['admin', 'bim_manager']); const force = new URL(req.url).searchParams.get('force') === '1';
    return ok(await refreshLocations(await accessToken(), { force }));
  });
}
