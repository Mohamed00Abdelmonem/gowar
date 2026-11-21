from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.catalog.models import Product
from apps.common.models import UUIDTimeStampedModel
from apps.stores.models import Store


class Cart(UUIDTimeStampedModel):
    customer = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cart",
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="active_carts",
    )

    def __str__(self):
        return f"Cart<{self.customer.email}>"


class CartItem(UUIDTimeStampedModel):
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="cart_items",
    )
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        unique_together = ("cart", "product")
        ordering = ["created_at"]
