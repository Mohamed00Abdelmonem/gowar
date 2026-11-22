from decimal import Decimal
import pytest
from django.contrib.gis.geos import Point
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User, UserRole
from apps.catalog.models import Category, Product
from apps.locations.models import Area, CustomerAddress, CustomerProfile
from apps.merchants.models import ApprovalStatus, MerchantProfile
from apps.platform_settings.models import PlatformSettings
from apps.stores.models import Store, StoreType


@pytest.fixture
def api_client():
    return APIClient()


def auth_client_for(user: User) -> APIClient:
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return client


@pytest.fixture
def platform_settings(db):
    return PlatformSettings.get_solo()


@pytest.fixture
def cairo_areas(db):
    nasr = Area.objects.create(
        name_ar="مدينة نصر",
        name_en="Nasr City",
        center_location=Point(31.3376, 30.0566, srid=4326),
        is_active=True,
    )
    maadi = Area.objects.create(
        name_ar="المعادي",
        name_en="Maadi",
        center_location=Point(31.2582, 29.9608, srid=4326),
        is_active=True,
    )
    return {"nasr": nasr, "maadi": maadi}


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(
        email="admin@gowar.test",
        password="AdminPassword123!",
        first_name="Admin",
        last_name="User",
    )


@pytest.fixture
def customer_user(db, cairo_areas):
    user = User.objects.create_user(
        email="cust1@gowar.test",
        password="CustPassword123!",
        first_name="أحمد",
        last_name="محمود",
        phone_number="01011111111",
        role=UserRole.CUSTOMER,
        is_verified=True,
    )
    CustomerProfile.objects.create(user=user, search_radius_km=3)
    CustomerAddress.objects.create(
        customer=user,
        area=cairo_areas["nasr"],
        label="المنزل",
        formatted_address="مدينة نصر، شارع عباس العقاد",
        latitude=Decimal("30.056600"),
        longitude=Decimal("31.337600"),
        is_default=True,
    )
    return user


@pytest.fixture
def other_customer_user(db):
    user = User.objects.create_user(
        email="cust2@gowar.test",
        password="CustPassword123!",
        first_name="سارة",
        last_name="علي",
        phone_number="01022222222",
        role=UserRole.CUSTOMER,
        is_verified=True,
    )
    CustomerProfile.objects.create(user=user, search_radius_km=3)
    return user


@pytest.fixture
def merchants_and_stores(db, cairo_areas):
    m1_user = User.objects.create_user(
        email="m1@gowar.test",
        password="MerchPassword123!",
        first_name="تاجر",
        last_name="البركة",
        phone_number="01033333333",
        role=UserRole.MERCHANT,
        is_verified=True,
    )
    m1 = MerchantProfile.objects.create(
        user=m1_user, business_name="ماركت البركة", approval_status=ApprovalStatus.APPROVED
    )
    s1 = Store.objects.create(
        merchant=m1,
        name="ماركت البركة",
        name_en="Al-Baraka Market",
        slug="al-baraka-test",
        store_type=StoreType.SUPERMARKET,
        phone_number="01033333333",
        address="عباس العقاد، مدينة نصر",
        area=cairo_areas["nasr"],
        latitude=Decimal("30.056100"),
        longitude=Decimal("31.336900"),
        delivery_enabled=True,
        delivery_radius_km=Decimal("4.00"),
        delivery_fee=Decimal("15.00"),
        delivery_price_per_km=Decimal("15.00"),
        minimum_order_amount=Decimal("50.00"),
        commission_rate=Decimal("5.00"),
        approval_status=ApprovalStatus.APPROVED,
        is_active=True,
        is_open=True,
    )

    m2_user = User.objects.create_user(
        email="m2@gowar.test",
        password="MerchPassword123!",
        first_name="تاجر",
        last_name="الكوربة",
        phone_number="01044444444",
        role=UserRole.MERCHANT,
        is_verified=True,
    )
    m2 = MerchantProfile.objects.create(
        user=m2_user, business_name="ماركت المدينة", approval_status=ApprovalStatus.APPROVED
    )
    # ~3.6 km away from Abbas El Akkad, but delivery_radius_km=2.00 (outside delivery coverage for Abbas El Akkad)
    s2 = Store.objects.create(
        merchant=m2,
        name="ماركت المدينة",
        name_en="Al-Madina Market",
        slug="al-madina-test",
        store_type=StoreType.MINI_MARKET,
        phone_number="01044444444",
        address="الكوربة، مصر الجديدة",
        area=cairo_areas["nasr"],
        latitude=Decimal("30.087500"),
        longitude=Decimal("31.326400"),
        delivery_enabled=True,
        delivery_radius_km=Decimal("2.00"),
        delivery_fee=Decimal("20.00"),
        delivery_price_per_km=Decimal("20.00"),
        minimum_order_amount=Decimal("50.00"),
        commission_rate=Decimal("8.00"),
        approval_status=ApprovalStatus.APPROVED,
        is_active=True,
        is_open=True,
    )

    return {"m1": m1, "s1": s1, "m2": m2, "s2": s2}


@pytest.fixture
def sample_catalog(db, merchants_and_stores):
    cat = Category.objects.create(
        name="ألبان وجبن", name_en="Dairy", slug="dairy-test", is_global=True
    )
    p1 = Product.objects.create(
        store=merchants_and_stores["s1"],
        category=cat,
        name="لبن جهينة ١ لتر",
        name_en="Juhayna Milk 1L",
        sku="BRK-MLK-1",
        price=Decimal("46.00"),
        stock_quantity=20,
        unit="١ لتر",
        is_available=True,
    )
    p2 = Product.objects.create(
        store=merchants_and_stores["s2"],
        category=cat,
        name="لبن جهينة ١ لتر",
        name_en="Juhayna Milk 1L",
        sku="MDN-MLK-1",
        price=Decimal("52.00"),
        stock_quantity=10,
        unit="١ لتر",
        is_available=True,
    )
    return {"category": cat, "p1": p1, "p2": p2}
