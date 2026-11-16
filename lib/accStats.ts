// Server side: reads the zip of an ACC "Data Connector" extract (node:zlib). The CSV parsing and summarising live in accSummary.ts so the browser can use them too.
import { inflateRawSync } from 'node:zlib';
import { summarize, WANTED, type AccStats } from './accSummary.ts';
export * from './accSummary.ts';

/** Files of a zip archive (only the ones accepted by `want`). Supports stored and deflated entries, which is what Autodesk produces. */
export function readZip(buf: Buffer, want: (name: string) => boolean = () => true): Record<string, Buffer> {
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Not a zip file');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const out: Record<string, Buffer> = {};
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Damaged zip directory');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen); p += 46 + nlen + xlen + clen;
    if (name.endsWith('/') || !want(name)) continue;
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28); const raw = buf.subarray(start, start + csize);
    out[name] = method === 0 ? raw : method === 8 ? inflateRawSync(raw) : (() => { throw new Error(`Unsupported zip method ${method}`); })();
  }
  return out;
}

export function summarizeZip(zip: Buffer, today: string): AccStats[] {
  const f = readZip(zip, (n) => WANTED.includes(n.split('/').pop()!));
  return summarize(Object.fromEntries(Object.entries(f).map(([k, v]) => [k.split('/').pop()!, v.toString('utf8')])), today);
}
