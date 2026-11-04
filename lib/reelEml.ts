// Builds an unsent e-mail (.eml) that Outlook opens as a NEW editable message, with the announcement picture embedded in the body.
// Pure; unit tested. `X-Unsent: 1` is what makes Outlook open it as a draft instead of a received message.
export interface ReelMail { to?: string; subject: string; text: string; html: string; png: Uint8Array | string /* raw bytes or base64 */ }
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const b64 = (d: Uint8Array | string) => (typeof d === 'string' ? d : btoa(Array.from(d, (c) => String.fromCharCode(c)).join('')));
const wrap = (s: string) => (s.match(/.{1,76}/g) ?? []).join('\r\n');
const utf8b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (c) => String.fromCharCode(c)).join(''));
const hdr = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${utf8b64(s)}?=`);

export const DEFAULT_REEL_TO = 'Bimm <Bimm_Dep@ecgsa.com>; Architectural Department <architecturaldep@ecgsa.com>; UrbanDesign&LandscapeDepartment <landscapedep@ecgsa.com>; InteriorDesignDepartment <Interiordep@ecgsa.com>; VisualizationDepartment <VisualizationDepartment@ecgsa.com>; HealthCareDepartment <HealthcareDep@ecgsa.com>; BIM <BIM@ecgsa.com>; StructuralDepartment <structuraldep@ecgsa.com>; HvacDepartment <hvacdep@ecgsa.com>; MechanicalDepartment <Mechanicaldep@ecgsa.com>; ElectricalDepartment <electricaldep@ecgsa.com>; Communication&SecurityDepartment <communicationdep@ecgsa.com>; InfrastructureBusinessUnit <Infrastructuredep@ecgsa.com>; Sites <Sites@ecgsa.com>; TechnicalOfficeDepartment <TechnicalOfficeDepartment@ecgsa.com>; ED <ED@ecgsa.com>; ProjectManagers <ProjectManagers@ecgsa.com>';
/** Plain addresses from "Name <a@x.com>; b@x.com" (names may contain commas or &, so only ; and new lines separate entries). */
export const toAddresses = (s: string): string[] => s.split(/[;\n]+/).map((p) => (p.match(/<([^>]+)>/)?.[1] ?? p).trim()).filter((a) => /^[^\s@<>]+@[^\s@<>]+$/.test(a));
export const DEFAULT_MEETING_LINK = 'https://teams.microsoft.com/meet/3878307048985?p=nx3sachr1U87HMPZEh';
/** `when` reads after "scheduled for", e.g. "today at 10:00 AM" or "Thursday, 5 November 2026 at 10:00 AM". */
export function reelMailContent(r: { topic: string; when: string; link?: string | null }) {
  const topic = r.topic || 'BIM Reel';
  const subject = `BIM Reel | ${topic}`;
  const line = `This is a gentle reminder about our BIM REEL online tutorial session scheduled for ${r.when}.`;
  const text = ['Dear All,', '', line, '', ...(r.link ? [`Meeting Link: ${r.link}`, ''] : [])].join('\r\n');
  const img = `<img src="cid:reel-announcement" alt="BIM Reel announcement: ${esc(topic)}" width="900" style="width:900px;max-width:100%;height:auto;border:0">`;
  const html = `<div style="font-family:Calibri,Segoe UI,Arial,sans-serif;font-size:12pt;color:#222">
<p style="font-size:12pt">Dear All,</p>
<p style="font-size:12pt">${esc(line)}</p>
<p>${r.link ? `<a href="${esc(r.link)}">${img}</a>` : img}</p>
${r.link ? `<p style="font-size:12pt"><b>Meeting Link:</b> <a href="${esc(r.link)}">${esc(r.link)}</a></p>` : ''}</div>`;
  return { subject, text, html };
}

export function buildReelEml(m: ReelMail): string {
  const o = '=_rel_' + Math.random().toString(36).slice(2), a = '=_alt_' + Math.random().toString(36).slice(2);
  return [
    'X-Unsent: 1', ...(m.to ? [`To: ${m.to}`] : []), 'MIME-Version: 1.0', `Subject: ${hdr(m.subject)}`, `Content-Type: multipart/related; boundary="${o}"; type="multipart/alternative"`, '',
    `--${o}`, `Content-Type: multipart/alternative; boundary="${a}"`, '',
    `--${a}`, 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', wrap(utf8b64(m.text)), '',
    `--${a}`, 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: base64', '', wrap(utf8b64(m.html)), '',
    `--${a}--`, '',
    `--${o}`, 'Content-Type: image/png; name="reel-announcement.png"', 'Content-Transfer-Encoding: base64', 'Content-ID: <reel-announcement>', 'Content-Disposition: inline; filename="reel-announcement.png"', '', wrap(b64(m.png)), '',
    `--${o}--`, '',
  ].join('\r\n');
}
