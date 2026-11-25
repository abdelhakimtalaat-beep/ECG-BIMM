import test from 'node:test';
import assert from 'node:assert/strict';
import { routeLabel, canAnswer, canAssign, canReopen, canResolve, canReturn, canView, showDraft, ticketMessage, ticketNo, validateNew } from '../lib/tickets.ts';
const adm = { id: 'a', role: 'admin' }, eng = { id: 'e', role: 'bim_specialist' }, req = { id: 'r', role: 'viewer' }, other = { id: 'o', role: 'bim_manager' };
const t = (status: string) => ({ status, requester_id: 'r', assignee_id: 'e' });
test('who can see', () => { for (const u of [adm, eng, req]) assert.ok(canView(u, t('New'))); assert.ok(!canView(other, t('New'))); assert.ok(!canView(req, { status: 'New', requester_id: 'x', assignee_id: null })); });
test('workflow permissions', () => {
  assert.ok(canAssign(adm, t('New')) && !canAssign(eng, t('New')) && !canAssign(adm, t('Resolved')) && canAssign(eng, t('Assigned')) && !canAssign(req, t('Assigned')));   /* the engineer can hand it over */
  assert.ok(canAnswer(eng, t('Assigned')) && !canAnswer(eng, t('Answered')) && !canAnswer(eng, t('New')) && !canAnswer(req, t('Assigned')) && !canAnswer(other, t('Assigned')) && canAnswer(adm, t('New')));
  assert.ok(canReturn(adm, t('Answered')) && !canReturn(adm, t('Assigned')) && !canReturn(eng, t('Answered')) && !canReturn(adm, { ...t('Answered'), assignee_id: null }));
  assert.ok(canResolve(adm, t('Answered')) && canResolve(adm, t('New')) && !canResolve(adm, t('Resolved')) && !canResolve(eng, t('Answered')));
  assert.ok(canReopen(req, t('Resolved')) && canReopen(adm, t('Resolved')) && !canReopen(eng, t('Resolved')) && !canReopen(req, t('Answered')));
  assert.ok(showDraft(adm, t('Answered')) && showDraft(eng, t('Answered')) && !showDraft(req, t('Answered')));
});
const ok = { project_id: 'p', ticket_type: 'Troubleshooting', software: 'Revit', title: 'Crash', problem: 'Revit crashes when I sync', priority: 'High', extension: '1234' };
test('validation: everything is mandatory except mobile and image', () => {
  assert.equal(validateNew(ok), null); assert.equal(validateNew({ ...ok, mobile: '0100 123 4567' }), null); assert.equal(validateNew({ ...ok, mobile: '' }), null);
  assert.match(validateNew({ ...ok, project_id: '' })!, /project/); assert.match(validateNew({ ...ok, software: 'Excel' })!, /software/); assert.match(validateNew({ ...ok, title: 'ab' })!, /title/);
  assert.match(validateNew({ ...ok, problem: 'short' })!, /description/); assert.match(validateNew({ ...ok, ticket_type: '' })!, /type/); assert.equal(validateNew({ ...ok, ticket_type: 'New Tool' }), null); assert.match(validateNew({ ...ok, priority: '' })!, /priority/); assert.match(validateNew({ ...ok, extension: '' })!, /extension/);
  assert.match(validateNew({ ...ok, extension: 'abc' })!, /extension/); assert.match(validateNew({ ...ok, mobile: 'abc' })!, /mobile/);
});
test('reviewers added by the Administrator', () => {
  const rev = { id: 'v', role: 'bim_coordinator', reviewer: true }; const x = { id: 'n', role: 'bim_coordinator' };
  assert.ok(canView(rev, t('New')) && !canView(x, t('New')) && showDraft(rev, t('Answered')) && canReturn(rev, t('Answered')) && canResolve(rev, t('Answered')) && canReopen(rev, t('Resolved')));
  assert.ok(!canResolve(rev, t('New')) && !canAssign(rev, t('New')) && !canAnswer(rev, t('Assigned')));   /* a reviewer confirms answers; only the Administrator transfers or answers directly */
});
test('reviewers added by the Administrator', () => {
  const rev = { id: 'v', role: 'bim_coordinator', reviewer: true }; const x = { id: 'n', role: 'bim_coordinator' };
  assert.ok(canView(rev, t('New')) && !canView(x, t('New')) && showDraft(rev, t('Answered')) && canReturn(rev, t('Answered')) && canResolve(rev, t('Answered')) && canReopen(rev, t('Resolved')));
  assert.ok(!canResolve(rev, t('New')) && !canAssign(rev, t('New')) && !canAnswer(rev, t('Assigned')));   /* a reviewer confirms answers; only the Administrator transfers or answers directly */
});
test('e-mails', () => {
  const tk = { ticket_no: 12, title: 'Crash', project_name: '3613 Spine', software: 'Revit', priority: 'High', problem: 'It crashes' }; assert.equal(ticketNo(12), 'TS-0012');
  const r = ticketMessage(tk, { kind: 'resolved', answer: 'Update the add-in', hasImage: true }, 'Sara', 'https://x/troubleshooting');
  assert.equal(r.subject, '[TS-0012] Solution of your ticket: Crash'); assert.ok(r.text.includes('Update the add-in') && r.text.includes('attached') && r.text.includes('Reopen') && r.text.startsWith('Hello Sara,'));
  assert.ok(ticketMessage(tk, { kind: 'new', by: 'Sara' }, 'Admin', null).text.includes('It crashes')); assert.ok(ticketMessage(tk, { kind: 'returned', by: 'Boss', note: 'add steps' }, 'E', null).text.includes('add steps'));
  assert.ok(!ticketMessage(tk, { kind: 'resolved', answer: 'x', hasImage: false }, 'S', null).text.includes('attached'));
});

test('routing: recipients may solve a ticket until one takes it', () => {
  const r = { id: 'm', role: 'bim_manager' }, r2 = { id: 'c', role: 'bim_coordinator' };
  const open = { status: 'Assigned', requester_id: 'r', assignee_id: null as string | null, recipient: true };
  assert.ok(canView(r, open) && canAnswer(r, open) && canAssign(r, open) && showDraft(r, open));
  assert.ok(!canAnswer(r, { ...open, recipient: false }) && !canView(r2, { ...open, recipient: false }));
  assert.ok(!canAnswer(r, { ...open, assignee_id: 'x' }) && canView(r, { ...open, assignee_id: 'x' }));   /* somebody else took it: the others only watch */
  assert.ok(canAnswer(r, { ...open, assignee_id: 'm' }) && !canAnswer(r, { ...open, status: 'Answered' }));
  assert.equal(routeLabel('New Tool'), 'R&D BIM Engineers'); assert.match(routeLabel('Troubleshooting'), /BIM Managers and BIM Coordinators/);
});
test('routing e-mails', () => {
  const tk = { ticket_no: 5, title: 'Add-in', project_name: '3613 Spine', software: 'Revit', priority: 'Low', problem: 'Need a tool', ticket_type: 'New Tool' };
  assert.match(ticketMessage(tk, { kind: 'incoming', by: 'Sara', others: ['Omar'] }, 'Ali', null).text, /Omar/);
  assert.match(ticketMessage(tk, { kind: 'new', by: 'Sara', routedTo: ['Ali', 'Omar'] }, 'Admin', null).text, /automatically to: Ali, Omar/);
  assert.match(ticketMessage(tk, { kind: 'new', by: 'Sara', routedTo: [], type: 'New Tool' }, 'Admin', null).text, /R&D BIM Engineers/);
});
test('resolved e-mail names the resolver and the reviewer', () => {
  const tk = { ticket_no: 3, title: 'x', project_name: 'P', software: 'Revit', priority: 'Low', problem: 'p' };
  const m = ticketMessage(tk, { kind: 'resolved', answer: 'Do this', hasImage: false, resolvedBy: 'Ali', reviewedBy: 'Abdelhakim' }, 'S', null).text;
  assert.ok(m.includes('Resolved by: Ali') && m.includes('Reviewed by: Abdelhakim') && m.indexOf('Reviewed by') < m.indexOf('Final solution:'));
});
