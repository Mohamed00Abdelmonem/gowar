from decimal import Decimal
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count
from rest_framework import generics, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User, UserRole
from apps.catalog.models import Category
from apps.catalog.serializers import CategorySerializer
from apps.commissions.models import CommissionRecord
from apps.commissions.services import process_order_refund, settle_commission_record
from apps.common.permissions import IsMerchant, IsPlatformAdmin
from apps.locations.models import Area
from apps.locations.serializers import AreaSerializer
from apps.merchants.models import MerchantProfile
from apps.merchants.services import update_merchant_approval
from apps.orders.models import Order
from apps.orders.serializers import OrderSerializer
from apps.platform_settings.models import PlatformSettings
from apps.stores.models import Store
from .services import (
    get_admin_per_store_financial_report,
    get_admin_platform_overview,
    get_merchant_analytics,
    get_merchant_customers,
    get_merchant_overview,
)


class MerchantOverviewView(APIView):
    permission_classes = [IsMerchant]

    def get(self, request):
        profile = getattr(request.user, "merchant_profile", None)
        store = profile.stores.first() if profile else None
        if not store:
            return Response({"detail": "Store not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(get_merchant_overview(store))


class MerchantAnalyticsView(APIView):
    permission_classes = [IsMerchant]

    def get(self, request):
        profile = getattr(request.user, "merchant_profile", None)
        store = profile.stores.first() if profile else None
        if not store:
            return Response({"detail": "Store not found."}, status=status.HTTP_404_NOT_FOUND)
        preset = request.query_params.get("preset", "30d")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        granularity = request.query_params.get("granularity", "daily")
        return Response(get_merchant_analytics(store, preset, date_from, date_to, granularity))


class MerchantCustomersView(APIView):
    permission_classes = [IsMerchant]

    def get(self, request):
        profile = getattr(request.user, "merchant_profile", None)
        store = profile.stores.first() if profile else None
        if not store:
            return Response({"detail": "Store not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"results": get_merchant_customers(store)})


# ==================== SUPER ADMIN APIs ====================


class AdminOverviewView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        preset = request.query_params.get("preset", "30d")
        return Response(
            get_admin_platform_overview(
                preset=preset,
                date_from=request.query_params.get("date_from"),
                date_to=request.query_params.get("date_to"),
            )
        )


class AdminFinancialReportView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        preset = request.query_params.get("preset", "30d")
        rows = get_admin_per_store_financial_report(
            preset=preset,
            date_from=request.query_params.get("date_from"),
            date_to=request.query_params.get("date_to"),
        )
        return Response({"currency": "EGP", "preset": preset, "stores": rows})


class AdminMerchantSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="user.full_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    phone_number = serializers.CharField(source="user.phone_number", read_only=True)
    stores = serializers.SerializerMethodField()

    class Meta:
        model = MerchantProfile
        fields = [
            "id",
            "merchant_code",
            "business_name",
            "owner_name",
            "email",
            "phone_number",
            "approval_status",
            "approved_at",
            "rejection_reason",
            "created_at",
            "stores",
        ]

    def get_stores(self, obj: MerchantProfile):
        return [
            {
                "id": str(s.id),
                "name": s.name,
                "name_en": s.name_en,
                "store_type": s.store_type,
                "address": s.address,
                "is_open": s.is_open,
                "is_active": s.is_active,
                "approval_status": s.approval_status,
                "commission_rate": str(s.commission_rate),
                "delivery_radius_km": str(s.delivery_radius_km),
                "delivery_fee": str(s.delivery_fee),
                "rating": str(s.rating),
            }
            for s in obj.stores.all()
        ]


class AdminMerchantListView(generics.ListAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = AdminMerchantSerializer
    filterset_fields = ["approval_status"]
    search_fields = ["business_name", "user__email", "user__first_name", "user__phone_number"]
    queryset = MerchantProfile.objects.select_related("user").prefetch_related("stores")


class AdminMerchantDetailView(generics.RetrieveAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = AdminMerchantSerializer
    queryset = MerchantProfile.objects.select_related("user").prefetch_related("stores")


class AdminMerchantStatusActionView(APIView):
    permission_classes = [IsPlatformAdmin]

    def post(self, request, pk):
        merchant = MerchantProfile.objects.filter(pk=pk).first()
        if not merchant:
            return Response({"detail": "Merchant not found."}, status=status.HTTP_404_NOT_FOUND)
        action = request.data.get("status")
        reason = request.data.get("reason", "")
        try:
            updated = update_merchant_approval(merchant, action, reason)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(AdminMerchantSerializer(updated).data)


class AdminStoreCommissionUpdateView(APIView):
    permission_classes = [IsPlatformAdmin]

    def patch(self, request, pk):
        store = Store.objects.filter(pk=pk).first()
        if not store:
            return Response({"detail": "Store not found."}, status=status.HTTP_404_NOT_FOUND)
        raw_rate = request.data.get("commission_rate")
        try:
            rate = Decimal(str(raw_rate))
            if rate < Decimal("0") or rate > Decimal("50"):
                raise ValueError()
        except Exception:
            return Response(
                {"detail": "Commission rate must be between 0 and 50."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        store.commission_rate = rate
        store.save(update_fields=["commission_rate", "updated_at"])
        return Response({"store_id": str(store.id), "commission_rate": f"{rate:.2f}"})


class AdminOrderListView(generics.ListAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = OrderSerializer
    filterset_fields = ["order_status", "payment_status", "store", "customer"]
    search_fields = ["order_number", "customer__email", "customer__phone_number", "store__name"]

    def get_queryset(self):
        return (
            Order.objects.select_related("store", "customer")
            .prefetch_related("items", "status_history")
            .all()
        )


class AdminOrderRefundView(APIView):
    permission_classes = [IsPlatformAdmin]

    def post(self, request, pk):
        order = Order.objects.filter(pk=pk).first()
        if not order:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            amount = Decimal(str(request.data.get("amount", order.total_amount)))
            refund = process_order_refund(
                order=order,
                refund_amount=amount,
                reason=request.data.get("reason", "Admin refund adjustment"),
                processed_by=request.user,
            )
        except (DjangoValidationError, Exception) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "refund_id": str(refund.id),
                "order_id": str(order.id),
                "amount": str(refund.amount),
                "commission_reversed": str(refund.commission_reversed),
            }
        )


class AdminCustomerSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    total_orders = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "phone_number",
            "first_name",
            "last_name",
            "full_name",
            "total_orders",
            "is_active",
            "is_verified",
            "date_joined",
        ]
        read_only_fields = ["id", "email", "total_orders", "date_joined"]


class AdminCustomerListView(generics.ListAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = AdminCustomerSerializer
    search_fields = ["email", "phone_number", "first_name", "last_name"]
    queryset = User.objects.filter(role=UserRole.CUSTOMER).annotate(total_orders=Count("orders"))


class AdminCustomerDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = AdminCustomerSerializer
    queryset = User.objects.filter(role=UserRole.CUSTOMER).annotate(total_orders=Count("orders"))


class AdminCategoryListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsPlatformAdmin]
    pagination_class = None
    serializer_class = CategorySerializer
    queryset = Category.objects.filter(is_global=True)

    def perform_create(self, serializer):
        serializer.save(is_global=True)


class AdminCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = CategorySerializer
    queryset = Category.objects.filter(is_global=True)


class AdminAreaListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsPlatformAdmin]
    pagination_class = None
    serializer_class = AreaSerializer
    queryset = Area.objects.all()


class AdminAreaDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = AreaSerializer
    queryset = Area.objects.all()


class CommissionRecordSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source="store.name", read_only=True)
    order_number = serializers.CharField(source="order.order_number", read_only=True)

    class Meta:
        model = CommissionRecord
        fields = [
            "id",
            "order",
            "order_number",
            "store",
            "store_name",
            "currency",
            "order_subtotal_snapshot",
            "delivery_fee_snapshot",
            "order_total_snapshot",
            "commission_rate_snapshot",
            "commission_amount",
            "merchant_net_amount",
            "reversed_commission_amount",
            "status",
            "settled_at",
            "created_at",
        ]


class AdminCommissionListView(generics.ListAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = CommissionRecordSerializer
    filterset_fields = ["status", "store"]
    queryset = CommissionRecord.objects.select_related("order", "store")


class AdminCommissionSettleView(APIView):
    permission_classes = [IsPlatformAdmin]

    def post(self, request, pk):
        try:
            record = settle_commission_record(pk)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CommissionRecordSerializer(record).data)


class PlatformSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformSettings
        fields = [
            "id",
            "platform_name",
            "platform_name_en",
            "default_commission_rate",
            "currency",
            "support_phone",
            "support_email",
            "auto_approve_merchants",
            "notify_on_new_order",
            "notify_on_low_stock",
            "updated_at",
        ]
        read_only_fields = ["id", "currency", "updated_at"]


class AdminPlatformSettingsView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        return Response(PlatformSettingsSerializer(PlatformSettings.get_solo()).data)

    def patch(self, request):
        solo = PlatformSettings.get_solo()
        serializer = PlatformSettingsSerializer(solo, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
