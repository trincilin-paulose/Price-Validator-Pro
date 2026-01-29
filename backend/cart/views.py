from django.shortcuts import redirect, render, get_object_or_404
from catalog.models import Product
from promotions.utils import calculate_product_price

def cart_add(request, product_id):
    product = get_object_or_404(Product, id=product_id)

    cart = request.session.get("cart", {})

    quantity = int(request.POST.get("quantity", 1))

    if str(product_id) in cart:
        cart[str(product_id)]["quantity"] += quantity
    else:
        cart[str(product_id)] = {
            "name": product.name,
            "price": float(product.sale_price),
            "quantity": quantity,
            "image": product.image.url if product.image else "",
        }

    request.session["cart"] = cart
    request.session.modified = True

    return redirect("cart:detail")


def cart_detail(request):
    cart = request.session.get("cart", {})
    total = sum(item["price"] * item["quantity"] for item in cart.values())

    return render(request, "cart/cart_detail.html", {
        "cart": cart,
        "total": total
    })

def cart_detail(request):
    cart = request.session.get("cart", {})

    cart_items = {}
    total = 0

    for product_id, item in cart.items():
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            continue

        # 🔥 Apply category promotion
        final_price, discount, promotion = calculate_product_price(product)

        cart_items[product_id] = {
            "name": item["name"],
            "quantity": item["quantity"],
            "image": item.get("image"),
            "mrp": product.mrp,
            "promotion": promotion,
            "final_price": final_price,
            "price": final_price * item["quantity"],
        }

        total += final_price * item["quantity"]

    context = {
        "cart": cart_items,
        "total": total,
    }

    return render(request, "cart/cart_detail.html", context)
