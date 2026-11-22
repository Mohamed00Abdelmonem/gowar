import logging
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.db import connection
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analytics import urls as analytics_urls
from apps.catalog import urls as catalog_urls
from apps.delivery import urls as delivery_urls
from apps.orders import urls as orders_urls
from apps.stores import urls as stores_urls

logger = logging.getLogger(__name__)


class HealthCheckView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = []

    def get(self, request):
        checks = {"database": "error", "postgis": "error"}
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                checks["database"] = "ok"
                cursor.execute("SELECT PostGIS_Version()")
                row = cursor.fetchone()
                if row and row[0]:
                    checks["postgis"] = "ok"
        except Exception:
            logger.exception("Health check failed")
            return Response(
                {"status": "unhealthy", "service": "gowar-backend", "checks": checks},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if checks["database"] != "ok" or checks["postgis"] != "ok":
            return Response(
                {"status": "unhealthy", "service": "gowar-backend", "checks": checks},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {"status": "ok", "service": "gowar-backend", "checks": checks},
            status=status.HTTP_200_OK,
        )


api_v1_patterns = [
    path("auth/", include("apps.accounts.urls")),
    path("locations/", include("apps.locations.urls")),
    path("stores/", include(stores_urls.public_urlpatterns)),
    path("catalog/", include(catalog_urls.public_urlpatterns)),
    path("cart/", include("apps.cart.urls")),
    path("orders/", include(orders_urls.customer_urlpatterns)),
    path("reviews/", include("apps.reviews.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path(
        "merchant/",
        include(
            stores_urls.merchant_urlpatterns
            + catalog_urls.merchant_urlpatterns
            + orders_urls.merchant_urlpatterns
            + analytics_urls.merchant_urlpatterns
            + delivery_urls.merchant_urlpatterns
            + [path("", include("apps.inventory.urls"))]
        ),
    ),
    path("admin/", include(analytics_urls.admin_urlpatterns)),
    path("delivery/", include(orders_urls.delivery_urlpatterns + delivery_urls.delivery_urlpatterns)),
]

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("health/", HealthCheckView.as_view(), name="health-check"),
    path("api/v1/", include(api_v1_patterns)),
]

if settings.DEBUG or getattr(settings, "GOWAR_ENABLE_API_DOCS", False):
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
        path(
            "api/docs/",
            SpectacularSwaggerView.as_view(url_name="api-schema"),
            name="swagger-ui",
        ),
        path(
            "api/redoc/",
            SpectacularRedocView.as_view(url_name="api-schema"),
            name="redoc",
        ),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
