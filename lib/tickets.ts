// BIM Ticket (troubleshooting / new tool) workflow rules and e-mail texts (pure; unit tested). No imports on purpose.
//   New ticket -> routed automatically: Troubleshooting -> the BIM Managers and BIM Coordinators of the selected project; New Tool -> the R&D BIM Engineers.   (Assigned)
//   The engineer solves it (final solution = text + image) or hands it to a colleague from the org chart -> Answered = waiting for review
//   -> (a reviewer edits and confirms) Resolved + e-mail to the requester.   A reviewer may return a solution to the engineer.
//   When nobody can be found automatically the ticket stays New and the Administrator transfers it.
export const SOFTWARE = ['Revit', 'Civil 3D', 'Navisworks', 'Autodesk Forma', 'AutoCAD', 'Other'] as const;
export const TICKET_TYPES = ['Troubleshooting', 'New Tool'] as const;
export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export const TICKET_STATUSES = ['New', 'Assigned', 'Answered', 'Resolved'] as const;
export const STATUS_LABEL: Record<string, string> = { New: 'New', Assigned: 'Assigned', Answered: 'Awaiting review', Resolved: 'Resolved' };
export const ASSIGNEE_ROLES = ['bim_manager', 'bim_coordinator', 'bim_specialist'] as const;
export const ticketNo = (n: number | string) => `TS-${String(n).padStart(4, '0')}`;
export const priorityRank = (p: string) => PRIORITIES.indexOf(p as any);

/** recipient = the person was one of the engineers the ticket was routed to (while nobody has taken it, any of them may solve it). */
export interface TicketLite { status: string; requester_id: string | null; assignee_id: string | null; recipient?: boolean }
export const RD_LABEL = 'R&D BIM Engineer';
/** Who a new ticket goes to: Troubleshooting -> BIM Managers/Coordinators of the project; New Tool -> R&D BIM Engineers. */
export const routeLabel = (type: string) => (type === 'New Tool' ? `${RD_LABEL}s` : 'BIM Managers and BIM Coordinators of the project');
export interface Actor { id: string; role: string; reviewer?: boolean }
export const isAdmin = (u: Actor) => u.role === 'admin';
/** Reviewers are chosen by the Administrator: they review, edit and confirm the answers (the Administrator always can). */
export const isReviewer = (u: Actor) => isAdmin(u) || u.reviewer === true;
/** The Administrator and the reviewers see every ticket; everybody else sees the ones he sent or that were transferred to him. */
export const canView = (u: Actor, t: TicketLite) => isReviewer(u) || (!!t.requester_id && t.requester_id === u.id) || (!!t.assignee_id && t.assignee_id === u.id) || t.recipient === true;
/** The engineer it was transferred to answers while it is Assigned; the Administrator may answer anything that is not resolved. */
export const canAnswer = (u: Actor, t: TicketLite) => (isAdmin(u) && t.status !== 'Resolved') || (t.status === 'Assigned' && ((!!t.assignee_id && t.assignee_id === u.id) || (!t.assignee_id && t.recipient === true)));
/** Whoever may solve it may also hand it over to another person from the org chart. */
export const canAssign = (u: Actor, t: TicketLite) => canAnswer(u, t);
export const canReturn = (u: Actor, t: TicketLite) => isReviewer(u) && t.status === 'Answered' && !!t.assignee_id;
/** The Administrator may confirm any open ticket; a reviewer confirms answers that are waiting for review. */
export const canResolve = (u: Actor, t: TicketLite) => (isAdmin(u) && t.status !== 'Resolved') || (isReviewer(u) && t.status === 'Answered');
export const canReopen = (u: Actor, t: TicketLite) => t.status === 'Resolved' && (isReviewer(u) || (!!t.requester_id && t.requester_id === u.id));
/** The requester must never see an unconfirmed answer or the internal steps. */
export const showDraft = (u: Actor, t: TicketLite) => isReviewer(u) || (!!t.assignee_id && t.assignee_id === u.id) || t.recipient === true;

export interface NewTicket { project_id: string; ticket_type: string; software: string; title: string; problem: string; priority: string; extension: string; mobile?: string | null }
/** Returns the first problem with a new ticket, or null. Everything is mandatory except the mobile number and the image. */
export function validateNew(b: Partial<NewTicket>): string | null {
  const t = (v: unknown) => String(v ?? '').trim();
  if (!t(b.project_id)) return 'Select the project'; if (!(TICKET_TYPES as readonly string[]).includes(t(b.ticket_type))) return 'Select the ticket type'; if (!(SOFTWARE as readonly string[]).includes(t(b.software))) return 'Select the software';
  if (t(b.title).length < 3) return 'Enter a title (at least 3 characters)'; if (t(b.problem).length < 10) return 'Enter the description (at least 10 characters)';
  if (!(PRIORITIES as readonly string[]).includes(t(b.priority))) return 'Select the priority'; if (!t(b.extension)) return 'Enter your extension';
  if (t(b.extension).length > 20 || !/^[\d\s+\-()#.]+$/.test(t(b.extension))) return 'The extension can only contain digits'; if (t(b.mobile) && !/^[\d\s+\-()]{6,25}$/.test(t(b.mobile))) return 'The mobile number is not valid';
  return null;
}

const sig = ['', 'ECG BIM Department'];
const head = (name: string) => [`Hello ${name},`, ''];
const brief = (t: { ticket_no: number | string; title: string; project_name: string; software: string; priority: string; ticket_type?: string }) => [`Ticket: ${ticketNo(t.ticket_no)} - ${t.title}`, `Type: ${t.ticket_type ?? 'Troubleshooting'}`, `Project: ${t.project_name}`, `Software: ${t.software}`, `Priority: ${t.priority}`];
type T = { ticket_no: number | string; title: string; project_name: string; software: string; priority: string; problem?: string; ticket_type?: string };
export type TicketMail =
  | { kind: 'received' } | { kind: 'new'; by: string; routedTo?: string[]; type?: string } | { kind: 'incoming'; by: string; others: string[] } | { kind: 'assigned'; by: string } | { kind: 'review'; by: string }
  | { kind: 'returned'; by: string; note: string } | { kind: 'resolved'; answer: string; hasImage: boolean } | { kind: 'reopened'; by: string; note: string };
/** Subject and text of each e-mail of the workflow. */
export function ticketMessage(t: T, m: TicketMail, name: string, link: string | null): { subject: string; text: string } {
  const no = ticketNo(t.ticket_no), open = link ? ['', `Open it in the portal: ${link}`] : [];
  const problem = t.problem ? ['', 'Description:', t.problem] : [];
  switch (m.kind) {
    case 'received': return { subject: `[${no}] We received your ticket: ${t.title}`, text: [...head(name), 'We received your BIM ticket. It was sent to the right engineer; the solution is reviewed and then sent to you by e-mail.', '', ...brief(t), ...open, ...sig].join('\n') };
    case 'new': return { subject: `[${no}] New BIM ticket (${t.priority}): ${t.title}`, text: [...head(name), m.routedTo?.length ? `${m.by} sent a new ticket. It was sent automatically to: ${m.routedTo.join(', ')}.` : `${m.by} sent a new ticket, but no engineer could be found automatically (${routeLabel(m.type ?? t.ticket_type ?? '')}). Please transfer it to an engineer.`, '', ...brief(t), ...problem, ...open].join('\n') };
    case 'incoming': return { subject: `[${no}] New BIM ticket for you (${t.priority}): ${t.title}`, text: [...head(name), `${m.by} sent a ${(t.ticket_type ?? 'Troubleshooting').toLowerCase()} ticket and you are one of the engineers it was sent to${m.others.length ? ` (with ${m.others.join(', ')})` : ''}. Whoever opens it first can write the final solution, or hand it over to a colleague from the org chart. The solution is reviewed before it is sent to the requester.`, '', ...brief(t), ...problem, ...open].join('\n') };
    case 'assigned': return { subject: `[${no}] Ticket transferred to you (${t.priority}): ${t.title}`, text: [...head(name), `${m.by} transferred this ticket to you. Please write the final solution in the portal; it is reviewed before it is sent to the requester.`, '', ...brief(t), ...problem, ...open].join('\n') };
    case 'review': return { subject: `[${no}] Solution waiting for your review: ${t.title}`, text: [...head(name), `${m.by} wrote the final solution of this ticket. Please review it, edit it if needed and confirm to send it to the requester.`, '', ...brief(t), ...open].join('\n') };
    case 'returned': return { subject: `[${no}] Your answer was returned for changes: ${t.title}`, text: [...head(name), `${m.by} returned your answer with this note:`, m.note, '', ...brief(t), ...open].join('\n') };
    case 'resolved': return { subject: `[${no}] Solution of your ticket: ${t.title}`, text: [...head(name), 'The BIM Department solved your ticket.', '', ...brief(t), '', 'Final solution:', m.answer, ...(m.hasImage ? ['', '(The image is attached to this e-mail.)'] : []), ...open, '', 'If this did not solve the problem, open the ticket in the portal and press Reopen.', ...sig].join('\n') };
    case 'reopened': return { subject: `[${no}] Ticket reopened: ${t.title}`, text: [...head(name), `${m.by} reopened this ticket:`, m.note, '', ...brief(t), ...open].join('\n') };
  }
}
