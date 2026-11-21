from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import PasswordResetToken, User

admin.site.site_header = "Gowar Platform Administration"
admin.site_title = "Gowar Admin"
admin.site.index_title = "Gowar Marketplace Management"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["-date_joined"]
    list_display = [
        "email",
        "first_name",
        "last_name",
        "phone_number",
        "role",
        "is_verified",
        "is_active",
        "is_staff",
        "date_joined",
    ]
    list_filter = ["role", "is_active", "is_verified", "is_staff", "is_superuser"]
    search_fields = ["email", "first_name", "last_name", "phone_number"]
    readonly_fields = ["date_joined", "last_login"]

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "phone_number", "role")}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_verified",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "first_name",
                    "last_name",
                    "phone_number",
                    "role",
                    "password1",
                    "password2",
                    "is_active",
                    "is_verified",
                    "is_staff",
                ),
            },
        ),
    )


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ["user", "token", "expires_at", "used_at", "created_at"]
    list_filter = ["created_at", "used_at"]
    search_fields = ["user__email", "token"]
    raw_id_fields = ["user"]
