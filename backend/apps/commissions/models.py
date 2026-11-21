from decimal import Decimal
from django.conf import settings
from django.db import models
from apps.common.models import UUIDTimeStampedModel
from apps.stores.models import Store


class CommissionStatus(models.TextChoices):
    PENDING = "pending", "Pending Settlement (Active Order)"
    EARNED = "earned", "Earned (Order Completed)"
    SETTLED = "settled", "Settled"
    REVERSED = "reversed", "Reversed (Cancelled / Refunded)"


class CommissionRecord(UUIDTimeStampedModel):
    order = models.OneToOneField(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="commission_record",
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name="commission_records",
    )
    currency = models.CharField(max_length=10, default="EGP")
    order_subtotal_snapshot = models.DecimalField(max_digits=12, decimal_places=2)
    delivery_fee_snapshot = models.DecimalField(max_digits=10, decimal_places=2)
    discount_snapshot = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    order_total_snapshot = models.DecimalField(max_digits=12, decimal_places=2)
    commission_rate_snapshot = models.DecimalField(max_digits=5, decimal_places=2)
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2)
    merchant_net_amount = models.DecimalField(max_digits=12, decimal_places=2)
    reversed_commission_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    status = models.CharField(
        max_length=20,
        choices=CommissionStatus.choices,
        default=CommissionStatus.PENDING,
        db_index=True,
    )
    settled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["store", "status", "created_at"]),
        ]

    @property
    def net_earned_commission(self) -> Decimal:
        if self.status in (CommissionStatus.EARNED, CommissionStatus.SETTLED):
            return max(Decimal("0.00"), self.commission_amount - self.reversed_commission_amount)
        return Decimal("0.00")


class RefundRecord(UUIDTimeStampedModel):
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="refund_records",
    )
    commission_record = models.ForeignKey(
        CommissionRecord,
        on_delete=models.CASCADE,
        related_name="refunds",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    commission_reversed = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField()
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="processed_refunds",
    )

    class Meta:
        ordering = ["-created_at"]
