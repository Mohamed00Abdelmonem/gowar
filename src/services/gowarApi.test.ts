import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImageUrl } from './imageUtils.ts';

test('normalizeImageUrl rewrites legacy http media/static URLs to relative paths', () => {
  assert.equal(
    normalizeImageUrl('http://91.90.83.126/static/catalog_library/nescafe.webp'),
    '/static/catalog_library/nescafe.webp'
  );
  assert.equal(
    normalizeImageUrl('http://91.90.83.126/media/products/uploads/test.png'),
    '/media/products/uploads/test.png'
  );
  assert.equal(
    normalizeImageUrl('https://gowar.shop/static/catalog_library/nescafe.webp'),
    'https://gowar.shop/static/catalog_library/nescafe.webp'
  );
  assert.equal(normalizeImageUrl(''), '');
});
