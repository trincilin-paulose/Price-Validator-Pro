# promotions/admin.py
from django.contrib import admin
from django.utils import timezone
from .models import CategoryPromotion, ProductPromotion


@admin.register(CategoryPromotion)
class CategoryPromotionAdmin(admin.ModelAdmin):
    list_display = (
        "category",
        "discount_type",
        "discount_value",
        "start_date",
        "end_date",
        "is_active",
        "is_currently_active",
    )

    list_filter = ("is_active", "discount_type", "category")
    search_fields = ("category__name",)

    def is_currently_active(self, obj):
        """
        Safe check to avoid NoneType comparison
        """
        if not obj.start_date or not obj.end_date:
            return False

        now = timezone.now()
        return obj.is_active and obj.start_date <= now <= obj.end_date

    is_currently_active.boolean = True
    is_currently_active.short_description = "Currently Active"

@admin.register(ProductPromotion)
class ProductPromotionAdmin(admin.ModelAdmin):
    list_display = (
        "product",
        "discount_type",
        "discount_value",
        "start_date",
        "end_date",
        "is_active",
        "is_currently_active",
    )
    list_filter = ("discount_type", "is_active")
    search_fields = ("product__name",)

    def is_currently_active(self, obj):
        """
        Safe check to avoid NoneType comparison
        """
        if not obj.start_date or not obj.end_date:
            return False

        now = timezone.now()
        return obj.is_active and obj.start_date <= now <= obj.end_date

    is_currently_active.boolean = True
    is_currently_active.short_description = "Currently Active"

    def save_model(self, request, obj, form, change):
        from promotions.models import ProductPromotion

        if isinstance(obj, CategoryPromotion):
            ProductPromotion.objects.filter(
                product__category=obj.category,
                is_active=True,
            ).update(is_active=False)

        super().save_model(request, obj, form, change)

@admin.display(boolean=True)
def currently_active(self, obj):
    return obj.currently_active