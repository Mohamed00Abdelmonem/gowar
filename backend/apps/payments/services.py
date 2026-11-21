from abc import ABC, abstractmethod
from django.utils import timezone
from .models import PaymentMethodChoices, PaymentStatusChoices, PaymentTransaction


class BasePaymentProvider(ABC):
    provider_name: str

    @abstractmethod
    def initialize_transaction(self, order) -> PaymentTransaction:
        raise NotImplementedError

    @abstractmethod
    def mark_collected(self, order) -> PaymentTransaction | None:
        raise NotImplementedError


class CashOnDeliveryProvider(BasePaymentProvider):
    provider_name = "cash_on_delivery"

    def initialize_transaction(self, order) -> PaymentTransaction:
        return PaymentTransaction.objects.create(
            order=order,
            payment_method=PaymentMethodChoices.COD,
            status=PaymentStatusChoices.PENDING,
            amount=order.total_amount,
            currency="EGP",
            provider_name=self.provider_name,
        )

    def mark_collected(self, order) -> PaymentTransaction | None:
        tx = order.payment_transactions.first()
        if tx and tx.status == PaymentStatusChoices.PENDING:
            tx.status = PaymentStatusChoices.PAID
            tx.paid_at = timezone.now()
            tx.save(update_fields=["status", "paid_at", "updated_at"])
        return tx


def get_payment_provider(payment_method: str) -> BasePaymentProvider:
    if payment_method == PaymentMethodChoices.COD:
        return CashOnDeliveryProvider()
    raise ValueError(
        f"Payment method '{payment_method}' is not configured. Only Cash on Delivery (cod) is currently active."
    )
