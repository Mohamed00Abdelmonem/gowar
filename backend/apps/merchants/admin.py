from django.contrib import admin

from apps.stores.models import Store
from .models import ApprovalStatus, MerchantProfile
from .services import update_merchant_approval


class StoreInline(admin.TabularInline):
    model = Store
    extra = 0
    fields = ["name", "name_en", "store_type", "area", "approval_status", "is_active", "is_open", "commission_rate"]
    readonly_fields = ["approval_status"]


@admin.register(MerchantProfile)
class MerchantProfileAdmin(admin.ModelAdmin):
    list_display = [
        "business_name",
        "user",
        "merchant_code",
        "approval_status",
        "approved_at",
        "created_at",
    ]
    list_filter = ["approval_status", "created_at"]
    search_fields = ["business_name", "merchant_code", "user__email", "user__phone_number"]
    raw_id_fields = ["user"]
    readonly_fields = ["approved_at", "created_at", "updated_at"]
    inlines = [StoreInline]
    actions = ["approve_selected", "reject_selected", "suspend_selected"]

    @admin.action(description="Approve selected merchants (activate merchant & stores)")
    def approve_selected(self, request, queryset):
        for merchant in queryset:
            update_merchant_approval(merchant, ApprovalStatus.APPROVED)

    @admin.action(description="Reject selected merchants")
    def reject_selected(self, request, queryset):
        for merchant in queryset:
            update_merchant_approval(merchant, ApprovalStatus.REJECTED, "Rejected via Django Admin")

    @admin.action(description="Suspend selected merchants")
    def suspend_selected(self, request, queryset):
        for merchant in queryset:
            update_merchant_approval(merchant, ApprovalStatus.SUSPENDED, "Suspended via Django Admin")
