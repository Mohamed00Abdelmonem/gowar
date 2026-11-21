from django.urls import path
from .views import (
    CustomerOrderCancelView,
    CustomerOrderDetailView,
    CustomerOrderListCreateView,
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
]
