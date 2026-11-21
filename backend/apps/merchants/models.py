from django.conf import settings
from django.db import models
from apps.common.models import UUIDTimeStampedModel


class ApprovalStatus(models.TextChoices):
    PENDING = "pending", "Pending Review"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    SUSPENDED = "suspended", "Suspended"


class MerchantProfile(UUIDTimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="merchant_profile",
    )
    merchant_code = models.CharField(max_length=40, unique=True, blank=True, null=True)
    business_name = models.CharField(max_length=160)
    commercial_registration = models.CharField(max_length=80, blank=True)
    approval_status = models.CharField(
        max_length=20,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.PENDING,
        db_index=True,
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.business_name} ({self.approval_status})"
