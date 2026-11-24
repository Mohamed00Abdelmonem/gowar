import {
  API_BASE_URL,
  apiRequest,
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
  type BackendUserSummary,
} from './apiClient';
import { cleanupPushSubscriptionOnLogout } from './pushNotifications';
import type {
  AppNotification,
  Area,
  Category,
  Customer,
  CustomerAddress,
  DeliveryShiftStatusResponse,
  DeliveryTripStatus,
  DriverVehicleType,
  Merchant,
  MerchantDeliveryDriver,
  MerchantDeliveryOverviewResponse,
  MerchantDeliveryPerformanceResponse,
  MerchantDeliveryTrackingResponse,
  MerchantStatus,
  Order,
  OrderStatus,
  PlatformSettings,
  Product,
} from '../types';

export interface AuthTokenResponse {
  access: string;
  refresh: string;
  user: BackendUserSummary;
}

export interface MerchantRegisterPayload {
  email?: string;
  password: string;
  phone_number: string;
  first_name: string;
  last_name?: string;
  business_name: string;
  store_name: string;
  store_name_en?: string;
  store_type: Merchant['type'];
  area?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  delivery_radius_km: number | string;
}

export interface BackendNotificationPayload {
  id: string;
  store?: string | null;
  title: string;
  body: string;
  title_en?: string;
  body_en?: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export function mapBackendNotification(
  n: BackendNotificationPayload,
  audience: AppNotification['audience']
): AppNotification {
  return {
    id: n.id,
    audience,
    merchantId: n.store ?? undefined,
    titleAr: n.title,
    titleEn: n.title_en || n.title,
    bodyAr: n.body,
    bodyEn: n.body_en || n.body,
    createdAt: n.created_at,
    read: n.is_read,
    link: n.link || (audience === 'merchant' ? '/merchant/orders' : '/orders'),
  };
}

export interface PaginatedResponse<T> {
  pagination: {
    count: number;
    page: number;
    page_size: number;
    total_pages: number;
    next: string | null;
    previous: string | null;
  };
  results: T[];
}

export const authApi = {
  async registerCustomer(payload: {
    phone_number: string;
    password: string;
    first_name: string;
    last_name?: string;
    email?: string;
  }): Promise<AuthTokenResponse> {
    const res = await apiRequest<AuthTokenResponse>('/auth/register/', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    });
    setAuthTokens(res.access, res.refresh, res.user);
    return res;
  },

  registerMerchant(payload: MerchantRegisterPayload) {
    return apiRequest<{ detail: string; approval_status: string; user: BackendUserSummary }>(
      '/auth/merchant/register/',
      {
        method: 'POST',
        body: payload,
        skipAuth: true,
      }
    );
  },

  async loginRole(
    role: 'customer' | 'merchant' | 'delivery' | 'admin',
    phone_number: string,
    password: string
  ): Promise<AuthTokenResponse> {
    const res = await apiRequest<AuthTokenResponse>(`/auth/${role}/login/`, {
      method: 'POST',
      body: { phone_number, password },
      skipAuth: true,
    });
    setAuthTokens(res.access, res.refresh, res.user);
    return res;
  },

  async logout(): Promise<void> {
    const refresh = getRefreshToken();
    try {
      await cleanupPushSubscriptionOnLogout();
      if (refresh) {
        await apiRequest('/auth/logout/', {
          method: 'POST',
          body: { refresh },
        });
      }
    } finally {
      clearAuthTokens();
    }
  },

  getProfile() {
    return apiRequest<BackendUserSummary>('/auth/me/');
  },

  updateProfile(
    updates: Partial<{ first_name: string; last_name: string; phone_number: string }>
  ) {
    return apiRequest<BackendUserSummary>('/auth/me/', {
      method: 'PATCH',
      body: updates,
    });
  },
};

export interface BackendStorePayload {
  id: string;
  name: string;
  name_en: string;
  slug: string;
  store_type: Merchant['type'];
  description: string;
  description_en: string;
  logo: string | null;
  cover_image: string | null;
  logo_url: string;
  cover_image_url: string;
  phone_number: string;
  address: string;
  address_en: string;
  area: string | null;
  latitude: string | number;
  longitude: string | number;
  opening_hours: string;
  is_open: boolean;
  approval_status?: MerchantStatus;
  commission_rate?: string | number;
  delivery_enabled: boolean;
  delivery_fee: string | number;
  delivery_price_per_km?: string | number;
  delivery_radius_km: string | number;
  minimum_order_amount: string | number;
  free_delivery_threshold: string | number | null;
  estimated_delivery_minutes: number;
  rating: string | number;
  review_count: number;
  distance_meters?: number | null;
  distance_km?: number | null;
  delivery_available?: boolean;
  delivery_status?: string;
  customer_completed_orders_count?: number;
  is_previously_ordered?: boolean;
}

export function mapBackendStoreToMerchant(s: BackendStorePayload): Merchant {
  return {
    id: s.id,
    nameAr: s.name,
    nameEn: s.name_en || s.name,
    type: s.store_type || 'supermarket',
    descriptionAr: s.description || '',
    descriptionEn: s.description_en || s.description || '',
    logo: s.logo || s.logo_url || '',
    coverImage: s.cover_image || s.cover_image_url || '',
    phone: s.phone_number,
    addressAr: s.address,
    addressEn: s.address_en || s.address,
    areaId: s.area || '',
    distanceKm: s.distance_km ?? 0,
    rating: Number(s.rating || 4.7),
    reviewCount: s.review_count || 0,
    workingHoursAr: s.opening_hours,
    workingHoursEn: s.opening_hours,
    isOpen: s.is_open,
    status: s.approval_status ?? 'approved',
    verified: (s.approval_status ?? 'approved') === 'approved',
    commissionRate: Number(s.commission_rate ?? 5),
    customerCompletedOrdersCount: Number(s.customer_completed_orders_count ?? 0),
    isPreviouslyOrdered: Boolean(s.is_previously_ordered),
    createdAt: new Date().toISOString(),
    categoryIds: [],
    coordinates: {
      lat: Number(s.latitude),
      lng: Number(s.longitude),
    },
    delivery: {
      deliveryEnabled: s.delivery_enabled,
      deliveryFee: Number(s.delivery_fee),
      deliveryPricePerKm: Number(s.delivery_price_per_km ?? s.delivery_fee ?? 10),
      minOrder: Number(s.minimum_order_amount),
      maxDistanceKm: Number(s.delivery_radius_km),
      supportedAreaIds: s.area ? [s.area] : [],
      prepTimeMin: 10,
      deliveryTimeMin: s.estimated_delivery_minutes,
      freeDeliveryThreshold: s.free_delivery_threshold
        ? Number(s.free_delivery_threshold)
        : undefined,
    },
  };
}

export interface BackendProductPayload {
  id: string;
  store: string;
  category: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  image: string | null;
  image_url: string;
  sku: string;
  price: string;
  discounted_price: string | null;
  effective_price: string;
  stock_quantity: number;
  unit: string;
  unit_en: string;
  is_available: boolean;
  is_best_seller: boolean;
  is_offer: boolean;
}

import { normalizeImageUrl } from './imageUtils';

export function mapBackendProduct(p: BackendProductPayload): Product {
  const effective = Number(p.effective_price || p.price);
  const reg = Number(p.price);
  return {
    id: p.id,
    merchantId: p.store,
    categoryId: p.category,
    nameAr: p.name,
    nameEn: p.name_en || p.name,
    descriptionAr: p.description || '',
    descriptionEn: p.description_en || p.description || '',
    image: normalizeImageUrl(p.image || p.image_url),
    price: effective,
    oldPrice: p.discounted_price && effective < reg ? reg : undefined,
    stock: p.stock_quantity,
    sku: p.sku,
    unitAr: p.unit,
    unitEn: p.unit_en || p.unit,
    isAvailable: p.is_available,
    isBestSeller: p.is_best_seller,
    isOffer: p.is_offer,
  };
}

export interface BackendOrderPayload {
  id: string;
  order_number: string;
  customer: string;
  customer_name: string;
  customer_phone: string;
  store: string;
  store_name: string;
  store_name_en: string;
  store_address?: string;
  store_phone?: string;
  delivery_address_snapshot: {
    area_id?: string;
    label?: string;
    recipient_name?: string;
    phone_number?: string;
    formatted_address?: string;
    latitude?: number | string;
    longitude?: number | string;
    building_number?: string;
    floor?: string;
    apartment?: string;
    additional_instructions?: string;
  };
  subtotal: string;
  delivery_fee: string;
  delivery_distance_km?: string | null;
  billable_distance_km?: number | null;
  delivery_price_per_km_snapshot?: string | null;
  discount_amount: string;
  total_amount: string;
  commission_rate_snapshot: string;
  commission_amount: string;
  merchant_net_amount: string;
  payment_method: 'cod';
  payment_status: string;
  order_status: string;
  customer_notes: string;
  reject_reason: string;
  estimated_delivery_minutes: number;
  assigned_delivery_person?: string | null;
  assigned_delivery_person_name?: string;
  assigned_at?: string | null;
  delivery_trip_status?: DeliveryTripStatus;
  delivery_trip_accepted_at?: string | null;
  delivery_trip_arrived_at?: string | null;
  delivery_trip_cancelled_at?: string | null;
  delivery_cancel_reason?: string;
  delivered_at?: string | null;
  delivered_by?: string | null;
  items: Array<{
    id: string;
    product: string | null;
    product_name_snapshot: string;
    product_name_en_snapshot: string;
    unit_price_snapshot: string;
    quantity: number;
    line_total: string;
  }>;
  status_history: Array<{
    id: string;
    status: string;
    actor_name: string;
    note: string;
    created_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

function mapOrderStatus(backendStatus: string): OrderStatus {
  if (backendStatus === 'ready_for_delivery') return 'preparing';
  if (
    backendStatus === 'pending' ||
    backendStatus === 'accepted' ||
    backendStatus === 'preparing' ||
    backendStatus === 'out_for_delivery' ||
    backendStatus === 'delivered' ||
    backendStatus === 'cancelled'
  ) {
    return backendStatus;
  }
  return 'pending';
}

export function mapBackendOrder(o: BackendOrderPayload): Order {
  const addr = o.delivery_address_snapshot?.formatted_address || '';
  return {
    id: o.id,
    orderNumber: o.order_number,
    customerId: o.customer,
    customerName: o.customer_name || '',
    customerPhone: o.customer_phone || '',
    merchantId: o.store,
    areaId: o.delivery_address_snapshot?.area_id || '',
    deliveryAddressAr: addr,
    deliveryAddressEn: addr,
    items: (o.items || []).map((item) => ({
      productId: item.product || item.id,
      nameAr: item.product_name_snapshot,
      nameEn: item.product_name_en_snapshot || item.product_name_snapshot,
      image: '',
      unitPrice: Number(item.unit_price_snapshot),
      quantity: item.quantity,
    })),
    subtotal: Number(o.subtotal),
    deliveryFee: Number(o.delivery_fee),
    deliveryDistanceKm: o.delivery_distance_km != null ? Number(o.delivery_distance_km) : undefined,
    billableDistanceKm: o.billable_distance_km ?? undefined,
    deliveryPricePerKmSnapshot:
      o.delivery_price_per_km_snapshot != null
        ? Number(o.delivery_price_per_km_snapshot)
        : undefined,
    discount: Number(o.discount_amount || 0),
    total: Number(o.total_amount),
    commissionRate: Number(o.commission_rate_snapshot),
    platformCommission: Number(o.commission_amount),
    paymentMethod: 'cod',
    notes: o.customer_notes || undefined,
    status: mapOrderStatus(o.order_status),
    rejectReason: o.reject_reason || undefined,
    assignedDeliveryPersonId: o.assigned_delivery_person ?? null,
    assignedDeliveryPersonName: o.assigned_delivery_person_name || undefined,
    assignedAt: o.assigned_at ?? null,
    deliveryTripStatus: o.delivery_trip_status ?? 'unassigned',
    deliveryTripAcceptedAt: o.delivery_trip_accepted_at ?? null,
    deliveryTripArrivedAt: o.delivery_trip_arrived_at ?? null,
    deliveryTripCancelledAt: o.delivery_trip_cancelled_at ?? null,
    deliveryCancelReason: o.delivery_cancel_reason || undefined,
    deliveredAt: o.delivered_at ?? null,
    statusHistory: (o.status_history || []).map((ev) => ({
      status: mapOrderStatus(ev.status),
      timestamp: ev.created_at,
      actorAr: ev.actor_name,
      actorEn: ev.actor_name,
      noteAr: ev.note,
      noteEn: ev.note,
    })),
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    estimatedDeliveryMin: o.estimated_delivery_minutes,
  };
}

export interface BackendInventoryMovement {
  id: string;
  product: string;
  product_name: string;
  movement_type: string;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reference_type: string;
  reference_id: string;
  note: string;
  created_at: string;
}

export interface BackendCommissionRecord {
  id: string;
  order: string;
  order_number: string;
  store: string;
  store_name: string;
  currency: string;
  order_subtotal_snapshot: string;
  delivery_fee_snapshot: string;
  order_total_snapshot: string;
  commission_rate_snapshot: string;
  commission_amount: string;
  merchant_net_amount: string;
  reversed_commission_amount: string;
  status: 'pending' | 'earned' | 'settled' | 'reversed';
  settled_at: string | null;
  created_at: string;
}

export interface BackendAdminMerchant {
  id: string;
  merchant_code: string | null;
  business_name: string;
  owner_name: string;
  email: string;
  phone_number: string;
  approval_status: MerchantStatus;
  created_at: string;
  stores: BackendStorePayload[];
}

export const marketplaceApi = {
  async fetchAreas(): Promise<Area[]> {
    const raw = await apiRequest<
      Array<{
        id: string;
        name_ar: string;
        name_en: string;
        city_ar: string;
        city_en: string;
        delivery_hub_note: string;
        latitude: number | null;
        longitude: number | null;
        is_active: boolean;
      }>
    >('/locations/areas/', { skipAuth: true });

    return raw.map((a) => ({
      id: a.id,
      nameAr: a.name_ar,
      nameEn: a.name_en,
      cityAr: a.city_ar,
      cityEn: a.city_en,
      isActive: a.is_active,
      deliveryHubNote: a.delivery_hub_note,
      coordinates:
        a.latitude !== null && a.longitude !== null
          ? { lat: a.latitude, lng: a.longitude }
          : undefined,
    }));
  },

  async fetchCategories(storeId?: string): Promise<Category[]> {
    const q = storeId ? `?store=${encodeURIComponent(storeId)}` : '';
    const raw = await apiRequest<
      Array<{
        id: string;
        name: string;
        name_en: string;
        icon: string;
        color: string;
        is_global: boolean;
        store: string | null;
      }>
    >(`/catalog/categories/${q}`, { skipAuth: true });

    return raw.map((c) => ({
      id: c.id,
      nameAr: c.name,
      nameEn: c.name_en || c.name,
      icon: c.icon,
      color: c.color,
      isGlobal: c.is_global,
      merchantId: c.store || undefined,
    }));
  },

  fetchNearbyStores(params: {
    latitude: number;
    longitude: number;
    radius_km?: number;
    category?: string;
    search?: string;
    sort?: string;
  }) {
    const qs = new URLSearchParams({
      latitude: String(params.latitude),
      longitude: String(params.longitude),
      page_size: '100',
    });
    if (params.radius_km !== undefined) qs.set('radius_km', String(params.radius_km));
    if (params.category) qs.set('category', params.category);
    if (params.search) qs.set('search', params.search);
    if (params.sort) qs.set('sort', params.sort);
    return apiRequest<PaginatedResponse<BackendStorePayload>>(
      `/stores/nearby/?${qs.toString()}`
    );
  },

  fetchDeliveryQuote(
    storeId: string,
    params: { latitude: number; longitude: number; subtotal?: number }
  ) {
    const qs = new URLSearchParams({
      latitude: String(params.latitude),
      longitude: String(params.longitude),
    });
    if (params.subtotal !== undefined) {
      qs.set('subtotal', String(params.subtotal));
    }
    return apiRequest<{
      store_id: string;
      store_name: string;
      store_name_en: string;
      delivery_enabled: boolean;
      delivery_available: boolean;
      reason: string;
      actual_distance_km: string;
      billable_km: number;
      price_per_km: string;
      delivery_fee: string;
      free_delivery_applied: boolean;
    }>(`/stores/${storeId}/delivery-quote/?${qs.toString()}`, { skipAuth: true });
  },

  fetchProducts(params?: { store?: string; category?: string; search?: string }) {
    const qs = new URLSearchParams({ page_size: '100' });
    if (params?.store) qs.set('store', params.store);
    if (params?.category) qs.set('category', params.category);
    if (params?.search) qs.set('search', params.search);
    return apiRequest<PaginatedResponse<BackendProductPayload>>(
      `/catalog/products/?${qs.toString()}`,
      { skipAuth: true }
    );
  },

  updateSearchRadius(search_radius_km: number) {
    return apiRequest<{ search_radius_km: number }>('/locations/search-radius/', {
      method: 'PATCH',
      body: { search_radius_km },
    });
  },

  async fetchAddresses(): Promise<CustomerAddress[]> {
    const raw = await apiRequest<
      Array<{
        id: string;
        area: string | null;
        label: string;
        formatted_address: string;
        latitude: string;
        longitude: string;
        building_number: string;
        floor: string;
        apartment: string;
        additional_instructions: string;
        is_default: boolean;
      }>
    >('/locations/addresses/');
    return raw.map((a) => ({
      id: a.id,
      areaId: a.area || '',
      labelAr: a.label,
      labelEn: a.label,
      streetAr: a.formatted_address,
      streetEn: a.formatted_address,
      building: a.building_number || '',
      floor: a.floor || '',
      apartment: a.apartment || '',
      notes: a.additional_instructions || undefined,
      isDefault: a.is_default,
      coordinates: { lat: Number(a.latitude), lng: Number(a.longitude) },
    }));
  },

  fetchFavoriteStores() {
    return apiRequest<{ store_ids: string[]; stores: BackendStorePayload[] }>('/stores/favorites/');
  },

  addFavoriteStore(storeId: string) {
    return apiRequest<{ store_id: string; is_favorite: boolean }>(`/stores/favorites/${storeId}/`, {
      method: 'POST',
    });
  },

  removeFavoriteStore(storeId: string) {
    return apiRequest<{ store_id: string; is_favorite: boolean }>(`/stores/favorites/${storeId}/`, {
      method: 'DELETE',
    });
  },

  createAddress(payload: {
    label: string;
    formatted_address: string;
    latitude: number;
    longitude: number;
    area?: string | null;
    building_number?: string;
    floor?: string;
    apartment?: string;
    additional_instructions?: string;
    is_default?: boolean;
  }) {
    return apiRequest<{ id: string }>('/locations/addresses/', {
      method: 'POST',
      body: payload,
    });
  },

  updateAddress(addressId: string, updates: Record<string, unknown>) {
    return apiRequest(`/locations/addresses/${addressId}/`, {
      method: 'PATCH',
      body: updates,
    });
  },

  deleteAddress(addressId: string) {
    return apiRequest(`/locations/addresses/${addressId}/`, { method: 'DELETE' });
  },

  setDefaultAddress(addressId: string) {
    return apiRequest(`/locations/addresses/${addressId}/set-default/`, { method: 'POST' });
  },

  fetchCart() {
    return apiRequest<{
      store: string | null;
      items: Array<{ product_id: string; quantity: number }>;
    }>('/cart/');
  },

  addCartItem(product_id: string, quantity = 1, replace_cart = false) {
    return apiRequest<{
      store: string | null;
      items: Array<{ product_id: string; quantity: number }>;
    }>('/cart/items/', {
      method: 'POST',
      body: { product_id, quantity, replace_cart },
    });
  },

  updateCartItem(product_id: string, quantity: number) {
    return apiRequest<{
      store: string | null;
      items: Array<{ product_id: string; quantity: number }>;
    }>(`/cart/items/${product_id}/`, {
      method: 'PATCH',
      body: { quantity },
    });
  },

  clearCart() {
    return apiRequest('/cart/', { method: 'DELETE' });
  },

  createOrder(payload: {
    address_id?: string | null;
    delivery_address?: {
      label?: string;
      recipient_name?: string;
      phone_number?: string;
      formatted_address: string;
      latitude: number;
      longitude: number;
      building_number?: string;
      floor?: string;
      apartment?: string;
    };
    payment_method: 'cod';
    customer_notes?: string;
    idempotency_key?: string;
  }) {
    return apiRequest<BackendOrderPayload>('/orders/', { method: 'POST', body: payload });
  },

  fetchCustomerOrders() {
    return apiRequest<PaginatedResponse<BackendOrderPayload>>('/orders/?page_size=100');
  },

  cancelCustomerOrder(orderId: string, reason = '') {
    return apiRequest<BackendOrderPayload>(`/orders/${orderId}/cancel/`, {
      method: 'POST',
      body: { reason },
    });
  },

  // ==================== MERCHANT PORTAL APIs ====================
  fetchMerchantStore() {
    return apiRequest<BackendStorePayload>('/merchant/store/');
  },

  updateMerchantStore(body: Record<string, unknown> | FormData) {
    return apiRequest<BackendStorePayload>('/merchant/store/', {
      method: 'PATCH',
      body,
    });
  },

  updateMerchantDelivery(body: Record<string, unknown>) {
    return apiRequest<BackendStorePayload>('/merchant/delivery/', {
      method: 'PATCH',
      body,
    });
  },

  fetchMerchantProducts() {
    return apiRequest<PaginatedResponse<BackendProductPayload>>('/merchant/products/?page_size=100');
  },

  createMerchantProduct(body: Record<string, unknown> | FormData) {
    return apiRequest<BackendProductPayload>('/merchant/products/', {
      method: 'POST',
      body,
    });
  },

  updateMerchantProduct(productId: string, body: Record<string, unknown> | FormData) {
    return apiRequest<BackendProductPayload>(`/merchant/products/${productId}/`, {
      method: 'PATCH',
      body,
    });
  },

  deleteMerchantProduct(productId: string) {
    return apiRequest(`/merchant/products/${productId}/`, { method: 'DELETE' });
  },

  createMerchantCategory(payload: { name: string; name_en?: string }) {
    return apiRequest<{ id: string; name: string; name_en: string; color: string; is_global: boolean; store: string }>(
      '/merchant/categories/',
      { method: 'POST', body: payload }
    );
  },

  updateMerchantCategory(categoryId: string, payload: Record<string, unknown>) {
    return apiRequest(`/merchant/categories/${categoryId}/`, { method: 'PATCH', body: payload });
  },

  deleteMerchantCategory(categoryId: string) {
    return apiRequest(`/merchant/categories/${categoryId}/`, { method: 'DELETE' });
  },

  fetchMerchantInventoryMovements() {
    return apiRequest<PaginatedResponse<BackendInventoryMovement>>(
      '/merchant/inventory/movements/?page_size=100'
    );
  },

  adjustMerchantStock(productId: string, stock_quantity: number, note = '') {
    return apiRequest<{ product: BackendProductPayload; movement: BackendInventoryMovement }>(
      `/merchant/inventory/${productId}/adjust/`,
      {
        method: 'POST',
        body: { stock_quantity, note },
      }
    );
  },

  fetchMerchantOrders() {
    return apiRequest<PaginatedResponse<BackendOrderPayload>>('/merchant/orders/?page_size=100');
  },

  transitionMerchantOrder(orderId: string, status: string, reject_reason = '') {
    return apiRequest<BackendOrderPayload>(`/merchant/orders/${orderId}/transition/`, {
      method: 'POST',
      body: { status, reject_reason },
    });
  },

  fetchMerchantOverview() {
    return apiRequest('/merchant/overview/');
  },

  fetchMerchantAnalytics(preset = '30d', granularity = 'daily') {
    return apiRequest(
      `/merchant/analytics/?preset=${encodeURIComponent(preset)}&granularity=${encodeURIComponent(granularity)}`
    );
  },

  // ==================== SUPER ADMIN APIs ====================
  fetchAdminMerchants() {
    return apiRequest<PaginatedResponse<BackendAdminMerchant>>('/admin/merchants/?page_size=100');
  },

  updateAdminMerchantStatus(merchantProfileId: string, status: MerchantStatus, reason = '') {
    return apiRequest<BackendAdminMerchant>(`/admin/merchants/${merchantProfileId}/status/`, {
      method: 'POST',
      body: { status, reason },
    });
  },

  updateAdminStoreCommission(storeId: string, commissionRate: number) {
    return apiRequest<{ store_id: string; commission_rate: string }>(
      `/admin/stores/${storeId}/commission/`,
      {
        method: 'PATCH',
        body: { commission_rate: commissionRate.toFixed(2) },
      }
    );
  },

  fetchAdminOrders() {
    return apiRequest<PaginatedResponse<BackendOrderPayload>>('/admin/orders/?page_size=100');
  },

  refundAdminOrder(orderId: string, amount: number, reason: string) {
    return apiRequest<{
      refund_id: string;
      order_id: string;
      amount: string;
      commission_reversed: string;
    }>(`/admin/orders/${orderId}/refund/`, {
      method: 'POST',
      body: { amount: amount.toFixed(2), reason },
    });
  },

  async fetchAdminCustomers(): Promise<Customer[]> {
    const res = await apiRequest<
      PaginatedResponse<{
        id: string;
        email: string;
        phone_number: string;
        full_name: string;
        is_active: boolean;
        date_joined: string;
      }>
    >('/admin/customers/?page_size=100');
    return res.results.map((c) => ({
      id: c.id,
      nameAr: c.full_name,
      nameEn: c.full_name,
      phone: c.phone_number,
      email: c.email,
      status: c.is_active ? 'active' : 'suspended',
      joinedAt: c.date_joined,
      favoriteMerchantIds: [],
      addresses: [],
    }));
  },

  toggleAdminCustomerActive(customerId: string, is_active: boolean) {
    return apiRequest(`/admin/customers/${customerId}/`, {
      method: 'PATCH',
      body: { is_active },
    });
  },

  createAdminCategory(payload: { name: string; name_en?: string; icon?: string; color?: string }) {
    return apiRequest('/admin/categories/', { method: 'POST', body: payload });
  },

  updateAdminCategory(categoryId: string, payload: Record<string, unknown>) {
    return apiRequest(`/admin/categories/${categoryId}/`, { method: 'PATCH', body: payload });
  },

  deleteAdminCategory(categoryId: string) {
    return apiRequest(`/admin/categories/${categoryId}/`, { method: 'DELETE' });
  },

  createAdminArea(payload: Record<string, unknown>) {
    return apiRequest('/admin/areas/', { method: 'POST', body: payload });
  },

  updateAdminArea(areaId: string, payload: Record<string, unknown>) {
    return apiRequest(`/admin/areas/${areaId}/`, { method: 'PATCH', body: payload });
  },

  fetchAdminCommissions() {
    return apiRequest<PaginatedResponse<BackendCommissionRecord>>('/admin/commissions/?page_size=100');
  },

  settleAdminCommission(recordId: string) {
    return apiRequest<BackendCommissionRecord>(`/admin/commissions/${recordId}/settle/`, {
      method: 'POST',
    });
  },

  fetchAdminOverview(preset = '30d') {
    return apiRequest(`/admin/overview/?preset=${encodeURIComponent(preset)}`);
  },

  fetchAdminFinancialReport(preset = '30d') {
    return apiRequest(`/admin/financial-report/?preset=${encodeURIComponent(preset)}`);
  },

  fetchNotifications() {
    return apiRequest<PaginatedResponse<BackendNotificationPayload>>('/notifications/?page_size=50');
  },

  markNotificationsRead() {
    return apiRequest('/notifications/mark-read/', { method: 'POST' });
  },

  markNotificationRead(notificationId: string) {
    return apiRequest(`/notifications/${notificationId}/mark-read/`, { method: 'POST' });
  },

  fetchPushConfig() {
    return apiRequest<{ enabled: boolean; vapid_public_key: string }>(
      '/notifications/push/config/',
      { skipAuth: true }
    );
  },

  fetchPushPreferences() {
    return apiRequest<{ push_enabled: boolean; order_updates: boolean }>(
      '/notifications/push/preferences/'
    );
  },

  updatePushPreferences(payload: { push_enabled?: boolean; order_updates?: boolean }) {
    return apiRequest<{ push_enabled: boolean; order_updates: boolean }>(
      '/notifications/push/preferences/',
      {
        method: 'PATCH',
        body: payload,
      }
    );
  },

  registerPushSubscription(payload: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    language: 'ar' | 'en';
  }) {
    return apiRequest('/notifications/push/subscriptions/', {
      method: 'POST',
      body: payload,
    });
  },

  unregisterPushSubscription(endpoint: string) {
    return apiRequest<{ deleted: boolean }>('/notifications/push/subscriptions/', {
      method: 'DELETE',
      body: { endpoint },
    });
  },

  async fetchAdminSettings(): Promise<PlatformSettings> {
    const s = await apiRequest<{
      default_commission_rate: string;
      currency: string;
      support_phone: string;
      support_email: string;
      auto_approve_merchants: boolean;
      notify_on_new_order: boolean;
      notify_on_low_stock: boolean;
      platform_name: string;
      platform_name_en: string;
    }>('/admin/settings/');
    return {
      defaultCommissionRate: Number(s.default_commission_rate),
      currencyAr: 'ج.م',
      currencyEn: s.currency || 'EGP',
      supportPhone: s.support_phone,
      supportEmail: s.support_email,
      autoApproveMerchants: s.auto_approve_merchants,
      notifyOnNewOrder: s.notify_on_new_order,
      notifyOnLowStock: s.notify_on_low_stock,
      platformNameAr: s.platform_name,
      platformNameEn: s.platform_name_en,
    };
  },

  updateAdminSettings(updates: Partial<PlatformSettings>) {
    return apiRequest('/admin/settings/', {
      method: 'PATCH',
      body: {
        ...(updates.platformNameAr !== undefined ? { platform_name: updates.platformNameAr } : {}),
        ...(updates.platformNameEn !== undefined ? { platform_name_en: updates.platformNameEn } : {}),
        ...(updates.defaultCommissionRate !== undefined
          ? { default_commission_rate: updates.defaultCommissionRate.toFixed(2) }
          : {}),
        ...(updates.supportPhone !== undefined ? { support_phone: updates.supportPhone } : {}),
        ...(updates.supportEmail !== undefined ? { support_email: updates.supportEmail } : {}),
        ...(updates.autoApproveMerchants !== undefined
          ? { auto_approve_merchants: updates.autoApproveMerchants }
          : {}),
        ...(updates.notifyOnNewOrder !== undefined
          ? { notify_on_new_order: updates.notifyOnNewOrder }
          : {}),
        ...(updates.notifyOnLowStock !== undefined
          ? { notify_on_low_stock: updates.notifyOnLowStock }
          : {}),
      },
    });
  },
};

export interface DeliverySummaryPayload {
  new_assigned: number;
  ready_for_delivery: number;
  out_for_delivery: number;
  delivered: number;
}

export const deliveryApi = {
  fetchSummary() {
    return apiRequest<DeliverySummaryPayload>('/delivery/summary/');
  },

  fetchOrders(params?: { order_status?: string; date?: string; page?: number }) {
    const qs = new URLSearchParams({ page_size: '50' });
    if (params?.order_status) qs.set('order_status', params.order_status);
    if (params?.date) qs.set('date', params.date);
    if (params?.page) qs.set('page', String(params.page));
    return apiRequest<PaginatedResponse<BackendOrderPayload>>(`/delivery/orders/?${qs.toString()}`);
  },

  fetchOrder(orderId: string) {
    return apiRequest<BackendOrderPayload>(`/delivery/orders/${orderId}/`);
  },

  acceptTrip(orderId: string) {
    return apiRequest<BackendOrderPayload>(`/delivery/orders/${orderId}/accept-trip/`, {
      method: 'POST',
    });
  },

  cancelTrip(orderId: string, reason = '') {
    return apiRequest<BackendOrderPayload>(`/delivery/orders/${orderId}/cancel-trip/`, {
      method: 'POST',
      body: { reason },
    });
  },

  confirmArrival(orderId: string) {
    return apiRequest<BackendOrderPayload>(`/delivery/orders/${orderId}/arrive/`, {
      method: 'POST',
    });
  },

  transitionOrder(
    orderId: string,
    payload: {
      status: 'out_for_delivery' | 'delivered';
      confirm_delivery?: boolean;
      note?: string;
    }
  ) {
    return apiRequest<BackendOrderPayload>(`/delivery/orders/${orderId}/transition/`, {
      method: 'POST',
      body: payload,
    });
  },

  fetchShiftStatus() {
    return apiRequest<DeliveryShiftStatusResponse>('/delivery/shift/');
  },

  startShift() {
    return apiRequest<{ id: string; started_at: string; is_active: boolean }>(
      '/delivery/shift/start/',
      { method: 'POST', body: {} }
    );
  },

  endShift() {
    return apiRequest<{
      id: string;
      started_at: string;
      ended_at: string | null;
      duration_minutes: number;
      is_active: boolean;
    }>('/delivery/shift/end/', { method: 'POST', body: {} });
  },

  updateLocation(payload: {
    latitude?: number | null;
    longitude?: number | null;
    accuracy_m?: number | null;
    is_sharing: boolean;
  }) {
    return apiRequest<{
      is_location_sharing: boolean;
      last_latitude: number | null;
      last_longitude: number | null;
      last_location_at: string | null;
    }>('/delivery/location/', {
      method: 'POST',
      body: payload,
    });
  },
};

export interface AssignableDriverOption {
  id: string;
  profile_id: string;
  full_name: string;
  phone_number: string;
  email: string;
  operational_status: string;
  active_orders_count: number;
  last_seen_at: string | null;
}

export const merchantDeliveryApi = {
  fetchOverview() {
    return apiRequest<MerchantDeliveryOverviewResponse>('/merchant/delivery-management/overview/');
  },

  listDrivers(params?: { search?: string; status?: string; include_archived?: boolean }) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status && params.status !== 'all') qs.set('status', params.status);
    if (params?.include_archived) qs.set('include_archived', 'true');
    const query = qs.toString();
    return apiRequest<MerchantDeliveryDriver[]>(
      `/merchant/delivery-management/drivers/${query ? `?${query}` : ''}`
    );
  },

  createDriver(payload: {
    email: string;
    password: string;
    first_name: string;
    last_name?: string;
    phone_number: string;
    vehicle_type: DriverVehicleType;
    vehicle_plate?: string;
    notes?: string;
  }) {
    return apiRequest<MerchantDeliveryDriver>('/merchant/delivery-management/drivers/', {
      method: 'POST',
      body: payload,
    });
  },

  getDriverDetail(driverId: string) {
    return apiRequest<{
      driver: MerchantDeliveryDriver;
      recent_orders: BackendOrderPayload[];
      recent_shifts: Array<{
        id: string;
        started_at: string;
        ended_at: string | null;
        is_active: boolean;
        duration_minutes: number;
      }>;
    }>(`/merchant/delivery-management/drivers/${driverId}/`);
  },

  updateDriver(
    driverId: string,
    payload: {
      email?: string;
      first_name?: string;
      last_name?: string;
      phone_number?: string;
      vehicle_type?: DriverVehicleType;
      vehicle_plate?: string;
      notes?: string;
    }
  ) {
    return apiRequest<MerchantDeliveryDriver>(
      `/merchant/delivery-management/drivers/${driverId}/`,
      {
        method: 'PATCH',
        body: payload,
      }
    );
  },

  toggleDriverActive(driverId: string, is_active: boolean, archive = false) {
    return apiRequest<MerchantDeliveryDriver>(
      `/merchant/delivery-management/drivers/${driverId}/toggle-active/`,
      {
        method: 'POST',
        body: { is_active, archive },
      }
    );
  },

  resetDriverPassword(driverId: string, new_password: string) {
    return apiRequest<{ detail: string }>(
      `/merchant/delivery-management/drivers/${driverId}/reset-password/`,
      {
        method: 'POST',
        body: { new_password },
      }
    );
  },

  fetchTracking() {
    return apiRequest<MerchantDeliveryTrackingResponse>(
      '/merchant/delivery-management/tracking/'
    );
  },

  fetchPerformance() {
    return apiRequest<MerchantDeliveryPerformanceResponse>(
      '/merchant/delivery-management/performance/'
    );
  },

  listAssignableDrivers() {
    return apiRequest<AssignableDriverOption[]>('/merchant/delivery-drivers/');
  },

  assignOrder(orderId: string, deliveryUserId: string) {
    return apiRequest<BackendOrderPayload>(`/merchant/orders/${orderId}/assign-delivery/`, {
      method: 'POST',
      body: { delivery_user_id: deliveryUserId },
    });
  },
};


export interface CatalogLibraryCategoryPayload {
  id: string;
  name: string;
  name_en: string;
  slug: string;
  icon: string;
  color: string;
  default_category: string | null;
  sort_order: number;
  items_count: number;
}

export interface CatalogLibraryItemPayload {
  id: string;
  name: string;
  name_en: string;
  slug: string;
  brand: string;
  package_size: string;
  barcode: string;
  default_unit: string;
  default_unit_en: string;
  category_slug: string;
  category_name: string;
  category_name_en: string;
  default_store_category: string | null;
  thumbnail_url: string;
}

export interface ExternalImageSearchResultItem {
  id: string;
  thumbnail_url: string;
  source_url: string;
  source_website: string;
  title: string;
  attribution: string;
  license: string;
}

export interface ExternalImageSearchResponse {
  configured: boolean;
  provider: string | null;
  status: string;
  results: ExternalImageSearchResultItem[];
  google_images_fallback_url: string;
}

export interface ImportedProductPayload {
  source: string;
  barcode: string;
  name: string;
  name_ar: string;
  name_en: string;
  brand: string;
  package_size: string;
  category_hint: string;
  default_store_category?: string | null;
  default_unit?: string;
  image_url: string;
  attribution: string;
}

export const catalogLibraryApi = {
  fetchCategories() {
    return apiRequest<CatalogLibraryCategoryPayload[]>('/merchant/catalog-library/categories/');
  },

  fetchItems(params?: { category?: string; q?: string; page?: number; pageSize?: number }) {
    const qs = new URLSearchParams();
    if (params?.category && params.category !== 'all') qs.set('category', params.category);
    if (params?.q) qs.set('q', params.q);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('page_size', String(params.pageSize));
    const query = qs.toString();
    return apiRequest<{
      count: number;
      next: string | null;
      previous: string | null;
      results: CatalogLibraryItemPayload[];
    }>(`/merchant/catalog-library/items/${query ? `?${query}` : ''}`);
  },

  uploadProductImage(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<{ image_url: string; path: string; size_bytes: number }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${API_BASE_URL}/merchant/products/upload-image/`;
      xhr.open('POST', url, true);
      const token = getAccessToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && onProgress) {
          onProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          const parsed = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.detail || 'Image upload failed.'));
          }
        } catch {
          reject(new Error('Image upload failed.'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during image upload.'));
      const fd = new FormData();
      fd.append('image', file);
      xhr.send(fd);
    });
  },

  searchExternalImages(q: string, page = 1) {
    const qs = new URLSearchParams({ q, page: String(page) });
    return apiRequest<ExternalImageSearchResponse>(
      `/merchant/catalog-library/external-images/?${qs.toString()}`
    );
  },

  lookupBarcode(barcode: string) {
    return apiRequest<{ status: string; product: ImportedProductPayload | null }>(
      `/merchant/product-import/barcode/${encodeURIComponent(barcode.trim())}/`
    );
  },

  searchProductDatabase(q: string, page = 1) {
    const qs = new URLSearchParams({ q, page: String(page) });
    return apiRequest<{ status: string; results: ImportedProductPayload[] }>(
      `/merchant/product-import/search/?${qs.toString()}`
    );
  },
};
