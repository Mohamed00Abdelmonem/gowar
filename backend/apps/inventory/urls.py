from django.urls import path
from .views import (
    MerchantInventoryListView,
    MerchantInventoryMovementsView,
    MerchantStockAdjustView,
)

urlpatterns = [
    path("inventory/", MerchantInventoryListView.as_view(), name="merchant-inventory"),
    path("inventory/<uuid:pk>/adjust/", MerchantStockAdjustView.as_view(), name="merchant-inventory-adjust"),
    path("inventory/movements/", MerchantInventoryMovementsView.as_view(), name="merchant-inventory-movements"),
]
