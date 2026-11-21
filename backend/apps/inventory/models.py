from django.conf import settings
from django.db import models
from apps.catalog.models import Product
from apps.common.models import UUIDModel
from apps.stores.models import Store


class MovementType(models.TextChoices):
    STOCK_IN = "stock_in", "Restock / Increase"
    STOCK_OUT = "stock_out", "Manual Decrease"
    ORDER_DEDUCTION = "order_deduction", "Order Deduction"
    ORDER_RESTOCK = "order_restock", "Order Cancellation Restock"
    ADJUSTMENT = "adjustment", "Manual Stock Count Adjustment"


class InventoryMovement(UUIDModel):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="inventory_movements",
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name="inventory_movements",
    )
    movement_type = models.CharField(
        max_length=30,
        choices=MovementType.choices,
        db_index=True,
    )
    quantity = models.IntegerField(help_text="Signed change (+ for restock, - for deduction)")
    previous_quantity = models.PositiveIntegerField()
    new_quantity = models.PositiveIntegerField()
    reference_type = models.CharField(max_length=40, blank=True, db_index=True)
    reference_id = models.CharField(max_length=80, blank=True, db_index=True)
    idempotency_key = models.CharField(max_length=120, unique=True, null=True, blank=True)
    note = models.CharField(max_length=255, blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_movements",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["store", "created_at"]),
            models.Index(fields=["reference_type", "reference_id"]),
        ]
