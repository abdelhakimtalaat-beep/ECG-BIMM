// Server side: current factor table (defaults merged with the Administrator's edits).
import { q } from './db';
import { mergeFactors, type Factors } from './workload';

export async function loadFactors(): Promise<Factors> {
  const r = await q<{ value: any }>(`select value from app_settings where key='factors'`);
  return mergeFactors(r[0]?.value);
}
