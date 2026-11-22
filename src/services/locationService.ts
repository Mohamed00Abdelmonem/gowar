import type { Area, Language, Merchant } from '../types';

export const DEFAULT_SEARCH_RADIUS_KM = 3;
export const MIN_SEARCH_RADIUS_KM = 1;
export const MAX_SEARCH_RADIUS_KM = 20;
export const QUICK_RADIUS_OPTIONS = [1, 3, 5, 10, 15, 20] as const;

export interface Coordinates {
  lat: number;
  lng: number;
}

export type DeliveryAvailabilityStatus =
  | 'deliverable'
  | 'outside_delivery_area'
  | 'pickup_only';

export interface EvaluatedStore {
  merchant: Merchant;
  distanceKm: number;
  withinSearchRadius: boolean;
  withinDeliveryCoverage: boolean;
  isDeliverable: boolean;
  deliveryStatus: DeliveryAvailabilityStatus;
}

export interface GeocodingSuggestion {
  id: string;
  displayName: string;
  shortLabel: string;
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Computes straight-line geographic distance in kilometers using the Haversine formula.
 */
export function calculateHaversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return Number((EARTH_RADIUS_KM * c).toFixed(2));
}

export function calculateBillableKm(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 1;
  const shifted = Number((distanceKm - 0.5).toFixed(4));
  return Math.max(1, Math.ceil(shifted));
}

export function calculateDynamicDeliveryFee(
  distanceKm: number,
  pricePerKm: number
): { billableKm: number; deliveryFee: number } {
  const billableKm = calculateBillableKm(distanceKm);
  const safeRate = Math.max(0, Number.isFinite(pricePerKm) ? pricePerKm : 0);
  const deliveryFee = Number((billableKm * safeRate).toFixed(2));
  return { billableKm, deliveryFee };
}

export function buildGoogleMapsDirectionsUrl(
  lat: unknown,
  lng: unknown
): string | null {
  if (
    lat === null ||
    lat === undefined ||
    lat === '' ||
    lng === null ||
    lng === undefined ||
    lng === '' ||
    typeof lat === 'boolean' ||
    typeof lng === 'boolean'
  ) {
    return null;
  }
  const numLat = typeof lat === 'number' ? lat : Number(lat);
  const numLng = typeof lng === 'number' ? lng : Number(lng);
  if (
    !Number.isFinite(numLat) ||
    !Number.isFinite(numLng) ||
    numLat < -90 ||
    numLat > 90 ||
    numLng < -180 ||
    numLng > 180 ||
    (numLat === 0 && numLng === 0)
  ) {
    return null;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${numLat},${numLng}`;
}

export function clampSearchRadiusKm(radiusKm: number): number {
  if (!Number.isFinite(radiusKm)) return DEFAULT_SEARCH_RADIUS_KM;
  return Math.min(MAX_SEARCH_RADIUS_KM, Math.max(MIN_SEARCH_RADIUS_KM, Math.round(radiusKm)));
}

export function formatDistanceShort(distanceKm: number, lang: Language): string {
  if (distanceKm < 1) {
    const meters = Math.max(50, Math.round(distanceKm * 1000));
    return lang === 'ar' ? `${meters} م` : `${meters} m`;
  }
  const kmText = distanceKm.toFixed(1).replace(/\.0$/, '');
  return lang === 'ar' ? `${kmText} كم` : `${kmText} km`;
}

export function formatDistanceAway(
  distanceKm: number,
  lang: Language,
  includeApproximate = false
): string {
  const unit = formatDistanceShort(distanceKm, lang);
  if (lang === 'ar') {
    return includeApproximate ? `يبعد عنك ${unit} (تقريباً)` : `يبعد عنك ${unit}`;
  }
  return includeApproximate ? `~${unit} away` : `${unit} away`;
}

/**
 * Evaluates discovery radius and merchant delivery coverage independently.
 */
export function evaluateStoreAvailability(
  merchant: Merchant,
  customerCoords: Coordinates,
  searchRadiusKm: number
): EvaluatedStore {
  const distanceKm = calculateHaversineDistanceKm(customerCoords, merchant.coordinates);
  const withinSearchRadius = distanceKm <= searchRadiusKm;
  const deliveryEnabled = merchant.delivery.deliveryEnabled;
  const withinDeliveryCoverage = distanceKm <= merchant.delivery.maxDistanceKm;

  let deliveryStatus: DeliveryAvailabilityStatus = 'deliverable';
  if (!deliveryEnabled) {
    deliveryStatus = 'pickup_only';
  } else if (!withinDeliveryCoverage) {
    deliveryStatus = 'outside_delivery_area';
  }

  return {
    merchant,
    distanceKm,
    withinSearchRadius,
    withinDeliveryCoverage,
    isDeliverable: deliveryStatus === 'deliverable',
    deliveryStatus,
  };
}

export type NearbySortMode = 'nearest' | 'lowest_fee' | 'highest_rating' | 'fastest';

export function filterNearbyStores(
  merchants: Merchant[],
  customerCoords: Coordinates,
  searchRadiusKm: number,
  sortMode: NearbySortMode = 'nearest'
): EvaluatedStore[] {
  const evaluated = merchants
    .filter((m) => m.status === 'approved')
    .map((m) => evaluateStoreAvailability(m, customerCoords, searchRadiusKm))
    .filter((item) => item.withinSearchRadius);

  return evaluated.sort((a, b) => {
    if (sortMode === 'lowest_fee') {
      return (
        a.merchant.delivery.deliveryFee - b.merchant.delivery.deliveryFee ||
        a.distanceKm - b.distanceKm
      );
    }
    if (sortMode === 'highest_rating') {
      return b.merchant.rating - a.merchant.rating || a.distanceKm - b.distanceKm;
    }
    if (sortMode === 'fastest') {
      return (
        a.merchant.delivery.deliveryTimeMin - b.merchant.delivery.deliveryTimeMin ||
        a.distanceKm - b.distanceKm
      );
    }
    const aOrders = a.merchant.isOpen ? (a.merchant.customerCompletedOrdersCount ?? 0) : 0;
    const bOrders = b.merchant.isOpen ? (b.merchant.customerCompletedOrdersCount ?? 0) : 0;
    if (aOrders !== bOrders && (aOrders > 0 || bOrders > 0)) {
      const score = (orders: number, distKm: number) => {
        const proximity = Math.max(0, 1 - distKm / Math.max(1, searchRadiusKm)) * 40;
        const rel = orders > 0 ? 25 + Math.min(20, (orders - 1) * 5) : 0;
        return proximity + rel;
      };
      return score(bOrders, b.distanceKm) - score(aOrders, a.distanceKm) || a.distanceKm - b.distanceKm;
    }
    return a.distanceKm - b.distanceKm;
  });
}

export function inferNearestArea(coords: Coordinates, areas: Area[]): Area | undefined {
  const activeWithCoords = areas.filter((a) => a.isActive && Boolean(a.coordinates));
  const pool =
    activeWithCoords.length > 0
      ? activeWithCoords
      : areas.filter((a) => Boolean(a.coordinates));
  if (pool.length === 0) return areas.find((a) => a.isActive) ?? areas[0];

  let closest = pool[0];
  let bestDist = Infinity;
  for (const area of pool) {
    if (!area.coordinates) continue;
    const dist = calculateHaversineDistanceKm(coords, area.coordinates);
    if (dist < bestDist) {
      bestDist = dist;
      closest = area;
    }
  }
  return closest;
}

export interface CoverageSupportResult {
  isSupported: boolean;
  nearestActiveArea?: Area;
  distanceKm: number | null;
}

/**
 * Checks whether coordinates fall within Gowar's active supported city coverage.
 */
export function evaluateCoverageSupport(
  coords: Coordinates,
  areas: Area[],
  maxAreaDistanceKm = 25
): CoverageSupportResult {
  const activeWithCoords = areas.filter((a) => a.isActive && Boolean(a.coordinates));
  if (activeWithCoords.length === 0) {
    return { isSupported: true, distanceKm: null };
  }

  let closest = activeWithCoords[0];
  let bestDist = Infinity;
  for (const area of activeWithCoords) {
    if (!area.coordinates) continue;
    const dist = calculateHaversineDistanceKm(coords, area.coordinates);
    if (dist < bestDist) {
      bestDist = dist;
      closest = area;
    }
  }

  return {
    isSupported: bestDist <= maxAreaDistanceKm,
    nearestActiveArea: closest,
    distanceKm: Number.isFinite(bestDist) ? bestDist : null,
  };
}

function getGeocodingBaseUrl(): string {
  const envUrl = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_GEOCODING_URL;
  return envUrl?.trim() || 'https://nominatim.openstreetmap.org';
}

interface NominatimAddressParts {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  state?: string;
}

interface NominatimResult {
  place_id?: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddressParts;
}

function buildCompactAddressLabel(item: NominatimResult): string {
  const addr = item.address;
  if (!addr) {
    return item.display_name.split(',').slice(0, 3).join('، ').trim();
  }
  const parts = [
    addr.road,
    addr.neighbourhood ?? addr.suburb ?? addr.city_district,
    addr.city ?? addr.town ?? addr.state,
  ].filter(Boolean);
  if (parts.length === 0) {
    return item.display_name.split(',').slice(0, 3).join('، ').trim();
  }
  return parts.join('، ');
}

export async function searchEgyptAddresses(
  query: string,
  lang: Language,
  signal?: AbortSignal
): Promise<{ ok: true; results: GeocodingSuggestion[] } | { ok: false; error: string }> {
  const trimmed = query.trim();
  if (!trimmed) return { ok: true, results: [] };

  const baseUrl = getGeocodingBaseUrl().replace(/\/+$/, '');
  const params = new URLSearchParams({
    format: 'jsonv2',
    countrycodes: 'eg',
    addressdetails: '1',
    limit: '6',
    q: trimmed,
    'accept-language': lang === 'ar' ? 'ar,en' : 'en,ar',
  });

  try {
    const res = await fetch(`${baseUrl}/search?${params.toString()}`, {
      signal,
      headers: {
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Geocoding service returned HTTP ${res.status}`,
      };
    }
    const raw = (await res.json()) as NominatimResult[];
    const results: GeocodingSuggestion[] = raw.map((item, idx) => ({
      id: String(item.place_id ?? `${item.lat}-${item.lon}-${idx}`),
      displayName: item.display_name,
      shortLabel: buildCompactAddressLabel(item),
      lat: Number(item.lat),
      lng: Number(item.lon),
    }));
    return { ok: true, results };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return { ok: false, error: 'aborted' };
    }
    return {
      ok: false,
      error: (err as Error)?.message || 'Network error',
    };
  }
}

export async function reverseGeocodeCoordinates(
  coords: Coordinates,
  lang: Language,
  signal?: AbortSignal
): Promise<{ ok: true; label: string } | { ok: false }> {
  const baseUrl = getGeocodingBaseUrl().replace(/\/+$/, '');
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(coords.lat),
    lon: String(coords.lng),
    zoom: '18',
    addressdetails: '1',
    'accept-language': lang === 'ar' ? 'ar,en' : 'en,ar',
  });

  try {
    const res = await fetch(`${baseUrl}/reverse?${params.toString()}`, {
      signal,
      headers: {
        Accept: 'application/json',
      },
    });
    if (!res.ok) return { ok: false };
    const item = (await res.json()) as NominatimResult;
    if (!item?.display_name) return { ok: false };
    return { ok: true, label: buildCompactAddressLabel(item) };
  } catch {
    return { ok: false };
  }
}
