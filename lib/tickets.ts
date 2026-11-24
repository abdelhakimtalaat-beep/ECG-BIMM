// Troubleshooting workflow rules and e-mail texts (pure; unit tested). No imports on purpose.
//   New -> (Administrator transfers) Assigned -> (engineer answers) Answered = waiting for review
//   -> (Administrator edits and confirms) Resolved + e-mail to the requester.   The Administrator may also return an answer to the engineer.
export const SOFTWARE = ['Revit', 'Civil 3D', 'Navisworks', 'Autodesk Forma', 'AutoCAD', 'Other'] as const;
export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export const TICKET_STATUSES = ['New', 'Assigned', 'Answered', 'Resolved'] as const;
export const STATUS_LABEL: Record<string, string> = { New: 'New', Assigned: 'Assigned', Answered: 'Awaiting review', Resolved: 'Resolved' };
export const ASSIGNEE_ROLES = ['bim_manager', 'bim_coordinator', 'bim_specialist'] as const;
export const ticketNo = (n: number | string) => `TS-${String(n).padStart(4, '0')}`;
export const priorityRank = (p: string) => PRIORITIES.indexOf(p as any);

export interface TicketLite { status: string; requester_id: string | null; assignee_id: string | null }
export interface Actor { id: string; role: string }
export const isAdmin = (u: Actor) => u.role === 'admin';
/** The Administrator sees every query; everybody else sees the ones he sent or that were transferred to him. */
export const canView = (u: Actor, t: TicketLite) => isAdmin(u) || (!!t.requester_id && t.requester_id === u.id) || (!!t.assignee_id && t.assignee_id === u.id);
/** The engineer it was transferred to answers while it is Assigned; the Administrator may answer anything that is not resolved. */
export const canAnswer = (u: Actor, t: TicketLite) => (isAdmin(u) && t.status !== 'Resolved') || (t.status === 'Assigned' && !!t.assignee_id && t.assignee_id === u.id);
export const canAssign = (u: Actor, t: TicketLite) => isAdmin(u) && t.status !== 'Resolved';
export const canReturn = (u: Actor, t: TicketLite) => isAdmin(u) && t.status === 'Answered' && !!t.assignee_id;
export const canResolve = (u: Actor, t: TicketLite) => isAdmin(u) && t.status !== 'Resolved';
export const canReopen = (u: Actor, t: TicketLite) => t.status === 'Resolved' && (isAdmin(u) || (!!t.requester_id && t.requester_id === u.id));
/** The requester must never see an unconfirmed answer or the internal steps. */
export const showDraft = (u: Actor, t: TicketLite) => isAdmin(u) || (!!t.assignee_id && t.assignee_id === u.id);

export interface NewTicket { project_id: string; software: string; title: string; problem: string; priority: string; extension: string; mobile?: string | null }
/** Returns the first problem with a new query, or null. Everything is mandatory except the mobile number and the image. */
export function validateNew(b: Partial<NewTicket>): string | null {
  const t = (v: unknown) => String(v ?? '').trim();
  if (!t(b.project_id)) return 'Select the project'; if (!(SOFTWARE as readonly string[]).includes(t(b.software))) return 'Select the software';
  if (t(b.title).length < 3) return 'Enter a title (at least 3 characters)'; if (t(b.problem).length < 10) return 'Describe the problem (at least 10 characters)';
  if (!(PRIORITIES as readonly string[]).includes(t(b.priority))) return 'Select the priority'; if (!t(b.extension)) return 'Enter your extension';
  if (t(b.extension).length > 20 || !/^[\d\s+\-()#.]+$/.test(t(b.extension))) return 'The extension can only contain digits'; if (t(b.mobile) && !/^[\d\s+\-()]{6,25}$/.test(t(b.mobile))) return 'The mobile number is not valid';
  return null;
}

const sig = ['', 'ECG BIM Department'];
const head = (name: string) => [`Hello ${name},`, ''];
const brief = (t: { ticket_no: number | string; title: string; project_name: string; software: string; priority: string }) => [`Query: ${ticketNo(t.ticket_no)} - ${t.title}`, `Project: ${t.project_name}`, `Software: ${t.software}`, `Priority: ${t.priority}`];
type T = { ticket_no: number | string; title: string; project_name: string; software: string; priority: string; problem?: string };
export type TicketMail =
  | { kind: 'received' } | { kind: 'new'; by: string } | { kind: 'assigned'; by: string } | { kind: 'review'; by: string }
  | { kind: 'returned'; by: string; note: string } | { kind: 'resolved'; answer: string; hasImage: boolean } | { kind: 'reopened'; by: string; note: string };
/** Subject and text of each e-mail of the workflow. */
export function ticketMessage(t: T, m: TicketMail, name: string, link: string | null): { subject: string; text: string } {
  const no = ticketNo(t.ticket_no), open = link ? ['', `Open it in the portal: ${link}`] : [];
  const problem = t.problem ? ['', 'The problem:', t.problem] : [];
  switch (m.kind) {
    case 'received': return { subject: `[${no}] We received your query: ${t.title}`, text: [...head(name), 'We received your troubleshooting query. The BIM Department will transfer it to the right engineer and send you the answer by e-mail.', '', ...brief(t), ...open, ...sig].join('\n') };
    case 'new': return { subject: `[${no}] New troubleshooting query (${t.priority}): ${t.title}`, text: [...head(name), `${m.by} sent a new query. Please transfer it to a BIM Manager, BIM Coordinator or BIM Specialist.`, '', ...brief(t), ...problem, ...open].join('\n') };
    case 'assigned': return { subject: `[${no}] Query transferred to you (${t.priority}): ${t.title}`, text: [...head(name), `${m.by} transferred this query to you. Please answer it in the portal; the Administrator will review your answer before it is sent to the requester.`, '', ...brief(t), ...problem, ...open].join('\n') };
    case 'review': return { subject: `[${no}] Answer waiting for your review: ${t.title}`, text: [...head(name), `${m.by} answered this query. Please review it, edit it if needed and confirm to send it to the requester.`, '', ...brief(t), ...open].join('\n') };
    case 'returned': return { subject: `[${no}] Your answer was returned for changes: ${t.title}`, text: [...head(name), `${m.by} returned your answer with this note:`, m.note, '', ...brief(t), ...open].join('\n') };
    case 'resolved': return { subject: `[${no}] Answer to your query: ${t.title}`, text: [...head(name), 'The BIM Department answered your troubleshooting query.', '', ...brief(t), '', 'Answer:', m.answer, ...(m.hasImage ? ['', '(The image is attached to this e-mail.)'] : []), ...open, '', 'If this did not solve the problem, open the query in the portal and press Reopen.', ...sig].join('\n') };
    case 'reopened': return { subject: `[${no}] Query reopened: ${t.title}`, text: [...head(name), `${m.by} reopened this query:`, m.note, '', ...brief(t), ...open].join('\n') };
  }
}
