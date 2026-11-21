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
  discount: number;
  total: number;
  commissionRate: number;
  platformCommission: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  status: OrderStatus;
  rejectReason?: string;
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
  audience: 'customer' | 'merchant' | 'admin';
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

export type DemoRole = 'merchant' | 'admin';

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
