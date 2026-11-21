from decimal import Decimal
from django.conf import settings
from django.db import models

from apps.catalog.models import Product
from apps.common.models import UUIDModel, UUIDTimeStampedModel
from apps.payments.models import PaymentMethodChoices, PaymentStatusChoices
from apps.stores.models import Store


class OrderStatusChoices(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    PREPARING = "preparing", "Preparing"
    READY_FOR_DELIVERY = "ready_for_delivery", "Ready for Delivery"
    OUT_FOR_DELIVERY = "out_for_delivery", "Out for Delivery"
    DELIVERED = "delivered", "Delivered"
    CANCELLED = "cancelled", "Cancelled"


class Order(UUIDTimeStampedModel):
    order_number = models.CharField(max_length=30, unique=True, db_index=True)
    idempotency_key = models.CharField(max_length=120, unique=True, null=True, blank=True)
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="orders",
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.PROTECT,
        related_name="orders",
    )
    delivery_address_snapshot = models.JSONField(default=dict)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    commission_rate_snapshot = models.DecimalField(max_digits=5, decimal_places=2)
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2)
    merchant_net_amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(
        max_length=24,
        choices=PaymentMethodChoices.choices,
        default=PaymentMethodChoices.COD,
    )
    payment_status = models.CharField(
        max_length=24,
        choices=PaymentStatusChoices.choices,
        default=PaymentStatusChoices.PENDING,
        db_index=True,
    )
    order_status = models.CharField(
        max_length=30,
        choices=OrderStatusChoices.choices,
        default=OrderStatusChoices.PENDING,
        db_index=True,
    )
    customer_notes = models.TextField(blank=True)
    reject_reason = models.CharField(max_length=255, blank=True)
    estimated_delivery_minutes = models.PositiveSmallIntegerField(default=25)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["store", "order_status", "created_at"]),
            models.Index(fields=["customer", "created_at"]),
            models.Index(fields=["order_status", "created_at"]),
        ]

    def __str__(self):
        return f"Order #{self.order_number} ({self.order_status})"


class OrderItem(UUIDModel):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_items",
    )
    product_name_snapshot = models.CharField(max_length=200)
    product_name_en_snapshot = models.CharField(max_length=200, blank=True)
    product_sku_snapshot = models.CharField(max_length=64, blank=True)
    unit_price_snapshot = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["id"]


class OrderStatusHistory(UUIDModel):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    status = models.CharField(max_length=30, choices=OrderStatusChoices.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    actor_name = models.CharField(max_length=160, blank=True)
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at"]
