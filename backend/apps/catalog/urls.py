from django.urls import path
from .views import (
    MerchantBarcodeImportView,
    MerchantCatalogLibraryCategoryListView,
    MerchantCatalogLibraryItemListView,
    MerchantCategoryDetailView,
    MerchantCategoryListCreateView,
    MerchantExternalImageSearchView,
    MerchantProductDatabaseSearchView,
    MerchantProductDetailView,
    MerchantProductImageUploadView,
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
    path("products/upload-image/", MerchantProductImageUploadView.as_view(), name="merchant-product-upload-image"),
    path("products/<uuid:pk>/", MerchantProductDetailView.as_view(), name="merchant-product-detail"),
    path("categories/", MerchantCategoryListCreateView.as_view(), name="merchant-categories"),
    path("categories/<uuid:pk>/", MerchantCategoryDetailView.as_view(), name="merchant-category-detail"),
    path(
        "catalog-library/categories/",
        MerchantCatalogLibraryCategoryListView.as_view(),
        name="merchant-catalog-library-categories",
    ),
    path(
        "catalog-library/items/",
        MerchantCatalogLibraryItemListView.as_view(),
        name="merchant-catalog-library-items",
    ),
    path(
        "catalog-library/external-images/",
        MerchantExternalImageSearchView.as_view(),
        name="merchant-catalog-external-images",
    ),
    path(
        "product-import/barcode/<str:barcode>/",
        MerchantBarcodeImportView.as_view(),
        name="merchant-product-import-barcode",
    ),
    path(
        "product-import/search/",
        MerchantProductDatabaseSearchView.as_view(),
        name="merchant-product-import-search",
    ),
]
