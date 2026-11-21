from django.urls import path
from .views import (
    AdminLoginView,
    BaseLoginView,
    ChangePasswordView,
    CustomerLoginView,
    CustomerRegisterView,
    LogoutView,
    MeProfileView,
    MerchantLoginView,
    MerchantRegisterView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    ThrottledTokenRefreshView,
)

urlpatterns = [
    path("register/", CustomerRegisterView.as_view(), name="auth-register"),
    path("merchant/register/", MerchantRegisterView.as_view(), name="auth-merchant-register"),
    path("login/", BaseLoginView.as_view(), name="auth-login"),
    path("customer/login/", CustomerLoginView.as_view(), name="auth-customer-login"),
    path("merchant/login/", MerchantLoginView.as_view(), name="auth-merchant-login"),
    path("admin/login/", AdminLoginView.as_view(), name="auth-admin-login"),
    path("refresh/", ThrottledTokenRefreshView.as_view(), name="auth-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeProfileView.as_view(), name="auth-me"),
    path("password/change/", ChangePasswordView.as_view(), name="auth-password-change"),
    path("password/reset/request/", PasswordResetRequestView.as_view(), name="auth-password-reset-request"),
    path("password/reset/confirm/", PasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),
]
