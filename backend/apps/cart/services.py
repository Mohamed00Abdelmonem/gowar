from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import transaction

from apps.catalog.models import Product
from apps.merchants.models import ApprovalStatus
from .models import Cart, CartItem


class CartStoreConflictError(Exception):
    def __init__(self, current_store, new_store):
        self.current_store = current_store
        self.new_store = new_store
        super().__init__(
            f"Cart already contains items from {current_store.name}. Clear or replace cart before ordering from {new_store.name}."
        )


def get_or_create_customer_cart(customer) -> Cart:
    cart, _ = Cart.objects.get_or_create(customer=customer)
    return cart


@transaction.atomic
def add_item_to_cart(
    *,
    customer,
    product_id,
    quantity: int = 1,
    replace_cart: bool = False,
) -> Cart:
    if quantity <= 0:
        raise ValidationError("Quantity must be at least 1.")

    product = Product.objects.select_related("store").filter(pk=product_id).first()
    if not product or not product.is_active or not product.is_available:
        raise ValidationError("This product is currently unavailable.")

    store = product.store
    if not store.is_active or store.approval_status != ApprovalStatus.APPROVED:
        raise ValidationError("This store is not currently active.")

    cart, _ = Cart.objects.select_for_update().get_or_create(customer=customer)

    if cart.store_id and cart.store_id != store.id and cart.items.exists():
        if not replace_cart:
            raise CartStoreConflictError(cart.store, store)
        cart.items.all().delete()

    if cart.store_id != store.id:
        cart.store = store
        cart.save(update_fields=["store", "updated_at"])

    existing = CartItem.objects.filter(cart=cart, product=product).first()
    next_qty = (existing.quantity if existing else 0) + quantity
    if next_qty > product.stock_quantity:
        raise ValidationError(
            f"Only {product.stock_quantity} units of '{product.name}' are available in stock."
        )

    if existing:
        existing.quantity = next_qty
        existing.save(update_fields=["quantity", "updated_at"])
    else:
        CartItem.objects.create(cart=cart, product=product, quantity=quantity)

    return cart


@transaction.atomic
def update_cart_item_quantity(*, customer, product_id, quantity: int) -> Cart:
    cart, _ = Cart.objects.select_for_update().get_or_create(customer=customer)
    item = CartItem.objects.select_related("product").filter(
        cart=cart, product_id=product_id
    ).first()
    if not item:
        raise ValidationError("Item not found in cart.")

    if quantity <= 0:
        item.delete()
        if not cart.items.exists():
            cart.store = None
            cart.save(update_fields=["store", "updated_at"])
        return cart

    if not item.product.is_active or not item.product.is_available:
        raise ValidationError("This product is no longer available.")
    if quantity > item.product.stock_quantity:
        raise ValidationError(
            f"Requested quantity exceeds available stock ({item.product.stock_quantity})."
        )

    item.quantity = quantity
    item.save(update_fields=["quantity", "updated_at"])
    return cart


@transaction.atomic
def clear_cart(*, customer) -> Cart:
    cart, _ = Cart.objects.select_for_update().get_or_create(customer=customer)
    cart.items.all().delete()
    cart.store = None
    cart.save(update_fields=["store", "updated_at"])
    return cart


def calculate_cart_summary(cart: Cart) -> dict:
    items = list(cart.items.select_related("product", "product__category"))
    subtotal = Decimal("0.00")
    for ci in items:
        subtotal += ci.product.effective_price * ci.quantity

    store = cart.store
    delivery_fee = Decimal("0.00")
    if store and store.delivery_enabled:
        if store.free_delivery_threshold and subtotal >= store.free_delivery_threshold:
            delivery_fee = Decimal("0.00")
        else:
            delivery_fee = store.delivery_fee

    return {
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "total": subtotal + delivery_fee,
        "items": items,
    }
