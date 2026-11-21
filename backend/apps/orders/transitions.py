ORDER_STATUS_PENDING = "pending"
ORDER_STATUS_ACCEPTED = "accepted"
ORDER_STATUS_PREPARING = "preparing"
ORDER_STATUS_READY = "ready_for_delivery"
ORDER_STATUS_OUT = "out_for_delivery"
ORDER_STATUS_DELIVERED = "delivered"
ORDER_STATUS_CANCELLED = "cancelled"

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    ORDER_STATUS_PENDING: {ORDER_STATUS_ACCEPTED, ORDER_STATUS_CANCELLED},
    ORDER_STATUS_ACCEPTED: {ORDER_STATUS_PREPARING, ORDER_STATUS_CANCELLED},
    ORDER_STATUS_PREPARING: {ORDER_STATUS_READY, ORDER_STATUS_CANCELLED},
    ORDER_STATUS_READY: {ORDER_STATUS_OUT},
    ORDER_STATUS_OUT: {ORDER_STATUS_DELIVERED},
    ORDER_STATUS_DELIVERED: set(),
    ORDER_STATUS_CANCELLED: set(),
}


def validate_order_transition(current_status: str, target_status: str, actor_role: str) -> None:
    if target_status not in ALLOWED_TRANSITIONS.get(current_status, set()):
        raise ValueError(
            f"Invalid order transition from '{current_status}' to '{target_status}'."
        )

    if actor_role == "customer":
        if not (current_status == ORDER_STATUS_PENDING and target_status == ORDER_STATUS_CANCELLED):
            raise PermissionError(
                "Customers may only cancel orders while they are still pending store acceptance."
            )
    elif actor_role == "merchant":
        # Merchants can process the full fulfillment workflow up to delivery or cancel before dispatch
        return
    elif actor_role == "admin":
        return
    else:
        raise PermissionError("Unauthorized actor role for order transition.")
