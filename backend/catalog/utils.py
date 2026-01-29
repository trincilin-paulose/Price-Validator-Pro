# from promotions.utils import get_active_category_promotion


# def calculate_product_price(product):
#     """
#     Returns final_price, discount_amount, promotion
#     """
#     base_price = product.sale_price or product.mrp
#     promotion = get_active_category_promotion(product.category)

#     if not promotion:
#         return base_price, 0, None

#     if promotion.discount_type == "percentage":
#         discount = (promotion.discount_value / 100) * base_price
#     else:
#         discount = promotion.discount_value

#     final_price = max(base_price - discount, 0)

#     return round(final_price, 2), round(discount, 2), promotion

