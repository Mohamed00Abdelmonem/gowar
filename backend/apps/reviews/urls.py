from django.urls import path
from .views import StoreReviewListCreateView

urlpatterns = [
    path("", StoreReviewListCreateView.as_view(), name="reviews-list-create"),
]
