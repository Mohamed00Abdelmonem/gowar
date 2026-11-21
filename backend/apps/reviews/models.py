from decimal import Decimal
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction
from django.db.models import Avg, Count

from apps.common.models import UUIDTimeStampedModel
from apps.orders.models import Order
from apps.stores.models import Store


class StoreReview(UUIDTimeStampedModel):
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="store_reviews",
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name="review",
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        with transaction.atomic():
            super().save(*args, **kwargs)
            stats = StoreReview.objects.filter(store=self.store).aggregate(
                avg_rating=Avg("rating"),
                total_reviews=Count("id"),
            )
            self.store.rating = Decimal(str(round(stats["avg_rating"] or 5.0, 2)))
            self.store.review_count = stats["total_reviews"] or 0
            self.store.save(update_fields=["rating", "review_count", "updated_at"])
