import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClientError, formatApiErrorMessage } from './apiClient.ts';

test('formatApiErrorMessage translates 429 rate limit with Retry-After in Arabic and English', () => {
  const err = new ApiClientError('Request was throttled', 429, 'RATE_LIMITED', null, 12);
  assert.equal(
    formatApiErrorMessage(err, 'ar', 'فشل', 'Failed'),
    'أنت بتستخدم الخدمة بسرعة. استنى 12 ثانية وجرب تاني.'
  );
  assert.equal(
    formatApiErrorMessage(err, 'en', 'فشل', 'Failed'),
    'You are making requests too quickly. Please wait 12s and try again.'
  );
});

test('formatApiErrorMessage translates network and 5xx errors cleanly without raw codes', () => {
  const netErr = new ApiClientError('Network error', 0, 'NETWORK_ERROR');
  assert.equal(
    formatApiErrorMessage(netErr, 'ar', 'فشل', 'Failed'),
    'في مشكلة في الاتصال بالإنترنت. راجع اتصالك وحاول تاني.'
  );

  const serverErr = new ApiClientError('HTTP Error 502', 502, 'SERVER_ERROR');
  assert.equal(
    formatApiErrorMessage(serverErr, 'ar', 'فشل', 'Failed'),
    'حصلت مشكلة مؤقتة. حاول مرة تانية.'
  );
  assert.equal(
    formatApiErrorMessage(serverErr, 'en', 'فشل', 'Failed'),
    'A temporary server issue occurred. Please try again.'
  );
});

test('formatApiErrorMessage preserves specific validation messages', () => {
  const valErr = new ApiClientError('quantity: Ensure this value is greater than 0.', 400);
  assert.equal(
    formatApiErrorMessage(valErr, 'en', 'فشل', 'Failed'),
    'quantity: Ensure this value is greater than 0.'
  );
});
