import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type {
  AppNotification,
  Area,
  AuthSession,
  Cart,
  Category,
  Customer,
  CustomerAddress,
  CustomerLocationState,
  DemoRole,
  Language,
  Merchant,
  MerchantStatus,
  Order,
  OrderPipelineEvent,
  OrderStatus,
  PaymentMethod,
  PlatformSettings,
  Product,
  Review,
  ToastMessage,
} from '../types';
import {
  SEED_AREAS,
  SEED_CATEGORIES,
  SEED_CUSTOMERS,
  SEED_MERCHANTS,
  SEED_NOTIFICATIONS,
  SEED_ORDERS,
  SEED_PRODUCTS,
  SEED_REVIEWS,
  SEED_SETTINGS,
} from '../data/seedData';
import {
  clearDemoSession,
  getDemoSession,
  loginWithDemoCredentials,
  registerDemoMerchantAccount,
} from '../services/authService';
import {
  ApiClientError,
  IS_BACKEND_API_ENABLED,
  clearAuthTokens,
  getAccessToken,
  getStoredApiUser,
} from '../services/apiClient';
import {
  authApi,
  mapBackendNotification,
  mapBackendOrder,
  mapBackendProduct,
  mapBackendStoreToMerchant,
  marketplaceApi,
  type BackendCommissionRecord,
  type BackendInventoryMovement,
  type MerchantRegisterPayload,
} from '../services/gowarApi';
import { pickLang } from '../utils/i18n';
import {
  initAudioUnlockListeners,
  playNotificationSound,
} from '../utils/notificationSound';
import {
  DEFAULT_SEARCH_RADIUS_KM,
  calculateDynamicDeliveryFee,
  calculateHaversineDistanceKm,
  clampSearchRadiusKm,
  inferNearestArea,
} from '../services/locationService';
import { markLocationOnboardingCompleted } from '../services/locationOnboarding';

const DEMO_STORAGE_KEY = 'gowar_demo_state_v3';
const UI_PREF_LANG_KEY = 'gowar_ui_lang_v1';
const UI_PREF_LOC_KEY = 'gowar_ui_location_v1';

function createDefaultCustomerLocation(): CustomerLocationState {
  const defaultArea = SEED_AREAS[0];
  const defaultCustomer = SEED_CUSTOMERS[0];
  const defaultAddr =
    defaultCustomer?.addresses.find((a) => a.isDefault) ?? defaultCustomer?.addresses[0];
  const coords =
    defaultAddr?.coordinates ?? defaultArea?.coordinates ?? { lat: 30.0566, lng: 31.3376 };

  return {
    lat: coords.lat,
    lng: coords.lng,
    formattedAddressAr: defaultAddr?.streetAr ?? `${defaultArea?.nameAr ?? 'مدينة نصر'}`,
    formattedAddressEn: defaultAddr?.streetEn ?? `${defaultArea?.nameEn ?? 'Nasr City'}`,
    areaId: defaultAddr?.areaId ?? defaultArea?.id ?? 'area-nasr-city',
    selectedAddressId: defaultAddr?.id ?? null,
    searchRadiusKm: DEFAULT_SEARCH_RADIUS_KM,
    source: 'saved',
    updatedAt: new Date().toISOString(),
  };
}

function getInitialAuthSession(): AuthSession | null {
  if (!IS_BACKEND_API_ENABLED) {
    return getDemoSession();
  }
  const token = getAccessToken();
  const apiUser = getStoredApiUser();
  if (
    !token ||
    !apiUser ||
    (apiUser.role !== 'merchant' && apiUser.role !== 'admin' && apiUser.role !== 'delivery')
  ) {
    return null;
  }
  return {
    role: apiUser.role,
    userId: apiUser.id,
    email: apiUser.email,
    nameAr: apiUser.full_name || apiUser.email,
    nameEn: apiUser.full_name || apiUser.email,
    merchantId: apiUser.stores?.[0]?.id,
    loggedInAt: new Date().toISOString(),
  };
}

interface PersistedState {
  language: Language;
  selectedAreaId: string;
  customerLocation: CustomerLocationState;
  activeCustomerId: string;
  activeMerchantId: string;
  areas: Area[];
  categories: Category[];
  merchants: Merchant[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  reviews: Review[];
  cart: Cart;
  notifications: AppNotification[];
  settings: PlatformSettings;
}

function loadInitialState(): PersistedState {
  const defaultLoc = createDefaultCustomerLocation();

  if (IS_BACKEND_API_ENABLED) {
    // Strictly avoid loading static mock/localStorage business records when Backend API mode is active
    let lang: Language = 'ar';
    let loc: CustomerLocationState = { ...defaultLoc, selectedAddressId: null, areaId: '' };
    try {
      const savedLang = localStorage.getItem(UI_PREF_LANG_KEY);
      if (savedLang === 'en' || savedLang === 'ar') lang = savedLang;
      const savedLoc = localStorage.getItem(UI_PREF_LOC_KEY);
      if (savedLoc) {
        const parsedLoc = JSON.parse(savedLoc) as CustomerLocationState;
        if (typeof parsedLoc.lat === 'number' && typeof parsedLoc.lng === 'number') {
          loc = {
            ...loc,
            ...parsedLoc,
            searchRadiusKm: clampSearchRadiusKm(
              parsedLoc.searchRadiusKm ?? DEFAULT_SEARCH_RADIUS_KM
            ),
          };
        }
      }
    } catch {
      // Ignore storage read issues
    }
    const apiUser = getStoredApiUser();
    const guestOrCustomer: Customer = {
      id: apiUser?.id ?? 'guest',
      nameAr: apiUser?.full_name ?? 'زائر جوار',
      nameEn: apiUser?.full_name ?? 'Gowar Shopper',
      phone: apiUser?.phone_number ?? '',
      email: apiUser?.email ?? '',
      status: 'active',
      joinedAt: new Date().toISOString(),
      favoriteMerchantIds: [],
      addresses: [],
    };
    return {
      language: lang,
      selectedAreaId: loc.areaId,
      customerLocation: loc,
      activeCustomerId: guestOrCustomer.id,
      activeMerchantId: apiUser?.stores?.[0]?.id ?? '',
      areas: [],
      categories: [],
      merchants: [],
      products: [],
      customers: [guestOrCustomer],
      orders: [],
      reviews: [],
      cart: { merchantId: null, items: [] },
      notifications: [],
      settings: SEED_SETTINGS,
    };
  }

  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed.merchants && parsed.products && parsed.orders) {
        const persistedLoc = parsed.customerLocation
          ? {
            ...defaultLoc,
            ...parsed.customerLocation,
            searchRadiusKm: clampSearchRadiusKm(
              parsed.customerLocation.searchRadiusKm ?? DEFAULT_SEARCH_RADIUS_KM
            ),
          }
          : defaultLoc;
        return {
          language: parsed.language ?? 'ar',
          selectedAreaId: parsed.selectedAreaId ?? persistedLoc.areaId,
          customerLocation: persistedLoc,
          activeCustomerId: parsed.activeCustomerId ?? 'cust-1',
          activeMerchantId: parsed.activeMerchantId ?? 'store-albaraka',
          areas: parsed.areas ?? SEED_AREAS,
          categories: parsed.categories ?? SEED_CATEGORIES,
          merchants: parsed.merchants ?? SEED_MERCHANTS,
          products: parsed.products ?? SEED_PRODUCTS,
          customers: parsed.customers ?? SEED_CUSTOMERS,
          orders: parsed.orders ?? SEED_ORDERS,
          reviews: parsed.reviews ?? SEED_REVIEWS,
          cart: parsed.cart ?? { merchantId: null, items: [] },
          notifications: parsed.notifications ?? SEED_NOTIFICATIONS,
          settings: parsed.settings ?? SEED_SETTINGS,
        };
      }
    }
  } catch {
    // Fallback to seed data
  }
  return {
    language: 'ar',
    selectedAreaId: 'area-nasr-city',
    customerLocation: defaultLoc,
    activeCustomerId: 'cust-1',
    activeMerchantId: 'store-albaraka',
    areas: SEED_AREAS,
    categories: SEED_CATEGORIES,
    merchants: SEED_MERCHANTS,
    products: SEED_PRODUCTS,
    customers: SEED_CUSTOMERS,
    orders: SEED_ORDERS,
    reviews: SEED_REVIEWS,
    cart: { merchantId: null, items: [] },
    notifications: SEED_NOTIFICATIONS,
    settings: SEED_SETTINGS,
  };
}

interface PendingCartConflict {
  productId: string;
  quantity: number;
  newMerchantId: string;
  currentMerchantId: string;
}

interface PlaceOrderInput {
  customerName: string;
  customerPhone: string;
  areaId: string;
  deliveryAddressAr: string;
  deliveryAddressEn: string;
  addressId?: string | null;
  latitude?: number;
  longitude?: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  discount?: number;
}

export type ProductPayloadInput = Omit<Product, 'id'> & { imageFile?: File | null };
export type ProductUpdateInput = Partial<Product> & { imageFile?: File | null };
export type MerchantUpdateInput = Partial<Merchant> & {
  logoFile?: File | null;
  coverFile?: File | null;
};

interface AppContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (ar: string, en: string) => string;

  selectedAreaId: string;
  setSelectedAreaId: (areaId: string) => void;
  customerLocation: CustomerLocationState;
  confirmCustomerLocation: (input: {
    lat: number;
    lng: number;
    formattedAddressAr: string;
    formattedAddressEn: string;
    areaId?: string;
    selectedAddressId?: string | null;
    source: CustomerLocationState['source'];
  }) => Promise<void> | void;
  setSearchRadiusKm: (radiusKm: number) => Promise<void> | void;

  activeCustomer: Customer;
  activeMerchant: Merchant;
  setActiveMerchantId: (merchantId: string) => void;

  areas: Area[];
  categories: Category[];
  merchants: Merchant[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  reviews: Review[];
  cart: Cart;
  notifications: AppNotification[];
  settings: PlatformSettings;
  inventoryMovements: BackendInventoryMovement[];
  commissionRecords: BackendCommissionRecord[];
  toasts: ToastMessage[];
  pendingCartConflict: PendingCartConflict | null;

  // Auth & Backend Sync
  authSession: AuthSession | null;
  loginPortal: (
    email: string,
    password: string,
    expectedRole: DemoRole
  ) => Promise<{ ok: true; session: AuthSession } | { ok: false; error: string }>;
  registerMerchantPortal: (
    payload: MerchantRegisterPayload
  ) => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
  logoutPortal: () => Promise<void>;
  refreshFromBackend: () => Promise<void>;

  showToast: (message: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
  resetDemoData: () => void;

  // Cart actions
  addToCart: (productId: string, quantity?: number) => Promise<void> | void;
  updateCartQuantity: (productId: string, quantity: number) => Promise<void> | void;
  removeFromCart: (productId: string) => Promise<void> | void;
  clearCart: () => Promise<void> | void;
  confirmReplaceCart: () => Promise<void> | void;
  cancelReplaceCart: () => void;
  getCartItemQty: (productId: string) => number;

  // Customer actions
  placeOrder: (input: PlaceOrderInput) => Promise<Order | null> | Order | null;
  cancelCustomerOrder: (orderId: string, reason?: string) => Promise<void>;
  toggleFavoriteMerchant: (merchantId: string) => void;
  updateCustomerProfile: (
    updates: Partial<Pick<Customer, 'nameAr' | 'nameEn' | 'phone' | 'email'>>
  ) => Promise<void> | void;
  addCustomerAddress: (address: Omit<CustomerAddress, 'id'>) => Promise<void> | void;
  updateCustomerAddress: (addressId: string, updates: Partial<CustomerAddress>) => Promise<void> | void;
  deleteCustomerAddress: (addressId: string) => Promise<void> | void;
  setDefaultAddress: (addressId: string) => Promise<void> | void;

  // Merchant actions
  toggleMerchantOpen: (merchantId: string) => Promise<void> | void;
  updateMerchant: (merchantId: string, updates: MerchantUpdateInput) => Promise<void> | void;
  updateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    rejectReason?: string
  ) => Promise<void> | void;
  advanceOrderPipeline: (orderId: string) => Promise<void> | void;
  addProduct: (product: ProductPayloadInput) => Promise<Product> | Product;
  updateProduct: (productId: string, updates: ProductUpdateInput) => Promise<void> | void;
  deleteProduct: (productId: string) => Promise<void> | void;
  quickUpdateStock: (productId: string, stock: number, note?: string) => Promise<void> | void;
  addMerchantCategory: (
    merchantId: string,
    nameAr: string,
    nameEn: string
  ) => Promise<Category> | Category;
  updateCategory: (categoryId: string, updates: Partial<Category>) => Promise<void> | void;
  deleteCategory: (categoryId: string) => Promise<void> | void;

  // Admin actions
  setMerchantStatus: (merchantId: string, status: MerchantStatus) => Promise<void> | void;
  updateMerchantCommission: (merchantId: string, commissionRate: number) => Promise<void> | void;
  addGlobalCategory: (cat: Omit<Category, 'id' | 'isGlobal'>) => Promise<void> | void;
  addArea: (area: Omit<Area, 'id'>) => Promise<void> | void;
  updateArea: (areaId: string, updates: Partial<Area>) => Promise<void> | void;
  toggleCustomerStatus: (customerId: string) => Promise<void> | void;
  updatePlatformSettings: (updates: Partial<PlatformSettings>) => Promise<void> | void;
  refundAdminOrder: (orderId: string, amount: number, reason: string) => Promise<void>;
  settleAdminCommission: (recordId: string) => Promise<void>;
  markNotificationsRead: (audience?: AppNotification['audience'], merchantId?: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const EMPTY_MERCHANT_PLACEHOLDER: Merchant = {
  id: '',
  nameAr: '',
  nameEn: '',
  type: 'supermarket',
  descriptionAr: '',
  descriptionEn: '',
  logo: '',
  coverImage: '',
  phone: '',
  addressAr: '',
  addressEn: '',
  areaId: '',
  distanceKm: 0,
  rating: 5,
  reviewCount: 0,
  workingHoursAr: '',
  workingHoursEn: '',
  isOpen: false,
  status: 'approved',
  verified: false,
  commissionRate: 5,
  createdAt: '',
  categoryIds: [],
  coordinates: { lat: 30.0566, lng: 31.3376 },
  delivery: {
    deliveryEnabled: true,
    deliveryFee: 15,
    minOrder: 50,
    maxDistanceKm: 3,
    supportedAreaIds: [],
    prepTimeMin: 10,
    deliveryTimeMin: 25,
  },
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PersistedState>(loadInitialState);
  const [authSession, setAuthSession] = useState<AuthSession | null>(getInitialAuthSession);
  const [inventoryMovements, setInventoryMovements] = useState<BackendInventoryMovement[]>([]);
  const [commissionRecords, setCommissionRecords] = useState<BackendCommissionRecord[]>([]);
  const [merchantProfileMap, setMerchantProfileMap] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [pendingCartConflict, setPendingCartConflict] = useState<PendingCartConflict | null>(null);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const notifsHydratedRef = useRef(false);

  useEffect(() => {
    initAudioUnlockListeners();
  }, []);

  // Persist UI preferences in Backend mode, or full prototype state in Offline Demo mode
  useEffect(() => {
    try {
      if (IS_BACKEND_API_ENABLED) {
        localStorage.setItem(UI_PREF_LANG_KEY, state.language);
        localStorage.setItem(UI_PREF_LOC_KEY, JSON.stringify(state.customerLocation));
      } else {
        localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  // Cross-tab sync ONLY for Offline Demo mode
  useEffect(() => {
    if (IS_BACKEND_API_ENABLED) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === DEMO_STORAGE_KEY && e.newValue) {
        try {
          const next = JSON.parse(e.newValue) as PersistedState;
          if (next.merchants && next.orders) {
            setState(next);
          }
        } catch {
          // Ignore malformed payload
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = state.language;
    document.documentElement.dir = state.language === 'ar' ? 'rtl' : 'ltr';
  }, [state.language]);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const t = useCallback(
    (ar: string, en: string) => pickLang(state.language, ar, en),
    [state.language]
  );

  const handleApiError = useCallback(
    (err: unknown, fallbackAr: string, fallbackEn: string) => {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : pickLang(state.language, fallbackAr, fallbackEn);
      showToast(msg, 'error');
      return msg;
    },
    [state.language, showToast]
  );

  const refreshFromBackend = useCallback(
    async (locOverride?: CustomerLocationState, roleOverride?: AuthSession['role'] | 'customer' | null) => {
      if (!IS_BACKEND_API_ENABLED) return;

      const loc = locOverride ?? state.customerLocation;
      const apiUser = getStoredApiUser();
      const effectiveRole = roleOverride ?? authSession?.role ?? apiUser?.role ?? null;

      try {
        const [areasRes, categoriesRes, nearbyRes, productsRes] = await Promise.all([
          marketplaceApi.fetchAreas(),
          marketplaceApi.fetchCategories(),
          marketplaceApi.fetchNearbyStores({
            latitude: loc.lat,
            longitude: loc.lng,
            radius_km: loc.searchRadiusKm,
          }),
          marketplaceApi.fetchProducts(),
        ]);

        let nextMerchants = nearbyRes.results.map(mapBackendStoreToMerchant);
        let nextProducts = productsRes.results.map(mapBackendProduct);
        let nextOrders: Order[] | null = null;
        let nextCart: Cart | null = null;
        let nextCustomers: Customer[] | null = null;
        let nextSettings: PlatformSettings | null = null;
        let nextNotifications: AppNotification[] | null = null;
        let nextCategories = categoriesRes;

        if (effectiveRole === 'customer' && getAccessToken()) {
          try {
            const [cartRes, addrRes, ordRes, notifRes] = await Promise.all([
              marketplaceApi.fetchCart(),
              marketplaceApi.fetchAddresses(),
              marketplaceApi.fetchCustomerOrders(),
              marketplaceApi.fetchNotifications().catch(() => null),
            ]);
            nextCart = {
              merchantId: cartRes.store,
              items: cartRes.items.map((i) => ({
                productId: i.product_id,
                quantity: i.quantity,
              })),
            };
            nextOrders = ordRes.results.map(mapBackendOrder);
            if (notifRes) {
              nextNotifications = notifRes.results.map((n) =>
                mapBackendNotification(n, 'customer')
              );
            }
            nextCustomers = [
              {
                id: apiUser?.id ?? 'customer',
                nameAr: apiUser?.full_name ?? '',
                nameEn: apiUser?.full_name ?? '',
                phone: apiUser?.phone_number ?? '',
                email: apiUser?.email ?? '',
                status: 'active',
                joinedAt: new Date().toISOString(),
                favoriteMerchantIds: [],
                addresses: addrRes,
              },
            ];
          } catch {
            // Unauthenticated or expired session
          }
        } else if (effectiveRole === 'merchant' && getAccessToken()) {
          try {
            const [mStore, mProds, mOrds, mMovs, mCats, mNotifs] = await Promise.all([
              marketplaceApi.fetchMerchantStore(),
              marketplaceApi.fetchMerchantProducts(),
              marketplaceApi.fetchMerchantOrders(),
              marketplaceApi.fetchMerchantInventoryMovements(),
              marketplaceApi.fetchCategories(),
              marketplaceApi.fetchNotifications().catch(() => null),
            ]);
            const mappedStore = mapBackendStoreToMerchant(mStore);
            nextMerchants = [mappedStore];
            nextProducts = mProds.results.map(mapBackendProduct);
            nextOrders = mOrds.results.map(mapBackendOrder);
            nextCategories = mCats;
            if (mNotifs) {
              nextNotifications = mNotifs.results.map((n) =>
                mapBackendNotification(n, 'merchant')
              );
            }
            setInventoryMovements(mMovs.results);
          } catch (err) {
            handleApiError(err, 'تعذر تحميل بيانات التاجر', 'Failed to load merchant data');
          }
        } else if (effectiveRole === 'admin' && getAccessToken()) {
          try {
            const [aMerchants, aOrds, aCusts, aComms, aSettings] = await Promise.all([
              marketplaceApi.fetchAdminMerchants(),
              marketplaceApi.fetchAdminOrders(),
              marketplaceApi.fetchAdminCustomers(),
              marketplaceApi.fetchAdminCommissions(),
              marketplaceApi.fetchAdminSettings(),
            ]);
            const profileMap: Record<string, string> = {};
            const allAdminStores: Merchant[] = [];
            aMerchants.results.forEach((mp) => {
              mp.stores.forEach((st) => {
                profileMap[st.id] = mp.id;
                allAdminStores.push({
                  ...mapBackendStoreToMerchant(st),
                  ownerNameAr: mp.owner_name,
                  ownerNameEn: mp.owner_name,
                  status: mp.approval_status,
                  verified: mp.approval_status === 'approved',
                  createdAt: mp.created_at,
                });
              });
            });
            setMerchantProfileMap(profileMap);
            nextMerchants = allAdminStores;
            nextOrders = aOrds.results.map(mapBackendOrder);
            nextCustomers = aCusts;
            nextSettings = aSettings;
            setCommissionRecords(aComms.results);
          } catch (err) {
            handleApiError(err, 'تعذر تحميل بيانات الإدارة', 'Failed to load admin data');
          }
        }

        setState((prev) => ({
          ...prev,
          areas: areasRes,
          categories: nextCategories,
          merchants: nextMerchants,
          products: nextProducts,
          ...(nextOrders !== null ? { orders: nextOrders } : {}),
          ...(nextCart !== null ? { cart: nextCart } : {}),
          ...(nextCustomers !== null
            ? {
              customers: nextCustomers,
              activeCustomerId: nextCustomers[0]?.id ?? prev.activeCustomerId,
            }
            : {}),
          ...(nextSettings !== null ? { settings: nextSettings } : {}),
          ...(nextNotifications !== null ? { notifications: nextNotifications } : {}),
        }));
        if (nextNotifications) {
          if (!notifsHydratedRef.current) {
            nextNotifications.forEach((n) => seenNotifIdsRef.current.add(n.id));
            notifsHydratedRef.current = true;
          } else {
            const newlyArrived = nextNotifications.filter(
              (n) => !n.read && !seenNotifIdsRef.current.has(n.id)
            );
            nextNotifications.forEach((n) => seenNotifIdsRef.current.add(n.id));
            if (newlyArrived.length > 0) {
              playNotificationSound(newlyArrived[0].audience);
            }
          }
        }
      } catch (err) {
        handleApiError(
          err,
          'تعذر الاتصال بخادم جوار. تأكد من تشغيل الخادم.',
          'Unable to reach Gowar backend server.'
        );
      }
    },
    [
      state.customerLocation,
      authSession?.role,
      handleApiError,
    ]
  );

  useEffect(() => {
    if (IS_BACKEND_API_ENABLED) {
      void refreshFromBackend();
    }
    // Hydrate once on mount in backend mode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll live notifications & orders every 8s when authenticated in Backend mode
  useEffect(() => {
    if (!IS_BACKEND_API_ENABLED) return;
    const poll = async () => {
      if (!getAccessToken()) return;
      const apiUser = getStoredApiUser();
      const role = authSession?.role ?? apiUser?.role;
      if (role !== 'customer' && role !== 'merchant') return;

      try {
        const res = await marketplaceApi.fetchNotifications();
        const mapped = res.results.map((n) => mapBackendNotification(n, role));
        if (!notifsHydratedRef.current) {
          mapped.forEach((n) => seenNotifIdsRef.current.add(n.id));
          notifsHydratedRef.current = true;
        } else {
          const fresh = mapped.filter((n) => !n.read && !seenNotifIdsRef.current.has(n.id));
          mapped.forEach((n) => seenNotifIdsRef.current.add(n.id));
          if (fresh.length > 0) {
            playNotificationSound(role);
            showToast(pickLang(state.language, fresh[0].titleAr, fresh[0].titleEn), 'info');
            try {
              const ordRes =
                role === 'merchant'
                  ? await marketplaceApi.fetchMerchantOrders()
                  : await marketplaceApi.fetchCustomerOrders();
              const nextOrds = ordRes.results.map(mapBackendOrder);
              setState((prev) => ({
                ...prev,
                notifications: mapped,
                orders: nextOrds,
              }));
              return;
            } catch {
              // Fall back to updating notifications alone
            }
          }
        }
        setState((prev) => ({ ...prev, notifications: mapped }));
      } catch {
        // Ignore transient polling failures
      }
    };

    const id = window.setInterval(() => {
      void poll();
    }, 8000);
    return () => window.clearInterval(id);
  }, [authSession?.role, showToast, state.language]);

  const setLanguage = (language: Language) => setState((prev) => ({ ...prev, language }));
  const toggleLanguage = () =>
    setState((prev) => ({ ...prev, language: prev.language === 'ar' ? 'en' : 'ar' }));

  const setSelectedAreaId = (selectedAreaId: string) =>
    setState((prev) => {
      const area = prev.areas.find((a) => a.id === selectedAreaId);
      const coords = area?.coordinates ?? {
        lat: prev.customerLocation.lat,
        lng: prev.customerLocation.lng,
      };
      const nextLoc: CustomerLocationState = {
        ...prev.customerLocation,
        lat: coords.lat,
        lng: coords.lng,
        areaId: selectedAreaId,
        formattedAddressAr: area ? `${area.nameAr}، ${area.cityAr}` : prev.customerLocation.formattedAddressAr,
        formattedAddressEn: area ? `${area.nameEn}, ${area.cityEn}` : prev.customerLocation.formattedAddressEn,
        selectedAddressId: null,
        source: 'area',
        updatedAt: new Date().toISOString(),
      };
      if (IS_BACKEND_API_ENABLED) {
        void refreshFromBackend(nextLoc);
      }
      return {
        ...prev,
        selectedAreaId,
        customerLocation: nextLoc,
      };
    });

  const confirmCustomerLocation = async (input: {
    lat: number;
    lng: number;
    formattedAddressAr: string;
    formattedAddressEn: string;
    areaId?: string;
    selectedAddressId?: string | null;
    source: CustomerLocationState['source'];
  }) => {
    const resolvedAreaId =
      input.areaId ??
      inferNearestArea({ lat: input.lat, lng: input.lng }, state.areas)?.id ??
      state.selectedAreaId;
    const nextLoc: CustomerLocationState = {
      ...state.customerLocation,
      lat: input.lat,
      lng: input.lng,
      formattedAddressAr: input.formattedAddressAr,
      formattedAddressEn: input.formattedAddressEn,
      areaId: resolvedAreaId,
      selectedAddressId: input.selectedAddressId ?? null,
      source: input.source,
      updatedAt: new Date().toISOString(),
    };

    markLocationOnboardingCompleted();
    setState((prev) => ({
      ...prev,
      selectedAreaId: resolvedAreaId,
      customerLocation: nextLoc,
      customers: input.selectedAddressId
        ? prev.customers.map((c) =>
          c.id !== prev.activeCustomerId
            ? c
            : {
              ...c,
              addresses: c.addresses.map((a) => ({
                ...a,
                isDefault: a.id === input.selectedAddressId,
              })),
            }
        )
        : prev.customers,
    }));

    if (IS_BACKEND_API_ENABLED) {
      if (input.selectedAddressId && getStoredApiUser()?.role === 'customer') {
        await marketplaceApi.setDefaultAddress(input.selectedAddressId).catch(() => { });
      }
      await refreshFromBackend(nextLoc);
    }

    showToast(
      pickLang(
        state.language,
        'تم تأكيد موقع التوصيل وتحديث المحلات القريبة',
        'Delivery location confirmed and nearby stores updated'
      ),
      'success'
    );
  };

  const setSearchRadiusKm = async (radiusKm: number) => {
    const clamped = clampSearchRadiusKm(radiusKm);
    const nextLoc: CustomerLocationState = {
      ...state.customerLocation,
      searchRadiusKm: clamped,
    };
    setState((prev) => ({
      ...prev,
      customerLocation: nextLoc,
    }));

    if (IS_BACKEND_API_ENABLED) {
      if (getStoredApiUser()?.role === 'customer' && getAccessToken()) {
        try {
          await marketplaceApi.updateSearchRadius(clamped);
        } catch (err) {
          handleApiError(err, 'تعذر حفظ نطاق البحث', 'Failed to save search radius');
        }
      }
      await refreshFromBackend(nextLoc);
    }
  };

  const setActiveMerchantId = (activeMerchantId: string) =>
    setState((prev) => ({ ...prev, activeMerchantId }));

  const activeCustomer =
    state.customers.find((c) => c.id === state.activeCustomerId) ??
    state.customers[0] ?? {
      id: 'guest',
      nameAr: 'زائر',
      nameEn: 'Guest',
      phone: '',
      email: '',
      status: 'active',
      joinedAt: '',
      favoriteMerchantIds: [],
      addresses: [],
    };

  const scopedMerchantId =
    authSession?.role === 'merchant' && authSession.merchantId
      ? authSession.merchantId
      : state.activeMerchantId;

  const activeMerchant =
    state.merchants.find((m) => m.id === scopedMerchantId) ??
    state.merchants[0] ??
    EMPTY_MERCHANT_PLACEHOLDER;

  const loginPortal = async (
    email: string,
    password: string,
    expectedRole: DemoRole
  ): Promise<{ ok: true; session: AuthSession } | { ok: false; error: string }> => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        const res = await authApi.loginRole(expectedRole, email, password);
        const primaryStore = res.user.stores?.[0];
        const session: AuthSession = {
          role: expectedRole,
          userId: res.user.id,
          email: res.user.email,
          nameAr: res.user.full_name || res.user.email,
          nameEn: res.user.full_name || res.user.email,
          merchantId: primaryStore?.id,
          loggedInAt: new Date().toISOString(),
        };
        setAuthSession(session);
        if (primaryStore?.id) {
          setState((prev) => ({ ...prev, activeMerchantId: primaryStore.id }));
        }
        await refreshFromBackend(undefined, expectedRole);
        showToast(
          pickLang(state.language, `أهلاً بك ${session.nameAr}`, `Welcome back, ${session.nameEn}`),
          'success'
        );
        return { ok: true, session };
      } catch (err) {
        const msg =
          err instanceof ApiClientError
            ? err.message
            : pickLang(state.language, 'فشل تسجيل الدخول', 'Login failed');
        return { ok: false, error: msg };
      }
    }

    const res = loginWithDemoCredentials(email, password, expectedRole);
    if (!res.ok) {
      return { ok: false, error: pickLang(state.language, res.errorAr, res.errorEn) };
    }
    if (res.session.role === 'merchant' && res.session.merchantId) {
      const targetStore = state.merchants.find((m) => m.id === res.session.merchantId);
      if (targetStore && targetStore.status === 'pending') {
        clearDemoSession();
        return {
          ok: false,
          error: pickLang(
            state.language,
            'طلب تسجيل متجرك ما زال قيد مراجعة الإدارة. ستتمكن من الدخول فور اعتماده.',
            'Your merchant application is awaiting admin approval. You can sign in once approved.'
          ),
        };
      }
      if (targetStore && (targetStore.status === 'rejected' || targetStore.status === 'suspended')) {
        clearDemoSession();
        return {
          ok: false,
          error: pickLang(
            state.language,
            'هذا المتجر غير مفعل حالياً من قبل الإدارة.',
            'This merchant store is currently rejected or suspended by admin.'
          ),
        };
      }
    }
    setAuthSession(res.session);
    if (res.session.role === 'merchant' && res.session.merchantId) {
      const mId = res.session.merchantId;
      setState((prev) => ({ ...prev, activeMerchantId: mId }));
    }
    showToast(
      pickLang(state.language, `أهلاً بك ${res.session.nameAr}`, `Welcome back, ${res.session.nameEn}`),
      'success'
    );
    return { ok: true, session: res.session };
  };

  const registerMerchantPortal = async (
    payload: MerchantRegisterPayload
  ): Promise<{ ok: true; message: string } | { ok: false; error: string }> => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        const res = await authApi.registerMerchant(payload);
        const msg = pickLang(
          state.language,
          'تم إرسال طلب تسجيل المتجر للإدارة بنجاح. بمجرد الموافقة يمكنك الدخول بنفس البريد وكلمة المرور.',
          res.detail || 'Merchant application submitted and awaiting platform admin approval.'
        );
        showToast(msg, 'success');
        return { ok: true, message: msg };
      } catch (err) {
        const msg =
          err instanceof ApiClientError
            ? err.message
            : pickLang(state.language, 'تعذر إرسال طلب تسجيل التاجر', 'Failed to submit merchant registration');
        return { ok: false, error: msg };
      }
    }

    const storeId = `store-${Date.now()}`;
    const fullName = [payload.first_name, payload.last_name].filter(Boolean).join(' ').trim();
    const areaId = payload.area || state.areas[0]?.id || 'area-nasr-city';
    const radiusNum = Number(payload.delivery_radius_km) || 3;
    const newMerchant: Merchant = {
      id: storeId,
      nameAr: payload.store_name,
      nameEn: payload.store_name_en || payload.store_name,
      type: payload.store_type,
      descriptionAr: payload.business_name,
      descriptionEn: payload.business_name,
      logo: '',
      coverImage: '',
      areaId,
      addressAr: payload.address,
      addressEn: payload.address,
      phone: payload.phone_number,
      ownerNameAr: fullName,
      ownerNameEn: fullName,
      coordinates: { lat: payload.latitude, lng: payload.longitude },
      distanceKm: 0,
      rating: 5,
      reviewCount: 0,
      workingHoursAr: '8:00 ص - 12:00 ص',
      workingHoursEn: '8:00 AM - 12:00 AM',
      isOpen: true,
      status: 'pending',
      verified: false,
      commissionRate: state.settings.defaultCommissionRate,
      createdAt: new Date().toISOString(),
      categoryIds: [],
      delivery: {
        deliveryEnabled: true,
        deliveryFee: 15,
        minOrder: 50,
        maxDistanceKm: radiusNum,
        supportedAreaIds: [areaId],
        prepTimeMin: 10,
        deliveryTimeMin: 25,
      },
    };
    registerDemoMerchantAccount({
      id: `usr-${Date.now()}`,
      role: 'merchant',
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      nameAr: fullName,
      nameEn: fullName,
      merchantId: storeId,
      merchantCode: `merchant_${Date.now().toString().slice(-4)}`,
      storeNameAr: payload.store_name,
      storeNameEn: payload.store_name_en || payload.store_name,
    });
    setState((prev) => ({
      ...prev,
      merchants: [newMerchant, ...prev.merchants],
    }));
    const msg = pickLang(
      state.language,
      'تم إرسال طلب تسجيل المتجر للإدارة بنجاح. بمجرد الموافقة يمكنك الدخول بنفس البريد وكلمة المرور.',
      'Merchant application submitted and awaiting platform admin approval.'
    );
    showToast(msg, 'success');
    return { ok: true, message: msg };
  };

  const logoutPortal = async () => {
    if (IS_BACKEND_API_ENABLED) {
      await authApi.logout();
      setState((prev) => ({ ...prev, orders: [], cart: { merchantId: null, items: [] } }));
    } else {
      clearAuthTokens();
    }
    clearDemoSession();
    setAuthSession(null);
    showToast(
      pickLang(state.language, 'تم تسجيل الخروج بنجاح', 'Signed out successfully'),
      'info'
    );
  };

  const resetDemoData = () => {
    if (IS_BACKEND_API_ENABLED) {
      void refreshFromBackend();
      return;
    }
    localStorage.removeItem(DEMO_STORAGE_KEY);
    setState({
      language: state.language,
      selectedAreaId: 'area-nasr-city',
      customerLocation: createDefaultCustomerLocation(),
      activeCustomerId: 'cust-1',
      activeMerchantId: 'store-albaraka',
      areas: SEED_AREAS,
      categories: SEED_CATEGORIES,
      merchants: SEED_MERCHANTS,
      products: SEED_PRODUCTS,
      customers: SEED_CUSTOMERS,
      orders: SEED_ORDERS,
      reviews: SEED_REVIEWS,
      cart: { merchantId: null, items: [] },
      notifications: SEED_NOTIFICATIONS,
      settings: SEED_SETTINGS,
    });
    setPendingCartConflict(null);
    showToast(
      pickLang(
        state.language,
        'تمت إعادة تعيين بيانات العرض التجريبي بنجاح',
        'Demo data has been reset successfully'
      ),
      'info'
    );
  };

  // ==================== CART ACTIONS ====================
  const addToCart = async (productId: string, quantity = 1) => {
    const product = state.products.find((p) => p.id === productId);
    if (!product) return;

    if (IS_BACKEND_API_ENABLED) {
      if (!getAccessToken() || getStoredApiUser()?.role !== 'customer') {
        showToast(
          t('سجّل دخول كعميل أولاً لإضافة منتجات للسلة', 'Sign in as a customer to add items to cart'),
          'warning'
        );
        return;
      }
      try {
        const res = await marketplaceApi.addCartItem(productId, quantity, false);
        setState((prev) => ({
          ...prev,
          cart: {
            merchantId: res.store,
            items: res.items.map((i) => ({ productId: i.product_id, quantity: i.quantity })),
          },
        }));
        showToast(t('تمت الإضافة إلى السلة', 'Added to cart'), 'success');
      } catch (err) {
        if (err instanceof ApiClientError && err.code === 'STORE_CONFLICT') {
          const payload = err.errors as { current_store_id?: string; new_store_id?: string };
          setPendingCartConflict({
            productId,
            quantity,
            newMerchantId: payload?.new_store_id ?? product.merchantId,
            currentMerchantId: payload?.current_store_id ?? state.cart.merchantId ?? '',
          });
          return;
        }
        handleApiError(err, 'تعذر إضافة المنتج للسلة', 'Could not add item to cart');
      }
      return;
    }

    if (!product.isAvailable || product.stock <= 0) {
      showToast(t('عذراً، هذا المنتج غير متوفر حالياً', 'Sorry, this product is out of stock'), 'error');
      return;
    }
    const merchant = state.merchants.find((m) => m.id === product.merchantId);
    if (!merchant || merchant.status !== 'approved') {
      showToast(t('هذا المتجر غير متاح حالياً', 'This store is currently unavailable'), 'error');
      return;
    }
    if (
      state.cart.merchantId &&
      state.cart.items.length > 0 &&
      state.cart.merchantId !== product.merchantId
    ) {
      setPendingCartConflict({
        productId,
        quantity,
        newMerchantId: product.merchantId,
        currentMerchantId: state.cart.merchantId,
      });
      return;
    }

    setState((prev) => {
      const existing = prev.cart.items.find((i) => i.productId === productId);
      const nextQty = Math.min(product.stock, (existing?.quantity ?? 0) + quantity);
      const nextItems = existing
        ? prev.cart.items.map((i) => (i.productId === productId ? { ...i, quantity: nextQty } : i))
        : [...prev.cart.items, { productId, quantity: nextQty }];
      return {
        ...prev,
        cart: { merchantId: product.merchantId, items: nextItems },
      };
    });
    showToast(t('تمت الإضافة إلى السلة', 'Added to cart'), 'success');
  };

  const confirmReplaceCart = async () => {
    if (!pendingCartConflict) return;
    const { productId, quantity, newMerchantId } = pendingCartConflict;

    if (IS_BACKEND_API_ENABLED) {
      try {
        const res = await marketplaceApi.addCartItem(productId, quantity, true);
        setState((prev) => ({
          ...prev,
          cart: {
            merchantId: res.store,
            items: res.items.map((i) => ({ productId: i.product_id, quantity: i.quantity })),
          },
        }));
        setPendingCartConflict(null);
        showToast(t('تم بدء سلة جديدة وإضافة المنتج', 'Started a new cart and added item'), 'success');
      } catch (err) {
        handleApiError(err, 'تعذر استبدال السلة', 'Failed to replace cart');
      }
      return;
    }

    const product = state.products.find((p) => p.id === productId);
    const maxQty = product ? Math.min(product.stock, quantity) : quantity;
    setState((prev) => ({
      ...prev,
      cart: {
        merchantId: newMerchantId,
        items: [{ productId, quantity: maxQty }],
      },
    }));
    setPendingCartConflict(null);
    showToast(t('تم بدء سلة جديدة وإضافة المنتج', 'Started a new cart and added item'), 'success');
  };

  const cancelReplaceCart = () => setPendingCartConflict(null);

  const removeFromCart = async (productId: string) => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        const res = await marketplaceApi.updateCartItem(productId, 0);
        setState((prev) => ({
          ...prev,
          cart: {
            merchantId: res.store,
            items: res.items.map((i) => ({ productId: i.product_id, quantity: i.quantity })),
          },
        }));
      } catch (err) {
        handleApiError(err, 'تعذر حذف الصنف من السلة', 'Failed to remove item');
      }
      return;
    }

    setState((prev) => {
      const nextItems = prev.cart.items.filter((i) => i.productId !== productId);
      return {
        ...prev,
        cart: {
          merchantId: nextItems.length > 0 ? prev.cart.merchantId : null,
          items: nextItems,
        },
      };
    });
  };

  const updateCartQuantity = async (productId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }

    if (IS_BACKEND_API_ENABLED) {
      try {
        const res = await marketplaceApi.updateCartItem(productId, quantity);
        setState((prev) => ({
          ...prev,
          cart: {
            merchantId: res.store,
            items: res.items.map((i) => ({ productId: i.product_id, quantity: i.quantity })),
          },
        }));
      } catch (err) {
        handleApiError(err, 'تعذر تعديل الكمية', 'Could not update quantity');
      }
      return;
    }

    const product = state.products.find((p) => p.id === productId);
    const capped = product ? Math.min(product.stock, quantity) : quantity;
    setState((prev) => ({
      ...prev,
      cart: {
        ...prev.cart,
        items: prev.cart.items.map((i) =>
          i.productId === productId ? { ...i, quantity: capped } : i
        ),
      },
    }));
  };

  const clearCart = async () => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        await marketplaceApi.clearCart();
      } catch {
        // Proceed clearing client view cleanly if server cleared
      }
    }
    setState((prev) => ({ ...prev, cart: { merchantId: null, items: [] } }));
  };

  const getCartItemQty = (productId: string) =>
    state.cart.items.find((i) => i.productId === productId)?.quantity ?? 0;

  // ==================== CHECKOUT & ORDERS ====================
  const placeOrder = async (input: PlaceOrderInput): Promise<Order | null> => {
    if (!state.cart.merchantId || state.cart.items.length === 0) return null;

    if (IS_BACKEND_API_ENABLED) {
      try {
        const idemKey = `ord-${activeCustomer.id}-${Date.now()}`;
        const created = await marketplaceApi.createOrder({
          address_id: input.addressId || null,
          delivery_address: input.addressId
            ? undefined
            : {
              recipient_name: input.customerName,
              phone_number: input.customerPhone,
              formatted_address: input.deliveryAddressAr,
              latitude: input.latitude ?? state.customerLocation.lat,
              longitude: input.longitude ?? state.customerLocation.lng,
            },
          payment_method: 'cod',
          customer_notes: input.notes ?? '',
          idempotency_key: idemKey,
        });
        const mapped = mapBackendOrder(created);
        setState((prev) => ({
          ...prev,
          orders: [mapped, ...prev.orders],
          cart: { merchantId: null, items: [] },
        }));
        await refreshFromBackend();
        showToast(
          t(`تم إرسال طلبك #${mapped.orderNumber}!`, `Order #${mapped.orderNumber} placed!`),
          'success'
        );
        return mapped;
      } catch (err) {
        handleApiError(err, 'تعذر إرسال الطلب', 'Failed to place order');
        return null;
      }
    }

    const merchant = state.merchants.find((m) => m.id === state.cart.merchantId);
    if (!merchant) return null;

    const orderItems = state.cart.items
      .map((ci) => {
        const prod = state.products.find((p) => p.id === ci.productId);
        if (!prod) return null;
        return {
          productId: prod.id,
          nameAr: prod.nameAr,
          nameEn: prod.nameEn,
          image: prod.image,
          unitPrice: prod.price,
          quantity: ci.quantity,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    if (orderItems.length === 0) return null;

    const subtotal = orderItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
    const qualifiesFreeDelivery =
      merchant.delivery.freeDeliveryThreshold && subtotal >= merchant.delivery.freeDeliveryThreshold;
    const distKm = calculateHaversineDistanceKm(
      { lat: state.customerLocation.lat, lng: state.customerLocation.lng },
      merchant.coordinates
    );
    const ratePerKm = merchant.delivery.deliveryPricePerKm ?? merchant.delivery.deliveryFee;
    const dyn = calculateDynamicDeliveryFee(distKm, ratePerKm);
    const deliveryFee =
      !merchant.delivery.deliveryEnabled || qualifiesFreeDelivery ? 0 : dyn.deliveryFee;
    const discount = input.discount ?? 0;
    const total = Math.max(0, subtotal + deliveryFee - discount);
    const commissionRate = merchant.commissionRate ?? state.settings.defaultCommissionRate;
    const platformCommission = Number(((subtotal * commissionRate) / 100).toFixed(2));

    const now = new Date().toISOString();
    const orderNumber = `GW-${Math.floor(4822 + Math.random() * 5000)}`;
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      customerId: activeCustomer.id,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      merchantId: merchant.id,
      areaId: input.areaId,
      deliveryAddressAr: input.deliveryAddressAr,
      deliveryAddressEn: input.deliveryAddressEn,
      items: orderItems,
      subtotal,
      deliveryFee,
      discount,
      total,
      commissionRate,
      platformCommission,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
      status: 'pending',
      statusHistory: [
        {
          status: 'pending',
          timestamp: now,
          actorAr: input.customerName,
          actorEn: input.customerName,
          noteAr: `تم إرسال الطلب إلى ${merchant.nameAr} وبانتظار قبول التاجر`,
          noteEn: `Order placed at ${merchant.nameEn}, awaiting merchant acceptance`,
        },
      ],
      createdAt: now,
      updatedAt: now,
      estimatedDeliveryMin: merchant.delivery.deliveryTimeMin,
    };

    const merchantNotif: AppNotification = {
      id: `notif-m-${Date.now()}`,
      audience: 'merchant',
      merchantId: merchant.id,
      titleAr: `طلب جديد #${orderNumber}`,
      titleEn: `New Order #${orderNumber}`,
      bodyAr: `طلب جديد بقيمة ${total} ج.م بانتظار قبولك`,
      bodyEn: `New order worth ${total} EGP awaiting approval`,
      createdAt: now,
      read: false,
      link: `/merchant/orders/${newOrder.id}`,
    };

    setState((prev) => ({
      ...prev,
      activeMerchantId: merchant.id,
      orders: [newOrder, ...prev.orders],
      notifications: [merchantNotif, ...prev.notifications],
      cart: { merchantId: null, items: [] },
      products: prev.products.map((p) => {
        const bought = orderItems.find((oi) => oi.productId === p.id);
        if (!bought) return p;
        const nextStock = Math.max(0, p.stock - bought.quantity);
        return {
          ...p,
          stock: nextStock,
          isAvailable: nextStock > 0 ? p.isAvailable : false,
        };
      }),
    }));

    playNotificationSound('merchant');

    showToast(
      t(
        `تم إرسال طلبك #${orderNumber} إلى ${merchant.nameAr}!`,
        `Order #${orderNumber} sent to ${merchant.nameEn}!`
      ),
      'success'
    );
    return newOrder;
  };

  const cancelCustomerOrder = async (orderId: string, reason = 'Cancelled by customer') => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        const updated = await marketplaceApi.cancelCustomerOrder(orderId, reason);
        const mapped = mapBackendOrder(updated);
        setState((prev) => ({
          ...prev,
          orders: prev.orders.map((o) => (o.id === orderId ? mapped : o)),
        }));
        await refreshFromBackend();
        showToast(t('تم إلغاء الطلب بنجاح', 'Order cancelled successfully'), 'info');
      } catch (err) {
        handleApiError(err, 'لا يمكن إلغاء هذا الطلب', 'Cannot cancel this order');
      }
      return;
    }

    await updateOrderStatus(orderId, 'cancelled', reason);
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus, rejectReason?: string) => {
    if (IS_BACKEND_API_ENABLED) {
      const currentOrder = state.orders.find((o) => o.id === orderId);
      try {
        if (status === 'out_for_delivery' && currentOrder?.status === 'preparing') {
          try {
            await marketplaceApi.transitionMerchantOrder(orderId, 'ready_for_delivery');
          } catch (stepErr) {
            // If backend is already at ready_for_delivery, continue to out_for_delivery
            if (!(stepErr instanceof ApiClientError && stepErr.message.includes("from 'ready_for_delivery'"))) {
              throw stepErr;
            }
          }
        }
        const updated = await marketplaceApi.transitionMerchantOrder(
          orderId,
          status,
          rejectReason || ''
        );
        const mapped = mapBackendOrder(updated);
        setState((prev) => ({
          ...prev,
          orders: prev.orders.map((o) => (o.id === orderId ? mapped : o)),
        }));
        showToast(
          t(`تم تحديث حالة الطلب #${mapped.orderNumber}`, `Updated #${mapped.orderNumber}`),
          'success'
        );
      } catch (err) {
        handleApiError(err, 'تعذر تحديث حالة الطلب', 'Could not update order status');
      }
      return;
    }

    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;
    const merchant = state.merchants.find((m) => m.id === order.merchantId);
    const now = new Date().toISOString();

    const statusLabels: Record<
      OrderStatus,
      { ar: string; en: string; noteAr: string; noteEn: string }
    > = {
      pending: { ar: 'قيد المراجعة', en: 'Pending', noteAr: 'الطلب بانتظار المراجعة', noteEn: 'Awaiting review' },
      accepted: { ar: 'تم قبول طلبك', en: 'Accepted', noteAr: 'وافق التاجر على الطلب', noteEn: 'Merchant accepted' },
      preparing: { ar: 'جاري التجهيز', en: 'Preparing', noteAr: 'جاري تجميع الطلب', noteEn: 'Packing items' },
      out_for_delivery: { ar: 'في الطريق', en: 'Out for Delivery', noteAr: 'المندوب في الطريق', noteEn: 'Courier on the way' },
      delivered: { ar: 'تم التوصيل', en: 'Delivered', noteAr: 'تم تسليم الطلب بنجاح', noteEn: 'Delivered' },
      cancelled: {
        ar: 'تم الإلغاء',
        en: 'Cancelled',
        noteAr: rejectReason || 'تم إلغاء الطلب',
        noteEn: rejectReason || 'Order cancelled',
      },
    };

    const newEvent: OrderPipelineEvent = {
      status,
      timestamp: now,
      actorAr: merchant?.nameAr ?? 'المتجر',
      actorEn: merchant?.nameEn ?? 'Store',
      noteAr: statusLabels[status].noteAr,
      noteEn: statusLabels[status].noteEn,
    };

    const customerNotif: AppNotification = {
      id: `notif-c-${Date.now()}`,
      audience: 'customer',
      merchantId: order.merchantId,
      titleAr: `تحديث حالة الطلب #${order.orderNumber}`,
      titleEn: `Order #${order.orderNumber} Update`,
      bodyAr: statusLabels[status].noteAr,
      bodyEn: statusLabels[status].noteEn,
      createdAt: now,
      read: false,
      link: `/orders/${order.id}`,
    };

    setState((prev) => ({
      ...prev,
      notifications: [customerNotif, ...prev.notifications],
      orders: prev.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          status,
          rejectReason: rejectReason ?? o.rejectReason,
          statusHistory: [...(o.statusHistory ?? []), newEvent],
          updatedAt: now,
        };
      }),
    }));

    playNotificationSound('customer');

    showToast(t(`تم تحديث حالة الطلب #${order.orderNumber}`, `Updated #${order.orderNumber}`), 'success');
  };

  const advanceOrderPipeline = async (orderId: string) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;

    const flow: OrderStatus[] = ['pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered'];
    const idx = flow.indexOf(order.status);
    if (idx >= 0 && idx < flow.length - 1) {
      await updateOrderStatus(orderId, flow[idx + 1]);
    }
  };

  // ==================== CUSTOMER PROFILE / ADDRESSES / FAVORITES ====================
  const toggleFavoriteMerchant = (merchantId: string) => {
    setState((prev) => ({
      ...prev,
      customers: prev.customers.map((c) => {
        if (c.id !== activeCustomer.id) return c;
        const exists = c.favoriteMerchantIds.includes(merchantId);
        return {
          ...c,
          favoriteMerchantIds: exists
            ? c.favoriteMerchantIds.filter((id) => id !== merchantId)
            : [...c.favoriteMerchantIds, merchantId],
        };
      }),
    }));
  };

  const updateCustomerProfile = async (
    updates: Partial<Pick<Customer, 'nameAr' | 'nameEn' | 'phone' | 'email'>>
  ) => {
    if (IS_BACKEND_API_ENABLED && getAccessToken()) {
      try {
        const parts = (updates.nameAr || updates.nameEn || '').trim().split(' ');
        await authApi.updateProfile({
          first_name: parts[0] || undefined,
          last_name: parts.slice(1).join(' ') || undefined,
          phone_number: updates.phone,
        });
      } catch (err) {
        handleApiError(err, 'تعذر حفظ بيانات الحساب', 'Failed to update profile');
        return;
      }
    }
    setState((prev) => ({
      ...prev,
      customers: prev.customers.map((c) =>
        c.id === activeCustomer.id ? { ...c, ...updates } : c
      ),
    }));
    showToast(t('تم حفظ بيانات الحساب', 'Profile updated'), 'success');
  };

  const addCustomerAddress = async (address: Omit<CustomerAddress, 'id'>) => {
    if (IS_BACKEND_API_ENABLED) {
      if (!getAccessToken()) {
        showToast(t('سجّل دخول كعميل لحفظ العنوان', 'Sign in to save addresses'), 'warning');
        return;
      }
      try {
        const area = state.areas.find((a) => a.id === address.areaId);
        const coords = address.coordinates ?? area?.coordinates ?? {
          lat: state.customerLocation.lat,
          lng: state.customerLocation.lng,
        };
        await marketplaceApi.createAddress({
          label: address.labelAr,
          formatted_address: address.streetAr,
          latitude: Number(coords.lat.toFixed(6)),
          longitude: Number(coords.lng.toFixed(6)),
          area: address.areaId || null,
          building_number: address.building,
          floor: address.floor,
          apartment: address.apartment,
          additional_instructions: address.notes || '',
          is_default: address.isDefault,
        });
        await refreshFromBackend();
        showToast(t('تم إضافة العنوان الجديد', 'Address added'), 'success');
      } catch (err) {
        handleApiError(err, 'تعذر إضافة العنوان', 'Failed to save address');
      }
      return;
    }

    const newAddr: CustomerAddress = { ...address, id: `addr-${Date.now()}` };
    setState((prev) => {
      const area = prev.areas.find((a) => a.id === address.areaId);
      const coords = address.coordinates ?? area?.coordinates;
      return {
        ...prev,
        customers: prev.customers.map((c) => {
          if (c.id !== activeCustomer.id) return c;
          const base = address.isDefault
            ? c.addresses.map((a) => ({ ...a, isDefault: false }))
            : c.addresses;
          return { ...c, addresses: [newAddr, ...base] };
        }),
        ...(address.isDefault && coords
          ? {
            selectedAreaId: address.areaId,
            customerLocation: {
              ...prev.customerLocation,
              lat: coords.lat,
              lng: coords.lng,
              areaId: address.areaId,
              formattedAddressAr: address.streetAr,
              formattedAddressEn: address.streetEn,
              selectedAddressId: newAddr.id,
              source: 'saved',
              updatedAt: new Date().toISOString(),
            },
          }
          : {}),
      };
    });
    showToast(t('تم إضافة العنوان الجديد', 'Address added'), 'success');
  };

  const updateCustomerAddress = async (addressId: string, updates: Partial<CustomerAddress>) => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        await marketplaceApi.updateAddress(addressId, {
          ...(updates.labelAr ? { label: updates.labelAr } : {}),
          ...(updates.streetAr ? { formatted_address: updates.streetAr } : {}),
          ...(updates.building ? { building_number: updates.building } : {}),
        });
        await refreshFromBackend();
      } catch (err) {
        handleApiError(err, 'تعذر تحديث العنوان', 'Failed to update address');
        return;
      }
    }
    setState((prev) => ({
      ...prev,
      customers: prev.customers.map((c) =>
        c.id !== activeCustomer.id
          ? c
          : {
            ...c,
            addresses: c.addresses.map((a) => (a.id === addressId ? { ...a, ...updates } : a)),
          }
      ),
    }));
    showToast(t('تم تحديث العنوان', 'Address updated'), 'success');
  };

  const deleteCustomerAddress = async (addressId: string) => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        await marketplaceApi.deleteAddress(addressId);
        await refreshFromBackend();
        showToast(t('تم حذف العنوان', 'Address removed'), 'info');
      } catch (err) {
        handleApiError(err, 'تعذر حذف العنوان', 'Failed to delete address');
      }
      return;
    }

    setState((prev) => ({
      ...prev,
      customers: prev.customers.map((c) => {
        if (c.id !== activeCustomer.id) return c;
        const filtered = c.addresses.filter((a) => a.id !== addressId);
        if (filtered.length > 0 && !filtered.some((a) => a.isDefault)) {
          filtered[0] = { ...filtered[0], isDefault: true };
        }
        return { ...c, addresses: filtered };
      }),
    }));
    showToast(t('تم حذف العنوان', 'Address removed'), 'info');
  };

  const setDefaultAddress = async (addressId: string) => {
    const target = activeCustomer.addresses.find((a) => a.id === addressId);
    if (IS_BACKEND_API_ENABLED) {
      try {
        await marketplaceApi.setDefaultAddress(addressId);
        const coords = target?.coordinates;
        const nextLoc = coords
          ? {
            ...state.customerLocation,
            lat: coords.lat,
            lng: coords.lng,
            areaId: target.areaId || state.customerLocation.areaId,
            formattedAddressAr: target.streetAr,
            formattedAddressEn: target.streetEn,
            selectedAddressId: target.id,
            source: 'saved' as const,
            updatedAt: new Date().toISOString(),
          }
          : state.customerLocation;
        setState((prev) => ({ ...prev, customerLocation: nextLoc }));
        await refreshFromBackend(nextLoc);
        showToast(t('تم تعيين العنوان الافتراضي للتوصيل', 'Default delivery address updated'), 'success');
      } catch (err) {
        handleApiError(err, 'تعذر تعيين العنوان الافتراضي', 'Failed to set default address');
      }
      return;
    }

    setState((prev) => {
      const area = target ? prev.areas.find((a) => a.id === target.areaId) : undefined;
      const coords = target?.coordinates ?? area?.coordinates;
      return {
        ...prev,
        customers: prev.customers.map((c) =>
          c.id !== activeCustomer.id
            ? c
            : {
              ...c,
              addresses: c.addresses.map((a) => ({ ...a, isDefault: a.id === addressId })),
            }
        ),
        ...(target && coords
          ? {
            selectedAreaId: target.areaId,
            customerLocation: {
              ...prev.customerLocation,
              lat: coords.lat,
              lng: coords.lng,
              areaId: target.areaId,
              formattedAddressAr: target.streetAr,
              formattedAddressEn: target.streetEn,
              selectedAddressId: target.id,
              source: 'saved',
              updatedAt: new Date().toISOString(),
            },
          }
          : target
            ? { selectedAreaId: target.areaId }
            : {}),
      };
    });
    showToast(t('تم تعيين العنوان الافتراضي للتوصيل', 'Default delivery address updated'), 'success');
  };

  // ==================== MERCHANT ACTIONS ====================
  const toggleMerchantOpen = async (merchantId: string) => {
    const current = state.merchants.find((m) => m.id === merchantId);
    if (!current) return;
    const nextOpen = !current.isOpen;

    if (IS_BACKEND_API_ENABLED) {
      try {
        const res = await marketplaceApi.updateMerchantStore({ is_open: nextOpen });
        const mapped = mapBackendStoreToMerchant(res);
        setState((prev) => ({
          ...prev,
          merchants: prev.merchants.map((m) => (m.id === merchantId ? mapped : m)),
        }));
      } catch (err) {
        handleApiError(err, 'تعذر تغيير حالة المحل', 'Could not toggle store status');
        return;
      }
    } else {
      setState((prev) => ({
        ...prev,
        merchants: prev.merchants.map((m) => (m.id === merchantId ? { ...m, isOpen: nextOpen } : m)),
      }));
    }

    showToast(
      nextOpen
        ? t('تم فتح المحل لاستقبال الطلبات', 'Store is now open for orders')
        : t('تم إيقاف استقبال الطلبات مؤقتاً', 'Store paused incoming orders'),
      nextOpen ? 'success' : 'warning'
    );
  };

  const updateMerchant = async (merchantId: string, updates: MerchantUpdateInput) => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        let updatedStore;
        if (updates.delivery) {
          updatedStore = await marketplaceApi.updateMerchantDelivery({
            delivery_enabled: updates.delivery.deliveryEnabled,
            delivery_fee: updates.delivery.deliveryFee.toFixed(2),
            delivery_price_per_km: (
              updates.delivery.deliveryPricePerKm ?? updates.delivery.deliveryFee
            ).toFixed(2),
            minimum_order_amount: updates.delivery.minOrder.toFixed(2),
            delivery_radius_km: updates.delivery.maxDistanceKm.toFixed(2),
            estimated_delivery_minutes: updates.delivery.deliveryTimeMin,
            free_delivery_threshold: updates.delivery.freeDeliveryThreshold
              ? updates.delivery.freeDeliveryThreshold.toFixed(2)
              : null,
          });
        } else if (updates.logoFile || updates.coverFile) {
          const fd = new FormData();
          if (updates.nameAr) fd.append('name', updates.nameAr);
          if (updates.nameEn) fd.append('name_en', updates.nameEn);
          if (updates.descriptionAr) fd.append('description', updates.descriptionAr);
          if (updates.phone) fd.append('phone_number', updates.phone);
          if (updates.addressAr) fd.append('address', updates.addressAr);
          if (updates.workingHoursAr) fd.append('opening_hours', updates.workingHoursAr);
          if (updates.areaId) fd.append('area', updates.areaId);
          if (updates.coordinates) {
            fd.append('latitude', String(Number(updates.coordinates.lat.toFixed(6))));
            fd.append('longitude', String(Number(updates.coordinates.lng.toFixed(6))));
          }
          if (updates.logoFile) fd.append('logo', updates.logoFile);
          if (updates.coverFile) fd.append('cover_image', updates.coverFile);
          updatedStore = await marketplaceApi.updateMerchantStore(fd);
        } else {
          updatedStore = await marketplaceApi.updateMerchantStore({
            ...(updates.nameAr !== undefined ? { name: updates.nameAr } : {}),
            ...(updates.nameEn !== undefined ? { name_en: updates.nameEn } : {}),
            ...(updates.descriptionAr !== undefined ? { description: updates.descriptionAr } : {}),
            ...(updates.phone !== undefined ? { phone_number: updates.phone } : {}),
            ...(updates.addressAr !== undefined ? { address: updates.addressAr } : {}),
            ...(updates.areaId !== undefined ? { area: updates.areaId } : {}),
            ...(updates.coordinates !== undefined
              ? {
                latitude: Number(updates.coordinates.lat.toFixed(6)),
                longitude: Number(updates.coordinates.lng.toFixed(6)),
              }
              : {}),
            ...(updates.workingHoursAr !== undefined
              ? { opening_hours: updates.workingHoursAr }
              : {}),
          });
        }
        const mapped = mapBackendStoreToMerchant(updatedStore);
        setState((prev) => ({
          ...prev,
          merchants: prev.merchants.map((m) => (m.id === merchantId ? mapped : m)),
        }));
        showToast(t('تم حفظ إعدادات المتجر', 'Store settings saved'), 'success');
      } catch (err) {
        handleApiError(err, 'تعذر حفظ إعدادات المتجر', 'Could not save store settings');
      }
      return;
    }

    setState((prev) => ({
      ...prev,
      merchants: prev.merchants.map((m) => (m.id === merchantId ? { ...m, ...updates } : m)),
    }));
    showToast(t('تم حفظ إعدادات المتجر', 'Store settings saved'), 'success');
  };

  const addProduct = async (productInput: ProductPayloadInput): Promise<Product> => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        let createdPayload;
        if (productInput.imageFile) {
          const fd = new FormData();
          fd.append('category', productInput.categoryId);
          fd.append('name', productInput.nameAr);
          fd.append('name_en', productInput.nameEn);
          fd.append('description', productInput.descriptionAr);
          fd.append('description_en', productInput.descriptionEn);
          fd.append('price', (productInput.oldPrice && productInput.oldPrice > productInput.price ? productInput.oldPrice : productInput.price).toFixed(2));
          if (productInput.oldPrice && productInput.oldPrice > productInput.price) {
            fd.append('discounted_price', productInput.price.toFixed(2));
          }
          fd.append('stock_quantity', String(productInput.stock));
          fd.append('sku', productInput.sku || '');
          fd.append('unit', productInput.unitAr);
          fd.append('unit_en', productInput.unitEn);
          fd.append('is_available', String(productInput.isAvailable));
          fd.append('is_offer', String(Boolean(productInput.isOffer)));
          fd.append('image', productInput.imageFile);
          createdPayload = await marketplaceApi.createMerchantProduct(fd);
        } else {
          const isHttp = productInput.image.startsWith('http');
          createdPayload = await marketplaceApi.createMerchantProduct({
            category: productInput.categoryId,
            name: productInput.nameAr,
            name_en: productInput.nameEn,
            description: productInput.descriptionAr,
            description_en: productInput.descriptionEn,
            ...(isHttp ? { image_url: productInput.image } : {}),
            price: (
              productInput.oldPrice && productInput.oldPrice > productInput.price
                ? productInput.oldPrice
                : productInput.price
            ).toFixed(2),
            ...(productInput.oldPrice && productInput.oldPrice > productInput.price
              ? { discounted_price: productInput.price.toFixed(2) }
              : {}),
            stock_quantity: productInput.stock,
            sku: productInput.sku || '',
            barcode: productInput.barcode || '',
            unit: productInput.unitAr,
            unit_en: productInput.unitEn,
            is_available: productInput.isAvailable,
            is_offer: Boolean(productInput.isOffer),
          });
        }
        const mapped = mapBackendProduct(createdPayload);
        setState((prev) => ({ ...prev, products: [mapped, ...prev.products] }));
        showToast(t('تم إضافة المنتج بنجاح', 'Product added successfully'), 'success');
        return mapped;
      } catch (err) {
        handleApiError(err, 'تعذر إضافة المنتج', 'Failed to create product');
        throw err;
      }
    }

    const newProd: Product = { ...productInput, id: `prod-${Date.now()}` };
    setState((prev) => ({ ...prev, products: [newProd, ...prev.products] }));
    showToast(t('تم إضافة المنتج بنجاح', 'Product added successfully'), 'success');
    return newProd;
  };

  const updateProduct = async (productId: string, updates: ProductUpdateInput) => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        let updatedPayload;
        if (updates.imageFile) {
          const fd = new FormData();
          if (updates.nameAr) fd.append('name', updates.nameAr);
          if (updates.nameEn) fd.append('name_en', updates.nameEn);
          if (updates.categoryId) fd.append('category', updates.categoryId);
          if (updates.descriptionAr) fd.append('description', updates.descriptionAr);
          if (updates.price !== undefined) fd.append('price', updates.price.toFixed(2));
          if (updates.stock !== undefined) fd.append('stock_quantity', String(updates.stock));
          if (updates.sku !== undefined) fd.append('sku', updates.sku);
          if (updates.isAvailable !== undefined) fd.append('is_available', String(updates.isAvailable));
          fd.append('image', updates.imageFile);
          updatedPayload = await marketplaceApi.updateMerchantProduct(productId, fd);
        } else {
          updatedPayload = await marketplaceApi.updateMerchantProduct(productId, {
            ...(updates.nameAr !== undefined ? { name: updates.nameAr } : {}),
            ...(updates.nameEn !== undefined ? { name_en: updates.nameEn } : {}),
            ...(updates.categoryId !== undefined ? { category: updates.categoryId } : {}),
            ...(updates.descriptionAr !== undefined ? { description: updates.descriptionAr } : {}),
            ...(updates.price !== undefined ? { price: updates.price.toFixed(2) } : {}),
            ...(updates.stock !== undefined ? { stock_quantity: updates.stock } : {}),
            ...(updates.sku !== undefined ? { sku: updates.sku } : {}),
            ...(updates.barcode !== undefined ? { barcode: updates.barcode } : {}),
            ...(updates.isAvailable !== undefined ? { is_available: updates.isAvailable } : {}),
            ...(updates.image && updates.image.startsWith('http')
              ? { image_url: updates.image }
              : {}),
          });
        }
        const mapped = mapBackendProduct(updatedPayload);
        setState((prev) => ({
          ...prev,
          products: prev.products.map((p) => (p.id === productId ? mapped : p)),
        }));
        showToast(t('تم تحديث بيانات المنتج', 'Product updated'), 'success');
      } catch (err) {
        handleApiError(err, 'تعذر تحديث المنتج', 'Failed to update product');
      }
      return;
    }

    setState((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id === productId ? { ...p, ...updates } : p)),
    }));
    showToast(t('تم تحديث بيانات المنتج', 'Product updated'), 'success');
  };

  const deleteProduct = async (productId: string) => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        await marketplaceApi.deleteMerchantProduct(productId);
      } catch (err) {
        handleApiError(err, 'تعذر حذف المنتج', 'Failed to delete product');
        return;
      }
    }
    setState((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== productId),
      cart: {
        ...prev.cart,
        items: prev.cart.items.filter((i) => i.productId !== productId),
      },
    }));
    showToast(t('تم حذف المنتج', 'Product deleted'), 'info');
  };

  const quickUpdateStock = async (productId: string, stock: number, note = '') => {
    const cleanStock = Math.max(0, stock);
    if (IS_BACKEND_API_ENABLED) {
      try {
        const res = await marketplaceApi.adjustMerchantStock(productId, cleanStock, note);
        const mapped = mapBackendProduct(res.product);
        setState((prev) => ({
          ...prev,
          products: prev.products.map((p) => (p.id === productId ? mapped : p)),
        }));
        setInventoryMovements((prev) => [res.movement, ...prev]);
        showToast(t('تم تحديث كمية المخزون', 'Stock quantity updated'), 'success');
      } catch (err) {
        handleApiError(err, 'تعذر تحديث المخزون', 'Failed to update stock');
      }
      return;
    }

    setState((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === productId
          ? {
            ...p,
            stock: cleanStock,
            isAvailable: cleanStock > 0 ? p.isAvailable : false,
          }
          : p
      ),
    }));
    showToast(t('تم تحديث كمية المخزون', 'Stock quantity updated'), 'success');
  };

  const addMerchantCategory = async (
    merchantId: string,
    nameAr: string,
    nameEn: string
  ): Promise<Category> => {
    if (IS_BACKEND_API_ENABLED) {
      const res = await marketplaceApi.createMerchantCategory({
        name: nameAr,
        name_en: nameEn || nameAr,
      });
      const mapped: Category = {
        id: res.id,
        nameAr: res.name,
        nameEn: res.name_en,
        icon: 'Tag',
        color: res.color || '#1B8E53',
        isGlobal: false,
        merchantId: res.store,
      };
      setState((prev) => ({ ...prev, categories: [...prev.categories, mapped] }));
      showToast(t('تم إضافة التصنيف', 'Category added'), 'success');
      return mapped;
    }

    const newCat: Category = {
      id: `cat-m-${Date.now()}`,
      nameAr,
      nameEn: nameEn || nameAr,
      icon: 'Tag',
      color: '#1B8E53',
      isGlobal: false,
      merchantId,
    };
    setState((prev) => ({
      ...prev,
      categories: [...prev.categories, newCat],
      merchants: prev.merchants.map((m) =>
        m.id === merchantId ? { ...m, categoryIds: [...m.categoryIds, newCat.id] } : m
      ),
    }));
    showToast(t('تم إضافة التصنيف', 'Category added'), 'success');
    return newCat;
  };

  const updateCategory = async (categoryId: string, updates: Partial<Category>) => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        if (authSession?.role === 'admin') {
          await marketplaceApi.updateAdminCategory(categoryId, {
            ...(updates.nameAr ? { name: updates.nameAr } : {}),
            ...(updates.nameEn ? { name_en: updates.nameEn } : {}),
            ...(updates.color ? { color: updates.color } : {}),
          });
        } else {
          await marketplaceApi.updateMerchantCategory(categoryId, {
            ...(updates.nameAr ? { name: updates.nameAr } : {}),
            ...(updates.nameEn ? { name_en: updates.nameEn } : {}),
          });
        }
      } catch (err) {
        handleApiError(err, 'تعذر تحديث التصنيف', 'Failed to update category');
        return;
      }
    }
    setState((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === categoryId ? { ...c, ...updates } : c)),
    }));
    showToast(t('تم تحديث التصنيف', 'Category updated'), 'success');
  };

  const deleteCategory = async (categoryId: string) => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        if (authSession?.role === 'admin') {
          await marketplaceApi.deleteAdminCategory(categoryId);
        } else {
          await marketplaceApi.deleteMerchantCategory(categoryId);
        }
      } catch (err) {
        handleApiError(err, 'تعذر حذف التصنيف', 'Failed to delete category');
        return;
      }
    }
    setState((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== categoryId),
    }));
    showToast(t('تم حذف التصنيف', 'Category deleted'), 'info');
  };

  // ==================== ADMIN ACTIONS ====================
  const setMerchantStatus = async (merchantId: string, status: MerchantStatus) => {
    if (IS_BACKEND_API_ENABLED) {
      const mpId = merchantProfileMap[merchantId] ?? merchantId;
      try {
        await marketplaceApi.updateAdminMerchantStatus(mpId, status);
        await refreshFromBackend();
        showToast(t('تم تحديث حالة التاجر', 'Merchant status updated'), 'success');
      } catch (err) {
        handleApiError(err, 'تعذر تحديث حالة التاجر', 'Failed to update merchant status');
      }
      return;
    }

    setState((prev) => ({
      ...prev,
      merchants: prev.merchants.map((m) =>
        m.id === merchantId
          ? {
            ...m,
            status,
            verified: status === 'approved' ? true : m.verified,
          }
          : m
      ),
    }));
    showToast(t('تم تحديث حالة التاجر', 'Merchant status updated'), 'success');
  };

  const updateMerchantCommission = async (merchantId: string, commissionRate: number) => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        await marketplaceApi.updateAdminStoreCommission(merchantId, commissionRate);
        await refreshFromBackend();
        showToast(t('تم تحديث نسبة العمولة للتاجر', 'Merchant commission updated'), 'success');
      } catch (err) {
        handleApiError(err, 'تعذر تحديث العمولة', 'Failed to update commission');
      }
      return;
    }

    setState((prev) => ({
      ...prev,
      merchants: prev.merchants.map((m) =>
        m.id === merchantId ? { ...m, commissionRate } : m
      ),
    }));
    showToast(t('تم تحديث نسبة العمولة للتاجر', 'Merchant commission updated'), 'success');
  };

  const addGlobalCategory = async (cat: Omit<Category, 'id' | 'isGlobal'>) => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        await marketplaceApi.createAdminCategory({
          name: cat.nameAr,
          name_en: cat.nameEn,
          icon: cat.icon,
          color: cat.color,
        });
        await refreshFromBackend();
        showToast(t('تم إضافة التصنيف العام', 'Global category added'), 'success');
      } catch (err) {
        handleApiError(err, 'تعذر إضافة التصنيف', 'Failed to create category');
      }
      return;
    }

    const newCat: Category = { ...cat, id: `cat-${Date.now()}`, isGlobal: true };
    setState((prev) => ({ ...prev, categories: [...prev.categories, newCat] }));
    showToast(t('تم إضافة التصنيف العام', 'Global category added'), 'success');
  };

  const addArea = async (area: Omit<Area, 'id'>) => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        await marketplaceApi.createAdminArea({
          name_ar: area.nameAr,
          name_en: area.nameEn,
          city_ar: area.cityAr,
          city_en: area.cityEn,
          delivery_hub_note: area.deliveryHubNote || '',
          is_active: area.isActive,
        });
        await refreshFromBackend();
        showToast(t('تمت إضافة المنطقة', 'Area added'), 'success');
      } catch (err) {
        handleApiError(err, 'تعذر إضافة المنطقة', 'Failed to add area');
      }
      return;
    }

    const newArea: Area = { ...area, id: `area-${Date.now()}` };
    setState((prev) => ({ ...prev, areas: [...prev.areas, newArea] }));
    showToast(t('تمت إضافة المنطقة', 'Area added'), 'success');
  };

  const updateArea = async (areaId: string, updates: Partial<Area>) => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        await marketplaceApi.updateAdminArea(areaId, {
          ...(updates.isActive !== undefined ? { is_active: updates.isActive } : {}),
          ...(updates.nameAr !== undefined ? { name_ar: updates.nameAr } : {}),
        });
        await refreshFromBackend();
        showToast(t('تم تحديث بيانات المنطقة', 'Area updated'), 'success');
      } catch (err) {
        handleApiError(err, 'تعذر تحديث المنطقة', 'Failed to update area');
      }
      return;
    }

    setState((prev) => ({
      ...prev,
      areas: prev.areas.map((a) => (a.id === areaId ? { ...a, ...updates } : a)),
    }));
    showToast(t('تم تحديث بيانات المنطقة', 'Area updated'), 'success');
  };

  const toggleCustomerStatus = async (customerId: string) => {
    const cust = state.customers.find((c) => c.id === customerId);
    if (!cust) return;
    const nextActive = cust.status !== 'active';

    if (IS_BACKEND_API_ENABLED) {
      try {
        await marketplaceApi.toggleAdminCustomerActive(customerId, nextActive);
        await refreshFromBackend();
        showToast(t('تم تحديث حالة حساب العميل', 'Customer status updated'), 'success');
      } catch (err) {
        handleApiError(err, 'تعذر تحديث حالة العميل', 'Failed to update customer status');
      }
      return;
    }

    setState((prev) => ({
      ...prev,
      customers: prev.customers.map((c) =>
        c.id === customerId ? { ...c, status: nextActive ? 'active' : 'suspended' } : c
      ),
    }));
    showToast(t('تم تحديث حالة حساب العميل', 'Customer status updated'), 'success');
  };

  const updatePlatformSettings = async (updates: Partial<PlatformSettings>) => {
    if (IS_BACKEND_API_ENABLED) {
      try {
        await marketplaceApi.updateAdminSettings(updates);
        await refreshFromBackend();
        showToast(t('تم حفظ إعدادات المنصة', 'Platform settings saved'), 'success');
      } catch (err) {
        handleApiError(err, 'تعذر حفظ إعدادات المنصة', 'Failed to update platform settings');
      }
      return;
    }

    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
    }));
    showToast(t('تم حفظ إعدادات المنصة', 'Platform settings saved'), 'success');
  };

  const refundAdminOrder = async (orderId: string, amount: number, reason: string) => {
    if (!IS_BACKEND_API_ENABLED) {
      showToast(t('الاسترداد متاح عند الاتصال بالخادم', 'Refunds require live backend mode'), 'info');
      return;
    }
    try {
      await marketplaceApi.refundAdminOrder(orderId, amount, reason);
      await refreshFromBackend();
      showToast(t('تم تسجيل الاسترداد وعكس العمولة بنجاح', 'Refund recorded and commission reversed'), 'success');
    } catch (err) {
      handleApiError(err, 'تعذر تنفيذ الاسترداد', 'Failed to process refund');
    }
  };

  const settleAdminCommission = async (recordId: string) => {
    if (!IS_BACKEND_API_ENABLED) return;
    try {
      const updated = await marketplaceApi.settleAdminCommission(recordId);
      setCommissionRecords((prev) => prev.map((r) => (r.id === recordId ? updated : r)));
      showToast(t('تمت تسوية سجل العمولة بنجاح', 'Commission marked settled'), 'success');
    } catch (err) {
      handleApiError(err, 'تعذر تسوية العمولة', 'Failed to settle commission');
    }
  };

  const markNotificationsRead = (
    audience?: AppNotification['audience'],
    merchantId?: string
  ) => {
    if (IS_BACKEND_API_ENABLED && getAccessToken()) {
      void marketplaceApi.markNotificationsRead().catch(() => { });
    }
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => {
        if (audience && n.audience !== audience) return n;
        if (merchantId && n.merchantId && n.merchantId !== merchantId) return n;
        return { ...n, read: true };
      }),
    }));
  };

  return (
    <AppContext.Provider
      value={{
        language: state.language,
        setLanguage,
        toggleLanguage,
        t,
        selectedAreaId: state.selectedAreaId,
        setSelectedAreaId,
        customerLocation: state.customerLocation,
        confirmCustomerLocation,
        setSearchRadiusKm,
        activeCustomer,
        activeMerchant,
        setActiveMerchantId,
        areas: state.areas,
        categories: state.categories,
        merchants: state.merchants,
        products: state.products,
        customers: state.customers,
        orders: state.orders,
        reviews: state.reviews,
        cart: state.cart,
        notifications: state.notifications,
        settings: state.settings,
        inventoryMovements,
        commissionRecords,
        toasts,
        pendingCartConflict,
        authSession,
        loginPortal,
        registerMerchantPortal,
        logoutPortal,
        refreshFromBackend,
        showToast,
        dismissToast,
        resetDemoData,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        confirmReplaceCart,
        cancelReplaceCart,
        getCartItemQty,
        placeOrder,
        cancelCustomerOrder,
        toggleFavoriteMerchant,
        updateCustomerProfile,
        addCustomerAddress,
        updateCustomerAddress,
        deleteCustomerAddress,
        setDefaultAddress,
        toggleMerchantOpen,
        updateMerchant,
        updateOrderStatus,
        advanceOrderPipeline,
        addProduct,
        updateProduct,
        deleteProduct,
        quickUpdateStock,
        addMerchantCategory,
        updateCategory,
        deleteCategory,
        setMerchantStatus,
        updateMerchantCommission,
        addGlobalCategory,
        addArea,
        updateArea,
        toggleCustomerStatus,
        updatePlatformSettings,
        refundAdminOrder,
        settleAdminCommission,
        markNotificationsRead,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
