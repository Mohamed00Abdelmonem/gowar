export type Language = 'ar' | 'en';

export type StoreType = 'supermarket' | 'grocery' | 'kiosk' | 'mini_market' | 'convenience';

export type MerchantStatus = 'approved' | 'pending' | 'suspended' | 'rejected';

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'cod' | 'online_demo';

export interface Area {
  id: string;
  nameAr: string;
  nameEn: string;
  cityAr: string;
  cityEn: string;
  isActive: boolean;
  deliveryHubNote?: string;
  coordinates?: { lat: number; lng: number };
}

export interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  color: string;
  image?: string;
  isGlobal: boolean;
  merchantId?: string;
}

export interface MerchantDeliverySettings {
  deliveryEnabled: boolean;
  deliveryFee: number;
  deliveryPricePerKm?: number;
  minOrder: number;
  maxDistanceKm: number;
  supportedAreaIds: string[];
  prepTimeMin: number;
  deliveryTimeMin: number;
  freeDeliveryThreshold?: number;
}

export interface Merchant {
  id: string;
  merchantCode?: string;
  ownerNameAr?: string;
  ownerNameEn?: string;
  nameAr: string;
  nameEn: string;
  type: StoreType;
  descriptionAr: string;
  descriptionEn: string;
  logo: string;
  coverImage: string;
  phone: string;
  addressAr: string;
  addressEn: string;
  areaId: string;
  distanceKm: number;
  rating: number;
  reviewCount: number;
  workingHoursAr: string;
  workingHoursEn: string;
  isOpen: boolean;
  status: MerchantStatus;
  verified: boolean;
  commissionRate: number; // percentage e.g. 8
  customerCompletedOrdersCount?: number;
  isPreviouslyOrdered?: boolean;
  createdAt: string;
  isRecentlyAdded?: boolean;
  isPopular?: boolean;
  categoryIds: string[];
  coordinates: { lat: number; lng: number };
  delivery: MerchantDeliverySettings;
}

export interface Product {
  id: string;
  merchantId: string;
  categoryId: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  image: string;
  price: number;
  oldPrice?: number;
  stock: number;
  sku?: string;
  barcode?: string;
  unitAr: string;
  unitEn: string;
  isAvailable: boolean;
  isBestSeller?: boolean;
  isOffer?: boolean;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface Cart {
  merchantId: string | null;
  items: CartItem[];
}

export interface OrderItem {
  productId: string;
  nameAr: string;
  nameEn: string;
  image: string;
  unitPrice: number;
  quantity: number;
}

export interface OrderPipelineEvent {
  status: OrderStatus;
  timestamp: string;
  actorAr: string;
  actorEn: string;
  noteAr?: string;
  noteEn?: string;
}

export type DeliveryTripStatus =
  | 'unassigned'
  | 'assigned'
  | 'accepted'
  | 'in_transit'
  | 'arrived'
  | 'completed'
  | 'cancelled';

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  merchantId: string;
  areaId: string;
  deliveryAddressAr: string;
  deliveryAddressEn: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  deliveryDistanceKm?: number;
  billableDistanceKm?: number;
  deliveryPricePerKmSnapshot?: number;
  discount: number;
  total: number;
  commissionRate: number;
  platformCommission: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  status: OrderStatus;
  rejectReason?: string;
  assignedDeliveryPersonId?: string | null;
  assignedDeliveryPersonName?: string;
  assignedAt?: string | null;
  deliveryTripStatus?: DeliveryTripStatus;
  deliveryTripAcceptedAt?: string | null;
  deliveryTripArrivedAt?: string | null;
  deliveryTripCancelledAt?: string | null;
  deliveryCancelReason?: string;
  deliveredAt?: string | null;
  statusHistory?: OrderPipelineEvent[];
  createdAt: string;
  updatedAt: string;
  estimatedDeliveryMin: number;
}

export interface CustomerAddress {
  id: string;
  labelAr: string;
  labelEn: string;
  areaId: string;
  streetAr: string;
  streetEn: string;
  building: string;
  floor: string;
  apartment: string;
  notes?: string;
  isDefault: boolean;
  coordinates?: { lat: number; lng: number };
}

export interface CustomerLocationState {
  lat: number;
  lng: number;
  formattedAddressAr: string;
  formattedAddressEn: string;
  areaId: string;
  selectedAddressId: string | null;
  searchRadiusKm: number;
  source: 'saved' | 'gps' | 'map' | 'search' | 'area';
  updatedAt: string;
}

export interface Customer {
  id: string;
  nameAr: string;
  nameEn: string;
  phone: string;
  email: string;
  status: 'active' | 'suspended';
  joinedAt: string;
  favoriteMerchantIds: string[];
  addresses: CustomerAddress[];
}

export interface AppNotification {
  id: string;
  audience: 'customer' | 'merchant' | 'delivery' | 'admin';
  merchantId?: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  createdAt: string;
  read: boolean;
  link?: string;
}

export interface PlatformSettings {
  defaultCommissionRate: number;
  currencyAr: string;
  currencyEn: string;
  supportPhone: string;
  supportEmail: string;
  autoApproveMerchants: boolean;
  notifyOnNewOrder?: boolean;
  notifyOnLowStock?: boolean;
  platformNameAr: string;
  platformNameEn: string;
}

export interface Review {
  id: string;
  merchantId: string;
  customerId: string;
  customerName: string;
  rating: number;
  commentAr: string;
  commentEn: string;
  createdAt: string;
}

export type DemoRole = 'merchant' | 'admin' | 'delivery';

export interface AuthSession {
  role: DemoRole;
  userId: string;
  email: string;
  nameAr: string;
  nameEn: string;
  merchantId?: string; // store id in shared state
  merchantCode?: string; // e.g. merchant_001
  loggedInAt: string;
}

export type DateRangePreset = 'today' | '7d' | '30d' | '3m' | '6m' | 'all' | 'custom';

export interface DateFilterState {
  preset: DateRangePreset;
  customStart: string;
  customEnd: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export type PromotionType = 'general' | 'store' | 'product' | 'category';

export type PromotionPricingModel = '' | 'flat' | 'cpm' | 'cpc';

export interface Promotion {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  discountLabelAr: string;
  discountLabelEn: string;
  image: string;
  mobileImage: string;
  promotionType: PromotionType;
  targetStoreId: string | null;
  targetStoreNameAr?: string;
  targetStoreNameEn?: string;
  targetProductId: string | null;
  targetProductNameAr?: string;
  targetProductNameEn?: string;
  targetCategoryId: string | null;
  targetCategoryNameAr?: string;
  targetCategoryNameEn?: string;
  targetAreaId: string | null;
  customDestination: string;
  ctaTextAr: string;
  ctaTextEn: string;
  overlayColor: string;
  displayOrder: number;
  startAt: string;
  endAt: string;
}

export interface AdminPromotion extends Promotion {
  imageUrlRaw: string;
  mobileImageUrlRaw: string;
  targetAreaNameAr?: string;
  isActive: boolean;
  isArchived: boolean;
  impressionsCount: number;
  clicksCount: number;
  ctr: number;
  isPaidCampaign: boolean;
  sponsorMerchantId: string | null;
  campaignBudget: string | null;
  pricingModel: PromotionPricingModel;
  priorityBoost: number;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionAnalyticsSummary {
  totalPromotions: number;
  activeLiveCount: number;
  scheduledCount: number;
  expiredCount: number;
  totalImpressions: number;
  totalClicks: number;
  overallCtr: number;
}


export type DriverOperationalStatus = 'available' | 'on_delivery' | 'offline' | 'inactive';
export type DriverLocationStatus = 'live' | 'stale' | 'unavailable';
export type DriverVehicleType = 'motorcycle' | 'bicycle' | 'car' | 'on_foot';

export interface DriverCurrentOrderSummary {
  id: string;
  order_number: string;
  order_status: string;
  store_name: string;
  customer_name: string;
  customer_address: string;
  customer_latitude: number | null;
  customer_longitude: number | null;
}

export interface MerchantDeliveryDriver {
  id: string;
  user_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  vehicle_type: DriverVehicleType;
  vehicle_plate: string;
  notes: string;
  is_active: boolean;
  is_archived: boolean;
  operational_status: DriverOperationalStatus;
  location_status: DriverLocationStatus;
  is_on_shift: boolean;
  is_location_sharing: boolean;
  last_latitude: number | null;
  last_longitude: number | null;
  last_location_accuracy_m: number | null;
  last_location_at: string | null;
  last_seen_at: string | null;
  active_orders_count: number;
  out_for_delivery_count: number;
  assigned_today: number;
  delivered_today: number;
  cancelled_today: number;
  delivered_this_week: number;
  delivered_this_month: number;
  avg_delivery_duration_minutes: number | null;
  working_hours_today: number;
  working_minutes_today: number;
  current_order: DriverCurrentOrderSummary | null;
  created_at: string;
}

export interface MerchantDeliveryOverviewResponse {
  summary: {
    total_personnel: number;
    active_personnel: number;
    available_now: number;
    on_delivery_now: number;
    delivered_today: number;
  };
  drivers: MerchantDeliveryDriver[];
}

export interface MerchantDeliveryTrackingResponse {
  generated_at: string;
  drivers: MerchantDeliveryDriver[];
}

export interface MerchantDeliveryPerformanceResponse {
  totals: {
    delivered_today: number;
    in_progress_count: number;
    assigned_today: number;
    delivered_this_week: number;
    delivered_this_month: number;
  };
  drivers: MerchantDeliveryDriver[];
}

export interface DeliveryShiftStatusResponse {
  has_profile: boolean;
  is_on_shift: boolean;
  active_shift: {
    id: string;
    started_at: string;
    duration_minutes: number;
  } | null;
  working_minutes_today: number;
  is_location_sharing: boolean;
  last_location_at: string | null;
}
