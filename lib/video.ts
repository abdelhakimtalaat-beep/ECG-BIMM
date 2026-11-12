// How a course video link is shown on the video screen. Pure; unit tested.
export type VideoSrc = { kind: 'file' | 'embed' | 'external'; src: string; open: string };
/** Sites that refuse to be shown inside another page (Autodesk Construction Cloud, Teams, Zoom): their link opens in its own tab. */
const NO_FRAME = /(^|\.)(autodesk\.com|teams\.microsoft\.com|zoom\.us)$/;
const FILE = /\.(mp4|webm|ogv|ogg|m4v|mov)$/i;
/** Direct video files play in a <video>; YouTube / Vimeo / Google Drive links are turned into their embed address; any other web link is tried in a frame. */
export function videoSrc(raw: string | null | undefined): VideoSrc | null {
  const url = (raw ?? '').trim(); if (!/^https?:\/\//i.test(url)) return null;
  let u: URL; try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  if (FILE.test(u.pathname)) return { kind: 'file', src: url, open: url };
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] || null;
  else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else { const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,})/); if (m) id = m[1]; }
  }
  if (id && /^[\w-]{6,}$/.test(id)) return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${id}`, open: url };
  if (host === 'vimeo.com') { const m = u.pathname.match(/^\/(?:video\/)?(\d+)/); if (m) return { kind: 'embed', src: `https://player.vimeo.com/video/${m[1]}`, open: url }; }
  if (host === 'player.vimeo.com') return { kind: 'embed', src: url, open: url };
  if (host === 'drive.google.com') { const m = u.pathname.match(/^\/file\/d\/([\w-]+)/); if (m) return { kind: 'embed', src: `https://drive.google.com/file/d/${m[1]}/preview`, open: url }; }
  if (NO_FRAME.test(host)) return { kind: 'external', src: url, open: url };
  return { kind: 'embed', src: url, open: url };
}
