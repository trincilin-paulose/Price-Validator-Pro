from django.shortcuts import render, get_object_or_404
from .models import Category, Product
from django.core.paginator import Paginator
from django.db.models import Q
#from products.models import Product   # adjust app name if needed
#from promotions.utils import calculate_product_price
#from promotions.utils import get_active_category_promotion
from promotions.services import get_final_price, calculate_price

def category_detail(request, slug):
    category = get_object_or_404(Category, slug=slug, is_active=True)

    subcategories = category.children.filter(is_active=True)

    # products_qs = Product.objects.filter(
    #     Q(category=category) |
    #     Q(category__parent=category) |
    #     Q(category__parent__parent=category),
    #     is_active=True
    # ).distinct()

    # ✅ FIX: Correct parent vs subcategory filtering
    if category.parent:
        # 🟢 Subcategory page → show only its products
        products_qs = Product.objects.filter(
            subcategory=category,
            is_active=True
        )
    else:
        # 🟢 Parent category page → show all under it
        products_qs = Product.objects.filter(
            Q(category=category) |
            Q(subcategory__parent=category),
            is_active=True
        ).distinct()

    paginator = Paginator(products_qs, 12)
    page_number = request.GET.get("page")
    products = paginator.get_page(page_number)

    # ✅ NO PRICE / PROMOTION ASSIGNMENTS HERE
    # Pricing is now handled by Product model properties

    # 🔥 APPLY FINAL PRICE LOGIC (REQUIRED)
    for product in products:
        price_data = calculate_price(product)

        product.mrp = price_data["mrp"]
        product.final_price = price_data["final_price"]
        product.discount = price_data["discount"]
        # product.active_promotion = price_data["promotion"]

    context = {
        "category": category,
        "subcategories": subcategories,
        "products": products,
    }

    return render(request, "catalog/category_detail.html", context)

"""
def category_detail(request, slug):
    category = get_object_or_404(Category, slug=slug, is_active=True)

    # Active subcategories
    subcategories = category.children.filter(is_active=True)

    # Products from category + child + grandchild
    products_qs = Product.objects.filter(
        Q(category=category) |
        Q(category__parent=category) |
        Q(category__parent__parent=category),
        is_active=True
    ).distinct()

    # Pagination
    paginator = Paginator(products_qs, 12)  # 12 products per page
    page_number = request.GET.get("page")
    products = paginator.get_page(page_number)

    # 🔥 APPLY CATEGORY PROMOTIONS
    for product in products:
        (
            product.final_price,
            product.discount,
            product.promotion
        ) = calculate_product_price(product)
        promo = get_active_category_promotion(product)
        product.active_promotion = promo

        print(
            "VIEW DEBUG →",
            product.name,
            "PROMO:",
            product.promotion
        )

    context = {
        "category": category,
        "subcategories": subcategories,
        "products": products,
    }

    return render(request, "catalog/category_detail.html", context)
"""
"""
def category_detail(request, slug):
    category = get_object_or_404(Category, slug=slug, is_active=True)

    subcategories = category.children.filter(is_active=True)

    products_qs = Product.objects.filter(
        Q(category=category) |
        Q(category__parent=category) |
        Q(category__parent__parent=category),
        is_active=True
    ).distinct()

    paginator = Paginator(products_qs, 12)
    page_number = request.GET.get("page")
    products = paginator.get_page(page_number)

    # ✅ APPLY PROMOTIONS (PRODUCT > CATEGORY)
    for product in products:
        price_data = calculate_price(product)

        product.mrp = price_data["mrp"]
        product.final_price = price_data["final_price"]
        product.discount = price_data["discount"]
        #product.promotion = price_data["promotion"]  # ⭐ THIS WAS MISSING
        product.active_promotion = price_data["promotion"]

        # DEBUG (remove later)
        print(
            "VIEW →",
            product.name,
            "PROMO:",
            product.active_promotion
        )

    context = {
        "category": category,
        "subcategories": subcategories,
        "products": products,
    }

    return render(request, "catalog/category_detail.html", context)
"""

# def product_detail(request, slug):
#     product = get_object_or_404(
#         Product,
#         slug=slug,
#         is_active=True
#     )
    
#     (
#         product.final_price,
#         product.discount,
#         product.promotion
#     ) = calculate_product_price(product)

#     discount_percent = 0
#     if product.mrp and product.sale_price:
#         discount_percent = int(
#             ((product.mrp - product.sale_price) / product.mrp) * 100
#         )
    
#     final_price, discount, promotion = calculate_product_price(product)

#     product.final_price = get_final_price(product)

#     context = {
#         "product": product,
#         "discount_percent": discount_percent,
#         # "final_price": final_price,
#         "final_price": product.final_price,
#         "discount": discount,
#         "promotion": promotion,
#     }

#     return render(request, "catalog/product_detail.html", context)

from promotions.services import calculate_price

def product_detail(request, slug):
    product = get_object_or_404(Product, slug=slug, is_active=True)

    price_data = calculate_price(product)

    product.mrp = price_data["mrp"]
    product.final_price = price_data["final_price"]
    product.discount = price_data["discount"]
    product.active_promotion = price_data["promotion"]

    context = {
        "product": product,
    }

    return render(request, "catalog/product_detail.html", context)

