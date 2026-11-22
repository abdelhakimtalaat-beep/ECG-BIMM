import test from 'node:test';
import assert from 'node:assert/strict';
import { addressKey, decodeFull, distanceKm, findPlusCode, geocodeQueries, recoverShort, resolveCode, validPoint } from '../lib/geo.ts';
test('plus code: full code decodes to the known place', () => {
  const p = decodeFull('8FVC9G8F+6X')!;   /* Zurich, from the Open Location Code reference */
  assert.ok(Math.abs(p.lat - 47.3655) < 0.001 && Math.abs(p.lng - 8.5242) < 0.001, JSON.stringify(p));
});
test('plus code: short code recovers near a reference', () => {
  const p = recoverShort('9G8F+6X', { lat: 47.4, lng: 8.5 })!;
  assert.ok(distanceKm(p, { lat: 47.3655, lng: 8.5242 }) < 0.2, JSON.stringify(p));
  const q = recoverShort('9G8F+6X', { lat: 47.0, lng: 8.1 })!;   /* a reference some distance away still lands in the right 1 degree square */
  assert.ok(distanceKm(q, { lat: 47.3655, lng: 8.5242 }) < 0.2, JSON.stringify(q));
});
test('plus code in an ACC address line', () => {
  const f = findPlusCode('5J38+47R, El Shorouk, Cairo Governorate 4923422')!;
  assert.equal(f.code, '5J38+47R'); assert.equal(f.rest, 'El Shorouk, Cairo Governorate 4923422');
  assert.equal(findPlusCode('12 Nile Street'), null); assert.equal(findPlusCode('Building 5J38 plus'), null);
  const full = findPlusCode('7GXX5J38+47R Cairo')!; assert.equal(full.code, '7GXX5J38+47R'); assert.ok(resolveCode(full.code, null));
  assert.equal(resolveCode('5J38+47R', null), null);
});
test('El Shorouk code lands in Egypt', () => {
  const p = recoverShort('5J38+47R', { lat: 30.12, lng: 31.6 })!;
  assert.ok(p.lat > 29.9 && p.lat < 30.3 && p.lng > 31.4 && p.lng < 31.8, JSON.stringify(p));
});
test('coordinates and keys', () => {
  assert.equal(validPoint('0', '0'), null); assert.equal(validPoint('', ''), null); assert.deepEqual(validPoint('30.1', '31.6'), { lat: 30.1, lng: 31.6 }); assert.equal(validPoint(91, 0), null);
  const a = { line1: '5J38+47R, El Shorouk, Cairo Governorate 4923422', city: 'Cairo', state: 'Cairo', postal: '00000', country: 'Egypt' };
  assert.equal(addressKey(a, null), addressKey({ ...a }, null)); assert.notEqual(addressKey(a, null), addressKey({ ...a, city: 'Giza' }, null));
  const q = geocodeQueries(a); assert.ok(q.locality[0].startsWith('El Shorouk, Cairo Governorate')); assert.ok(!q.locality[0].includes('4923422')); assert.equal(q.address.length, 0);
  assert.ok(geocodeQueries({ line1: '12 Nile Street', city: 'Cairo', country: 'Egypt' }).address[0].includes('12 Nile Street'));
});
