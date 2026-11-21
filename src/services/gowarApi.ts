import {
  apiRequest,
  clearAuthTokens,
  getRefreshToken,
  setAuthTokens,
  type BackendUserSummary,
} from './apiClient';
import type {
  AppNotification,
  Area,
  Category,
  Customer,
  CustomerAddress,
  Merchant,
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
  email: string;
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
    titleEn: n.title,
    bodyAr: n.body,
    bodyEn: n.body,
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
    email: string;
    password: string;
    first_name: string;
    last_name?: string;
    phone_number?: string;
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
    role: 'customer' | 'merchant' | 'admin',
    email: string,
    password: string
  ): Promise<AuthTokenResponse> {
    const res = await apiRequest<AuthTokenResponse>(`/auth/${role}/login/`, {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    });
    setAuthTokens(res.access, res.refresh, res.user);
    return res;
  },

  async logout(): Promise<void> {
    const refresh = getRefreshToken();
    try {
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
    createdAt: new Date().toISOString(),
    categoryIds: [],
    coordinates: {
      lat: Number(s.latitude),
      lng: Number(s.longitude),
    },
    delivery: {
      deliveryEnabled: s.delivery_enabled,
      deliveryFee: Number(s.delivery_fee),
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
    image: p.image || p.image_url || '',
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
  delivery_address_snapshot: {
    area_id?: string;
    formatted_address?: string;
    building_number?: string;
    floor?: string;
    apartment?: string;
  };
  subtotal: string;
  delivery_fee: string;
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
    discount: Number(o.discount_amount || 0),
    total: Number(o.total_amount),
    commissionRate: Number(o.commission_rate_snapshot),
    platformCommission: Number(o.commission_amount),
    paymentMethod: 'cod',
    notes: o.customer_notes || undefined,
    status: mapOrderStatus(o.order_status),
    rejectReason: o.reject_reason || undefined,
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
