from django.urls import path
from .views import (
    CustomerOrderCancelView,
    CustomerOrderDetailView,
    CustomerOrderListCreateView,
    DeliveryAcceptTripView,
    DeliveryArriveView,
    DeliveryCancelTripView,
    DeliveryOrderDetailView,
    DeliveryOrderListView,
    DeliveryOrderTransitionView,
    DeliverySummaryView,
    MerchantAssignDeliveryView,
    MerchantDeliveryDriversListView,
    MerchantOrderDetailView,
    MerchantOrderListView,
    MerchantOrderTransitionView,
)

customer_urlpatterns = [
    path("", CustomerOrderListCreateView.as_view(), name="customer-orders"),
    path("<uuid:pk>/", CustomerOrderDetailView.as_view(), name="customer-order-detail"),
    path("<uuid:pk>/cancel/", CustomerOrderCancelView.as_view(), name="customer-order-cancel"),
]

merchant_urlpatterns = [
    path("orders/", MerchantOrderListView.as_view(), name="merchant-orders"),
    path("orders/<uuid:pk>/", MerchantOrderDetailView.as_view(), name="merchant-order-detail"),
    path("orders/<uuid:pk>/transition/", MerchantOrderTransitionView.as_view(), name="merchant-order-transition"),
    path("orders/<uuid:pk>/assign-delivery/", MerchantAssignDeliveryView.as_view(), name="merchant-order-assign-delivery"),
    path("delivery-drivers/", MerchantDeliveryDriversListView.as_view(), name="merchant-delivery-drivers"),
]

delivery_urlpatterns = [
    path("summary/", DeliverySummaryView.as_view(), name="delivery-summary"),
    path("orders/", DeliveryOrderListView.as_view(), name="delivery-orders"),
    path("orders/<uuid:pk>/", DeliveryOrderDetailView.as_view(), name="delivery-order-detail"),
    path("orders/<uuid:pk>/accept-trip/", DeliveryAcceptTripView.as_view(), name="delivery-order-accept-trip"),
    path("orders/<uuid:pk>/cancel-trip/", DeliveryCancelTripView.as_view(), name="delivery-order-cancel-trip"),
    path("orders/<uuid:pk>/arrive/", DeliveryArriveView.as_view(), name="delivery-order-arrive"),
    path("orders/<uuid:pk>/transition/", DeliveryOrderTransitionView.as_view(), name="delivery-order-transition"),
]
