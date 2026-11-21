from django.urls import path
from .views import (
    MerchantCategoryDetailView,
    MerchantCategoryListCreateView,
    MerchantProductDetailView,
    MerchantProductListCreateView,
    PublicCategoryListView,
    PublicProductDetailView,
    PublicProductListView,
)

public_urlpatterns = [
    path("categories/", PublicCategoryListView.as_view(), name="catalog-categories"),
    path("products/", PublicProductListView.as_view(), name="catalog-products"),
    path("products/<uuid:pk>/", PublicProductDetailView.as_view(), name="catalog-product-detail"),
]

merchant_urlpatterns = [
    path("products/", MerchantProductListCreateView.as_view(), name="merchant-products"),
    path("products/<uuid:pk>/", MerchantProductDetailView.as_view(), name="merchant-product-detail"),
    path("categories/", MerchantCategoryListCreateView.as_view(), name="merchant-categories"),
    path("categories/<uuid:pk>/", MerchantCategoryDetailView.as_view(), name="merchant-category-detail"),
]
