// Platform tabs an Administrator can enable per read-only user. Pure; unit tested.
export const TAB_LIST = [
  { href: '/', label: 'Executive Dashboard' }, { href: '/org', label: 'Org Chart' }, { href: '/projects', label: 'Projects' }, { href: '/teams', label: 'Teams and Workload' },
  { href: '/tasks', label: 'Tasks' }, { href: '/reels', label: 'BIM Reels' }, { href: '/contacts', label: 'Contacts' }, { href: '/meetings', label: 'Meetings' },
  { href: '/process-map', label: 'BIM Process Map' }, { href: '/proposals', label: 'Proposals' }, { href: '/email-templates', label: 'Emails Template' }, { href: '/wishes', label: 'Wish List' },
] as const;
export const TAB_HREFS: string[] = TAB_LIST.map((t) => t.href);
type U = { role: string; allowed_tabs?: string[] | null };
/** Only read-only (viewer) users can be limited to chosen tabs; everyone else sees every tab. `null` = all tabs. */
export const isTabRestricted = (u: U) => u.role === 'viewer' && Array.isArray(u.allowed_tabs);
export const canSeeTab = (u: U, href: string) => !isTabRestricted(u) || u.allowed_tabs!.includes(href);
export const tabOfPath = (path: string): string | null => { const t = [...TAB_HREFS].filter((h) => h !== '/').sort((a, b) => b.length - a.length).find((h) => path === h || path.startsWith(h + '/')); return t ?? (path === '/' ? '/' : null); };
export const firstAllowedTab = (u: U): string | null => TAB_LIST.find((t) => canSeeTab(u, t.href))?.href ?? null;
