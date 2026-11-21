from decimal import Decimal
from django.db import models
from apps.common.models import UUIDTimeStampedModel


class PlatformSettings(UUIDTimeStampedModel):
    platform_name = models.CharField(max_length=120, default="جوار")
    platform_name_en = models.CharField(max_length=120, default="Gowar")
    default_commission_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("5.00")
    )
    currency = models.CharField(max_length=10, default="EGP")
    support_phone = models.CharField(max_length=32, default="19842")
    support_email = models.EmailField(default="support@gowar.eg")
    auto_approve_merchants = models.BooleanField(default=False)
    notify_on_new_order = models.BooleanField(default=True)
    notify_on_low_stock = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "Platform Settings"

    @classmethod
    def get_solo(cls) -> "PlatformSettings":
        obj = cls.objects.first()
        if obj:
            return obj
        return cls.objects.create()
