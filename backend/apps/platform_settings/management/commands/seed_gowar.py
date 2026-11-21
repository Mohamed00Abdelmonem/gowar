import os
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User, UserRole
from apps.catalog.models import Category, Product
from apps.commissions.calculator import calculate_order_financials
from apps.commissions.models import CommissionRecord, CommissionStatus
from apps.inventory.models import InventoryMovement, MovementType
from apps.locations.models import Area, CustomerAddress, CustomerProfile
from apps.merchants.models import ApprovalStatus, MerchantProfile
from apps.orders.models import Order, OrderItem, OrderStatusChoices, OrderStatusHistory
from apps.payments.models import PaymentMethodChoices, PaymentStatusChoices, PaymentTransaction
from apps.platform_settings.models import PlatformSettings
from apps.reviews.models import StoreReview
from apps.stores.models import Store, StoreType


class Command(BaseCommand):
    help = "Idempotent development seed command for Gowar marketplace."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Allow running when DEBUG is False (still requires explicit env passwords).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        enable_seed = os.environ.get("GOWAR_ENABLE_DEMO_SEED", "").lower() == "true"
        if not settings.DEBUG and not (options["force"] and enable_seed):
            raise CommandError(
                "Demo seeding is disabled in production unless GOWAR_ENABLE_DEMO_SEED=true and --force are passed."
            )

        admin_email = os.environ.get("DEMO_ADMIN_EMAIL", "admin@gowar.demo").lower()
        admin_password = os.environ.get("DEMO_ADMIN_PASSWORD", "Admin@123")
        merchant_password = os.environ.get("DEMO_MERCHANT_PASSWORD", "Gowar@123")
        customer_password = os.environ.get("DEMO_CUSTOMER_PASSWORD", "Customer@123")

        PlatformSettings.get_solo()

        # 1. Admin User
        admin_user, created = User.objects.get_or_create(
            email=admin_email,
            defaults={
                "first_name": "Gowar",
                "last_name": "Super Admin",
                "phone_number": "01000000000",
                "role": UserRole.ADMIN,
                "is_staff": True,
                "is_superuser": True,
                "is_verified": True,
            },
        )
        if created:
            admin_user.set_password(admin_password)
            admin_user.save(update_fields=["password"])

        # 2. Cairo & Giza Areas
        areas_spec = [
            ("مدينة نصر", "Nasr City", "القاهرة", "Cairo", 30.0566, 31.3376, "شارع عباس العقاد، مكرم عبيد"),
            ("مصر الجديدة", "Heliopolis", "القاهرة", "Cairo", 30.0885, 31.3282, "الكوربة، الميرغني، روكسي"),
            ("المعادي", "Maadi", "القاهرة", "Cairo", 29.9608, 31.2582, "شارع ٩، دجلة"),
            ("الدقي", "Dokki", "الجيزة", "Giza", 30.0385, 31.2122, "شارع التحرير، المساحة"),
            ("التجمع الخامس", "New Cairo", "القاهرة", "Cairo", 30.0175, 31.4140, "شارع التسعين، الحي الأول"),
        ]
        areas_map = {}
        for name_ar, name_en, city_ar, city_en, lat, lng, note in areas_spec:
            area, _ = Area.objects.get_or_create(
                name_en=name_en,
                defaults={
                    "name_ar": name_ar,
                    "city_ar": city_ar,
                    "city_en": city_en,
                    "delivery_hub_note": note,
                    "center_location": Point(lng, lat, srid=4326),
                    "is_active": True,
                },
            )
            areas_map[name_en] = area

        # 3. Categories
        categories_spec = [
            ("groceries", "بقالة", "Groceries", "ShoppingBasket", "#D6450D"),
            ("dairy", "ألبان وجبن", "Dairy & Cheese", "Milk", "#0284C7"),
            ("drinks", "مشروبات", "Beverages", "CupSoda", "#059669"),
            ("snacks", "سناكس", "Snacks", "Cookie", "#D97706"),
            ("cleaning", "منظفات", "Cleaning", "Sparkles", "#4F46E5"),
            ("bakery", "مخبوزات", "Bakery", "Croissant", "#B45309"),
        ]
        cats_map = {}
        for slug, name_ar, name_en, icon, color in categories_spec:
            cat, _ = Category.objects.get_or_create(
                slug=slug,
                defaults={
                    "name": name_ar,
                    "name_en": name_en,
                    "icon": icon,
                    "color": color,
                    "is_global": True,
                    "is_active": True,
                },
            )
            cats_map[slug] = cat

        # 4. Merchants & Stores
        stores_spec = [
            {
                "email": "ahmed@gowar.demo",
                "first_name": "أحمد",
                "last_name": "عبد الرحمن",
                "phone": "01012345678",
                "merchant_code": "merchant_001",
                "business_name": "مؤسسة البركة التجارية",
                "slug": "al-baraka-market",
                "name": "ماركت البركة",
                "name_en": "Al-Baraka Market",
                "store_type": StoreType.SUPERMARKET,
                "area": "Nasr City",
                "address": "١٤ شارع عباس العقاد، مدينة نصر، القاهرة",
                "lat": 30.0561,
                "lng": 31.3369,
                "delivery_radius_km": Decimal("4.00"),
                "delivery_fee": Decimal("15.00"),
                "min_order": Decimal("80.00"),
                "free_threshold": Decimal("400.00"),
                "eta": 25,
                "commission_rate": Decimal("5.00"),
                "status": ApprovalStatus.APPROVED,
                "is_open": True,
            },
            {
                "email": "nour@gowar.demo",
                "first_name": "محمود",
                "last_name": "النور",
                "phone": "01122334455",
                "merchant_code": "merchant_002",
                "business_name": "أسواق النور",
                "slug": "el-nour-supermarket",
                "name": "سوبر ماركت النور",
                "name_en": "El-Nour Supermarket",
                "store_type": StoreType.SUPERMARKET,
                "area": "Nasr City",
                "address": "٢٨ شارع مكرم عبيد، مدينة نصر، القاهرة",
                "lat": 30.0628,
                "lng": 31.3452,
                "delivery_radius_km": Decimal("5.00"),
                "delivery_fee": Decimal("12.00"),
                "min_order": Decimal("100.00"),
                "free_threshold": Decimal("500.00"),
                "eta": 30,
                "commission_rate": Decimal("5.00"),
                "status": ApprovalStatus.APPROVED,
                "is_open": True,
            },
            {
                "email": "amahmed@gowar.demo",
                "first_name": "أحمد",
                "last_name": "مصطفى",
                "phone": "01234567890",
                "merchant_code": "merchant_003",
                "business_name": "بقالة عم أحمد",
                "slug": "uncle-ahmed-grocery",
                "name": "بقالة عم أحمد",
                "name_en": "Uncle Ahmed Grocery",
                "store_type": StoreType.GROCERY,
                "area": "Nasr City",
                "address": "٥ شارع مصطفى النحاس، مدينة نصر",
                "lat": 30.0543,
                "lng": 31.3392,
                "delivery_radius_km": Decimal("2.50"),
                "delivery_fee": Decimal("8.00"),
                "min_order": Decimal("50.00"),
                "free_threshold": Decimal("250.00"),
                "eta": 18,
                "commission_rate": Decimal("6.00"),
                "status": ApprovalStatus.APPROVED,
                "is_open": True,
            },
            {
                "email": "korba@gowar.demo",
                "first_name": "شريف",
                "last_name": "المدينة",
                "phone": "01098765432",
                "merchant_code": "merchant_004",
                "business_name": "ماركت المدينة الكوربة",
                "slug": "al-madina-market",
                "name": "ماركت المدينة",
                "name_en": "Al-Madina Market",
                "store_type": StoreType.MINI_MARKET,
                "area": "Heliopolis",
                "address": "١٢ شارع بغداد، الكوربة، مصر الجديدة",
                "lat": 30.0875,
                "lng": 31.3264,
                "delivery_radius_km": Decimal("5.00"),
                "delivery_fee": Decimal("20.00"),
                "min_order": Decimal("100.00"),
                "free_threshold": None,
                "eta": 35,
                "commission_rate": Decimal("8.00"),
                "status": ApprovalStatus.APPROVED,
                "is_open": True,
            },
            {
                "email": "zahraa@gowar.demo",
                "first_name": "ياسر",
                "last_name": "الزهراء",
                "phone": "01033445566",
                "merchant_code": "merchant_005",
                "business_name": "ماركت الزهراء المعادي",
                "slug": "al-zahraa-maadi",
                "name": "ماركت الزهراء المعادي",
                "name_en": "Al-Zahraa Market Maadi",
                "store_type": StoreType.SUPERMARKET,
                "area": "Maadi",
                "address": "٢٢ شارع ٩، المعادي، القاهرة",
                "lat": 29.9602,
                "lng": 31.2569,
                "delivery_radius_km": Decimal("5.00"),
                "delivery_fee": Decimal("15.00"),
                "min_order": Decimal("100.00"),
                "free_threshold": Decimal("450.00"),
                "eta": 25,
                "commission_rate": Decimal("8.00"),
                "status": ApprovalStatus.APPROVED,
                "is_open": True,
            },
            {
                "email": "rahma.pending@gowar.demo",
                "first_name": "حسن",
                "last_name": "الرحمة",
                "phone": "01144556677",
                "merchant_code": "merchant_006",
                "business_name": "ماركت الرحمة التجمع",
                "slug": "al-rahma-pending",
                "name": "ماركت الرحمة",
                "name_en": "Al-Rahma Convenience",
                "store_type": StoreType.CONVENIENCE,
                "area": "New Cairo",
                "address": "مول الياسمين، الحي الأول، التجمع الخامس",
                "lat": 30.0165,
                "lng": 31.4252,
                "delivery_radius_km": Decimal("4.00"),
                "delivery_fee": Decimal("18.00"),
                "min_order": Decimal("75.00"),
                "free_threshold": None,
                "eta": 25,
                "commission_rate": Decimal("8.00"),
                "status": ApprovalStatus.PENDING,
                "is_open": True,
            },
        ]

        stores_map = {}
        for spec in stores_spec:
            u, u_created = User.objects.get_or_create(
                email=spec["email"],
                defaults={
                    "first_name": spec["first_name"],
                    "last_name": spec["last_name"],
                    "phone_number": spec["phone"],
                    "role": UserRole.MERCHANT,
                    "is_verified": spec["status"] == ApprovalStatus.APPROVED,
                },
            )
            if u_created:
                u.set_password(merchant_password)
                u.save(update_fields=["password"])

            mp, _ = MerchantProfile.objects.get_or_create(
                user=u,
                defaults={
                    "merchant_code": spec["merchant_code"],
                    "business_name": spec["business_name"],
                    "approval_status": spec["status"],
                    "approved_at": timezone.now() if spec["status"] == ApprovalStatus.APPROVED else None,
                },
            )

            store, _ = Store.objects.get_or_create(
                slug=spec["slug"],
                defaults={
                    "merchant": mp,
                    "name": spec["name"],
                    "name_en": spec["name_en"],
                    "store_type": spec["store_type"],
                    "phone_number": spec["phone"],
                    "address": spec["address"],
                    "area": areas_map[spec["area"]],
                    "latitude": Decimal(str(spec["lat"])),
                    "longitude": Decimal(str(spec["lng"])),
                    "location": Point(spec["lng"], spec["lat"], srid=4326),
                    "delivery_enabled": True,
                    "delivery_radius_km": spec["delivery_radius_km"],
                    "delivery_fee": spec["delivery_fee"],
                    "minimum_order_amount": spec["min_order"],
                    "free_delivery_threshold": spec["free_threshold"],
                    "estimated_delivery_minutes": spec["eta"],
                    "commission_rate": spec["commission_rate"],
                    "approval_status": spec["status"],
                    "is_active": spec["status"] == ApprovalStatus.APPROVED,
                    "is_open": spec["is_open"],
                },
            )
            stores_map[spec["slug"]] = store

        # 5. Store-Specific Grocery Products
        catalog_templates = [
            ("dairy", "لبن جهينة كامل الدسم ١ لتر", "Juhayna Full Cream Milk 1L", "MLK-1L", Decimal("46.00"), Decimal("43.50"), 34, "١ لتر", "1L", True, True),
            ("dairy", "كرتونة بيض أبيض ٣٠ بيضة", "White Eggs Carton 30 pcs", "EGG-30", Decimal("165.00"), None, 18, "٣٠ بيضة", "30 pcs", True, False),
            ("dairy", "جبنة دومتي بلس فيتا ٥٠٠ جم", "Domty Plus Feta Cheese 500g", "CHS-500", Decimal("49.00"), Decimal("45.00"), 22, "٥٠٠ جم", "500g", True, True),
            ("groceries", "أرز الضحى مصري فاخر ١ كجم", "El Doha Egyptian Rice 1kg", "RCE-1K", Decimal("42.00"), None, 40, "١ كجم", "1kg", True, False),
            ("groceries", "زيت ذرة كريستال ٨٠٠ مل", "Crystal Corn Oil 800ml", "OIL-800", Decimal("94.00"), None, 15, "٨٠٠ مل", "800ml", False, False),
            ("groceries", "مكرونة إيطاليانو قلم ٤٠٠ جم", "Italiano Penne Pasta 400g", "PST-400", Decimal("24.00"), None, 4, "٤٠٠ جم", "400g", False, False),
            ("bakery", "عيش فينو طازج ١٠ أرغفة", "Fresh Fino Bread 10 pcs", "BRD-10", Decimal("22.00"), None, 25, "كيس ١٠ أرغفة", "10 pcs", True, False),
            ("drinks", "مياه نستله ١.٥ لتر (٦ زجاجات)", "Nestle Water 1.5L Pack of 6", "WTR-6", Decimal("52.00"), Decimal("48.00"), 20, "كرتونة ٦", "6x1.5L", True, True),
            ("snacks", "شيبسي عائلي بطعم الجبنة", "Chipsy Family Size Cheese", "CHP-FAM", Decimal("20.00"), None, 30, "كيس عائلي", "Family Bag", False, False),
            ("cleaning", "مسحوق أريال أوتوماتيك ٢.٥ كجم", "Ariel Automatic Detergent 2.5kg", "CLN-25", Decimal("245.00"), Decimal("225.00"), 3, "٢.٥ كجم", "2.5kg", False, True),
        ]

        products_by_store = {}
        for store_idx, (slug, store) in enumerate(stores_map.items()):
            store_prods = []
            price_offset = Decimal(str(store_idx * 2))
            for cat_slug, name_ar, name_en, sku_suffix, base_price, disc_price, stock, unit_ar, unit_en, best, offer in catalog_templates:
                sku = f"{slug[:4].upper()}-{sku_suffix}"
                prod, created_p = Product.objects.get_or_create(
                    store=store,
                    sku=sku,
                    defaults={
                        "category": cats_map[cat_slug],
                        "name": name_ar,
                        "name_en": name_en,
                        "price": base_price + price_offset,
                        "discounted_price": (disc_price + price_offset) if disc_price else None,
                        "stock_quantity": stock,
                        "unit": unit_ar,
                        "unit_en": unit_en,
                        "is_available": stock > 0,
                        "is_active": True,
                        "is_best_seller": best,
                        "is_offer": offer,
                    },
                )
                if created_p and stock > 0:
                    InventoryMovement.objects.create(
                        product=prod,
                        store=store,
                        movement_type=MovementType.STOCK_IN,
                        quantity=stock,
                        previous_quantity=0,
                        new_quantity=stock,
                        reference_type="seed",
                        reference_id=sku,
                        idempotency_key=f"seed:{store.id}:{sku}",
                        note="Initial catalog seed stock",
                    )
                store_prods.append(prod)
            products_by_store[slug] = store_prods

        # 6. Customers + Saved Addresses
        customers_spec = [
            ("customer@gowar.demo", "أحمد", "محمود", "01023456789", "Nasr City", "مدينة نصر، شارع عباس العقاد", 30.0566, 31.3376),
            ("sara@gowar.demo", "سارة", "عبد الله", "01155667788", "Nasr City", "مدينة نصر، شارع مكرم عبيد", 30.0622, 31.3455),
            ("karim@gowar.demo", "كريم", "حسام", "01299887766", "Heliopolis", "مصر الجديدة، الكوربة، شارع بغداد", 30.0910, 31.3245),
        ]
        seeded_customers = []
        for email, fn, ln, phone, area_key, addr_text, lat, lng in customers_spec:
            cu, cu_created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": fn,
                    "last_name": ln,
                    "phone_number": phone,
                    "role": UserRole.CUSTOMER,
                    "is_verified": True,
                },
            )
            if cu_created:
                cu.set_password(customer_password)
                cu.save(update_fields=["password"])
            CustomerProfile.objects.get_or_create(user=cu, defaults={"search_radius_km": 3})
            if not CustomerAddress.objects.filter(customer=cu).exists():
                CustomerAddress.objects.create(
                    customer=cu,
                    area=areas_map[area_key],
                    label="المنزل",
                    recipient_name=f"{fn} {ln}",
                    phone_number=phone,
                    formatted_address=addr_text,
                    latitude=Decimal(str(lat)),
                    longitude=Decimal(str(lng)),
                    location=Point(lng, lat, srid=4326),
                    building_number="22",
                    floor="4",
                    apartment="12",
                    is_default=True,
                )
            seeded_customers.append(cu)

        # 7. Historical & Active Orders + Commissions + Reviews (idempotent via order_number)
        baraka = stores_map["al-baraka-market"]
        baraka_prods = products_by_store["al-baraka-market"]
        nour = stores_map["el-nour-supermarket"]
        nour_prods = products_by_store["el-nour-supermarket"]

        sample_orders_spec = [
            ("GW-100001", seeded_customers[0], baraka, baraka_prods[:3], OrderStatusChoices.DELIVERED, 14),
            ("GW-100002", seeded_customers[0], baraka, baraka_prods[1:4], OrderStatusChoices.DELIVERED, 5),
            ("GW-100003", seeded_customers[1], baraka, baraka_prods[:2], OrderStatusChoices.PREPARING, 0),
            ("GW-100004", seeded_customers[1], nour, nour_prods[:3], OrderStatusChoices.DELIVERED, 3),
            ("GW-100005", seeded_customers[2], baraka, baraka_prods[3:5], OrderStatusChoices.CANCELLED, 7),
        ]

        for order_no, cust, store, prods, o_status, days_ago in sample_orders_spec:
            if Order.objects.filter(order_number=order_no).exists():
                continue

            sub = sum((p.effective_price * 2 for p in prods), Decimal("0.00"))
            fin = calculate_order_financials(
                subtotal=sub,
                delivery_fee=store.delivery_fee,
                commission_rate=store.commission_rate,
            )
            addr = cust.addresses.first()
            snapshot = {
                "label": addr.label if addr else "المنزل",
                "formatted_address": addr.formatted_address if addr else store.address,
                "latitude": float(addr.latitude) if addr else float(store.latitude),
                "longitude": float(addr.longitude) if addr else float(store.longitude),
                "recipient_name": cust.full_name,
                "phone_number": cust.phone_number,
            }
            p_status = (
                PaymentStatusChoices.PAID
                if o_status == OrderStatusChoices.DELIVERED
                else PaymentStatusChoices.PENDING
            )
            order = Order.objects.create(
                order_number=order_no,
                customer=cust,
                store=store,
                delivery_address_snapshot=snapshot,
                subtotal=fin.subtotal,
                delivery_fee=fin.delivery_fee,
                discount_amount=fin.discount_amount,
                total_amount=fin.total_amount,
                commission_rate_snapshot=fin.commission_rate,
                commission_amount=fin.commission_amount,
                merchant_net_amount=fin.merchant_net_amount,
                payment_method=PaymentMethodChoices.COD,
                payment_status=p_status,
                order_status=o_status,
                estimated_delivery_minutes=store.estimated_delivery_minutes,
            )
            created_dt = timezone.now() - timedelta(days=days_ago)
            Order.objects.filter(pk=order.pk).update(created_at=created_dt, updated_at=created_dt)

            for p in prods:
                OrderItem.objects.create(
                    order=order,
                    product=p,
                    product_name_snapshot=p.name,
                    product_name_en_snapshot=p.name_en,
                    product_sku_snapshot=p.sku,
                    unit_price_snapshot=p.effective_price,
                    quantity=2,
                    line_total=p.effective_price * 2,
                )

            OrderStatusHistory.objects.create(
                order=order,
                status=o_status,
                actor=store.merchant.user,
                actor_name=store.name,
                note=f"Seeded order in status {o_status}",
            )

            PaymentTransaction.objects.create(
                order=order,
                payment_method=PaymentMethodChoices.COD,
                status=p_status,
                amount=fin.total_amount,
                currency="EGP",
                paid_at=created_dt if p_status == PaymentStatusChoices.PAID else None,
            )

            comm_status = (
                CommissionStatus.EARNED
                if o_status == OrderStatusChoices.DELIVERED
                else CommissionStatus.REVERSED
                if o_status == OrderStatusChoices.CANCELLED
                else CommissionStatus.PENDING
            )
            CommissionRecord.objects.create(
                order=order,
                store=store,
                currency="EGP",
                order_subtotal_snapshot=fin.subtotal,
                delivery_fee_snapshot=fin.delivery_fee,
                discount_snapshot=fin.discount_amount,
                order_total_snapshot=fin.total_amount,
                commission_rate_snapshot=fin.commission_rate,
                commission_amount=fin.commission_amount,
                merchant_net_amount=fin.merchant_net_amount,
                status=comm_status,
            )

            if o_status == OrderStatusChoices.DELIVERED and not hasattr(order, "review"):
                StoreReview.objects.create(
                    customer=cust,
                    store=store,
                    order=order,
                    rating=5,
                    comment="توصيل سريع ومنتجات طازجة وأسعار ممتازة.",
                )

        self.stdout.write(
            self.style.SUCCESS(
                "Gowar development database seeded idempotently "
                f"({Store.objects.count()} stores, {Product.objects.count()} products, {Order.objects.count()} orders)."
            )
        )
