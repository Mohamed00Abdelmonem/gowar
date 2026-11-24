import secrets
from decimal import Decimal
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from apps.cart.models import Cart
from apps.commissions.calculator import calculate_order_financials
from apps.commissions.models import CommissionRecord, CommissionStatus
from apps.inventory.services import deduct_stock_for_order, restock_for_cancelled_order
from apps.locations.models import CustomerAddress
from apps.merchants.models import ApprovalStatus
from apps.notifications.services import create_and_dispatch_notification
from apps.payments.services import get_payment_provider
from apps.stores.services import calculate_dynamic_delivery_quote
from .models import (
    DeliveryTripStatusChoices,
    Order,
    OrderItem,
    OrderStatusChoices,
    OrderStatusHistory,
)
from .transitions import validate_order_transition


def _generate_order_number() -> str:
    return f"GW-{secrets.randbelow(900000) + 100000}"


@transaction.atomic
def create_order_from_cart(
    *,
    customer,
    address_id=None,
    delivery_address: dict | None = None,
    payment_method: str = "cod",
    customer_notes: str = "",
    idempotency_key: str | None = None,
) -> Order:
    if idempotency_key:
        existing = Order.objects.filter(
            customer=customer, idempotency_key=idempotency_key
        ).first()
        if existing:
            return existing

    cart = (
        Cart.objects.select_for_update(of=("self",))
        .select_related("store", "store__merchant")
        .filter(customer=customer)
        .first()
    )
    if not cart or not cart.store_id:
        raise ValidationError("Your cart is empty.")

    cart_items = list(cart.items.select_related("product"))
    if not cart_items:
        raise ValidationError("Your cart has no items.")

    store = cart.store
    if not store.is_active or store.approval_status != ApprovalStatus.APPROVED:
        raise ValidationError("Selected store is not currently accepting orders.")
    if not store.is_open:
        raise ValidationError("This store is currently closed.")

    # Resolve authoritative delivery address & coordinates
    if address_id:
        addr = CustomerAddress.objects.filter(pk=address_id, customer=customer).first()
        if not addr:
            raise ValidationError("Selected delivery address was not found.")
        lat = float(addr.latitude)
        lng = float(addr.longitude)
        address_snapshot = {
            "address_id": str(addr.id),
            "area_id": str(addr.area_id) if addr.area_id else "",
            "label": addr.label,
            "recipient_name": addr.recipient_name or customer.full_name,
            "phone_number": addr.phone_number or customer.phone_number,
            "formatted_address": addr.formatted_address,
            "latitude": lat,
            "longitude": lng,
            "building_number": addr.building_number,
            "floor": addr.floor,
            "apartment": addr.apartment,
            "additional_instructions": addr.additional_instructions,
        }
    elif delivery_address:
        lat = float(delivery_address["latitude"])
        lng = float(delivery_address["longitude"])
        address_snapshot = {
            "area_id": str(delivery_address.get("area_id", "")),
            "label": delivery_address.get("label", "موقع مخصص"),
            "recipient_name": delivery_address.get("recipient_name") or customer.full_name,
            "phone_number": delivery_address.get("phone_number") or customer.phone_number,
            "formatted_address": delivery_address["formatted_address"],
            "latitude": lat,
            "longitude": lng,
            "building_number": delivery_address.get("building_number", ""),
            "floor": delivery_address.get("floor", ""),
            "apartment": delivery_address.get("apartment", ""),
            "additional_instructions": delivery_address.get("additional_instructions", ""),
        }
    else:
        raise ValidationError("A confirmed delivery address or coordinates must be provided.")

    # Calculate totals exclusively from live DB prices (never trust frontend numbers)
    subtotal = Decimal("0.00")
    items_qty_map: dict = {}
    prepared_items = []
    for ci in cart_items:
        prod = ci.product
        unit_price = prod.effective_price
        line_total = unit_price * ci.quantity
        subtotal += line_total
        items_qty_map[prod.id] = items_qty_map.get(prod.id, 0) + ci.quantity
        prepared_items.append(
            {
                "product": prod,
                "name": prod.name,
                "name_en": prod.name_en,
                "sku": prod.sku,
                "unit_price": unit_price,
                "quantity": ci.quantity,
                "line_total": line_total,
            }
        )

    if subtotal < store.minimum_order_amount:
        raise ValidationError(
            f"Minimum order for {store.name} is {store.minimum_order_amount} EGP."
        )

    # Strictly validate independent merchant delivery coverage & dynamic fee using PostGIS
    delivery_quote = calculate_dynamic_delivery_quote(store, lat, lng, subtotal=subtotal)
    if not delivery_quote["delivery_available"]:
        if delivery_quote["reason"] == "pickup_only":
            raise ValidationError(
                "This store does not offer delivery; only in-store pickup is available."
            )
        raise ValidationError(
            f"Delivery address ({delivery_quote['distance_km']} km) is outside {store.name}'s delivery coverage ({store.delivery_radius_km} km)."
        )

    delivery_fee = delivery_quote["delivery_fee"]

    financials = calculate_order_financials(
        subtotal=subtotal,
        delivery_fee=delivery_fee,
        discount_amount=Decimal("0.00"),
        commission_rate=store.commission_rate,
    )

    payment_provider = get_payment_provider(payment_method)

    order = Order.objects.create(
        order_number=_generate_order_number(),
        idempotency_key=idempotency_key,
        customer=customer,
        store=store,
        delivery_address_snapshot=address_snapshot,
        subtotal=financials.subtotal,
        delivery_fee=financials.delivery_fee,
        delivery_distance_km=delivery_quote["actual_distance_km"],
        billable_distance_km=delivery_quote["billable_km"],
        delivery_price_per_km_snapshot=delivery_quote["price_per_km"],
        discount_amount=financials.discount_amount,
        total_amount=financials.total_amount,
        commission_rate_snapshot=financials.commission_rate,
        commission_amount=financials.commission_amount,
        merchant_net_amount=financials.merchant_net_amount,
        payment_method=payment_method,
        payment_status="pending",
        order_status=OrderStatusChoices.PENDING,
        customer_notes=customer_notes,
        estimated_delivery_minutes=store.estimated_delivery_minutes,
    )

    # Atomic, locked inventory deduction
    deduct_stock_for_order(order, items_qty_map, performed_by=customer)

    OrderItem.objects.bulk_create(
        [
            OrderItem(
                order=order,
                product=item["product"],
                product_name_snapshot=item["name"],
                product_name_en_snapshot=item["name_en"],
                product_sku_snapshot=item["sku"],
                unit_price_snapshot=item["unit_price"],
                quantity=item["quantity"],
                line_total=item["line_total"],
            )
            for item in prepared_items
        ]
    )

    OrderStatusHistory.objects.create(
        order=order,
        status=OrderStatusChoices.PENDING,
        actor=customer,
        actor_name=customer.full_name,
        note=f"Order placed at {store.name}",
    )

    payment_provider.initialize_transaction(order)

    CommissionRecord.objects.create(
        order=order,
        store=store,
        currency="EGP",
        order_subtotal_snapshot=financials.subtotal,
        delivery_fee_snapshot=financials.delivery_fee,
        discount_snapshot=financials.discount_amount,
        order_total_snapshot=financials.total_amount,
        commission_rate_snapshot=financials.commission_rate,
        commission_amount=financials.commission_amount,
        merchant_net_amount=financials.merchant_net_amount,
        status=CommissionStatus.PENDING,
    )

    create_and_dispatch_notification(
        recipient=store.merchant.user,
        store=store,
        title=f"طلب جديد #{order.order_number}",
        body=f"طلب جديد بقيمة {order.total_amount} جنيه بانتظار قبولك",
        title_en="New Order Received",
        body_en=f"You have received a new order (#{order.order_number}). Open Gowar to view its details.",
        link=f"/merchant/orders/{order.id}",
        event_key=f"order-created-merchant-{order.id}",
    )

    create_and_dispatch_notification(
        recipient=customer,
        store=store,
        title=f"تم استلام طلبك #{order.order_number}",
        body=f"تم إرسال طلبك إلى {store.name} وبانتظار تأكيد المتجر",
        title_en=f"Order Received #{order.order_number}",
        body_en=f"Your order has been sent to {store.name_en or store.name} and is awaiting confirmation.",
        link=f"/orders/{order.id}",
        event_key=f"order-created-customer-{order.id}",
    )

    # Clear cart cleanly inside the same transaction
    cart.items.all().delete()
    cart.store = None
    cart.save(update_fields=["store", "updated_at"])

    return order


@transaction.atomic
def transition_order_status(
    *,
    order_id,
    target_status: str,
    actor,
    note: str = "",
    reject_reason: str = "",
) -> Order:
    order = (
        Order.objects.select_for_update(of=("self",))
        .select_related("store", "store__merchant", "customer")
        .get(pk=order_id)
    )

    if actor.role == "merchant":
        profile = getattr(actor, "merchant_profile", None)
        if not profile or order.store.merchant_id != profile.id:
            raise PermissionDenied("You cannot modify another merchant's order.")
    elif actor.role == "delivery":
        if order.assigned_delivery_person_id != actor.id:
            raise PermissionDenied("You can only update orders assigned to you.")
    elif actor.role == "customer" and order.customer_id != actor.id:
        raise PermissionDenied("You cannot modify another customer's order.")

    try:
        validate_order_transition(order.order_status, target_status, actor.role)
    except PermissionError as exc:
        raise PermissionDenied(str(exc)) from exc
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc

    order.order_status = target_status
    if reject_reason:
        order.reject_reason = reject_reason

    update_fields = ["order_status", "reject_reason", "updated_at"]

    if target_status == OrderStatusChoices.OUT_FOR_DELIVERY and order.assigned_delivery_person_id:
        order.delivery_trip_status = DeliveryTripStatusChoices.IN_TRANSIT
        update_fields.append("delivery_trip_status")
        if order.delivery_trip_accepted_at is None:
            order.delivery_trip_accepted_at = timezone.now()
            update_fields.append("delivery_trip_accepted_at")

    elif target_status == OrderStatusChoices.DELIVERED:
        if actor.role == "delivery" and order.delivery_trip_status in (
            DeliveryTripStatusChoices.UNASSIGNED,
            DeliveryTripStatusChoices.CANCELLED,
        ):
            raise ValidationError("Cannot complete an unassigned or cancelled delivery trip.")
        provider = get_payment_provider(order.payment_method)
        provider.mark_collected(order)
        order.payment_status = "paid"
        order.delivered_at = timezone.now()
        order.delivered_by = actor
        order.delivery_trip_status = DeliveryTripStatusChoices.COMPLETED
        update_fields.extend(["payment_status", "delivered_at", "delivered_by", "delivery_trip_status"])
        CommissionRecord.objects.filter(order=order).update(status=CommissionStatus.EARNED)

    elif target_status == OrderStatusChoices.CANCELLED:
        restock_for_cancelled_order(order, performed_by=actor)
        CommissionRecord.objects.filter(order=order).update(status=CommissionStatus.REVERSED)

    order.save(update_fields=update_fields)

    OrderStatusHistory.objects.create(
        order=order,
        status=target_status,
        actor=actor,
        actor_name=actor.full_name,
        note=note or reject_reason or f"Order status updated to {target_status}",
    )

    status_messages_ar = {
        OrderStatusChoices.ACCEPTED: ("تم قبول طلبك", "تم قبول طلبك من المتجر وجاري المتابعة"),
        OrderStatusChoices.PREPARING: ("جاري تجهيز طلبك", "جاري تجهيز طلبك الآن في المتجر"),
        OrderStatusChoices.READY_FOR_DELIVERY: ("طلبك جاهز للتوصيل", "طلبك جاهز وسيخرج للتوصيل قريباً"),
        OrderStatusChoices.OUT_FOR_DELIVERY: ("طلبك في الطريق إليك!", "طلبك خرج مع المندوب وهو في الطريق إليك"),
        OrderStatusChoices.DELIVERED: ("تم توصيل طلبك", "تم توصيل طلبك بالسلامة، نتمنى لك يوماً سعيداً"),
        OrderStatusChoices.CANCELLED: (
            "تم إلغاء الطلب",
            f"تم إلغاء الطلب{f' ({reject_reason})' if reject_reason else ''}",
        ),
    }
    status_messages_en = {
        OrderStatusChoices.ACCEPTED: ("Order Confirmed", f"Your order #{order.order_number} has been accepted by the store."),
        OrderStatusChoices.PREPARING: ("Preparing Your Order", f"Your order #{order.order_number} is now being prepared."),
        OrderStatusChoices.READY_FOR_DELIVERY: ("Order Ready for Delivery", f"Your order #{order.order_number} is packed and ready for delivery."),
        OrderStatusChoices.OUT_FOR_DELIVERY: ("Your Order Is On Its Way", "Your order is out for delivery!"),
        OrderStatusChoices.DELIVERED: ("Order Delivered", f"Your order #{order.order_number} has been delivered. Enjoy!"),
        OrderStatusChoices.CANCELLED: (
            "Order Cancelled",
            f"Your order #{order.order_number} was cancelled{f' ({reject_reason})' if reject_reason else ''}.",
        ),
    }
    title_ar, body_ar = status_messages_ar.get(
        target_status, (f"تحديث حالة الطلب #{order.order_number}", f"حالة طلبك الآن: {target_status}")
    )
    title_en, body_en = status_messages_en.get(
        target_status, (f"Order Update #{order.order_number}", f"Your order status is now: {target_status}")
    )
    create_and_dispatch_notification(
        recipient=order.customer,
        store=order.store,
        title=f"{title_ar} #{order.order_number}" if "#" not in title_ar else title_ar,
        body=body_ar,
        title_en=title_en,
        body_en=body_en,
        link=f"/orders/{order.id}",
        event_key=f"order-status-{order.id}-{target_status}",
    )
    if target_status == OrderStatusChoices.READY_FOR_DELIVERY and order.assigned_delivery_person_id:
        create_and_dispatch_notification(
            recipient=order.assigned_delivery_person,
            store=order.store,
            title=f"الطلب جاهز للاستلام #{order.order_number}",
            body=f"أصبح الطلب #{order.order_number} من {order.store.name} جاهزاً للاستلام والتوصيل",
            title_en=f"Order Ready for Pickup #{order.order_number}",
            body_en=f"Order #{order.order_number} from {order.store.name_en or order.store.name} is ready for pickup.",
            link=f"/delivery/orders/{order.id}",
            event_key=f"order-ready-delivery-{order.id}-{order.assigned_delivery_person_id}",
        )
    if target_status == OrderStatusChoices.CANCELLED:
        if actor.role == "customer":
            create_and_dispatch_notification(
                recipient=order.store.merchant.user,
                store=order.store,
                title=f"تم إلغاء الطلب #{order.order_number}",
                body=f"قام العميل بإلغاء الطلب #{order.order_number}",
                title_en=f"Order Cancelled #{order.order_number}",
                body_en=f"Order #{order.order_number} was cancelled by the customer.",
                link=f"/merchant/orders/{order.id}",
                event_key=f"order-cancelled-merchant-{order.id}",
            )
        if order.assigned_delivery_person_id and actor.role != "delivery":
            create_and_dispatch_notification(
                recipient=order.assigned_delivery_person,
                store=order.store,
                title=f"تم إلغاء الطلب #{order.order_number}",
                body=f"تم إلغاء الطلب #{order.order_number} المسند إليك",
                title_en=f"Assigned Order Cancelled #{order.order_number}",
                body_en=f"Order #{order.order_number} assigned to you was cancelled.",
                link=f"/delivery/orders/{order.id}",
                event_key=f"order-cancelled-delivery-{order.id}-{order.assigned_delivery_person_id}",
            )
    elif target_status == OrderStatusChoices.DELIVERED:
        create_and_dispatch_notification(
            recipient=order.store.merchant.user,
            store=order.store,
            title=f"تم تسليم الطلب #{order.order_number}",
            body=f"تم تسليم الطلب #{order.order_number} للعميل بنجاح",
            title_en=f"Order Delivered #{order.order_number}",
            body_en=f"Order #{order.order_number} has been delivered to the customer.",
            link=f"/merchant/orders/{order.id}",
            event_key=f"order-delivered-merchant-{order.id}",
        )
    return order


@transaction.atomic
def assign_order_to_delivery(*, order_id, delivery_user, actor) -> Order:
    order = (
        Order.objects.select_for_update(of=("self",))
        .select_related("store", "store__merchant", "customer")
        .get(pk=order_id)
    )

    if actor.role == "merchant":
        profile = getattr(actor, "merchant_profile", None)
        if not profile or order.store.merchant_id != profile.id:
            raise PermissionDenied("You cannot assign another merchant's order.")
    elif actor.role != "admin" and not getattr(actor, "is_superuser", False):
        raise PermissionDenied("Only merchants or admins can assign delivery personnel.")

    if order.order_status in (OrderStatusChoices.DELIVERED, OrderStatusChoices.CANCELLED):
        raise ValidationError("Cannot assign delivery to a completed or cancelled order.")

    if getattr(delivery_user, "role", None) != "delivery" or not delivery_user.is_active:
        raise ValidationError("Selected user is not an active delivery person.")

    previous_driver = order.assigned_delivery_person
    was_reassigned = (
        order.delivery_trip_status == DeliveryTripStatusChoices.CANCELLED
        or previous_driver is not None
    )
    now = timezone.now()
    order.assigned_delivery_person = delivery_user
    order.assigned_at = now
    order.delivery_trip_status = DeliveryTripStatusChoices.ASSIGNED
    order.delivery_trip_accepted_at = None
    order.delivery_trip_arrived_at = None
    order.delivery_trip_cancelled_at = None
    order.delivery_cancel_reason = ""
    order.save(
        update_fields=[
            "assigned_delivery_person",
            "assigned_at",
            "delivery_trip_status",
            "delivery_trip_accepted_at",
            "delivery_trip_arrived_at",
            "delivery_trip_cancelled_at",
            "delivery_cancel_reason",
            "updated_at",
        ]
    )

    OrderStatusHistory.objects.create(
        order=order,
        status=order.order_status,
        actor=actor,
        actor_name=actor.full_name,
        note=(
            f"Reassigned to delivery personnel: {delivery_user.full_name}"
            if was_reassigned
            else f"Assigned to delivery personnel: {delivery_user.full_name}"
        ),
    )

    assign_key = now.strftime("%Y%m%d%H%M%S%f")
    create_and_dispatch_notification(
        recipient=delivery_user,
        store=order.store,
        title=f"طلب توصيل جديد #{order.order_number}",
        body=f"تم إسناد الطلب #{order.order_number} من {order.store.name} للتوصيل",
        title_en=f"New Assigned Delivery #{order.order_number}",
        body_en=f"Order #{order.order_number} from {order.store.name_en or order.store.name} has been assigned to you.",
        link=f"/delivery/orders/{order.id}",
        event_key=f"order-assigned-delivery-{order.id}-{delivery_user.id}-{assign_key}",
    )
    create_and_dispatch_notification(
        recipient=order.customer,
        store=order.store,
        title=f"تم تعيين مندوب لطلبك #{order.order_number}",
        body=f"تم تعيين المندوب {delivery_user.full_name} لتوصيل طلبك #{order.order_number}",
        title_en=f"Driver Assigned #{order.order_number}",
        body_en=f"{delivery_user.full_name} has been assigned to deliver your order #{order.order_number}.",
        link=f"/orders/{order.id}",
        event_key=f"order-assigned-customer-{order.id}-{delivery_user.id}-{assign_key}",
    )
    if was_reassigned:
        create_and_dispatch_notification(
            recipient=order.store.merchant.user,
            store=order.store,
            title=f"تم تعيين مندوب جديد #{order.order_number}",
            body=f"تم إعادة إسناد الطلب #{order.order_number} إلى المندوب {delivery_user.full_name}",
            title_en=f"Driver Reassigned #{order.order_number}",
            body_en=f"Order #{order.order_number} has been reassigned to {delivery_user.full_name}.",
            link=f"/merchant/orders/{order.id}",
            event_key=f"order-reassigned-merchant-{order.id}-{delivery_user.id}-{assign_key}",
        )
        if previous_driver and previous_driver.id != delivery_user.id:
            create_and_dispatch_notification(
                recipient=previous_driver,
                store=order.store,
                title=f"تم إعادة إسناد الطلب #{order.order_number}",
                body=f"تم نقل توصيل الطلب #{order.order_number} إلى مندوب آخر",
                title_en=f"Order Reassigned #{order.order_number}",
                body_en=f"Order #{order.order_number} has been reassigned to another driver.",
                link="/delivery",
                event_key=f"order-reassigned-prev-driver-{order.id}-{previous_driver.id}-{assign_key}",
            )
    return order


@transaction.atomic
def accept_delivery_trip(*, order_id, actor) -> Order:
    order = (
        Order.objects.select_for_update(of=("self",))
        .select_related("store", "store__merchant", "customer")
        .get(pk=order_id)
    )

    if getattr(actor, "role", None) != "delivery":
        raise PermissionDenied("Only delivery personnel can accept delivery trips.")

    if order.assigned_delivery_person_id != actor.id:
        raise PermissionDenied("This delivery trip is not assigned to you.")

    if order.order_status in (OrderStatusChoices.DELIVERED, OrderStatusChoices.CANCELLED):
        raise ValidationError("Cannot accept a completed or cancelled order.")

    # Idempotent retry for already-accepted trip by the same driver
    if order.delivery_trip_status == DeliveryTripStatusChoices.ACCEPTED:
        return order

    if order.delivery_trip_status != DeliveryTripStatusChoices.ASSIGNED:
        raise ValidationError(
            f"Cannot accept trip from current trip status '{order.delivery_trip_status}'."
        )

    now = timezone.now()
    order.delivery_trip_status = DeliveryTripStatusChoices.ACCEPTED
    order.delivery_trip_accepted_at = now
    order.save(update_fields=["delivery_trip_status", "delivery_trip_accepted_at", "updated_at"])

    OrderStatusHistory.objects.create(
        order=order,
        status=order.order_status,
        actor=actor,
        actor_name=actor.full_name,
        note=f"Delivery trip accepted by {actor.full_name}",
    )

    assign_key = order.assigned_at.strftime("%Y%m%d%H%M%S%f") if order.assigned_at else now.strftime("%Y%m%d%H%M%S%f")
    create_and_dispatch_notification(
        recipient=order.store.merchant.user,
        store=order.store,
        title=f"المندوب قبل الرحلة #{order.order_number}",
        body=f"قبل المندوب {actor.full_name} رحلة توصيل الطلب #{order.order_number}",
        title_en=f"Trip Accepted #{order.order_number}",
        body_en=f"Driver {actor.full_name} accepted the delivery trip for order #{order.order_number}.",
        link=f"/merchant/orders/{order.id}",
        event_key=f"trip-accepted-merchant-{order.id}-{actor.id}-{assign_key}",
    )
    create_and_dispatch_notification(
        recipient=order.customer,
        store=order.store,
        title=f"المندوب قبل رحلة طلبك #{order.order_number}",
        body=f"المندوب {actor.full_name} قبل توصيل طلبك #{order.order_number} وسيبدأ التوجه إليك قريباً",
        title_en=f"Driver Accepted Trip #{order.order_number}",
        body_en=f"Driver {actor.full_name} accepted your delivery for order #{order.order_number}.",
        link=f"/orders/{order.id}",
        event_key=f"trip-accepted-customer-{order.id}-{actor.id}-{assign_key}",
    )
    return order


@transaction.atomic
def cancel_delivery_trip(*, order_id, actor, reason: str = "") -> Order:
    order = (
        Order.objects.select_for_update(of=("self",))
        .select_related("store", "store__merchant", "customer")
        .get(pk=order_id)
    )

    if getattr(actor, "role", None) != "delivery":
        raise PermissionDenied("Only delivery personnel can cancel delivery trips.")

    if order.assigned_delivery_person_id != actor.id:
        raise PermissionDenied("You can only cancel delivery trips currently assigned to you.")

    if (
        order.order_status in (OrderStatusChoices.DELIVERED, OrderStatusChoices.CANCELLED)
        or order.delivery_trip_status == DeliveryTripStatusChoices.COMPLETED
    ):
        raise ValidationError("Cannot cancel a completed or cancelled order.")

    now = timezone.now()
    clean_reason = reason.strip()[:255]
    order.assigned_delivery_person = None
    order.delivery_trip_status = DeliveryTripStatusChoices.CANCELLED
    order.delivery_trip_accepted_at = None
    order.delivery_trip_arrived_at = None
    order.delivery_trip_cancelled_at = now
    order.delivery_cancel_reason = clean_reason

    update_fields = [
        "assigned_delivery_person",
        "delivery_trip_status",
        "delivery_trip_accepted_at",
        "delivery_trip_arrived_at",
        "delivery_trip_cancelled_at",
        "delivery_cancel_reason",
        "updated_at",
    ]
    # Keep customer order active; if already out_for_delivery, return to ready_for_delivery for reassignment
    if order.order_status == OrderStatusChoices.OUT_FOR_DELIVERY:
        order.order_status = OrderStatusChoices.READY_FOR_DELIVERY
        update_fields.append("order_status")

    order.save(update_fields=update_fields)

    OrderStatusHistory.objects.create(
        order=order,
        status=order.order_status,
        actor=actor,
        actor_name=actor.full_name,
        note=(
            f"Delivery trip cancelled by {actor.full_name}: {clean_reason}"
            if clean_reason
            else f"Delivery trip cancelled by {actor.full_name}"
        ),
    )

    cancel_key = now.strftime("%Y%m%d%H%M%S%f")
    create_and_dispatch_notification(
        recipient=order.store.merchant.user,
        store=order.store,
        title=f"ألغى المندوب الرحلة #{order.order_number}",
        body=(
            f"ألغى المندوب {actor.full_name} توصيل الطلب #{order.order_number}"
            f"{f' ({clean_reason})' if clean_reason else ''}. يمكنك إسناد الطلب لمندوب آخر."
        ),
        title_en=f"Delivery Trip Cancelled #{order.order_number}",
        body_en=(
            f"Driver {actor.full_name} cancelled the trip for order #{order.order_number}"
            f"{f' ({clean_reason})' if clean_reason else ''}. Please reassign another driver."
        ),
        link=f"/merchant/orders/{order.id}",
        event_key=f"trip-cancelled-merchant-{order.id}-{actor.id}-{cancel_key}",
    )
    return order


@transaction.atomic
def arrive_delivery_trip(*, order_id, actor) -> Order:
    order = (
        Order.objects.select_for_update(of=("self",))
        .select_related("store", "store__merchant", "customer")
        .get(pk=order_id)
    )

    if getattr(actor, "role", None) != "delivery":
        raise PermissionDenied("Only delivery personnel can confirm arrival.")

    if order.assigned_delivery_person_id != actor.id:
        raise PermissionDenied("This delivery trip is not assigned to you.")

    if order.order_status != OrderStatusChoices.OUT_FOR_DELIVERY:
        raise ValidationError("Order must be out for delivery before confirming arrival.")

    # Idempotent retry
    if order.delivery_trip_status == DeliveryTripStatusChoices.ARRIVED:
        return order

    if order.delivery_trip_status not in (
        DeliveryTripStatusChoices.ACCEPTED,
        DeliveryTripStatusChoices.IN_TRANSIT,
    ):
        raise ValidationError(
            f"Cannot confirm arrival from current trip status '{order.delivery_trip_status}'."
        )

    now = timezone.now()
    order.delivery_trip_status = DeliveryTripStatusChoices.ARRIVED
    order.delivery_trip_arrived_at = now
    order.save(update_fields=["delivery_trip_status", "delivery_trip_arrived_at", "updated_at"])

    OrderStatusHistory.objects.create(
        order=order,
        status=order.order_status,
        actor=actor,
        actor_name=actor.full_name,
        note=f"Delivery person {actor.full_name} arrived at customer location",
    )

    arrive_key = order.assigned_at.strftime("%Y%m%d%H%M%S%f") if order.assigned_at else now.strftime("%Y%m%d%H%M%S%f")
    create_and_dispatch_notification(
        recipient=order.customer,
        store=order.store,
        title=f"المندوب وصل إليك #{order.order_number}",
        body=f"وصل المندوب {actor.full_name} إلى موقع التوصيل الخاص بطلبك #{order.order_number}",
        title_en=f"Driver Arrived #{order.order_number}",
        body_en=f"Driver {actor.full_name} has arrived at your delivery location for order #{order.order_number}.",
        link=f"/orders/{order.id}",
        event_key=f"trip-arrived-customer-{order.id}-{actor.id}-{arrive_key}",
    )
    create_and_dispatch_notification(
        recipient=order.store.merchant.user,
        store=order.store,
        title=f"وصل المندوب للعميل #{order.order_number}",
        body=f"وصل المندوب {actor.full_name} لموقع عميل الطلب #{order.order_number}",
        title_en=f"Driver Arrived at Customer #{order.order_number}",
        body_en=f"Driver {actor.full_name} arrived at the customer's location for order #{order.order_number}.",
        link=f"/merchant/orders/{order.id}",
        event_key=f"trip-arrived-merchant-{order.id}-{actor.id}-{arrive_key}",
    )
    return order
