from django.utils import timezone
from decimal import Decimal

from catalog.models import Product
from .models import CategoryPromotion


# def get_active_category_promotion(category):
#     """
#     Returns the first active promotion for the given category
#     """
#     now = timezone.now()

#     return (
#         CategoryPromotion.objects
#         .filter(
#             category=category,
#             is_active=True,
#             start_date__lte=now,
#             end_date__gte=now,
#         )
#         .order_by("-discount_value")
#         .first()
#     )

def get_active_category_promotion(product):
    """
    Accepts a Product instance
    Returns an active CategoryPromotion or None
    """
    category = product.category
    now = timezone.now()

    while category:
        promo = (
            CategoryPromotion.objects
            .filter(
                category=category,
                is_active=True,
                start_date__lte=now,
                end_date__gte=now,
            )
            .order_by("-created_at")
            .first()
        )

        if promo:
            return promo

        # move up the category tree
        category = category.parent

    return None

def calculate_product_price(product: Product):
    """
    Calculates final price of a product based on category-level promotions.
    Supports promotions applied to:
    - Product's category
    - Parent category
    - Grandparent category
    """

    now = timezone.now()

    # 🧠 Collect category hierarchy IDs safely
    category_ids = [product.category_id]

    if product.category.parent:
        category_ids.append(product.category.parent_id)

        if product.category.parent.parent:
            category_ids.append(product.category.parent.parent_id)

    # 🎯 Fetch best applicable promotion
    category_promo = (
        CategoryPromotion.objects.filter(
            category_id__in=category_ids,
            is_active=True,
            start_date__lte=now,
            end_date__gte=now,
        )
        .order_by("-discount_value")  # highest discount wins
        .first()
    )

    base_price = product.mrp
    final_price = base_price
    discount_amount = Decimal("0.00")
    applied_promo = None

    if category_promo:
        # Percentage Discount
        if category_promo.discount_type == "percentage":
            discount_amount = (
                base_price * Decimal(category_promo.discount_value) / Decimal("100")
            )
            applied_promo = category_promo

        # Flat Discount
        elif category_promo.discount_type == "flat":
            # 🔥 SAFETY CHECK
            if category_promo.discount_value < base_price:
                discount_amount = Decimal(category_promo.discount_value)
                applied_promo = category_promo
            else:
                discount_amount = Decimal("0.00")
                applied_promo = None

    # ✅ Final price calculated ONCE
    final_price = max(base_price - discount_amount, Decimal("0.00"))

    return (
        final_price,
        discount_amount,
        applied_promo,
    )