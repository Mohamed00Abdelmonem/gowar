from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsCustomer
from .models import Area, CustomerAddress, CustomerProfile
from .serializers import (
    AreaSerializer,
    CustomerAddressSerializer,
    SearchRadiusSerializer,
)


class AreaListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    serializer_class = AreaSerializer
    queryset = Area.objects.filter(is_active=True)


class CustomerSearchRadiusView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        profile, _ = CustomerProfile.objects.get_or_create(user=request.user)
        return Response(SearchRadiusSerializer(profile).data)

    def patch(self, request):
        profile, _ = CustomerProfile.objects.get_or_create(user=request.user)
        serializer = SearchRadiusSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class CustomerAddressListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsCustomer]
    pagination_class = None
    serializer_class = CustomerAddressSerializer

    def get_queryset(self):
        return CustomerAddress.objects.select_related("area").filter(
            customer=self.request.user
        )

    def perform_create(self, serializer):
        user = self.request.user
        has_existing = CustomerAddress.objects.filter(customer=user).exists()
        is_default = serializer.validated_data.get("is_default", not has_existing)
        serializer.save(customer=user, is_default=is_default)


class CustomerAddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsCustomer]
    serializer_class = CustomerAddressSerializer

    def get_queryset(self):
        return CustomerAddress.objects.select_related("area").filter(
            customer=self.request.user
        )

    def perform_destroy(self, instance):
        user = instance.customer
        was_default = instance.is_default
        instance.delete()
        if was_default:
            fallback = CustomerAddress.objects.filter(customer=user).first()
            if fallback:
                fallback.is_default = True
                fallback.save()


class SetDefaultAddressView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request, pk):
        address = CustomerAddress.objects.filter(customer=request.user, pk=pk).first()
        if not address:
            return Response(
                {"detail": "Address not found."}, status=status.HTTP_404_NOT_FOUND
            )
        address.is_default = True
        address.save()
        return Response(CustomerAddressSerializer(address).data)
