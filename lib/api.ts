import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError } from './auth';

export function ok(data: unknown = { ok: true }, status = 200) { return NextResponse.json(data, { status }); }
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try { return await fn(); }
  catch (e: any) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues.map((i) => `${i.path.join('.') || 'value'}: ${i.message}`).join('; ') }, { status: 400 });
    if (e?.code === '23505') return NextResponse.json({ error: 'That record already exists (duplicate).' }, { status: 409 });
    if (e?.code === '23503') return NextResponse.json({ error: 'Referenced record does not exist or is still in use.' }, { status: 409 });
    if (e?.code === '23514') return NextResponse.json({ error: 'A value violates a database rule.' }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
export async function json<T = any>(req: Request): Promise<T> {
  try { return await req.json(); } catch { throw new ApiError(400, 'Invalid JSON body'); }
}
