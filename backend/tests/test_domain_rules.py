from decimal import Decimal
import pytest

from apps.commissions.calculator import (
    calculate_order_financials,
    calculate_refund_commission_reversal,
)
from apps.locations.validators import (
    DEFAULT_RADIUS_KM,
    validate_coordinates,
    validate_search_radius_km,
)
from apps.orders.transitions import validate_order_transition


def test_order_state_machine_valid_and_invalid_transitions():
    validate_order_transition("pending", "accepted", "merchant")
    validate_order_transition("accepted", "preparing", "merchant")
    validate_order_transition("preparing", "ready_for_delivery", "merchant")
    validate_order_transition("ready_for_delivery", "out_for_delivery", "merchant")
    validate_order_transition("out_for_delivery", "delivered", "merchant")

    # Skipping steps must fail
    with pytest.raises(ValueError):
        validate_order_transition("pending", "delivered", "merchant")

    # Delivered orders cannot be cancelled
    with pytest.raises(ValueError):
        validate_order_transition("delivered", "cancelled", "admin")

    # Customers can only cancel while pending
    validate_order_transition("pending", "cancelled", "customer")
    with pytest.raises(PermissionError):
        validate_order_transition("preparing", "cancelled", "customer")
    with pytest.raises(PermissionError):
        validate_order_transition("pending", "accepted", "customer")


def test_decimal_commission_and_refund_calculations():
    fin = calculate_order_financials(
        subtotal=Decimal("306.00"),
        delivery_fee=Decimal("15.00"),
        discount_amount=Decimal("0.00"),
        commission_rate=Decimal("5.00"),
    )
    assert fin.commission_amount == Decimal("15.30")
    assert fin.total_amount == Decimal("321.00")
    assert fin.merchant_net_amount == Decimal("290.70")

    reversed_full = calculate_refund_commission_reversal(
        order_subtotal=fin.subtotal,
        commission_amount=fin.commission_amount,
        refund_amount=Decimal("306.00"),
    )
    assert reversed_full == Decimal("15.30")

    reversed_half = calculate_refund_commission_reversal(
        order_subtotal=Decimal("200.00"),
        commission_amount=Decimal("10.00"),
        refund_amount=Decimal("100.00"),
    )
    assert reversed_half == Decimal("5.00")


def test_coordinate_and_radius_validators():
    assert DEFAULT_RADIUS_KM == 3
    lat, lng = validate_coordinates(30.0566, 31.3376)
    assert lat == pytest.approx(30.0566)
    assert lng == pytest.approx(31.3376)

    with pytest.raises(ValueError):
        validate_coordinates(95.0, 31.0)
    with pytest.raises(ValueError):
        validate_coordinates(30.0, 190.0)
    with pytest.raises(ValueError):
        validate_coordinates("abc", "def")

    assert validate_search_radius_km(3) == 3
    assert validate_search_radius_km("10") == 10
    with pytest.raises(ValueError):
        validate_search_radius_km(0)
    with pytest.raises(ValueError):
        validate_search_radius_km(25)
