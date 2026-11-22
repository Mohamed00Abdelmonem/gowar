from django.urls import path

from .views import (
    AdminPromotionAnalyticsView,
    AdminPromotionDetailView,
    AdminPromotionListCreateView,
    AdminPromotionReorderView,
    AdminPromotionToggleActiveView,
    PromotionTrackClickAPIView,
    PromotionTrackViewAPIView,
    PublicPromotionDetailView,
    PublicPromotionListView,
)

public_urlpatterns = [
    path("", PublicPromotionListView.as_view(), name="promotion-list"),
    path("<uuid:pk>/", PublicPromotionDetailView.as_view(), name="promotion-detail"),
    path("<uuid:pk>/track-view/", PromotionTrackViewAPIView.as_view(), name="promotion-track-view"),
    path("<uuid:pk>/track-click/", PromotionTrackClickAPIView.as_view(), name="promotion-track-click"),
]

admin_urlpatterns = [
    path("promotions/", AdminPromotionListCreateView.as_view(), name="admin-promotion-list"),
    path("promotions/analytics/", AdminPromotionAnalyticsView.as_view(), name="admin-promotion-analytics"),
    path("promotions/reorder/", AdminPromotionReorderView.as_view(), name="admin-promotion-reorder"),
    path("promotions/<uuid:pk>/", AdminPromotionDetailView.as_view(), name="admin-promotion-detail"),
    path(
        "promotions/<uuid:pk>/toggle-active/",
        AdminPromotionToggleActiveView.as_view(),
        name="admin-promotion-toggle-active",
    ),
]
