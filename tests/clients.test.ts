import test from 'node:test';
import assert from 'node:assert/strict';
import { clientKey, mostCommon, unifyNames } from '../lib/clients.ts';
test('client keys ignore spelling noise', () => {
  assert.equal(clientKey('Palm Hills'), clientKey('  PALM  hills '));
  assert.equal(clientKey('Orascom Development Co.'), clientKey('orascom development'));
  assert.equal(clientKey('Talaat Moustafa Group (TMG)'), clientKey('talaat moustafa group tmg'));
  assert.equal(clientKey('Emaar & Misr'), clientKey('Emaar and Misr'));
  assert.equal(clientKey('Société Générale'), clientKey('Societe Generale'));
  assert.notEqual(clientKey('Palm Hills'), clientKey('Palm Hills Developments'));
  assert.equal(clientKey('Co'), 'co'); assert.equal(clientKey(''), ''); assert.equal(clientKey(null), '');
  assert.equal(clientKey('شركة النيل'), clientKey('شركة  النيل'));
});
test('variants are unified', () => {
  const g = unifyNames(['Palm Hills', 'palm hills', 'Palm Hills', 'PALM HILLS', 'Orascom', '', null, 'Orascom Ltd.', 'orascom']);
  assert.equal(g.length, 2); const p = g.find((x) => x.key === 'palm hills')!; assert.equal(p.name, 'Palm Hills'); assert.equal(p.count, 4);
  const o = g.find((x) => x.key === 'orascom')!; assert.equal(o.count, 3); assert.equal(o.name, 'Orascom'); assert.equal(o.variants.length, 3);
  assert.equal(unifyNames(['acme', 'ACME']).length, 1);
  assert.equal(unifyNames(['ACME', 'Acme']) [0].name, 'Acme');
});
test('most common value', () => { assert.equal(mostCommon(['Egypt', 'Egypt', 'KSA', '', null]), 'Egypt'); assert.equal(mostCommon([null, '']), null); });
