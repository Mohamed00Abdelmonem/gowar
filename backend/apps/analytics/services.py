from datetime import datetime, timedelta
from decimal import Decimal
from django.db.models import Avg, Count, DecimalField, F, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDate, TruncMonth, TruncWeek
from django.utils import timezone
from django.utils.dateparse import parse_date

from apps.accounts.models import User, UserRole
from apps.catalog.models import Product
from apps.commissions.models import CommissionRecord, CommissionStatus, RefundRecord
from apps.merchants.models import ApprovalStatus, MerchantProfile
from apps.orders.models import Order, OrderItem, OrderStatusChoices
from apps.payments.models import PaymentStatusChoices
from apps.stores.models import Store

ZERO_MONEY = Value(Decimal("0.00"), output_field=DecimalField(max_digits=14, decimal_places=2))


def resolve_date_window(preset: str = "30d", date_from: str | None = None, date_to: str | None = None):
    now = timezone.now()
    if preset == "all":
        return None, None
    if preset == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, now
    if preset == "7d":
        return now - timedelta(days=7), now
    if preset == "30d":
        return now - timedelta(days=30), now
    if preset == "3m":
        return now - timedelta(days=90), now
    if preset == "6m":
        return now - timedelta(days=180), now
    if preset == "custom" and date_from and date_to:
        d_from = parse_date(date_from)
        d_to = parse_date(date_to)
        if d_from and d_to:
            tz = timezone.get_current_timezone()
            start = timezone.make_aware(datetime.combine(d_from, datetime.min.time()), tz)
            end = timezone.make_aware(datetime.combine(d_to, datetime.max.time()), tz)
            return start, end
    return now - timedelta(days=30), now


def _apply_date_filter(qs, start, end, field="created_at"):
    if start is not None:
        qs = qs.filter(**{f"{field}__gte": start})
    if end is not None:
        qs = qs.filter(**{f"{field}__lte": end})
    return qs


def _qualifying_completed_orders_q(prefix: str = "") -> Q:
    return Q(**{f"{prefix}order_status": OrderStatusChoices.DELIVERED}) & ~Q(
        **{f"{prefix}payment_status": PaymentStatusChoices.REFUNDED}
    )


def get_merchant_overview(store: Store) -> dict:
    start_today, end_today = resolve_date_window("today")
    today_orders = _apply_date_filter(Order.objects.filter(store=store), start_today, end_today)

    today_stats = today_orders.aggregate(
        today_orders=Count("id"),
        today_completed_sales=Coalesce(
            Sum("total_amount", filter=_qualifying_completed_orders_q()), ZERO_MONEY
        ),
    )

    lifetime_counts = Order.objects.filter(store=store).aggregate(
        pending_orders=Count("id", filter=Q(order_status=OrderStatusChoices.PENDING)),
        completed_orders=Count("id", filter=Q(order_status=OrderStatusChoices.DELIVERED)),
    )

    catalog_stats = Product.objects.filter(store=store, is_active=True).aggregate(
        total_products=Count("id"),
        low_stock_count=Count("id", filter=Q(stock_quantity__gt=0, stock_quantity__lte=5)),
        out_of_stock_count=Count("id", filter=Q(stock_quantity=0)),
    )

    return {
        "store_id": str(store.id),
        "store_name": store.name,
        "is_open": store.is_open,
        "approval_status": store.approval_status,
        "today_sales": str(today_stats["today_completed_sales"]),
        "today_orders": today_stats["today_orders"],
        "pending_orders": lifetime_counts["pending_orders"],
        "completed_orders": lifetime_counts["completed_orders"],
        "total_products": catalog_stats["total_products"],
        "low_stock_alerts": catalog_stats["low_stock_count"],
        "out_of_stock_alerts": catalog_stats["out_of_stock_count"],
    }


def get_merchant_analytics(
    store: Store,
    preset: str = "30d",
    date_from: str | None = None,
    date_to: str | None = None,
    granularity: str = "daily",
) -> dict:
    start, end = resolve_date_window(preset, date_from, date_to)
    window_orders = _apply_date_filter(Order.objects.filter(store=store), start, end)
    completed_q = _qualifying_completed_orders_q()

    summary = window_orders.aggregate(
        total_orders=Count("id"),
        completed_orders=Count("id", filter=Q(order_status=OrderStatusChoices.DELIVERED)),
        cancelled_orders=Count("id", filter=Q(order_status=OrderStatusChoices.CANCELLED)),
        gross_sales=Coalesce(Sum("total_amount", filter=completed_q), ZERO_MONEY),
        products_subtotal=Coalesce(Sum("subtotal", filter=completed_q), ZERO_MONEY),
        delivery_fees=Coalesce(Sum("delivery_fee", filter=completed_q), ZERO_MONEY),
        platform_commission=Coalesce(Sum("commission_amount", filter=completed_q), ZERO_MONEY),
        merchant_net_sales=Coalesce(Sum("merchant_net_amount", filter=completed_q), ZERO_MONEY),
        average_order_value=Coalesce(Avg("total_amount", filter=completed_q), ZERO_MONEY),
    )

    completed_order_ids = window_orders.filter(completed_q).values_list("id", flat=True)
    items_qs = OrderItem.objects.filter(order_id__in=completed_order_ids)

    units_sold = items_qs.aggregate(total_units=Coalesce(Sum("quantity"), 0))["total_units"]

    top_products = list(
        items_qs.values("product_id", "product_name_snapshot", "product_name_en_snapshot")
        .annotate(units_sold=Coalesce(Sum("quantity"), 0), revenue=Coalesce(Sum("line_total"), ZERO_MONEY))
        .order_by("-units_sold", "-revenue")[:10]
    )

    # Least-selling active products (including 0-unit items)
    sold_filter = Q(order_items__order_id__in=completed_order_ids)
    least_selling = list(
        Product.objects.filter(store=store, is_active=True)
        .annotate(
            units_sold=Coalesce(Sum("order_items__quantity", filter=sold_filter), 0),
            revenue=Coalesce(Sum("order_items__line_total", filter=sold_filter), ZERO_MONEY),
        )
        .values("id", "name", "name_en", "stock_quantity", "units_sold", "revenue")
        .order_by("units_sold", "name")[:5]
    )

    category_performance = list(
        items_qs.filter(product__category__isnull=False)
        .values(
            category_id=F("product__category_id"),
            category_name=F("product__category__name"),
            category_name_en=F("product__category__name_en"),
        )
        .annotate(units_sold=Coalesce(Sum("quantity"), 0), revenue=Coalesce(Sum("line_total"), ZERO_MONEY))
        .order_by("-revenue")
    )

    # Time series via SQL Trunc
    trunc_fn = TruncMonth if granularity == "monthly" else TruncWeek if granularity == "weekly" else TruncDate
    time_series = [
        {
            "period": row["period"].isoformat() if row["period"] else "",
            "orders": row["orders"],
            "sales": str(row["sales"]),
        }
        for row in window_orders.annotate(period=trunc_fn("created_at"))
        .values("period")
        .annotate(
            orders=Count("id"),
            sales=Coalesce(Sum("total_amount", filter=completed_q), ZERO_MONEY),
        )
        .order_by("period")
    ]

    low_stock_alerts = list(
        Product.objects.filter(store=store, is_active=True, stock_quantity__gt=0, stock_quantity__lte=5)
        .values("id", "name", "sku", "stock_quantity")
        .order_by("stock_quantity")
    )
    out_of_stock_alerts = list(
        Product.objects.filter(store=store, is_active=True, stock_quantity=0)
        .values("id", "name", "sku")
    )

    # Customer statistics in window + returning customer check
    period_customers = window_orders.values("customer_id").distinct().count()
    returning_customers = (
        Order.objects.filter(store=store, customer_id__in=window_orders.values("customer_id"))
        .values("customer_id")
        .annotate(total_cnt=Count("id"))
        .filter(total_cnt__gte=2)
        .count()
    )

    return {
        "currency": "EGP",
        "preset": preset,
        "summary": {
            "total_orders": summary["total_orders"],
            "completed_orders": summary["completed_orders"],
            "cancelled_orders": summary["cancelled_orders"],
            "units_sold": units_sold,
            "gross_sales": str(summary["gross_sales"]),
            "products_subtotal": str(summary["products_subtotal"]),
            "delivery_fees": str(summary["delivery_fees"]),
            "platform_commission": str(summary["platform_commission"]),
            "merchant_net_sales": str(summary["merchant_net_sales"]),
            "average_order_value": f"{Decimal(summary['average_order_value']):.2f}",
        },
        "time_series": time_series,
        "top_10_products": [
            {
                "product_id": str(r["product_id"]) if r["product_id"] else None,
                "name": r["product_name_snapshot"],
                "name_en": r["product_name_en_snapshot"],
                "units_sold": r["units_sold"],
                "revenue": str(r["revenue"]),
            }
            for r in top_products
        ],
        "least_selling_products": [
            {
                "id": str(r["id"]),
                "name": r["name"],
                "name_en": r["name_en"],
                "stock_quantity": r["stock_quantity"],
                "units_sold": r["units_sold"],
                "revenue": str(r["revenue"]),
            }
            for r in least_selling
        ],
        "category_performance": [
            {
                "category_id": str(r["category_id"]),
                "category_name": r["category_name"],
                "category_name_en": r["category_name_en"],
                "units_sold": r["units_sold"],
                "revenue": str(r["revenue"]),
            }
            for r in category_performance
        ],
        "inventory_alerts": {
            "low_stock": [dict(x, id=str(x["id"])) for x in low_stock_alerts],
            "out_of_stock": [dict(x, id=str(x["id"])) for x in out_of_stock_alerts],
        },
        "customer_insights": {
            "active_customers": period_customers,
            "returning_customers": returning_customers,
            "avg_orders_per_customer": round(summary["total_orders"] / period_customers, 2)
            if period_customers
            else 0,
        },
    }


def get_merchant_customers(store: Store) -> list[dict]:
    from django.db.models import Max

    rows = (
        Order.objects.filter(store=store)
        .values(
            "customer_id",
            first_name=F("customer__first_name"),
            last_name=F("customer__last_name"),
            email=F("customer__email"),
            phone=F("customer__phone_number"),
        )
        .annotate(
            order_count=Count("id"),
            completed_count=Count("id", filter=_qualifying_completed_orders_q()),
            total_spent=Coalesce(Sum("total_amount", filter=_qualifying_completed_orders_q()), ZERO_MONEY),
            last_order_at=Max("created_at"),
        )
        .order_by("-total_spent")
    )
    return [
        {
            "customer_id": str(r["customer_id"]),
            "name": f"{r['first_name']} {r['last_name']}".strip() or r["email"],
            "phone": r["phone"],
            "email": r["email"],
            "order_count": r["order_count"],
            "completed_count": r["completed_count"],
            "is_returning": r["order_count"] >= 2,
            "total_spent": str(r["total_spent"]),
            "last_order_at": r["last_order_at"].isoformat() if r["last_order_at"] else None,
        }
        for r in rows
    ]


def get_admin_platform_overview(
    preset: str = "30d",
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    start, end = resolve_date_window(preset, date_from, date_to)
    window_orders = _apply_date_filter(Order.objects.all(), start, end)
    completed_q = _qualifying_completed_orders_q()

    order_agg = window_orders.aggregate(
        total_orders=Count("id"),
        completed_orders=Count("id", filter=Q(order_status=OrderStatusChoices.DELIVERED)),
        cancelled_orders=Count("id", filter=Q(order_status=OrderStatusChoices.CANCELLED)),
        total_gmv=Coalesce(Sum("total_amount", filter=completed_q), ZERO_MONEY),
        platform_revenue=Coalesce(Sum("commission_amount", filter=completed_q), ZERO_MONEY),
        delivery_fees=Coalesce(Sum("delivery_fee", filter=completed_q), ZERO_MONEY),
        merchant_net_sales=Coalesce(Sum("merchant_net_amount", filter=completed_q), ZERO_MONEY),
        average_order_value=Coalesce(Avg("total_amount", filter=completed_q), ZERO_MONEY),
    )

    pending_commissions = CommissionRecord.objects.filter(
        status=CommissionStatus.PENDING
    ).aggregate(total=Coalesce(Sum("commission_amount"), ZERO_MONEY))["total"]

    refunded_comm = _apply_date_filter(RefundRecord.objects.all(), start, end).aggregate(
        total_refunds=Coalesce(Sum("amount"), ZERO_MONEY),
        reversed_commissions=Coalesce(Sum("commission_reversed"), ZERO_MONEY),
    )

    net_platform_revenue = max(
        Decimal("0.00"),
        Decimal(order_agg["platform_revenue"]) - Decimal(refunded_comm["reversed_commissions"]),
    )

    merchant_counts = MerchantProfile.objects.aggregate(
        total_merchants=Count("id"),
        active_merchants=Count("id", filter=Q(approval_status=ApprovalStatus.APPROVED)),
        pending_approvals=Count("id", filter=Q(approval_status=ApprovalStatus.PENDING)),
    )
    total_customers = User.objects.filter(role=UserRole.CUSTOMER).count()

    trunc_fn = TruncMonth if preset in ("3m", "6m", "all") else TruncDate
    revenue_over_time = [
        {
            "period": r["period"].isoformat() if r["period"] else "",
            "orders": r["orders"],
            "gmv": str(r["gmv"]),
            "commission_revenue": str(r["commission_revenue"]),
        }
        for r in window_orders.annotate(period=trunc_fn("created_at"))
        .values("period")
        .annotate(
            orders=Count("id"),
            gmv=Coalesce(Sum("total_amount", filter=completed_q), ZERO_MONEY),
            commission_revenue=Coalesce(Sum("commission_amount", filter=completed_q), ZERO_MONEY),
        )
        .order_by("period")
    ]

    sales_by_area = [
        {
            "area_id": str(r["store__area_id"]) if r["store__area_id"] else None,
            "area_name": r["store__area__name_ar"] or "غير محدد",
            "area_name_en": r["store__area__name_en"] or "Unassigned",
            "orders": r["orders"],
            "gmv": str(r["gmv"]),
        }
        for r in window_orders.filter(completed_q)
        .values("store__area_id", "store__area__name_ar", "store__area__name_en")
        .annotate(orders=Count("id"), gmv=Coalesce(Sum("total_amount"), ZERO_MONEY))
        .order_by("-gmv")
    ]

    sales_by_store = get_admin_per_store_financial_report(preset, date_from, date_to)

    return {
        "currency": "EGP",
        "preset": preset,
        "kpis": {
            "total_gmv": str(order_agg["total_gmv"]),
            "platform_revenue": f"{net_platform_revenue:.2f}",
            "merchant_net_sales": str(order_agg["merchant_net_sales"]),
            "delivery_fees": str(order_agg["delivery_fees"]),
            "pending_commissions": str(pending_commissions),
            "refund_adjustments": str(refunded_comm["reversed_commissions"]),
            "total_merchants": merchant_counts["total_merchants"],
            "active_merchants": merchant_counts["active_merchants"],
            "pending_merchant_approvals": merchant_counts["pending_approvals"],
            "total_customers": total_customers,
            "total_orders": order_agg["total_orders"],
            "completed_orders": order_agg["completed_orders"],
            "cancelled_orders": order_agg["cancelled_orders"],
            "average_order_value": f"{Decimal(order_agg['average_order_value']):.2f}",
        },
        "revenue_over_time": revenue_over_time,
        "sales_by_area": sales_by_area,
        "top_performing_stores": sales_by_store[:5],
    }


def get_admin_per_store_financial_report(
    preset: str = "30d",
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[dict]:
    start, end = resolve_date_window(preset, date_from, date_to)

    order_date_q = Q()
    if start is not None:
        order_date_q &= Q(orders__created_at__gte=start)
    if end is not None:
        order_date_q &= Q(orders__created_at__lte=end)

    completed_filter = order_date_q & _qualifying_completed_orders_q("orders__")
    pending_filter = order_date_q & Q(
        orders__order_status__in=[
            OrderStatusChoices.PENDING,
            OrderStatusChoices.ACCEPTED,
            OrderStatusChoices.PREPARING,
            OrderStatusChoices.READY_FOR_DELIVERY,
            OrderStatusChoices.OUT_FOR_DELIVERY,
        ]
    )

    refund_date_q = Q()
    if start is not None:
        refund_date_q &= Q(orders__refund_records__created_at__gte=start)
    if end is not None:
        refund_date_q &= Q(orders__refund_records__created_at__lte=end)

    stores = (
        Store.objects.select_related("merchant", "merchant__user")
        .annotate(
            completed_order_count=Count("orders", filter=completed_filter, distinct=True),
            gmv=Coalesce(Sum("orders__total_amount", filter=completed_filter), ZERO_MONEY),
            average_order_value=Coalesce(Avg("orders__total_amount", filter=completed_filter), ZERO_MONEY),
            gowar_commission_earned=Coalesce(
                Sum("orders__commission_amount", filter=completed_filter), ZERO_MONEY
            ),
            merchant_net_sales=Coalesce(
                Sum("orders__merchant_net_amount", filter=completed_filter), ZERO_MONEY
            ),
            pending_commissions=Coalesce(
                Sum("orders__commission_amount", filter=pending_filter), ZERO_MONEY
            ),
            refunds_and_adjustments=Coalesce(
                Sum("orders__refund_records__amount", filter=refund_date_q), ZERO_MONEY
            ),
        )
        .order_by("-gmv", "name")
    )

    return [
        {
            "store_id": str(s.id),
            "store_name": s.name,
            "store_name_en": s.name_en,
            "merchant_id": str(s.merchant_id),
            "merchant_name": s.merchant.user.full_name,
            "completed_order_count": s.completed_order_count,
            "gmv": f"{Decimal(s.gmv):.2f}",
            "average_order_value": f"{Decimal(s.average_order_value):.2f}",
            "commission_percentage": f"{s.commission_rate:.2f}",
            "gowar_commission_earned": f"{Decimal(s.gowar_commission_earned):.2f}",
            "merchant_net_sales": f"{Decimal(s.merchant_net_sales):.2f}",
            "pending_commissions": f"{Decimal(s.pending_commissions):.2f}",
            "refunds_and_adjustments": f"{Decimal(s.refunds_and_adjustments):.2f}",
        }
        for s in stores
    ]
