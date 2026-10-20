import { Pool, PoolClient } from 'pg';

const g = globalThis as unknown as { __ecgPool?: Pool };

function make(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const local = /localhost|127\.0\.0\.1|\[::1\]/.test(url) || process.env.DATABASE_SSL === 'disable';
  return new Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: 5, idleTimeoutMillis: 20000 });
}
export function pool(): Pool { return g.__ecgPool ?? (g.__ecgPool = make()); }

export async function q<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const r = await pool().query(text, params);
  return r.rows as T[];
}
export async function one<T = any>(text: string, params: any[] = []): Promise<T | null> {
  return (await q<T>(text, params))[0] ?? null;
}
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try { await c.query('begin'); const r = await fn(c); await c.query('commit'); return r; }
  catch (e) { try { await c.query('rollback'); } catch {} throw e; }
  finally { c.release(); }
}
export async function audit(c: { query: PoolClient['query'] } | null, user: string | null, action: string, entity: string, entityId: string | null, summary: string, before?: unknown, after?: unknown) {
  const sql = 'insert into audit_logs(user_email,action,entity,entity_id,summary,before_data,after_data) values($1,$2,$3,$4,$5,$6,$7)';
  const params = [user, action, entity, entityId, summary, before === undefined ? null : JSON.stringify(before), after === undefined ? null : JSON.stringify(after)];
  if (c) await c.query(sql, params); else await pool().query(sql, params);
}
