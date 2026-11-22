import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SEARCH_RADIUS_KM,
  calculateHaversineDistanceKm,
  clampSearchRadiusKm,
  evaluateCoverageSupport,
  evaluateStoreAvailability,
  filterNearbyStores,
  formatDistanceAway,
  formatDistanceShort,
  inferNearestArea,
} from './locationService.ts';
import type { Area, Merchant } from '../types/index.ts';

function makeMerchant(overrides: Partial<Merchant> & Pick<Merchant, 'id' | 'coordinates'>): Merchant {
  return {
    nameAr: 'متجر تجريبي',
    nameEn: 'Test Store',
    type: 'supermarket',
    descriptionAr: '',
    descriptionEn: '',
    logo: '',
    coverImage: '',
    phone: '01000000000',
    addressAr: 'القاهرة',
    addressEn: 'Cairo',
    areaId: 'area-nasr-city',
    distanceKm: 0,
    rating: 4.5,
    reviewCount: 10,
    workingHoursAr: '24 ساعة',
    workingHoursEn: '24 Hours',
    isOpen: true,
    status: 'approved',
    verified: true,
    commissionRate: 5,
    createdAt: '2026-01-01T00:00:00Z',
    categoryIds: ['cat-groceries'],
    delivery: {
      deliveryEnabled: true,
      deliveryFee: 15,
      minOrder: 50,
      maxDistanceKm: 4,
      supportedAreaIds: ['area-nasr-city'],
      prepTimeMin: 10,
      deliveryTimeMin: 25,
    },
    ...overrides,
  };
}

test('calculateHaversineDistanceKm returns 0 for identical coordinates', () => {
  const p = { lat: 30.0566, lng: 31.3376 };
  assert.equal(calculateHaversineDistanceKm(p, p), 0);
});

test('calculateHaversineDistanceKm computes realistic Cairo distances', () => {
  const abbasElAkkad = { lat: 30.0566, lng: 31.3376 };
  const elNour = { lat: 30.0628, lng: 31.3452 };
  const maadi = { lat: 29.9602, lng: 31.2569 };

  const distNour = calculateHaversineDistanceKm(abbasElAkkad, elNour);
  assert.ok(distNour > 0.9 && distNour < 1.15, `expected ~1.0 km, got ${distNour}`);

  const distMaadi = calculateHaversineDistanceKm(abbasElAkkad, maadi);
  assert.ok(distMaadi > 12 && distMaadi < 14.5, `expected ~13.2 km, got ${distMaadi}`);
});

test('clampSearchRadiusKm enforces [1, 20] bounds and default 3 KM', () => {
  assert.equal(DEFAULT_SEARCH_RADIUS_KM, 3);
  assert.equal(clampSearchRadiusKm(0), 1);
  assert.equal(clampSearchRadiusKm(-5), 1);
  assert.equal(clampSearchRadiusKm(3), 3);
  assert.equal(clampSearchRadiusKm(25), 20);
  assert.equal(clampSearchRadiusKm(Number.NaN), 3);
});

test('distance formatters render meters under 1 KM and kilometers >= 1 KM', () => {
  assert.equal(formatDistanceShort(0.45, 'ar'), '450 م');
  assert.equal(formatDistanceShort(0.45, 'en'), '450 m');
  assert.equal(formatDistanceAway(1.2, 'ar'), 'يبعد عنك 1.2 كم');
  assert.equal(formatDistanceAway(1.2, 'en'), '1.2 km away');
});

test('filterNearbyStores enforces customer radius and sorts nearest first', () => {
  const customer = { lat: 30.0566, lng: 31.3376 }; // Abbas El Akkad
  const closeStore = makeMerchant({
    id: 's-close',
    coordinates: { lat: 30.0588, lng: 31.3378 }, // ~0.25 km
  });
  const mediumStore = makeMerchant({
    id: 's-medium',
    coordinates: { lat: 30.0875, lng: 31.3264 }, // ~3.6 km
  });
  const farStore = makeMerchant({
    id: 's-far',
    coordinates: { lat: 29.9602, lng: 31.2569 }, // ~13.2 km
  });

  // At 1 KM: only closeStore fits
  const within1 = filterNearbyStores([farStore, mediumStore, closeStore], customer, 1);
  assert.deepEqual(
    within1.map((s) => s.merchant.id),
    ['s-close']
  );

  // At default 3 KM: still only closeStore
  const within3 = filterNearbyStores([farStore, mediumStore, closeStore], customer, 3);
  assert.deepEqual(
    within3.map((s) => s.merchant.id),
    ['s-close']
  );

  // Expanding to 5 KM adds mediumStore, sorted nearest first
  const within5 = filterNearbyStores([farStore, mediumStore, closeStore], customer, 5);
  assert.deepEqual(
    within5.map((s) => s.merchant.id),
    ['s-close', 's-medium']
  );
  assert.ok(within5[0].distanceKm < within5[1].distanceKm);
});

test('evaluateStoreAvailability keeps customer search radius independent from merchant delivery coverage', () => {
  const customer = { lat: 30.0566, lng: 31.3376 };
  const outsideDeliveryStore = makeMerchant({
    id: 's-out-coverage',
    coordinates: { lat: 30.0875, lng: 31.3264 }, // ~3.6 km away
    delivery: {
      deliveryEnabled: true,
      deliveryFee: 10,
      minOrder: 50,
      maxDistanceKm: 2, // Merchant only delivers up to 2 km
      supportedAreaIds: ['area-heliopolis'],
      prepTimeMin: 10,
      deliveryTimeMin: 25,
    },
  });

  const pickupOnlyStore = makeMerchant({
    id: 's-pickup',
    coordinates: { lat: 30.0588, lng: 31.3378 }, // ~0.25 km away
    delivery: {
      deliveryEnabled: false,
      deliveryFee: 0,
      minOrder: 30,
      maxDistanceKm: 3,
      supportedAreaIds: ['area-nasr-city'],
      prepTimeMin: 10,
      deliveryTimeMin: 20,
    },
  });

  // Within customer 5 KM search radius, but beyond merchant 2 KM delivery coverage
  const resOutside = evaluateStoreAvailability(outsideDeliveryStore, customer, 5);
  assert.equal(resOutside.withinSearchRadius, true);
  assert.equal(resOutside.withinDeliveryCoverage, false);
  assert.equal(resOutside.isDeliverable, false);
  assert.equal(resOutside.deliveryStatus, 'outside_delivery_area');

  const resPickup = evaluateStoreAvailability(pickupOnlyStore, customer, 3);
  assert.equal(resPickup.withinSearchRadius, true);
  assert.equal(resPickup.isDeliverable, false);
  assert.equal(resPickup.deliveryStatus, 'pickup_only');
});

test('changing customer coordinates shifts discovered nearby stores and resolves nearest area', () => {
  const nasrCity = { lat: 30.0566, lng: 31.3376 };
  const maadi = { lat: 29.9602, lng: 31.2580 };

  const storeNasr = makeMerchant({ id: 'store-nasr', coordinates: { lat: 30.0561, lng: 31.3369 } });
  const storeMaadi = makeMerchant({ id: 'store-maadi', coordinates: { lat: 29.9602, lng: 31.2569 } });

  const fromNasr = filterNearbyStores([storeNasr, storeMaadi], nasrCity, 3);
  assert.deepEqual(
    fromNasr.map((x) => x.merchant.id),
    ['store-nasr']
  );

  const fromMaadi = filterNearbyStores([storeNasr, storeMaadi], maadi, 3);
  assert.deepEqual(
    fromMaadi.map((x) => x.merchant.id),
    ['store-maadi']
  );

  const sampleAreas: Area[] = [
    {
      id: 'area-nasr-city',
      nameAr: 'مدينة نصر',
      nameEn: 'Nasr City',
      cityAr: 'القاهرة',
      cityEn: 'Cairo',
      isActive: true,
      coordinates: { lat: 30.0566, lng: 31.3376 },
    },
    {
      id: 'area-maadi',
      nameAr: 'المعادي',
      nameEn: 'Maadi',
      cityAr: 'القاهرة',
      cityEn: 'Cairo',
      isActive: true,
      coordinates: { lat: 29.9608, lng: 31.2582 },
    },
  ];
  assert.equal(inferNearestArea(maadi, sampleAreas)?.id, 'area-maadi');
  assert.equal(inferNearestArea(nasrCity, sampleAreas)?.id, 'area-nasr-city');
});


test('Mansoura is inferred as active area, inactive areas are skipped, and unsupported cities are flagged', () => {
  const areaMansoura: Area = {
    id: 'area-mansoura',
    nameAr: 'المنصورة',
    nameEn: 'Mansoura',
    cityAr: 'الدقهلية',
    cityEn: 'Dakahlia',
    isActive: true,
    deliveryHubNote: 'حي الجامعة',
    coordinates: { lat: 31.0409, lng: 31.3785 },
  };
  const inactiveMaadi: Area = {
    id: 'area-maadi',
    nameAr: 'المعادي',
    nameEn: 'Maadi',
    cityAr: 'القاهرة',
    cityEn: 'Cairo',
    isActive: false,
    deliveryHubNote: '',
    coordinates: { lat: 29.9608, lng: 31.2582 },
  };

  const inferredNearMaadi = inferNearestArea(
    { lat: 29.961, lng: 31.258 },
    [areaMansoura, inactiveMaadi]
  );
  assert.equal(inferredNearMaadi?.id, 'area-mansoura');

  const mansouraCoverage = evaluateCoverageSupport(
    { lat: 31.042, lng: 31.379 },
    [areaMansoura, inactiveMaadi]
  );
  assert.equal(mansouraCoverage.isSupported, true);
  assert.equal(mansouraCoverage.nearestActiveArea?.id, 'area-mansoura');

  const aswanCoverage = evaluateCoverageSupport(
    { lat: 24.0889, lng: 32.8998 },
    [areaMansoura, inactiveMaadi]
  );
  assert.equal(aswanCoverage.isSupported, false);
});

test('filterNearbyStores boosts previously ordered open stores while preserving proximity fairness', () => {
  const customer = { lat: 31.0409, lng: 31.3785 };
  const storeA = makeMerchant({
    id: 'store-prev-2km',
    isOpen: true,
    customerCompletedOrdersCount: 2,
    coordinates: { lat: 31.054, lng: 31.392 }, // ~1.9 km away
  });
  const storeB = makeMerchant({
    id: 'store-new-500m',
    isOpen: true,
    customerCompletedOrdersCount: 0,
    coordinates: { lat: 31.0435, lng: 31.381 }, // ~0.37 km away
  });

  const ranked = filterNearbyStores([storeB, storeA], customer, 5, 'nearest');
  assert.deepEqual(
    ranked.map((r) => r.merchant.id),
    ['store-prev-2km', 'store-new-500m']
  );
});

import { calculateBillableKm, calculateDynamicDeliveryFee } from './locationService.ts';

test('calculateBillableKm enforces 1.5 km band pricing boundaries', () => {
  const cases: Array<[number, number]> = [
    [0.5, 1],
    [1.0, 1],
    [1.25, 1],
    [1.5, 1],
    [1.51, 2],
    [2.0, 2],
    [2.5, 2],
    [2.51, 3],
    [3.5, 3],
    [3.51, 4],
  ];
  for (const [dist, expected] of cases) {
    assert.equal(calculateBillableKm(dist), expected, `Failed for ${dist} km`);
  }
  const feeRes = calculateDynamicDeliveryFee(1.8, 10);
  assert.equal(feeRes.billableKm, 2);
  assert.equal(feeRes.deliveryFee, 20);
});
