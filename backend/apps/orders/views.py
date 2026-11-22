from datetime import date, timedelta

from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User, UserRole
from apps.common.permissions import IsCustomer, IsDelivery, IsMerchant
from .models import Order, OrderStatusChoices
from .serializers import (
    AssignDeliveryInputSerializer,
    CreateOrderInputSerializer,
    DeliveryTransitionInputSerializer,
    OrderSerializer,
    OrderTransitionInputSerializer,
)
from .services import (
    assign_order_to_delivery,
    create_order_from_cart,
    transition_order_status,
)


class CustomerOrderListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsCustomer]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return (
            Order.objects.select_related("store", "customer")
            .prefetch_related("items", "status_history")
            .filter(customer=self.request.user)
        )

    def create(self, request, *args, **kwargs):
        serializer = CreateOrderInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            order = create_order_from_cart(
                customer=request.user,
                address_id=data.get("address_id"),
                delivery_address=data.get("delivery_address"),
                payment_method=data["payment_method"],
                customer_notes=data.get("customer_notes", ""),
                idempotency_key=data.get("idempotency_key") or None,
            )
        except DjangoValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class CustomerOrderDetailView(generics.RetrieveAPIView):
    permission_classes = [IsCustomer]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return (
            Order.objects.select_related("store", "customer")
            .prefetch_related("items", "status_history")
            .filter(customer=self.request.user)
        )


class CustomerOrderCancelView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request, pk):
        order = Order.objects.filter(pk=pk, customer=request.user).first()
        if not order:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            updated = transition_order_status(
                order_id=order.id,
                target_status="cancelled",
                actor=request.user,
                note=request.data.get("reason", "Cancelled by customer"),
            )
        except PermissionDenied as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except DjangoValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderSerializer(updated).data)


class MerchantOrderListView(generics.ListAPIView):
    permission_classes = [IsMerchant]
    serializer_class = OrderSerializer
    filterset_fields = ["order_status", "payment_status"]
    search_fields = ["order_number", "customer__first_name", "customer__phone_number"]

    def get_queryset(self):
        profile = getattr(self.request.user, "merchant_profile", None)
        if not profile:
            return Order.objects.none()
        return (
            Order.objects.select_related("store", "customer")
            .prefetch_related("items", "status_history")
            .filter(store__merchant=profile)
        )


class MerchantOrderDetailView(generics.RetrieveAPIView):
    permission_classes = [IsMerchant]
    serializer_class = OrderSerializer

    def get_queryset(self):
        profile = getattr(self.request.user, "merchant_profile", None)
        if not profile:
            return Order.objects.none()
        return (
            Order.objects.select_related("store", "customer")
            .prefetch_related("items", "status_history")
            .filter(store__merchant=profile)
        )


class MerchantOrderTransitionView(APIView):
    permission_classes = [IsMerchant]

    def post(self, request, pk):
        profile = getattr(request.user, "merchant_profile", None)
        order = Order.objects.filter(pk=pk).first()
        if not order:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
        if not profile or order.store.merchant_id != profile.id:
            return Response(
                {"detail": "You do not have permission to update this order."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = OrderTransitionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            updated = transition_order_status(
                order_id=order.id,
                target_status=serializer.validated_data["status"],
                actor=request.user,
                note=serializer.validated_data.get("note", ""),
                reject_reason=serializer.validated_data.get("reject_reason", ""),
            )
        except PermissionDenied as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except DjangoValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        return Response(OrderSerializer(updated).data)


class MerchantDeliveryDriversListView(APIView):
    permission_classes = [IsMerchant]

    def get(self, request):
        drivers = User.objects.filter(role=UserRole.DELIVERY, is_active=True).order_by(
            "first_name", "last_name"
        )
        return Response(
            [
                {
                    "id": str(d.id),
                    "full_name": d.full_name or d.email,
                    "phone_number": d.phone_number,
                    "email": d.email,
                }
                for d in drivers
            ]
        )


class MerchantAssignDeliveryView(APIView):
    permission_classes = [IsMerchant]

    def post(self, request, pk):
        profile = getattr(request.user, "merchant_profile", None)
        order = Order.objects.filter(pk=pk).first()
        if not order:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
        if not profile or order.store.merchant_id != profile.id:
            return Response(
                {"detail": "You do not have permission to assign this order."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AssignDeliveryInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        delivery_user = User.objects.filter(
            pk=serializer.validated_data["delivery_user_id"],
            role=UserRole.DELIVERY,
            is_active=True,
        ).first()
        if not delivery_user:
            return Response(
                {"detail": "Active delivery personnel account not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            updated = assign_order_to_delivery(
                order_id=order.id,
                delivery_user=delivery_user,
                actor=request.user,
            )
        except PermissionDenied as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except DjangoValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        return Response(OrderSerializer(updated).data)


class DeliverySummaryView(APIView):
    permission_classes = [IsDelivery]

    def get(self, request):
        base_qs = Order.objects.filter(assigned_delivery_person=request.user)
        return Response(
            {
                "new_assigned": base_qs.filter(
                    order_status__in=[
                        OrderStatusChoices.PENDING,
                        OrderStatusChoices.ACCEPTED,
                        OrderStatusChoices.PREPARING,
                        OrderStatusChoices.READY_FOR_DELIVERY,
                    ]
                ).count(),
                "ready_for_delivery": base_qs.filter(
                    order_status=OrderStatusChoices.READY_FOR_DELIVERY
                ).count(),
                "out_for_delivery": base_qs.filter(
                    order_status=OrderStatusChoices.OUT_FOR_DELIVERY
                ).count(),
                "delivered": base_qs.filter(
                    order_status=OrderStatusChoices.DELIVERED
                ).count(),
            }
        )


class DeliveryOrderListView(generics.ListAPIView):
    permission_classes = [IsDelivery]
    serializer_class = OrderSerializer
    filterset_fields = ["order_status"]
    search_fields = ["order_number", "customer__first_name", "customer__phone_number", "store__name"]

    def get_queryset(self):
        qs = (
            Order.objects.select_related("store", "customer", "assigned_delivery_person", "delivered_by")
            .prefetch_related("items", "status_history")
            .filter(assigned_delivery_person=self.request.user)
        )
        date_filter = self.request.query_params.get("date")
        if date_filter == "today":
            today = timezone.localdate()
            qs = qs.filter(created_at__date=today)
        elif date_filter == "week":
            week_ago = timezone.localdate() - timedelta(days=7)
            qs = qs.filter(created_at__date__gte=week_ago)
        elif date_filter:
            try:
                parsed_date = date.fromisoformat(date_filter)
                qs = qs.filter(created_at__date=parsed_date)
            except ValueError:
                pass
        return qs


class DeliveryOrderDetailView(generics.RetrieveAPIView):
    permission_classes = [IsDelivery]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return (
            Order.objects.select_related("store", "customer", "assigned_delivery_person", "delivered_by")
            .prefetch_related("items", "status_history")
            .filter(assigned_delivery_person=self.request.user)
        )


class DeliveryOrderTransitionView(APIView):
    permission_classes = [IsDelivery]

    def post(self, request, pk):
        order = Order.objects.filter(pk=pk).first()
        if not order:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
        if order.assigned_delivery_person_id != request.user.id:
            return Response(
                {"detail": "You do not have permission to access this order."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = DeliveryTransitionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            updated = transition_order_status(
                order_id=order.id,
                target_status=serializer.validated_data["status"],
                actor=request.user,
                note=serializer.validated_data.get("note", ""),
            )
        except PermissionDenied as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except DjangoValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        return Response(OrderSerializer(updated).data)
