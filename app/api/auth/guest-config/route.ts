import { handle, ok } from '@/lib/api';
import { getGuestCfg } from '@/lib/guestServer';

export const dynamic = 'force-dynamic';
/** Public: tells the sign-in page whether "sign in with a one-time code" is switched on. */
export async function GET() { return handle(async () => ok({ enabled: (await getGuestCfg()).enabled })); }
