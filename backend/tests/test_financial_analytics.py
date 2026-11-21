from decimal import Decimal
import pytest
from rest_framework import status

from apps.commissions.models import CommissionRecord, CommissionStatus
from apps.orders.services import create_order_from_cart, transition_order_status
from apps.cart.services import add_item_to_cart
from tests.conftest import auth_client_for


@pytest.mark.django_db
def test_completed_order_commission_refund_and_analytics_aggregation(
    customer_user,
    admin_user,
    merchants_and_stores,
    sample_catalog,
):
    m1_user = merchants_and_stores["m1"].user
    p1 = sample_catalog["p1"]  # 46.00 EGP
    addr_id = customer_user.addresses.first().id

    # Order 1: Completed -> Delivered (subtotal 92.00, commission 5% = 4.60)
    add_item_to_cart(customer=customer_user, product_id=p1.id, quantity=2)
    order1 = create_order_from_cart(customer=customer_user, address_id=addr_id)
    for st in ("accepted", "preparing", "ready_for_delivery", "out_for_delivery", "delivered"):
        order1 = transition_order_status(order_id=order1.id, target_status=st, actor=m1_user)

    assert CommissionRecord.objects.get(order=order1).status == CommissionStatus.EARNED

    # Order 2: Cancelled -> Excluded from realized sales & revenue (subtotal 92.00 meets 50.00 minimum)
    add_item_to_cart(customer=customer_user, product_id=p1.id, quantity=2)
    order2 = create_order_from_cart(customer=customer_user, address_id=addr_id)
    transition_order_status(order_id=order2.id, target_status="cancelled", actor=customer_user)

    # Merchant Analytics shows realized sales strictly from Order 1 (107.00 total, 4.60 commission)
    m1_client = auth_client_for(m1_user)
    m_analytics = m1_client.get("/api/v1/merchant/analytics/?preset=30d")
    assert m_analytics.status_code == status.HTTP_200_OK
    assert m_analytics.data["summary"]["completed_orders"] == 1
    assert m_analytics.data["summary"]["cancelled_orders"] == 1
    assert m_analytics.data["summary"]["gross_sales"] == "107.00"
    assert m_analytics.data["summary"]["platform_commission"] == "4.60"

    # Admin Overview & Per-Store Financial Report
    admin_client = auth_client_for(admin_user)
    overview = admin_client.get("/api/v1/admin/overview/?preset=30d")
    assert overview.status_code == status.HTTP_200_OK
    assert overview.data["kpis"]["total_gmv"] == "107.00"
    assert overview.data["kpis"]["platform_revenue"] == "4.60"

    report = admin_client.get("/api/v1/admin/financial-report/?preset=30d")
    assert report.status_code == status.HTTP_200_OK
    s1_row = next(r for r in report.data["stores"] if r["store_id"] == str(merchants_and_stores["s1"].id))
    assert s1_row["completed_order_count"] == 1
    assert s1_row["gowar_commission_earned"] == "4.60"

    # Process partial refund (46.00 of 92.00 subtotal) -> reverses 2.30 commission without deleting history
    refund_res = admin_client.post(
        f"/api/v1/admin/orders/{order1.id}/refund/",
        {"amount": "46.00", "reason": "Damaged bottle"},
        format="json",
    )
    assert refund_res.status_code == status.HTTP_200_OK
    assert Decimal(refund_res.data["commission_reversed"]) == Decimal("2.30")
    assert CommissionRecord.objects.filter(order=order1).exists()

    # Admin customers endpoint serializes cleanly including total_orders
    custs_res = admin_client.get("/api/v1/admin/customers/")
    assert custs_res.status_code == status.HTTP_200_OK
    assert custs_res.data["results"][0]["total_orders"] >= 1
