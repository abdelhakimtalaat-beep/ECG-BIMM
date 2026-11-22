import test from 'node:test';
import assert from 'node:assert/strict';
import { clientKey, clusterNames, mostCommon, sameClient, unifyNames } from '../lib/clients.ts';
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
test('almost the same names are one client', () => {
  const g = unifyNames(['Talaat Mostafa Group', 'Talaat Moustafa Group', 'Talaat Moustafa Group', 'TMG', 'TMG Talaat Mostafa Group', 'Palm Hills', 'Palm Hills Developments', 'Orascom', 'Smart Village', 'Suez Canal']);
  const t = g.find((x) => x.variants.includes('TMG'))!; assert.equal(t.name, 'Talaat Moustafa Group'); assert.equal(t.variants.length, 4); assert.equal(t.count, 5);
  assert.equal(g.length, 5, JSON.stringify(g.map((x) => x.name)));
  assert.ok(sameClient('Mustafa Kamel', 'Moustafa Kamel')); assert.ok(sameClient('Palm Hills', 'Palm Hills Developments'));
});
test('different clients stay apart', () => {
  assert.equal(sameClient('Emaar Misr', 'Emaar Properties'), false); assert.equal(sameClient('Dar Al Handasah', 'Dar Al Arkan'), false); assert.equal(sameClient('Misr Italia', 'Misr Holding'), false);
  assert.equal(sameClient('Saudi Aramco', 'Saudi Electricity'), false); assert.equal(sameClient('Orascom', 'Ora'), false); assert.equal(sameClient('ZOOD', 'Smart Village'), false);
  assert.equal(clusterNames(['ABC', 'ABD']).length, 2);
});
