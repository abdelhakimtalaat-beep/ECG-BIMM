import test from 'node:test';
import assert from 'node:assert/strict';
import { canAnswer, canAssign, canReopen, canResolve, canReturn, canView, showDraft, ticketMessage, ticketNo, validateNew } from '../lib/tickets.ts';
const adm = { id: 'a', role: 'admin' }, eng = { id: 'e', role: 'bim_specialist' }, req = { id: 'r', role: 'viewer' }, other = { id: 'o', role: 'bim_manager' };
const t = (status: string) => ({ status, requester_id: 'r', assignee_id: 'e' });
test('who can see', () => { for (const u of [adm, eng, req]) assert.ok(canView(u, t('New'))); assert.ok(!canView(other, t('New'))); assert.ok(!canView(req, { status: 'New', requester_id: 'x', assignee_id: null })); });
test('workflow permissions', () => {
  assert.ok(canAssign(adm, t('New')) && !canAssign(eng, t('New')) && !canAssign(adm, t('Resolved')));
  assert.ok(canAnswer(eng, t('Assigned')) && !canAnswer(eng, t('Answered')) && !canAnswer(eng, t('New')) && !canAnswer(req, t('Assigned')) && !canAnswer(other, t('Assigned')) && canAnswer(adm, t('New')));
  assert.ok(canReturn(adm, t('Answered')) && !canReturn(adm, t('Assigned')) && !canReturn(eng, t('Answered')) && !canReturn(adm, { ...t('Answered'), assignee_id: null }));
  assert.ok(canResolve(adm, t('Answered')) && canResolve(adm, t('New')) && !canResolve(adm, t('Resolved')) && !canResolve(eng, t('Answered')));
  assert.ok(canReopen(req, t('Resolved')) && canReopen(adm, t('Resolved')) && !canReopen(eng, t('Resolved')) && !canReopen(req, t('Answered')));
  assert.ok(showDraft(adm, t('Answered')) && showDraft(eng, t('Answered')) && !showDraft(req, t('Answered')));
});
const ok = { project_id: 'p', software: 'Revit', title: 'Crash', problem: 'Revit crashes when I sync', priority: 'High', extension: '1234' };
test('validation: everything is mandatory except mobile and image', () => {
  assert.equal(validateNew(ok), null); assert.equal(validateNew({ ...ok, mobile: '0100 123 4567' }), null); assert.equal(validateNew({ ...ok, mobile: '' }), null);
  assert.match(validateNew({ ...ok, project_id: '' })!, /project/); assert.match(validateNew({ ...ok, software: 'Excel' })!, /software/); assert.match(validateNew({ ...ok, title: 'ab' })!, /title/);
  assert.match(validateNew({ ...ok, problem: 'short' })!, /problem/); assert.match(validateNew({ ...ok, priority: '' })!, /priority/); assert.match(validateNew({ ...ok, extension: '' })!, /extension/);
  assert.match(validateNew({ ...ok, extension: 'abc' })!, /extension/); assert.match(validateNew({ ...ok, mobile: 'abc' })!, /mobile/);
});
test('e-mails', () => {
  const tk = { ticket_no: 12, title: 'Crash', project_name: '3613 Spine', software: 'Revit', priority: 'High', problem: 'It crashes' }; assert.equal(ticketNo(12), 'TS-0012');
  const r = ticketMessage(tk, { kind: 'resolved', answer: 'Update the add-in', hasImage: true }, 'Sara', 'https://x/troubleshooting');
  assert.equal(r.subject, '[TS-0012] Answer to your query: Crash'); assert.ok(r.text.includes('Update the add-in') && r.text.includes('attached') && r.text.includes('Reopen') && r.text.startsWith('Hello Sara,'));
  assert.ok(ticketMessage(tk, { kind: 'new', by: 'Sara' }, 'Admin', null).text.includes('It crashes')); assert.ok(ticketMessage(tk, { kind: 'returned', by: 'Boss', note: 'add steps' }, 'E', null).text.includes('add steps'));
  assert.ok(!ticketMessage(tk, { kind: 'resolved', answer: 'x', hasImage: false }, 'S', null).text.includes('attached'));
});
