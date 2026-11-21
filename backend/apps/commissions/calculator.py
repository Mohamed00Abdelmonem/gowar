from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

TWO_PLACES = Decimal("0.01")
HUNDRED = Decimal("100.00")


def to_money(val: Decimal | str | int) -> Decimal:
    return Decimal(str(val)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class OrderFinancialBreakdown:
    subtotal: Decimal
    delivery_fee: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    commission_rate: Decimal
    commission_amount: Decimal
    merchant_net_amount: Decimal


def calculate_order_financials(
    *,
    subtotal: Decimal,
    delivery_fee: Decimal,
    discount_amount: Decimal = Decimal("0.00"),
    commission_rate: Decimal,
) -> OrderFinancialBreakdown:
    sub = to_money(subtotal)
    fee = to_money(delivery_fee)
    disc = to_money(discount_amount)
    rate = to_money(commission_rate)

    commission_amount = (sub * rate / HUNDRED).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    total_amount = max(Decimal("0.00"), (sub + fee - disc).quantize(TWO_PLACES, rounding=ROUND_HALF_UP))
    # Merchant receives order subtotal minus Gowar platform commission (delivery is fulfilled directly by merchant)
    merchant_net_amount = max(
        Decimal("0.00"),
        (sub - commission_amount - disc).quantize(TWO_PLACES, rounding=ROUND_HALF_UP),
    )

    return OrderFinancialBreakdown(
        subtotal=sub,
        delivery_fee=fee,
        discount_amount=disc,
        total_amount=total_amount,
        commission_rate=rate,
        commission_amount=commission_amount,
        merchant_net_amount=merchant_net_amount,
    )


def calculate_refund_commission_reversal(
    *,
    order_subtotal: Decimal,
    commission_amount: Decimal,
    refund_amount: Decimal,
) -> Decimal:
    sub = to_money(order_subtotal)
    comm = to_money(commission_amount)
    ref = to_money(refund_amount)
    if sub <= Decimal("0.00") or ref <= Decimal("0.00"):
        return Decimal("0.00")
    ratio = min(Decimal("1.0000"), ref / sub)
    return (comm * ratio).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
