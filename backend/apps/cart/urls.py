from django.urls import path
from .views import CartItemUpdateDeleteView, CartItemsAddView, CustomerCartView

urlpatterns = [
    path("", CustomerCartView.as_view(), name="cart-detail"),
    path("items/", CartItemsAddView.as_view(), name="cart-add-item"),
    path("items/<uuid:product_id>/", CartItemUpdateDeleteView.as_view(), name="cart-item-update"),
]
