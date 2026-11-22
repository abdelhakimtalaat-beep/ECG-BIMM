// Pure helpers for the projects map: Google Plus Codes (Open Location Code), coordinates and ACC address text. No imports; unit tested.
const ALPHABET = '23456789CFGHJMPQRVWX';
export interface Addr { line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; postal?: string | null; country?: string | null }
export interface Pt { lat: number; lng: number }

/** A Plus Code inside free text, e.g. "5J38+47R, El Shorouk, Cairo" or "7GXX5J38+47R". */
const CODE_RE = /(?:^|[\s,;(])([23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,})(?=$|[\s,;)])/i;
export function findPlusCode(text: string | null | undefined): { code: string; rest: string } | null {
  const s = String(text ?? ''); const m = s.match(CODE_RE); if (!m) return null;
  const code = m[1].toUpperCase(); const before = code.indexOf('+'); if (before % 2 !== 0) return null;   /* a code has an even number of digits before the plus sign */
  return { code, rest: s.replace(m[1], ' ').replace(/\s*,\s*,+/g, ',').replace(/^[\s,]+|[\s,]+$/g, '').replace(/\s{2,}/g, ' ') };
}
const idx = (ch: string) => ALPHABET.indexOf(ch);
/** Centre of a FULL code (8 digits before the plus sign). */
export function decodeFull(code: string): Pt | null {
  const c = code.toUpperCase(); const plus = c.indexOf('+'); if (plus !== 8) return null;
  const digits = c.replace('+', '').slice(0, 10); if (digits.length < 8 || digits.length % 2 !== 0 || [...digits].some((ch) => idx(ch) < 0)) return null;
  let lat = -90, lng = -180, res = 20;
  for (let i = 0; i < digits.length; i += 2) { lat += idx(digits[i]) * res; lng += idx(digits[i + 1]) * res; if (i + 2 < digits.length) res /= 20; }
  return { lat: lat + res / 2, lng: lng + res / 2 };
}
const encodePrefix = (p: Pt, n: number): string => {
  let lat = Math.min(Math.max(p.lat, -89.999999), 89.999999) + 90, lng = ((p.lng + 180) % 360 + 360) % 360, res = 20, out = '';
  for (let i = 0; i < n; i += 2) { const a = Math.floor(lat / res), b = Math.floor(lng / res); out += ALPHABET[a] + ALPHABET[b]; lat -= a * res; lng -= b * res; res /= 20; }
  return out;
};
/** A SHORT code (e.g. "5J38+47R") needs a place near it to become a full code: the locality's coordinates are that reference. */
export function recoverShort(code: string, ref: Pt): Pt | null {
  const c = code.toUpperCase(); const plus = c.indexOf('+'); if (plus < 0 || plus >= 8 || plus % 2 !== 0) return null;
  const pad = 8 - plus; const full = decodeFull(encodePrefix(ref, pad) + c); if (!full) return null;
  const res = Math.pow(20, 2 - pad / 2); const half = res / 2; let { lat, lng } = full;
  if (ref.lat + half < lat && lat - res >= -90) lat -= res; else if (ref.lat - half > lat && lat + res <= 90) lat += res;
  if (ref.lng + half < lng) lng -= res; else if (ref.lng - half > lng) lng += res;
  return { lat, lng };
}
export const resolveCode = (code: string, ref: Pt | null): Pt | null => (code.indexOf('+') === 8 ? decodeFull(code) : ref ? recoverShort(code, ref) : null);

/** Coordinates Autodesk may return as text. (0,0) and out-of-range values mean "not set". */
export function validPoint(lat: unknown, lng: unknown): Pt | null {
  const a = typeof lat === 'string' ? parseFloat(lat) : Number(lat), b = typeof lng === 'string' ? parseFloat(lng) : Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180 || (a === 0 && b === 0)) return null; return { lat: a, lng: b };
}
const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const noPostal = (s: string) => s.replace(/\b\d{4,}\b/g, ' ').replace(/\s{2,}/g, ' ').replace(/[\s,]+$/g, '').trim();
export const addressText = (a: Addr) => [a.line1, a.line2, a.city, a.state, a.postal, a.country].map(clean).filter(Boolean).join(', ');
/** Fingerprint of the address: when it is unchanged the pin is kept and nothing is looked up. */
export const addressKey = (a: Addr, pt: Pt | null) => [a.line1, a.line2, a.city, a.state, a.postal, a.country].map((x) => clean(x).toLowerCase()).join('|') + (pt ? `|${pt.lat},${pt.lng}` : '');
export const hasAddress = (a: Addr) => !!(clean(a.line1) || clean(a.line2) || clean(a.city) || clean(a.state));

/** Lookup texts for the geocoder, best first. `plus` = the Plus Code found in the address (its locality text is the reference place). */
export function geocodeQueries(a: Addr): { locality: string[]; address: string[]; city: string[] } {
  const country = clean(a.country), join = (...p: string[]) => p.map(clean).filter(Boolean).join(', ');
  const code = findPlusCode(a.line1) ?? findPlusCode(a.line2); const l1 = code && findPlusCode(a.line1) ? noPostal(findPlusCode(a.line1)!.rest) : noPostal(clean(a.line1)); const l2 = noPostal(clean(a.line2));
  const city = join(a.city ?? '', a.state ?? '', country);
  const locality = [join(l1, l2, a.city ?? '', a.state ?? '', country), join(l1, a.city ?? '', country), city].filter((x, i, arr) => x && arr.indexOf(x) === i);
  return { locality, address: [join(l1, l2, a.city ?? '', a.state ?? '', country), join(l1, a.city ?? '', country)].filter((x, i, arr) => x && !code && arr.indexOf(x) === i), city: [city, join(a.city ?? '', country)].filter((x, i, arr) => x && arr.indexOf(x) === i) };
}
export const distanceKm = (p: Pt, q: Pt) => { const r = Math.PI / 180, d = Math.sin(((q.lat - p.lat) * r) / 2) ** 2 + Math.cos(p.lat * r) * Math.cos(q.lat * r) * Math.sin(((q.lng - p.lng) * r) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(d)); };

/** Country names and ISO codes of the countries ECG works in, so "AU" and "Australia" (or "EG" and "Egypt") compare as equal. */
const ISO: Record<string, string> = { sa: 'saudi arabia', ksa: 'saudi arabia', eg: 'egypt', ae: 'united arab emirates', uae: 'united arab emirates', qa: 'qatar', kw: 'kuwait', bh: 'bahrain', om: 'oman', jo: 'jordan', iq: 'iraq', lb: 'lebanon', ly: 'libya', ma: 'morocco', dz: 'algeria', tn: 'tunisia', sd: 'sudan', ye: 'yemen', tr: 'turkey', gb: 'united kingdom', uk: 'united kingdom', us: 'united states', usa: 'united states', de: 'germany', fr: 'france', it: 'italy', in: 'india', pk: 'pakistan', cn: 'china', sg: 'singapore', my: 'malaysia', au: 'australia', ca: 'canada', za: 'south africa', ng: 'nigeria', ke: 'kenya' };
export const countryName = (v: unknown): string => { const s = clean(v).toLowerCase().replace(/\./g, ''); return ISO[s] ?? s; };
/** True when the two countries agree, or when either is unknown (nothing to compare). */
export const sameCountry = (portal: unknown, acc: unknown): boolean => { const a = countryName(portal), b = countryName(acc); return !a || !b || a === b; };
