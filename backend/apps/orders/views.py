from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsCustomer, IsMerchant
from .models import Order
from .serializers import (
    CreateOrderInputSerializer,
    OrderSerializer,
    OrderTransitionInputSerializer,
)
from .services import create_order_from_cart, transition_order_status


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
