export function sniffImage(b: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export const CV_MAX_BYTES = 4 * 1024 * 1024; // keeps the request under the hosting body limit
/** Accepts PDF, Word (.doc) and Word (.docx) by their real file signature plus the file extension. */
export function sniffCv(b: Buffer, filename: string): { mime: string; ext: string } | null {
  const ext = (filename.match(/\.([A-Za-z0-9]{2,5})$/)?.[1] ?? '').toLowerCase();
  if (b.length > 5 && b.toString('latin1', 0, 5) === '%PDF-' && ext === 'pdf') return { mime: 'application/pdf', ext: 'pdf' };
  if (b.length > 8 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 && ext === 'doc') return { mime: 'application/msword', ext: 'doc' };
  if (b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 && ext === 'docx') return { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' };
  return null;
}
