from django.urls import path
from .views import (
    AreaListView,
    CustomerAddressDetailView,
    CustomerAddressListCreateView,
    CustomerSearchRadiusView,
    SetDefaultAddressView,
)

urlpatterns = [
    path("areas/", AreaListView.as_view(), name="areas-list"),
    path("search-radius/", CustomerSearchRadiusView.as_view(), name="customer-search-radius"),
    path("addresses/", CustomerAddressListCreateView.as_view(), name="customer-addresses"),
    path("addresses/<uuid:pk>/", CustomerAddressDetailView.as_view(), name="customer-address-detail"),
    path("addresses/<uuid:pk>/set-default/", SetDefaultAddressView.as_view(), name="customer-address-set-default"),
]
