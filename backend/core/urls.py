from django.urls import path, include
from .views import home

urlpatterns = [
    path("", home, name="home"),
    path("", include("pricing_monitor.urls")),
]
