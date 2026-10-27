// Wish List rules (pure; unit tested). Everybody signed in can propose and vote; the Administrator manages status and replies.
export const WISH_STATUSES = ['New', 'Under review', 'Planned', 'Done', 'Declined'] as const;
export const WISH_AREAS = ['Dashboard', 'Org chart', 'Projects', 'Teams & assignments', 'Workload', 'Tasks', 'BIM Reels', 'Reports & export', 'Mobile', 'Other'] as const;
export interface WishLite { author_id: string | null; status: string }
/** The author may change or delete his own idea until the Administrator has picked it up (status New). The Administrator always may. */
export const canEditWish = (role: string | undefined, userId: string | undefined, w: WishLite) => role === 'admin' || (!!userId && w.author_id === userId && w.status === 'New');
export const canManageWish = (role: string | undefined) => role === 'admin';
export function sortWishes<T extends { votes: number; created_at: string }>(rows: T[], by: 'votes' | 'newest'): T[] {
  return [...rows].sort((a, b) => (by === 'votes' ? b.votes - a.votes || b.created_at.localeCompare(a.created_at) : b.created_at.localeCompare(a.created_at)));
}
