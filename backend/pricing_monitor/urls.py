from django.urls import path
from .api_views import ProductCSVUploadAPIView

urlpatterns = [
    path("api/pricing/upload/", ProductCSVUploadAPIView.as_view(), name="pricing-upload"),
]
