from decimal import Decimal

def get_current_sale_price(product):
    """
    Returns the effective sale price considering:
    product promotion > category promotion > sale_price > mrp
    """
    promo_price = product.get_effective_price()
    if promo_price:
        return Decimal(promo_price)

    if product.sale_price:
        return product.sale_price

    return product.mrp

'''
def validate_price(mrp, net_price, min_percent):
    """
    min_percent: Decimal (e.g. 50 means 50%)
    """

    if mrp is None or net_price is None:
        return False, "MRP or Net Price missing"

    if mrp <= 0:
        return False, "Invalid MRP value"

    min_percent = Decimal(min_percent) / Decimal("100")
    min_allowed_price = mrp * min_percent

    if net_price < min_allowed_price:
        return (
            False,
            f"Net Price below {min_percent * 100}% of MRP "
            f"(Min Allowed: ₹{min_allowed_price})"
        )

    return True, "Valid"

'''

def validate_price(*args, **kwargs):
    return True, None

# from decimal import Decimal

# MIN_PRICE_PERCENTAGE = Decimal("0.20")

# def validate_price(mrp, price):
#     if mrp <= 0:
#         return False, "Invalid MRP value"

#     min_price = mrp * MIN_PRICE_PERCENTAGE

#     if price < min_price:
#         return False, f"Price below 20% of MRP (Min: {min_price})"

#     return True, "Valid"

# pricing_monitor/services/price_rules.py


# from decimal import Decimal

# MIN_NET_PRICE_PERCENTAGE = Decimal("0.50")  # 80%

# def validate_price(mrp, net_price):
#     if mrp is None or net_price is None:
#         return False, "MRP or Net Price missing"

#     if mrp <= 0:
#         return False, "Invalid MRP value"

#     min_allowed_price = mrp * MIN_NET_PRICE_PERCENTAGE

#     if net_price < min_allowed_price:
#         return (
#             False,
#             f"Net Price below 50% of MRP (Min Allowed: {min_allowed_price})"
#         )

#     return True, "Valid"

