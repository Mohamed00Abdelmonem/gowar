from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .calculator import calculate_refund_commission_reversal
from .models import CommissionRecord, CommissionStatus, RefundRecord


@transaction.atomic
def process_order_refund(
    *,
    order,
    refund_amount: Decimal,
    reason: str,
    processed_by,
) -> RefundRecord:
    record = CommissionRecord.objects.select_for_update().get(order=order)
    if refund_amount <= Decimal("0.00") or refund_amount > order.total_amount:
        raise ValidationError("Invalid refund amount.")

    reversed_comm = calculate_refund_commission_reversal(
        order_subtotal=record.order_subtotal_snapshot,
        commission_amount=record.commission_amount,
        refund_amount=refund_amount,
    )

    next_reversed = min(record.commission_amount, record.reversed_commission_amount + reversed_comm)
    record.reversed_commission_amount = next_reversed
    if next_reversed >= record.commission_amount:
        record.status = CommissionStatus.REVERSED
    record.save(update_fields=["reversed_commission_amount", "status", "updated_at"])

    order.payment_status = "refunded"
    order.save(update_fields=["payment_status", "updated_at"])

    return RefundRecord.objects.create(
        order=order,
        commission_record=record,
        amount=refund_amount,
        commission_reversed=reversed_comm,
        reason=reason,
        processed_by=processed_by,
    )


@transaction.atomic
def settle_commission_record(record_id) -> CommissionRecord:
    record = CommissionRecord.objects.select_for_update().get(pk=record_id)
    if record.status != CommissionStatus.EARNED:
        raise ValidationError("Only earned commission records can be marked settled.")
    record.status = CommissionStatus.SETTLED
    record.settled_at = timezone.now()
    record.save(update_fields=["status", "settled_at", "updated_at"])
    return record
