from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsCustomer
from .serializers import AddCartItemSerializer, CartSerializer, UpdateCartItemSerializer
from .services import (
    CartStoreConflictError,
    add_item_to_cart,
    clear_cart,
    get_or_create_customer_cart,
    update_cart_item_quantity,
)


class CustomerCartView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        cart = get_or_create_customer_cart(request.user)
        return Response(CartSerializer(cart).data)

    def delete(self, request):
        cart = clear_cart(customer=request.user)
        return Response(CartSerializer(cart).data)


class CartItemsAddView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request):
        serializer = AddCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            cart = add_item_to_cart(
                customer=request.user,
                product_id=serializer.validated_data["product_id"],
                quantity=serializer.validated_data["quantity"],
                replace_cart=serializer.validated_data["replace_cart"],
            )
        except CartStoreConflictError as exc:
            return Response(
                {
                    "error": True,
                    "code": "STORE_CONFLICT",
                    "detail": str(exc),
                    "current_store_id": str(exc.current_store.id),
                    "current_store_name": exc.current_store.name,
                    "new_store_id": str(exc.new_store.id),
                    "new_store_name": exc.new_store.name,
                },
                status=status.HTTP_409_CONFLICT,
            )
        except DjangoValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        return Response(CartSerializer(cart).data, status=status.HTTP_200_OK)


class CartItemUpdateDeleteView(APIView):
    permission_classes = [IsCustomer]

    def patch(self, request, product_id):
        serializer = UpdateCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            cart = update_cart_item_quantity(
                customer=request.user,
                product_id=product_id,
                quantity=serializer.validated_data["quantity"],
            )
        except DjangoValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CartSerializer(cart).data)

    def delete(self, request, product_id):
        try:
            cart = update_cart_item_quantity(
                customer=request.user,
                product_id=product_id,
                quantity=0,
            )
        except DjangoValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CartSerializer(cart).data)
