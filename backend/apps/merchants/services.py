from django.db import transaction
from django.utils import timezone
from .models import ApprovalStatus, MerchantProfile


@transaction.atomic
def update_merchant_approval(
    merchant: MerchantProfile,
    new_status: str,
    reason: str = "",
) -> MerchantProfile:
    if new_status not in ApprovalStatus.values:
        raise ValueError(f"Unsupported approval status: {new_status}")

    merchant.approval_status = new_status
    if new_status == ApprovalStatus.APPROVED:
        merchant.approved_at = timezone.now()
        merchant.rejection_reason = ""
        merchant.user.is_active = True
        merchant.user.save(update_fields=["is_active"])
    elif new_status in (ApprovalStatus.REJECTED, ApprovalStatus.SUSPENDED):
        merchant.rejection_reason = reason

    merchant.save()
    merchant.stores.update(
        approval_status=new_status,
        is_active=(new_status == ApprovalStatus.APPROVED),
    )
    return merchant
