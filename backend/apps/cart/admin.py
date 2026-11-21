from django.contrib import admin

from .models import Cart, CartItem


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0
    raw_id_fields = ["product"]


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ["customer", "store", "created_at", "updated_at"]
    search_fields = ["customer__email", "store__name"]
    raw_id_fields = ["customer", "store"]
    inlines = [CartItemInline]


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ["cart", "product", "quantity", "updated_at"]
    search_fields = ["cart__customer__email", "product__name"]
    raw_id_fields = ["cart", "product"]
