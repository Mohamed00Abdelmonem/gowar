from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response

from apps.common.permissions import IsCustomer
from apps.orders.models import Order, OrderStatusChoices
from .models import StoreReview


class StoreReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)

    class Meta:
        model = StoreReview
        fields = ["id", "store", "order", "customer_name", "rating", "comment", "created_at"]
        read_only_fields = ["id", "store", "customer_name", "created_at"]


class StoreReviewListCreateView(generics.ListCreateAPIView):
    serializer_class = StoreReviewSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsCustomer()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        qs = StoreReview.objects.select_related("customer", "store")
        store_id = self.request.query_params.get("store")
        if store_id:
            qs = qs.filter(store_id=store_id)
        return qs

    def create(self, request, *args, **kwargs):
        order_id = request.data.get("order")
        order = Order.objects.filter(pk=order_id, customer=request.user).first()
        if not order:
            return Response(
                {"detail": "Eligible order not found for review."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if order.order_status != OrderStatusChoices.DELIVERED:
            return Response(
                {"detail": "Only delivered orders can be reviewed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if hasattr(order, "review"):
            return Response(
                {"detail": "This order has already been reviewed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(customer=request.user, store=order.store, order=order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
