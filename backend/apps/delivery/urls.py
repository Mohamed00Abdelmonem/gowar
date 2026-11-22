from django.urls import path
from .views import (
    DeliveryLocationUpdateView,
    DeliveryShiftEndView,
    DeliveryShiftStartView,
    DeliveryShiftStatusView,
    MerchantDeliveryDriverDetailView,
    MerchantDeliveryDriverResetPasswordView,
    MerchantDeliveryDriversManageView,
    MerchantDeliveryDriverToggleActiveView,
    MerchantDeliveryOverviewView,
    MerchantDeliveryPerformanceView,
    MerchantDeliveryTrackingView,
)

merchant_urlpatterns = [
    path(
        "delivery-management/overview/",
        MerchantDeliveryOverviewView.as_view(),
        name="merchant-delivery-overview",
    ),
    path(
        "delivery-management/drivers/",
        MerchantDeliveryDriversManageView.as_view(),
        name="merchant-delivery-drivers-manage",
    ),
    path(
        "delivery-management/drivers/<uuid:pk>/",
        MerchantDeliveryDriverDetailView.as_view(),
        name="merchant-delivery-driver-detail",
    ),
    path(
        "delivery-management/drivers/<uuid:pk>/toggle-active/",
        MerchantDeliveryDriverToggleActiveView.as_view(),
        name="merchant-delivery-driver-toggle-active",
    ),
    path(
        "delivery-management/drivers/<uuid:pk>/reset-password/",
        MerchantDeliveryDriverResetPasswordView.as_view(),
        name="merchant-delivery-driver-reset-password",
    ),
    path(
        "delivery-management/tracking/",
        MerchantDeliveryTrackingView.as_view(),
        name="merchant-delivery-tracking",
    ),
    path(
        "delivery-management/performance/",
        MerchantDeliveryPerformanceView.as_view(),
        name="merchant-delivery-performance",
    ),
]

delivery_urlpatterns = [
    path("shift/", DeliveryShiftStatusView.as_view(), name="delivery-shift-status"),
    path("shift/start/", DeliveryShiftStartView.as_view(), name="delivery-shift-start"),
    path("shift/end/", DeliveryShiftEndView.as_view(), name="delivery-shift-end"),
    path("location/", DeliveryLocationUpdateView.as_view(), name="delivery-location-update"),
]
