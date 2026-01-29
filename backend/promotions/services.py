from django.utils import timezone
from decimal import Decimal

from promotions.models import ProductPromotion, CategoryPromotion

def calculate_price(product):
    """
    FINAL pricing logic with correct priority:
    1. Deal Price (pricing_monitor)
    2. Product Promotion
    3. Category Promotion
    4. MRP
    """

    mrp = product.mrp

    # ===================== DEAL PRICE (TOP PRIORITY) =====================
    # if product.has_deal_price:
    #     return {
    #         "mrp": mrp,
    #         "final_price": product.sale_price,
    #         "discount": mrp - product.sale_price,
    #         "promotion": None,   # 🔥 FORCE promotion OFF
    #     }
    if product.is_deal_price and product.sale_price:
        return {
            "mrp": mrp,
            "final_price": product.sale_price,
            "discount": mrp - product.sale_price,
            "promotion": None,   # force promotions OFF
        }

    now = timezone.now()

    # ===================== PRODUCT PROMOTION =====================
    product_promo = ProductPromotion.objects.filter(
        product=product,
        is_active=True,
        start_date__lte=now,
        end_date__gte=now,
    ).first()

    if product_promo:
        final_price = apply_discount(mrp, product_promo)
        return {
            "mrp": mrp,
            "final_price": final_price,
            "discount": mrp - final_price,
            "promotion": product_promo,
        }

    # ===================== CATEGORY PROMOTION =====================
    category_promo = CategoryPromotion.objects.filter(
        category=product.category,
        is_active=True,
    ).first()

    if category_promo:
        final_price = apply_discount(mrp, category_promo)
        return {
            "mrp": mrp,
            "final_price": final_price,
            "discount": mrp - final_price,
            "promotion": category_promo,
        }

    # ===================== NO PROMO =====================
    return {
        "mrp": mrp,
        "final_price": mrp,
        "discount": Decimal("0.00"),
        "promotion": None,
    }


def get_active_promotion_for_product(product):
    now = timezone.now()

    # 1️⃣ Product promotion (highest priority after deal price)
    product_promo = (
        ProductPromotion.objects
        .filter(product=product, start_date__lte=now, end_date__gte=now, active=True)
        .first()
    )
    if product_promo:
        return product_promo

    # 2️⃣ Category promotion
    category_promo = (
        CategoryPromotion.objects
        .filter(category=product.category, start_date__lte=now, end_date__gte=now, active=True)
        .first()
    )
    return category_promo


def get_active_product_promotion(product):
    now = timezone.now()

    return ProductPromotion.objects.filter(
        product=product,
        is_active=True,
        start_date__lte=now,
        end_date__gte=now,
    ).order_by("-id").first()


def get_active_category_promotion(category, product=None):
    now = timezone.now()

    # 🔴 DISABLE category promo if product promo exists
    if product:
        product_promo_exists = ProductPromotion.objects.filter(
            product=product,
            is_active=True,
            start_date__lte=now,
            end_date__gte=now,
        ).exists()

        if product_promo_exists:
            return None

    return (
        CategoryPromotion.objects.filter(
            category=category,
            is_active=True,
            start_date__lte=now,
            end_date__gte=now,
        )
        .order_by("-id")
        .first()
    )


# def calculate_price(product):
#     mrp = product.mrp  # ✅ correct field
#     final_price = mrp
#     discount = Decimal("0.00")
#     applied_promotion = None

#     now = timezone.now()

#     # 1️⃣ PRODUCT PROMOTION (HIGHEST PRIORITY)
#     product_promo = ProductPromotion.objects.filter(
#         product=product,
#         is_active=True,
#         start_date__lte=now,
#         end_date__gte=now,
#     ).order_by("-id").first()

#     if product_promo:
#         applied_promotion = product_promo

#         dtype = product_promo.discount_type.lower()

#         if dtype == "percentage":
#             discount = (mrp * Decimal(product_promo.discount_value)) / Decimal("100")

#         elif dtype == "flat":
#             discount = Decimal(product_promo.discount_value)

#     else:
#         # 2️⃣ CATEGORY PROMOTION (ONLY IF NO PRODUCT PROMO)
#         category_promo = get_active_category_promotion(
#             category=product.category,
#             product=product,  # 🔴 ensures FIX #3
#         )

#         if category_promo:
#             dtype = category_promo.discount_type.lower()
#             applied_promotion = category_promo

#             if dtype == "percentage":
#                 discount = (mrp * Decimal(category_promo.discount_value)) / Decimal("100")
#             elif dtype == "flat":
#                 discount = Decimal(category_promo.discount_value)

#     # 🔒 SAFETY RULES
#     if discount <= 0 or discount >= mrp:
#             discount = Decimal("0.00")
#             applied_promotion = None

#     final_price = mrp - discount

#     return {
#         "mrp": mrp.quantize(Decimal("0.01")),
#         "final_price": final_price.quantize(Decimal("0.01")),
#         "discount": discount.quantize(Decimal("0.01")),
#         "promotion": applied_promotion,
#     }





# def apply_discount(price, discount_type, discount_value):
#     price = Decimal(price)

#     if discount_type == "percentage":
#         return price - (price * discount_value / Decimal(100))

#     if discount_type == "flat":
#         return max(price - discount_value, Decimal("0.00"))

#     return price

def get_final_price(product):
    base_price = product.mrp
    now = timezone.now()

    # 1️⃣ Product promotion (highest priority)
    product_promo = ProductPromotion.objects.filter(
        product=product,
        is_active=True,
        start_date__lte=now,
        end_date__gte=now,
    ).first()

    if product_promo:
        return apply_discount(base_price, product_promo)

    # 2️⃣ Category promotion
    category_promo = CategoryPromotion.objects.filter(
        category=product.category,
        is_active=True,
        start_date__lte=now,
        end_date__gte=now,
    ).first()

    if category_promo:
        return apply_discount(base_price, category_promo)

    return base_price


# def apply_discount(price, promo):
#     price = Decimal(price)

#     if promo.discount_type.lower() == "PERCENTAGE":
#         discount = price * Decimal(promo.discount_value) / Decimal("100")
#     else:
#         discount = Decimal(promo.discount_value)

#     return max(price - discount, Decimal("0.00"))

def apply_discount(price, promo):
    """
    Correctly applies percentage or flat discount
    """

    if promo.discount_type == "PERCENTAGE" or promo.discount_type == "percentage":
        discount_amount = (price * promo.discount_value) / Decimal("100")
        return (price - discount_amount).quantize(Decimal("0.01"))

    # FLAT discount
    return (price - promo.discount_value).quantize(Decimal("0.01"))


def get_active_promotion(product):
    product_promo = get_active_product_promotion(product)
    if product_promo:
        return ("product", product_promo)

    category_promo = get_active_category_promotion(product.category)
    if category_promo:
        return ("category", category_promo)

    return (None, None)