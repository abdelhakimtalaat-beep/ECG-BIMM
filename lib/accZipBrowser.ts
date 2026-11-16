// Reads a Data Connector zip inside the browser (no upload of the 40+ MB file): finds the needed CSV files and inflates them with DecompressionStream.
import { WANTED } from './accSummary.ts';

async function inflate(raw: Uint8Array): Promise<string> {
  return new Response(new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
}
/** CSV text by file name, for the files the statistics need. */
export async function readExtractZip(buf: ArrayBuffer): Promise<Record<string, string>> {
  const v = new DataView(buf), u8 = new Uint8Array(buf); const td = new TextDecoder();
  let e = buf.byteLength - 22; while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('This is not a zip file');
  const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true); const out: Record<string, string> = {};
  for (let i = 0; i < n; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('The zip file is damaged');
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nlen)).split('/').pop()!; p += 46 + nlen + xlen + clen;
    if (!WANTED.includes(name)) continue;
    const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true); const raw = u8.subarray(start, start + csize);
    out[name] = method === 0 ? td.decode(raw) : method === 8 ? await inflate(raw) : (() => { throw new Error(`Unsupported zip method ${method}`); })();
  }
  return out;
}
