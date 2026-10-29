// Emails Template rules and Outlook links (pure; used by the API and the UI, unit tested).
export const TEMPLATE_STATUSES = ['approved', 'pending', 'rejected'] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];
export interface TemplateRow { status: string; requested_by: string | null }

/** Everybody sees approved templates; the Administrator sees all; a requester sees his own requests. */
export const canSeeTemplate = (t: TemplateRow, role: string | undefined, email: string) => t.status === 'approved' || role === 'admin' || (!!t.requested_by && t.requested_by === email);
/** The Administrator edits/deletes anything; a requester edits or withdraws his own request until it is approved. */
export const canChangeTemplate = (t: TemplateRow, role: string | undefined, email: string) => role === 'admin' || (t.status !== 'approved' && !!t.requested_by && t.requested_by === email);
/** Status a new template gets: the Administrator publishes directly, everybody else sends a request. */
export const newTemplateStatus = (role: string | undefined): TemplateStatus => (role === 'admin' ? 'approved' : 'pending');

const crlf = (s: string) => s.replace(/\r?\n/g, '\r\n');
/** Opens the default mail program (Outlook on a company PC). Long bodies may be cut by some programs. */
export const mailtoLink = (subject: string, body: string) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(crlf(body))}`;
/** Outlook on the web (Microsoft 365) compose window. */
export const outlookWebLink = (subject: string, body: string) => `https://outlook.office.com/mail/deeplink/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
export const LONG_BODY = 1800;
