// Text of the e-mails to the author of an idea. Pure; unit tested. No imports on purpose.
export type WishAction = { kind: 'status'; from: string; to: string } | { kind: 'reply' } | { kind: 'edited' } | { kind: 'deleted' };
const MEANING: Record<string, string> = { 'Under review': 'we are reviewing it', Planned: 'it is planned for development', Done: 'it has been implemented', Declined: 'it will not be taken forward', New: 'it is back to New' };

/** Pure: the subject and text of the message. */
export function wishMessage(w: { title: string; admin_note: string | null }, a: WishAction, byName: string, link: string | null, name: string) {
  const note = w.admin_note ? ['', `Reply from ${byName}:`, w.admin_note] : [];
  const head = `Hello ${name},`, tail = link ? ['', `See your idea in the Wish List: ${link}`] : [];
  switch (a.kind) {
    case 'status': return { subject: `Your idea "${w.title}" is now: ${a.to}`, lines: [head, '', `The status of your idea "${w.title}" changed from ${a.from} to ${a.to}${MEANING[a.to] ? ` (${MEANING[a.to]})` : ''}.`, ...note, ...tail] };
    case 'reply': return { subject: `Reply to your idea "${w.title}"`, lines: [head, '', `${byName} replied to your idea "${w.title}".`, ...note, ...tail] };
    case 'edited': return { subject: `Your idea "${w.title}" was updated`, lines: [head, '', `${byName} updated the details of your idea "${w.title}".`, ...note, ...tail] };
    case 'deleted': return { subject: `Your idea "${w.title}" was removed`, lines: [head, '', `${byName} removed your idea "${w.title}" from the Wish List.`, ...note] };
  }
}
