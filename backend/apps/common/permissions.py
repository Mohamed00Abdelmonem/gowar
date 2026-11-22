from rest_framework.permissions import BasePermission


class IsCustomer(BasePermission):
    message = "Customer account required."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and request.user.role == "customer"
        )


class IsMerchant(BasePermission):
    message = "Merchant account required."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and request.user.role == "merchant"
        )


class IsDelivery(BasePermission):
    message = "Delivery personnel account required."

    def has_permission(self, request, view):
        if not (
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and request.user.role == "delivery"
        ):
            return False
        profile = getattr(request.user, "delivery_profile", None)
        if profile is not None and (not profile.is_active or profile.is_archived):
            return False
        return True


class IsApprovedMerchant(IsMerchant):
    message = "Approved merchant profile required."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        profile = getattr(request.user, "merchant_profile", None)
        return bool(profile and profile.approval_status == "approved")


class IsPlatformAdmin(BasePermission):
    message = "Platform administrator privileges required."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and (request.user.role == "admin" or request.user.is_superuser)
        )


class IsStoreOwner(BasePermission):
    """Object-level permission guaranteeing merchant owns the store or resource."""

    message = "You do not have permission to access another merchant's store."

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == "admin" or request.user.is_superuser:
            return True
        if request.user.role != "merchant":
            return False
        profile = getattr(request.user, "merchant_profile", None)
        if not profile:
            return False
        if hasattr(obj, "merchant_id") and obj.merchant_id is not None:
            return obj.merchant_id == profile.id
        if hasattr(obj, "store") and obj.store is not None and hasattr(obj.store, "merchant_id"):
            return obj.store.merchant_id == profile.id
        return False
