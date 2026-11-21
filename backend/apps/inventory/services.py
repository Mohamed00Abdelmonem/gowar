from django.core.exceptions import ValidationError
from django.db import transaction

from apps.catalog.models import Product
from .models import InventoryMovement, MovementType


@transaction.atomic
def set_product_stock(
    *,
    product_id,
    new_quantity: int,
    performed_by=None,
    note: str = "",
) -> InventoryMovement:
    if new_quantity < 0:
        raise ValidationError("Stock quantity cannot be negative.")

    product = Product.objects.select_for_update().get(pk=product_id)
    prev_qty = product.stock_quantity
    delta = new_quantity - prev_qty

    product.stock_quantity = new_quantity
    product.is_available = new_quantity > 0
    product.save(update_fields=["stock_quantity", "is_available", "updated_at"])

    return InventoryMovement.objects.create(
        product=product,
        store=product.store,
        movement_type=MovementType.ADJUSTMENT,
        quantity=delta,
        previous_quantity=prev_qty,
        new_quantity=new_quantity,
        reference_type="manual_adjustment",
        reference_id=str(product.id),
        note=note or f"Manual stock adjustment from {prev_qty} to {new_quantity}",
        performed_by=performed_by,
    )


@transaction.atomic
def adjust_product_stock_delta(
    *,
    product_id,
    delta: int,
    movement_type: str = MovementType.STOCK_IN,
    reference_type: str = "manual",
    reference_id: str = "",
    performed_by=None,
    note: str = "",
) -> InventoryMovement:
    product = Product.objects.select_for_update().get(pk=product_id)
    prev_qty = product.stock_quantity
    next_qty = prev_qty + delta
    if next_qty < 0:
        raise ValidationError(
            f"Insufficient stock for {product.name}: available {prev_qty}, requested reduction {abs(delta)}."
        )

    product.stock_quantity = next_qty
    product.is_available = next_qty > 0
    product.save(update_fields=["stock_quantity", "is_available", "updated_at"])

    return InventoryMovement.objects.create(
        product=product,
        store=product.store,
        movement_type=movement_type,
        quantity=delta,
        previous_quantity=prev_qty,
        new_quantity=next_qty,
        reference_type=reference_type,
        reference_id=reference_id,
        note=note,
        performed_by=performed_by,
    )


@transaction.atomic
def deduct_stock_for_order(order, items_qty_map: dict, performed_by=None) -> list[InventoryMovement]:
    """
    Atomically locks products in deterministic UUID order to avoid deadlocks,
    verifies sufficient stock, and creates idempotent order_deduction movements.
    """
    order_ref = str(order.id)
    if InventoryMovement.objects.filter(
        reference_type="order",
        reference_id=order_ref,
        movement_type=MovementType.ORDER_DEDUCTION,
    ).exists():
        # Prevent duplicate deductions if called twice for the same order
        return []

    product_ids = sorted(items_qty_map.keys(), key=str)
    locked_products = {
        p.id: p
        for p in Product.objects.select_for_update().filter(id__in=product_ids).order_by("id")
    }

    movements: list[InventoryMovement] = []
    for pid in product_ids:
        qty = int(items_qty_map[pid])
        product = locked_products.get(pid)
        if not product:
            raise ValidationError(f"Product {pid} no longer exists.")
        if not product.is_active or not product.is_available:
            raise ValidationError(f"Product '{product.name}' is currently unavailable.")
        if product.stock_quantity < qty:
            raise ValidationError(
                f"Insufficient stock for '{product.name}': requested {qty}, available {product.stock_quantity}."
            )

        prev_qty = product.stock_quantity
        next_qty = prev_qty - qty
        product.stock_quantity = next_qty
        product.is_available = next_qty > 0
        product.save(update_fields=["stock_quantity", "is_available", "updated_at"])

        movements.append(
            InventoryMovement.objects.create(
                product=product,
                store=order.store,
                movement_type=MovementType.ORDER_DEDUCTION,
                quantity=-qty,
                previous_quantity=prev_qty,
                new_quantity=next_qty,
                reference_type="order",
                reference_id=order_ref,
                idempotency_key=f"deduct:{order_ref}:{pid}",
                note=f"Deducted for order #{order.order_number}",
                performed_by=performed_by,
            )
        )
    return movements


@transaction.atomic
def restock_for_cancelled_order(order, performed_by=None) -> list[InventoryMovement]:
    """
    Idempotently restores deducted stock when an order is cancelled.
    """
    order_ref = str(order.id)
    if InventoryMovement.objects.filter(
        reference_type="order",
        reference_id=order_ref,
        movement_type=MovementType.ORDER_RESTOCK,
    ).exists():
        return []

    deductions = InventoryMovement.objects.filter(
        reference_type="order",
        reference_id=order_ref,
        movement_type=MovementType.ORDER_DEDUCTION,
    )
    if not deductions.exists():
        return []

    product_ids = sorted([d.product_id for d in deductions], key=str)
    locked_products = {
        p.id: p
        for p in Product.objects.select_for_update().filter(id__in=product_ids).order_by("id")
    }

    movements: list[InventoryMovement] = []
    for ded in deductions:
        restore_qty = abs(ded.quantity)
        product = locked_products.get(ded.product_id)
        if not product:
            continue
        prev_qty = product.stock_quantity
        next_qty = prev_qty + restore_qty
        product.stock_quantity = next_qty
        product.is_available = next_qty > 0
        product.save(update_fields=["stock_quantity", "is_available", "updated_at"])

        movements.append(
            InventoryMovement.objects.create(
                product=product,
                store=order.store,
                movement_type=MovementType.ORDER_RESTOCK,
                quantity=restore_qty,
                previous_quantity=prev_qty,
                new_quantity=next_qty,
                reference_type="order",
                reference_id=order_ref,
                idempotency_key=f"restock:{order_ref}:{product.id}",
                note=f"Restocked due to cancellation of order #{order.order_number}",
                performed_by=performed_by,
            )
        )
    return movements
