import type { Customer, Merchant, Order, OrderItem, OrderStatus, Product, Review } from '../types';

const EXTRA_NAMES: [string, string, string][] = [
  ['محمود حسن', 'Mahmoud Hassan', 'area-nasr-city'],
  ['ياسمين عادل', 'Yasmine Adel', 'area-nasr-city'],
  ['عمر الشريف', 'Omar El-Sherif', 'area-heliopolis'],
  ['هبة الله مصطفى', 'Hebatallah Mostafa', 'area-nasr-city'],
  ['طارق نبيل', 'Tarek Nabil', 'area-maadi'],
  ['دينا سمير', 'Dina Samir', 'area-dokki'],
  ['خالد فاروق', 'Khaled Farouk', 'area-mohandessin'],
  ['نورهان جمال', 'Nourhan Gamal', 'area-new-cairo'],
  ['شريف مجدي', 'Sherif Magdy', 'area-nasr-city'],
  ['آية علاء', 'Aya Alaa', 'area-heliopolis'],
  ['وليد سعيد', 'Walid Saeed', 'area-nasr-city'],
  ['ريم محمد', 'Reem Mohamed', 'area-maadi'],
  ['مصطفى كمال', 'Mostafa Kamal', 'area-dokki'],
  ['سلمى هاني', 'Salma Hany', 'area-new-cairo'],
  ['حسام الدين علي', 'Hossam Ali', 'area-nasr-city'],
  ['مريم أشرف', 'Mariam Ashraf', 'area-heliopolis'],
  ['إسلام فتحي', 'Islam Fathy', 'area-mohandessin'],
  ['نهى عبد الحميد', 'Noha Abdelhamid', 'area-nasr-city'],
  ['زياد وائل', 'Ziad Wael', 'area-nasr-city'],
  ['فرح أيمن', 'Farah Ayman', 'area-maadi'],
  ['أمير صلاح', 'Amir Salah', 'area-dokki'],
  ['رانيا فؤاد', 'Rania Fouad', 'area-heliopolis'],
  ['باسم رضا', 'Bassem Reda', 'area-new-cairo'],
  ['هند طه', 'Hend Taha', 'area-nasr-city'],
];

const STREETS: Record<string, { ar: string; en: string }> = {
  'area-nasr-city': { ar: 'مدينة نصر، شارع الطيران', en: 'Nasr City, El Tayaran St' },
  'area-heliopolis': { ar: 'مصر الجديدة، شارع الحجاز', en: 'Heliopolis, El Hegaz St' },
  'area-new-cairo': { ar: 'التجمع الخامس، شارع التسعين', en: 'New Cairo, 90th St' },
  'area-maadi': { ar: 'المعادي، دجلة، شارع ١٩٩', en: 'Maadi, Degla, St 199' },
  'area-dokki': { ar: 'الدقي، شارع مصدق', en: 'Dokki, Mossadak St' },
  'area-mohandessin': { ar: 'المهندسين، شارع شهاب', en: 'Mohandessin, Shehab St' },
};

export function generateExtraCustomers(baseNow = new Date()): Customer[] {
  const prefixes = ['010', '011', '012', '015'];
  return EXTRA_NAMES.map(([nameAr, nameEn, areaId], idx) => {
    const idNum = idx + 7;
    const daysAgo = 175 - idx * 6;
    const joined = new Date(baseNow);
    joined.setDate(joined.getDate() - Math.max(2, daysAgo));
    const street = STREETS[areaId] ?? STREETS['area-nasr-city'];
    const phone = `${prefixes[idx % prefixes.length]}${String(21004500 + idx * 13791).slice(0, 8)}`;

    return {
      id: `cust-${idNum}`,
      nameAr,
      nameEn,
      phone,
      email: `customer${idNum}@gowar.demo`,
      status: idx === 19 ? 'suspended' : 'active',
      joinedAt: joined.toISOString(),
      favoriteMerchantIds: idx % 2 === 0 ? ['store-albaraka'] : ['store-elnour'],
      addresses: [
        {
          id: `addr-gen-${idNum}`,
          labelAr: 'المنزل',
          labelEn: 'Home',
          areaId,
          streetAr: street.ar,
          streetEn: street.en,
          building: String(10 + (idx % 40)),
          floor: String(1 + (idx % 7)),
          apartment: String(1 + (idx % 14)),
          isDefault: true,
        },
      ],
    };
  });
}

export function generateHistoricalOrders(
  merchants: Merchant[],
  products: Product[],
  customers: Customer[],
  baseNow = new Date()
): Order[] {
  const activeMerchants = merchants.filter((m) => m.status === 'approved');
  const orders: Order[] = [];

  // Weighted day offsets over 180 days: denser in last 30 days, plus steady 6-month history
  const dayOffsets: number[] = [];
  // Today (day 0): 7 orders
  for (let i = 0; i < 7; i++) dayOffsets.push(0);
  // Days 1..6 (last 7 days): 18 orders
  for (let d = 1; d <= 6; d++) {
    dayOffsets.push(d, d, d);
  }
  // Days 7..29 (last 30 days): 36 orders
  for (let i = 0; i < 36; i++) {
    dayOffsets.push(7 + (i % 23));
  }
  // Days 30..89 (last 3 months): 35 orders
  for (let i = 0; i < 35; i++) {
    dayOffsets.push(30 + ((i * 5) % 60));
  }
  // Days 90..175 (3..6 months): 28 orders
  for (let i = 0; i < 28; i++) {
    dayOffsets.push(90 + ((i * 3) % 85));
  }

  dayOffsets.forEach((daysAgo, index) => {
    // Weight towards Al-Baraka & El-Nour for rich primary merchant analytics
    const storePool = [
      'store-albaraka',
      'store-albaraka',
      'store-albaraka',
      'store-elnour',
      'store-elnour',
      'store-amahmed',
      'store-almadina',
      'store-alsaada',
      'store-alzahraa',
      'store-eldokki',
      'store-mohandessin',
      'store-tagamoa',
      'store-elekhlas',
    ];
    const targetMerchantId = storePool[index % storePool.length];
    const merchant =
      activeMerchants.find((m) => m.id === targetMerchantId) ?? activeMerchants[0];
    const storeProducts = products.filter((p) => p.merchantId === merchant.id);
    if (storeProducts.length === 0) return;

    const customer = customers[(index * 7) % customers.length];
    const addr = customer.addresses[0];

    // Pick 2..4 products from this store
    const itemCount = 2 + (index % Math.min(3, storeProducts.length));
    const items: OrderItem[] = [];
    for (let k = 0; k < itemCount; k++) {
      const prod = storeProducts[(index + k * 2) % storeProducts.length];
      if (items.some((x) => x.productId === prod.id)) continue;
      const qty = 1 + ((index + k) % 3);
      items.push({
        productId: prod.id,
        nameAr: prod.nameAr,
        nameEn: prod.nameEn,
        image: prod.image,
        unitPrice: prod.price,
        quantity: qty,
      });
    }
    if (items.length === 0) return;

    const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    const qualifiesFree =
      merchant.delivery.freeDeliveryThreshold &&
      subtotal >= merchant.delivery.freeDeliveryThreshold;
    const deliveryFee =
      !merchant.delivery.deliveryEnabled || qualifiesFree ? 0 : merchant.delivery.deliveryFee;
    const total = subtotal + deliveryFee;
    const commissionRate = merchant.commissionRate;
    const platformCommission = Number(((subtotal * commissionRate) / 100).toFixed(2));

    const createdDate = new Date(baseNow);
    createdDate.setDate(createdDate.getDate() - daysAgo);
    createdDate.setHours(9 + (index % 13), (index * 11) % 60, 0, 0);
    // Keep "today" timestamps at or before current clock time
    if (daysAgo === 0 && createdDate.getTime() > baseNow.getTime()) {
      createdDate.setTime(baseNow.getTime() - (index + 1) * 900000);
    }

    let status: OrderStatus = 'delivered';
    if (daysAgo === 0) {
      const todayStatuses: OrderStatus[] = [
        'pending',
        'accepted',
        'preparing',
        'out_for_delivery',
        'delivered',
        'delivered',
        'delivered',
      ];
      status = todayStatuses[index % todayStatuses.length];
    } else if (index % 13 === 0) {
      status = 'cancelled';
    }

    const updatedDate = new Date(createdDate.getTime() + 25 * 60000);
    const orderNumber = `GW-${3100 + index}`;

    orders.push({
      id: `ord-hist-${index + 1}`,
      orderNumber,
      customerId: customer.id,
      customerName: customer.nameAr,
      customerPhone: customer.phone,
      merchantId: merchant.id,
      areaId: merchant.areaId,
      deliveryAddressAr: addr ? addr.streetAr : merchant.addressAr,
      deliveryAddressEn: addr ? addr.streetEn : merchant.addressEn,
      items,
      subtotal,
      deliveryFee,
      discount: 0,
      total,
      commissionRate,
      platformCommission,
      paymentMethod: index % 3 === 0 ? 'online_demo' : 'cod',
      status,
      rejectReason:
        status === 'cancelled'
          ? 'تم الإلغاء لعدم توفر أحد الأصناف وقت الطلب'
          : undefined,
      statusHistory: [
        {
          status: 'pending',
          timestamp: createdDate.toISOString(),
          actorAr: customer.nameAr,
          actorEn: customer.nameEn,
          noteAr: `تم إرسال الطلب إلى ${merchant.nameAr}`,
          noteEn: `Order placed at ${merchant.nameEn}`,
        },
        ...(status !== 'pending'
          ? [
              {
                status,
                timestamp: updatedDate.toISOString(),
                actorAr: merchant.nameAr,
                actorEn: merchant.nameEn,
                noteAr:
                  status === 'delivered'
                    ? 'تم التوصيل بنجاح'
                    : status === 'cancelled'
                      ? 'تم إلغاء الطلب'
                      : 'تحديث حالة الطلب',
                noteEn: status === 'delivered' ? 'Delivered' : 'Status updated',
              },
            ]
          : []),
      ],
      createdAt: createdDate.toISOString(),
      updatedAt: updatedDate.toISOString(),
      estimatedDeliveryMin: merchant.delivery.deliveryTimeMin,
    });
  });

  return orders.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function generateSeedReviews(merchants: Merchant[], customers: Customer[]): Review[] {
  const comments: { ar: string; en: string; rating: number }[] = [
    {
      ar: 'توصيل سريع جداً والحاجة وصلت طازجة ومغلفة كويس.',
      en: 'Very fast delivery and fresh items packed neatly.',
      rating: 5,
    },
    {
      ar: 'الأسعار ممتازة ومندوب المحل محترم جداً.',
      en: 'Great prices and very polite store courier.',
      rating: 5,
    },
    {
      ar: 'تجربة كويسة وكل الأصناف كانت متوفرة.',
      en: 'Good experience and all items were in stock.',
      rating: 4,
    },
    {
      ar: 'التجهيز كان سريع لكن التوصيل اتأخر ١٠ دقايق.',
      en: 'Quick packing though delivery arrived 10 mins late.',
      rating: 4,
    },
  ];

  const reviews: Review[] = [];
  merchants
    .filter((m) => m.status === 'approved')
    .forEach((m, mIdx) => {
      for (let i = 0; i < 3; i++) {
        const c = customers[(mIdx * 3 + i) % customers.length];
        const tmpl = comments[(mIdx + i) % comments.length];
        reviews.push({
          id: `rev-${m.id}-${i}`,
          merchantId: m.id,
          customerId: c.id,
          customerName: c.nameAr,
          rating: tmpl.rating,
          commentAr: tmpl.ar,
          commentEn: tmpl.en,
          createdAt: new Date(Date.now() - (i + 1) * 4 * 86400000).toISOString(),
        });
      }
    });
  return reviews;
}
