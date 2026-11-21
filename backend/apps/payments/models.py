from django.db import models
from apps.common.models import UUIDTimeStampedModel


class PaymentMethodChoices(models.TextChoices):
    COD = "cod", "Cash on Delivery"


class PaymentStatusChoices(models.TextChoices):
    UNPAID = "unpaid", "Unpaid"
    PENDING = "pending", "Pending Collection"
    PAID = "paid", "Paid"
    REFUNDED = "refunded", "Refunded"
    FAILED = "failed", "Failed"


class PaymentTransaction(UUIDTimeStampedModel):
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="payment_transactions",
    )
    payment_method = models.CharField(
        max_length=24,
        choices=PaymentMethodChoices.choices,
        default=PaymentMethodChoices.COD,
    )
    status = models.CharField(
        max_length=24,
        choices=PaymentStatusChoices.choices,
        default=PaymentStatusChoices.PENDING,
        db_index=True,
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default="EGP")
    provider_name = models.CharField(max_length=40, default="cash_on_delivery")
    provider_reference = models.CharField(max_length=120, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
