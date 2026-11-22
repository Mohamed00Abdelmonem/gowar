from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.gis.geos import Point
from django.utils import timezone

from apps.accounts.models import User, UserRole
from apps.merchants.models import ApprovalStatus, MerchantProfile
from apps.orders.models import Order, OrderStatusChoices
from apps.stores.models import Store


def _make_store(merchant_profile, slug, name_en, lat, lng, is_active=True, is_open=True):
    return Store.objects.create(
        merchant=merchant_profile,
        name=name_en,
        name_en=name_en,
        slug=slug,
        phone_number="01000000000",
        address="Test Address",
        latitude=Decimal(str(lat)),
        longitude=Decimal(str(lng)),
        location=Point(lng, lat, srid=4326),
        approval_status=ApprovalStatus.APPROVED,
        is_active=is_active,
        is_open=is_open,
        delivery_enabled=True,
        delivery_radius_km=Decimal("10.00"),
    )


def _make_order(customer, store, order_number, status, created_at=None):
    order = Order.objects.create(
        order_number=order_number,
        customer=customer,
        store=store,
        delivery_address_snapshot={"formatted_address": "Test"},
        subtotal=Decimal("100.00"),
        delivery_fee=Decimal("10.00"),
        discount_amount=Decimal("0.00"),
        total_amount=Decimal("110.00"),
        commission_rate_snapshot=Decimal("5.00"),
        commission_amount=Decimal("5.00"),
        merchant_net_amount=Decimal("95.00"),
        order_status=status,
    )
    if created_at is not None:
        Order.objects.filter(pk=order.pk).update(created_at=created_at)
    return order


@pytest.mark.django_db
def test_personalized_ranking_boosts_previously_ordered_store_over_closer_new_store(
    api_client, customer_user, merchants_and_stores
):
    m_user = User.objects.create_user(
        email="rank_m@gowar.test",
        password="MerchPassword123!",
        first_name="Rank",
        last_name="Merchant",
        phone_number="01077777777",
        role=UserRole.MERCHANT,
        is_verified=True,
    )
    mp = MerchantProfile.objects.create(
        user=m_user, business_name="Rank Co", approval_status=ApprovalStatus.APPROVED
    )

    # Customer at Mansoura center: (31.0409, 31.3785)
    # Store A: ~2.0 km north-east, previously ordered (delivered recently)
    store_a = _make_store(mp, "rank-store-a", "Store A Previous", 31.0540, 31.3920)
    # Store B: ~0.4 km away, never ordered
    store_b = _make_store(mp, "rank-store-b", "Store B Closer New", 31.0435, 31.3810)
    # Store C: ~0.2 km away, inactive -> must never appear
    store_inactive = _make_store(
        mp, "rank-store-inactive", "Store Inactive", 31.0415, 31.3790, is_active=False
    )

    _make_order(customer_user, store_a, "GW-RNK-001", OrderStatusChoices.DELIVERED)

    # Anonymous user sees default proximity order (Store B before Store A, no inactive)
    anon_res = api_client.get(
        "/api/v1/stores/nearby/?latitude=31.0409&longitude=31.3785&radius_km=5"
    )
    assert anon_res.status_code == 200
    anon_ids = [s["id"] for s in anon_res.data["results"]]
    assert str(store_inactive.id) not in anon_ids
    assert anon_ids.index(str(store_b.id)) < anon_ids.index(str(store_a.id))

    # Authenticated customer sees Store A boosted above Store B with count=1
    api_client.force_authenticate(user=customer_user)
    cust_res = api_client.get(
        "/api/v1/stores/nearby/?latitude=31.0409&longitude=31.3785&radius_km=5"
    )
    assert cust_res.status_code == 200
    results = cust_res.data["results"]
    cust_ids = [s["id"] for s in results]
    assert len(cust_ids) == len(set(cust_ids))
    assert cust_ids.index(str(store_a.id)) < cust_ids.index(str(store_b.id))
    store_a_payload = next(s for s in results if s["id"] == str(store_a.id))
    assert store_a_payload["is_previously_ordered"] is True
    assert store_a_payload["customer_completed_orders_count"] == 1


@pytest.mark.django_db
def test_repeat_orders_recency_cancelled_orders_and_pagination(
    api_client, customer_user
):
    m_user = User.objects.create_user(
        email="rank2_m@gowar.test",
        password="MerchPassword123!",
        first_name="Rank2",
        last_name="Merchant",
        phone_number="01088888888",
        role=UserRole.MERCHANT,
        is_verified=True,
    )
    mp = MerchantProfile.objects.create(
        user=m_user, business_name="Rank2 Co", approval_status=ApprovalStatus.APPROVED
    )

    now = timezone.now()
    # Equal distance (~0.5 km) to isolate repeat + recency + status rules
    store_repeat_recent = _make_store(mp, "s-rep-rec", "Repeat Recent", 31.0445, 31.3815)
    store_old_once = _make_store(mp, "s-old-once", "Old Once", 31.0445, 31.3816)
    store_cancelled_only = _make_store(mp, "s-cxl-only", "Cancelled Only", 31.0445, 31.3817)
    store_distant_old = _make_store(mp, "s-dist-old", "Distant Old", 31.1100, 31.4300)

    # 3 recent delivered orders on store_repeat_recent
    for i in range(3):
        _make_order(
            customer_user,
            store_repeat_recent,
            f"GW-REP-{i}",
            OrderStatusChoices.DELIVERED,
            created_at=now - timedelta(days=2),
        )

    # 1 old delivered order (45 days ago) on store_old_once
    _make_order(
        customer_user,
        store_old_once,
        "GW-OLD-1",
        OrderStatusChoices.DELIVERED,
        created_at=now - timedelta(days=45),
    )

    # Cancelled & pending orders must NOT count
    _make_order(customer_user, store_cancelled_only, "GW-CXL-1", OrderStatusChoices.CANCELLED)
    _make_order(customer_user, store_cancelled_only, "GW-PEN-1", OrderStatusChoices.PENDING)

    # Distant store (>8km away) with 1 old order must not beat close stores in 10km radius
    _make_order(
        customer_user,
        store_distant_old,
        "GW-DST-1",
        OrderStatusChoices.DELIVERED,
        created_at=now - timedelta(days=45),
    )

    api_client.force_authenticate(user=customer_user)
    p1 = api_client.get(
        "/api/v1/stores/nearby/?latitude=31.0409&longitude=31.3785&radius_km=10&page=1&page_size=2"
    )
    p2 = api_client.get(
        "/api/v1/stores/nearby/?latitude=31.0409&longitude=31.3785&radius_km=10&page=2&page_size=2"
    )
    assert p1.status_code == 200 and p2.status_code == 200
    combined = p1.data["results"] + p2.data["results"]
    ids = [s["id"] for s in combined]

    assert ids[0] == str(store_repeat_recent.id)
    assert ids.index(str(store_old_once.id)) < ids.index(str(store_cancelled_only.id))

    cxl_payload = next(s for s in combined if s["id"] == str(store_cancelled_only.id))
    assert cxl_payload["is_previously_ordered"] is False
    assert cxl_payload["customer_completed_orders_count"] == 0
