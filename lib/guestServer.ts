import { one, q } from './db';
import { TAB_HREFS } from './tabs';
import { parseDomains, type GuestCfg } from './guest';

export async function getGuestCfg(): Promise<GuestCfg> {
  const r = await one<{ value: any }>(`select value from app_settings where key='guest_access'`); const v = r?.value ?? {};
  return { enabled: v.enabled === true, tabs: (Array.isArray(v.tabs) ? v.tabs : []).filter((t: string) => TAB_HREFS.includes(t) && t !== '/admin' && t !== '/troubleshooting'), domains: parseDomains(v.domains) };
}
export async function saveGuestCfg(c: GuestCfg) {
  await q(`insert into app_settings(key,value,updated_at) values('guest_access',$1,now()) on conflict (key) do update set value=excluded.value, updated_at=now()`, [JSON.stringify(c)]);
}
