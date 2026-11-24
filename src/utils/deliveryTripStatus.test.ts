import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CUSTOMER_PROGRESS_STEPS,
  getMerchantTripStatusMeta,
  resolveCustomerProgressStage,
} from './deliveryTripStatus.ts';

test('resolveCustomerProgressStage maps all 6 customer delivery progress stages accurately', () => {
  assert.equal(CUSTOMER_PROGRESS_STEPS.length, 6);

  assert.equal(
    resolveCustomerProgressStage('preparing', 'unassigned', false).labelAr,
    'الطلب قيد التجهيز'
  );
  assert.equal(
    resolveCustomerProgressStage('preparing', 'assigned', true).labelAr,
    'تم تعيين مندوب'
  );
  assert.equal(
    resolveCustomerProgressStage('preparing', 'accepted', true).labelAr,
    'المندوب قبل الرحلة'
  );
  assert.equal(
    resolveCustomerProgressStage('out_for_delivery', 'in_transit', true).labelAr,
    'المندوب في طريقه إليك'
  );
  assert.equal(
    resolveCustomerProgressStage('out_for_delivery', 'arrived', true).labelAr,
    'المندوب وصل إليك'
  );
  assert.equal(
    resolveCustomerProgressStage('delivered', 'completed', true).labelAr,
    'تم تسليم الطلب'
  );
});

test('getMerchantTripStatusMeta returns clear Arabic labels for all trip states', () => {
  assert.match(getMerchantTripStatusMeta('assigned', 'ar').label, /تعيين مندوب/);
  assert.match(getMerchantTripStatusMeta('accepted', 'ar').label, /قبل الرحلة/);
  assert.match(getMerchantTripStatusMeta('in_transit', 'ar').label, /في الطريق/);
  assert.match(getMerchantTripStatusMeta('arrived', 'ar').label, /وصل للعميل/);
  assert.match(getMerchantTripStatusMeta('completed', 'ar').label, /تم تسليم الطلب/);
  assert.match(getMerchantTripStatusMeta('cancelled', 'ar').label, /ألغى المندوب/);
});
