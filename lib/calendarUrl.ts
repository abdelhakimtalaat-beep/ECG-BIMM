// Pure helper: validates the calendar link a user pastes (https, Microsoft / Google calendar servers only; no HTML links).
const HOSTS = /(^|\.)(office365\.com|office\.com|outlook\.com|live\.com|office365\.us|outlook\.cn|microsoft\.com)$|^calendar\.google\.com$/i;
/** Accepts only https links to Microsoft (or Google) calendar servers. webcal:// is converted to https://. */
export function cleanFeedUrl(raw: string): string {
  let u = raw.trim().replace(/^webcal:\/\//i, 'https://');
  let url: URL; try { url = new URL(u); } catch { throw new Error('This is not a valid link. Paste the ICS link from Outlook (Publish a calendar).'); }
  if (url.protocol !== 'https:') throw new Error('The link must start with https:// (or webcal://).');
  if (!HOSTS.test(url.hostname)) throw new Error('Only Outlook / Microsoft 365 (or Google) calendar links are accepted.');
  if (/\.html?($|\?)/i.test(url.pathname)) throw new Error('This is the HTML link. Copy the ICS link instead (the second link in Outlook\'s Publish a calendar).');
  return url.toString();
}
