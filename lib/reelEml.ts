// Builds an unsent e-mail (.eml) that Outlook opens as a NEW editable message, with the announcement picture embedded in the body.
// Pure; unit tested. `X-Unsent: 1` is what makes Outlook open it as a draft instead of a received message.
export interface ReelMail { subject: string; text: string; html: string; png: Uint8Array | string /* raw bytes or base64 */ }
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const b64 = (d: Uint8Array | string) => (typeof d === 'string' ? d : btoa(Array.from(d, (c) => String.fromCharCode(c)).join('')));
const wrap = (s: string) => (s.match(/.{1,76}/g) ?? []).join('\r\n');
const utf8b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (c) => String.fromCharCode(c)).join(''));
const hdr = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${utf8b64(s)}?=`);

export function reelMailContent(r: { topic: string; speaker: string; whenText: string; link?: string | null }) {
  const topic = r.topic || 'BIM Reel';
  const subject = `BIM Reels: ${topic} – ${r.whenText}`;
  const text = ['Dear Colleagues,', '', 'You are invited to the next BIM Reel (Quick Tips For Great Productivity), organized by the BIM Management Department.', '',
    `Topic: ${topic}`, `Speaker: ${r.speaker}`, `When: ${r.whenText}`, ...(r.link ? [`Meeting link: ${r.link}`] : []), '', 'Best regards,', 'BIM Management Department'].join('\r\n');
  const img = `<img src="cid:reel-announcement" alt="BIM Reel announcement: ${esc(topic)}" width="900" style="width:900px;max-width:100%;height:auto;border:0">`;
  const html = `<div style="font-family:Calibri,Segoe UI,Arial,sans-serif;font-size:11pt;color:#222">
<p>Dear Colleagues,</p>
<p>You are invited to the next <b>BIM Reel</b> (Quick Tips For Great Productivity), organized by the BIM Management Department.</p>
<p>${r.link ? `<a href="${esc(r.link)}">${img}</a>` : img}</p>
<p><b>Topic:</b> ${esc(topic)}<br><b>Speaker:</b> ${esc(r.speaker)}<br><b>When:</b> ${esc(r.whenText)}${r.link ? `<br><b>Meeting link:</b> <a href="${esc(r.link)}">${esc(r.link)}</a>` : ''}</p>
<p>Best regards,<br>BIM Management Department</p></div>`;
  return { subject, text, html };
}

export function buildReelEml(m: ReelMail): string {
  const o = '=_rel_' + Math.random().toString(36).slice(2), a = '=_alt_' + Math.random().toString(36).slice(2);
  return [
    'X-Unsent: 1', 'MIME-Version: 1.0', `Subject: ${hdr(m.subject)}`, `Content-Type: multipart/related; boundary="${o}"; type="multipart/alternative"`, '',
    `--${o}`, `Content-Type: multipart/alternative; boundary="${a}"`, '',
    `--${a}`, 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', wrap(utf8b64(m.text)), '',
    `--${a}`, 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: base64', '', wrap(utf8b64(m.html)), '',
    `--${a}--`, '',
    `--${o}`, 'Content-Type: image/png; name="reel-announcement.png"', 'Content-Transfer-Encoding: base64', 'Content-ID: <reel-announcement>', 'Content-Disposition: inline; filename="reel-announcement.png"', '', wrap(b64(m.png)), '',
    `--${o}--`, '',
  ].join('\r\n');
}
