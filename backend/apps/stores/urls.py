from django.urls import path
from .views import (
    MerchantDeliverySettingsView,
    MerchantStoreSettingsView,
    NearbyStoresListView,
    PublicStoreDetailView,
    PublicStoreListView,
)

public_urlpatterns = [
    path("", PublicStoreListView.as_view(), name="stores-list"),
    path("nearby/", NearbyStoresListView.as_view(), name="stores-nearby"),
    path("<uuid:pk>/", PublicStoreDetailView.as_view(), name="store-detail"),
]

merchant_urlpatterns = [
    path("store/", MerchantStoreSettingsView.as_view(), name="merchant-store-settings"),
    path("delivery/", MerchantDeliverySettingsView.as_view(), name="merchant-delivery-settings"),
]
