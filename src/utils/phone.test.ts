import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEgyptPhone } from './phone.ts';

test('normalizes local, international, spaced, and Arabic-Indic Egyptian mobile numbers', () => {
  const cases = [
    '01012345678',
    '+201012345678',
    '201012345678',
    '00201012345678',
    '010 1234-5678',
    '٠١٠١٢٣٤٥٦٧٨',
    '+٢٠١٠١٢٣٤٥٦٧٨',
  ];

  for (const input of cases) {
    const res = normalizeEgyptPhone(input);
    assert.equal(res.ok, true, `Expected ${input} to be valid`);
    if (res.ok) {
      assert.equal(res.value, '+201012345678');
    }
  }
});

test('accepts all valid Egyptian carrier prefixes (010, 011, 012, 015)', () => {
  for (const prefix of ['010', '011', '012', '015']) {
    const res = normalizeEgyptPhone(`${prefix}98765432`);
    assert.equal(res.ok, true);
  }
});

test('rejects invalid, empty, or non-Egyptian mobile numbers', () => {
  const invalid = ['', '   ', '01312345678', '0101234567', '010123456789', '+447911123456', 'abc'];
  for (const input of invalid) {
    const res = normalizeEgyptPhone(input);
    assert.equal(res.ok, false, `Expected ${input} to be rejected`);
  }
});
