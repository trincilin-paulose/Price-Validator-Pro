# pricing_monitor/services/csv_processor.py
import csv
from decimal import Decimal
from django.utils.text import slugify
from catalog.models import Product, Category
from pricing_monitor.models import ImportedProduct, SkippedPriceImport, CSVImportLog
from .price_rules import validate_price
from .suggestions import suggest_fix


def to_decimal(value):
    try:
        return Decimal(str(value).replace("₹", "").strip())
    except Exception:
        return None
    
def get_or_create_category(name, parent=None):
    """
    Safe category creation that avoids slug conflicts
    """
    name = name.strip().title()
    slug = slugify(name)

    category = Category.objects.filter(slug=slug, parent=parent).first()
    if category:
        return category

    return Category.objects.create(
        name=name,
        slug=slug,
        parent=parent
    )


Product.objects.filter(is_deal_price=True).update(
    is_deal_price=False,
    sale_price=None
)


def process_csv_upload(csv_upload):
    """
    Processes CSV and imports only valid Net Price products.
    """
    csv_file = csv_upload.file
    csv_file.seek(0)

    reader = csv.DictReader(csv_file.read().decode("utf-8").splitlines())

    imported = 0
    skipped = 0

    REQUIRED_COLUMNS = [
        "SKU",
        "Product Name",
        "Category",
        "Sub-category",
        # "MRP",
        # "Net Price",
    ]

    # MRP required ONLY when price validation is enabled
    if getattr(csv_upload, "consider_price_validation", False):
        REQUIRED_COLUMNS.extend(["MRP", "Net Price"])

    from catalog.models import Product, Category
    from promotions.models import ProductPromotion, CategoryPromotion
    from pricing_monitor.models import ImportedProduct, SkippedPriceImport, CSVImportLog
    from django.utils import timezone

    for index, row in enumerate(reader, start=2):
        mrp = None
        net_price = None

        try:
            # 1️⃣ Required columns validation
            for col in REQUIRED_COLUMNS:
                if not row.get(col):
                    raise ValueError(f"Missing required column: {col}")

            sku = row["SKU"].strip()
            name = row["Product Name"].strip()
            category_name = row["Category"].strip().title()
            subcategory_name = row["Sub-category"].strip().title()

            # mrp = to_decimal(row["MRP"])
            mrp = to_decimal(row["MRP"]) if row.get("MRP") else None
            # net_price = to_decimal(row["Net Price"])
            net_price = (
                to_decimal(row["Net Price"])
                if row.get("Net Price")
                else None
            )

            # =====================================================
            # 🔒 SAFE PRICE VALIDATION (NEW LOGIC)
            # =====================================================
            if getattr(csv_upload, "consider_price_validation", False):

                product = Product.objects.filter(sku=sku).first()
                if not product:
                    SkippedPriceImport.objects.create(
                        sku=sku,
                        reason="SKU not found in catalog"
                    )
                    continue
                
                current_sale_price = None

                if product:
                    # 1️⃣ Product promotion
                    product_promo = product.product_promotions.filter(
                        is_active=True,
                        start_date__lte=timezone.now(),
                        end_date__gte=timezone.now()
                    ).first()

                    if product_promo:
                        # current_sale_price = product_promo.get_discounted_price()
                        # base_price = product.sale_price or product.mrp
                        # current_sale_price = product_promo.get_discounted_price(base_price)
                        current_sale_price = product_promo.get_discounted_price()

                    # 2️⃣ Category promotion
                    elif product.category:
                        category_promo = CategoryPromotion.objects.filter(
                            category=product.category,
                            is_active=True,
                            start_date__lte=timezone.now(),
                            end_date__gte=timezone.now()
                        ).first()

                        if category_promo:
                            # current_sale_price = category_promo.get_discounted_price(
                            #     product.sale_price or product.mrp
                            # )
                            current_sale_price = category_promo.get_discounted_price(product)

                    # 3️⃣ Regular sale price
                    if current_sale_price is None:
                        current_sale_price = product.sale_price or product.mrp

                # 4️⃣ Fallback (new product)
                # if current_sale_price is None:
                #     current_sale_price = mrp

                if current_sale_price is None:
                    current_sale_price = (
                        product.sale_price
                        or product.mrp
                        or mrp
                    )

                # ❌ Reject CSV row if net price is lower
                if net_price < current_sale_price:
                    SkippedPriceImport.objects.create(
                        row_number=index,
                        sku=sku,
                        product_name=name,
                        mrp=mrp or 0,
                        current_sale_price=current_sale_price,
                        price=net_price or 0,
                        reason=(
                            f"CSV Net Price ({net_price}) is lower than "
                            f"current sale price ({current_sale_price})"
                        ),
                        suggestion="Increase Net Price to match or exceed current sale price",
                    )
                    skipped += 1
                    continue
            # =====================================================

            # 2️⃣ CATEGORY
            category = get_or_create_category(category_name)

            # 3️⃣ SUBCATEGORY
            subcategory = None
            if subcategory_name:
                subcategory = get_or_create_category(subcategory_name, parent=category)

            # 4️⃣ PRODUCT UPSERT
            product, created = Product.objects.get_or_create(
                sku=sku,
                defaults={
                    "name": name,
                    "slug": slugify(name),
                    "category": category,
                    "subcategory": subcategory,
                    "mrp": mrp,
                },
            )

            previous_price = product.sale_price or product.mrp
            # ⏭ Skip if price is unchanged
            if net_price is not None and previous_price == net_price:
                SkippedPriceImport.objects.create(
                    row_number=index,
                    sku=sku,
                    product_name=name,
                    reason="CSV net price is same as current sale price",
                    suggestion="Change price to create a new update",
                )
                continue

            # 🔁 ALWAYS UPDATE PRICES
            product.category = category
            product.subcategory = subcategory

            if mrp is not None:
                product.mrp = mrp

            # product.sale_price = net_price
            if net_price is not None:
                product.sale_price = net_price
                # product.is_deal_price = True

            product.is_deal_price = True
            product.is_active = True
            # product.save()

            product.save(update_fields=[
                "sale_price",
                "is_deal_price",
                "is_active",
                "updated_at"
            ])

            # 5️⃣ TRACK IMPORT
            # ImportedProduct.objects.get_or_create(
            #     csv_upload=csv_upload,
            #     product=product
            # )
            ImportedProduct.objects.update_or_create(
                csv_upload=csv_upload,
                product=product,
                defaults={
                    "mrp": mrp,
                    # "previous_price": product.sale_price if not created else None,
                    "previous_price": previous_price if not created else None,
                    "updated_price": net_price,
                }
            )

            imported += 1

        except Exception as e:
            SkippedPriceImport.objects.create(
                row_number=index,
                sku=row.get("SKU", ""),
                product_name=row.get("Product Name", ""),
                mrp=mrp or 0,
                price=net_price or 0,
                reason=str(e),
                suggestion="Check CSV format or values",
            )
            skipped += 1

    CSVImportLog.objects.create(
        file_name=csv_file.name,
        imported=imported,
        skipped=skipped,
    )

    return imported, skipped




#def process_csv_upload(csv_file, csv_upload):
# def process_csv_upload(csv_upload):
#     """
#     Processes CSV and imports only valid Net Price products.
#     """
#     csv_file = csv_upload.file
#     csv_file.seek(0)
#     #file = csv_upload.csv_file

#     reader = csv.DictReader(csv_file.read().decode("utf-8").splitlines())

#     imported = 0
#     skipped = 0

#     REQUIRED_COLUMNS = [
#         "SKU",
#         "Product Name",
#         "Category",
#         "Sub-category",
#         "MRP",
#         "Net Price",
#     ]

#     for index, row in enumerate(reader, start=2):
#         mrp = None
#         net_price = None
#         # min_percent = csv_upload.min_net_price_percent
#         try:
#             # Validate required columns
#             for col in REQUIRED_COLUMNS:
#                 if not row.get(col):
#                     raise ValueError(f"Missing required column: {col}")

#             sku = row["SKU"].strip()
#             name = row["Product Name"].strip()
#             category_name = row["Category"].strip().title()
#             subcategory_name = row["Sub-category"].strip().title()

#             mrp = to_decimal(row["MRP"])
#             net_price = to_decimal(row["Net Price"])

#             # valid, reason = validate_price(mrp, net_price)
#             # min_percent = csv_upload.min_net_price_percent
#             # valid, reason = validate_price(mrp, net_price, min_percent)
#             valid, reason = validate_price(mrp, net_price)

#             # ❌ INVALID → SKIP
#             if not valid:
#                 SkippedPriceImport.objects.create(
#                     row_number=index,
#                     sku=sku,
#                     product_name=name,
#                     mrp=mrp or 0,
#                     price=net_price or 0,
#                     # min_price_percent=min_percent,
#                     reason=reason,
#                     suggestion=suggest_fix(),
#                 )
#                 skipped += 1
#                 continue

#             # ✅ CATEGORY
#             # category, _ = Category.objects.get_or_create(
#             #     name=category_name,
#             #     parent=None,
#             #     defaults={"slug": slugify(category_name)},
#             # )
#             category = get_or_create_category(category_name)

#             # ✅ SUBCATEGORY
#             subcategory = None
#             if subcategory_name:
#                 # subcategory, _ = Category.objects.get_or_create(
#                 #     name=subcategory_name,
#                 #     parent=category,
#                 #     defaults={"slug": slugify(subcategory_name)},
#                 # )
#                 subcategory = get_or_create_category(subcategory_name, parent=category)

#             # ✅ PRODUCT UPSERT
#             # Product.objects.update_or_create(
#             #     sku=sku,
#             #     defaults={
#             #         "name": name,
#             #         "slug": slugify(name),
#             #         "category": category,
#             #         "subcategory": subcategory,
#             #         "mrp": mrp,
#             #         "sale_price": net_price,
#             #         "stock": int(row.get("Stock", 0)),
#             #     },
#             # )

#             product, created = Product.objects.get_or_create(
#                 sku=sku,
#                 defaults={
#                     "name": name,
#                     "slug": slugify(name),
#                     "category": category,
#                     "subcategory": subcategory,
#                     "mrp": mrp,
#                     "csv_upload": csv_upload,
#                     #"sale_price": net_price,
#                     #"is_deal_price": True,
#                 },
#             )

#             # 🔥 ALWAYS update deal price fields
#             product.sale_price = net_price
#             product.is_deal_price = True
#             # product.csv_upload = csv_upload
#             # product.save()

#             # 🔁 UPDATE ONLY PRICE FIELDS FOR EXISTING PRODUCTS
#             if not created:
#                 product.mrp = mrp
#                 product.sale_price = net_price
#                 product.is_deal_price = True
#                 # product.save(update_fields=["mrp", "sale_price", "is_deal_price", "csv_upload"])
#                 product.save(update_fields=["mrp", "sale_price", "is_deal_price"])
#             # else:
#             #     raise ValueError("Product does not exist in catalog")

#             ImportedProduct.objects.get_or_create(
#                 csv_upload=csv_upload,
#                 product=product
#             )

#             imported += 1

#         except Exception as e:
#             SkippedPriceImport.objects.create(
#                 row_number=index,
#                 sku=row.get("SKU", ""),
#                 product_name=row.get("Product Name", ""),
#                 mrp=0,
#                 price=net_price or 0,
#                 # min_price_percent=min_percent,
#                 reason=str(e),
#                 suggestion="Check CSV format or values",
#             )
#             skipped += 1

#     CSVImportLog.objects.create(
#         file_name=csv_file.name,
#         imported=imported,
#         skipped=skipped,
#     )

#     return imported, skipped






# # pricing_monitor/services/csv_processor.py
# import csv
# from decimal import Decimal
# from django.utils.text import slugify
# from catalog.models import Product, Category
# from pricing_monitor.models import SkippedPriceImport
# from .price_rules import validate_price
# from .suggestions import suggest_fix

# def process_csv_upload(csv_file):
#     """
#     Processes a CSV file for importing products with price validation.
#     """

#     print("🚀 CSV PROCESSOR STARTED")
#     reader = csv.DictReader(csv_file.read().decode("utf-8").splitlines())

#     imported = 0
#     skipped = 0

#     for index, row in enumerate(reader, start=2):  # start=2 for CSV header row
#         try:
#             print(
#                 f"📄 ROW {index} | "
#                 f"SKU={row.get('SKU')} | "
#                 f"MRP={row.get('MRP')} | "
#                 f"SALE={row.get('Sale Price')}"
#             )
             
#             mrp = Decimal(row["MRP"])
#             sale_price = Decimal(row["Sale Price"])

#             # Validate price
#             valid, reason = validate_price(mrp, sale_price)
#             if not valid:
#                 print(f"❌ SKIPPED ROW {index}: {reason}")
#                 SkippedPriceImport.objects.create(
#                     row_number=index,
#                     sku=row.get("SKU", ""),
#                     product_name=row.get("Name", ""),
#                     mrp=mrp,
#                     price=sale_price,
#                     reason=reason,
#                     suggestion=suggest_fix(),
#                 )
#                 skipped += 1
#                 continue
#             print(f"✅ VALID ROW {index} – importing product")

#             # Handle category
#             category_name = row["Category"]
#             category, _ = Category.objects.get_or_create(
#                 name=category_name,
#                 parent=None,
#                 defaults={"slug": slugify(category_name)}
#             )

#             # Handle subcategory (optional)
#             subcategory_name = row.get("Subcategory", "").strip()
#             subcategory = None
#             if subcategory_name:
#                 subcategory, _ = Category.objects.get_or_create(
#                     name=subcategory_name,
#                     parent=category,
#                     defaults={"slug": slugify(subcategory_name)}
#                 )

#             # Create or update product
#             Product.objects.update_or_create(
#                 sku=row["SKU"],
#                 defaults={
#                     "name": row["Name"],
#                     "slug": slugify(row["Name"]),
#                     "category": category,
#                     "subcategory": subcategory,
#                     "mrp": mrp,
#                     "sale_price": sale_price,
#                     "stock": int(row["Stock"]),
#                     "description": row["Description"],
#                     "specifications": row["Specifications"],
#                     "image": row["Image"],
#                 }
#             )
#             imported += 1

#         except Exception as e:
#             # Log CSV formatting or conversion errors
#             SkippedPriceImport.objects.create(
#                 row_number=index,
#                 sku=row.get("SKU", ""),
#                 product_name=row.get("Name", ""),
#                 mrp=row.get("MRP", 0),
#                 price=row.get("Sale Price", 0),
#                 reason=str(e),
#                 suggestion="Check CSV formatting and retry",
#             )
#             skipped += 1
#     print(f"🏁 CSV FINISHED | Imported={imported} | Skipped={skipped}")

#     return imported, skipped
