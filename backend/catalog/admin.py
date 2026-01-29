import csv
from urllib.request import urlopen
from io import BytesIO
from django.http import HttpResponse
from django.contrib import admin, messages
from django.core.files.base import ContentFile
from django.db import transaction
from django.core.files.temp import NamedTemporaryFile
from .models import Category, Product
from django.shortcuts import render, redirect
from django.urls import path
from django.utils.text import slugify
from decimal import Decimal, InvalidOperation

def parse_decimal(value, default=None):
    try:
        if value in ("", None):
            return default
        return Decimal(value)
    except (InvalidOperation, TypeError):
        return default

def parse_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default

@admin.action(description="Export selected categories to CSV")
def export_categories_csv(modeladmin, request, queryset):
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="categories.csv"'

    writer = csv.writer(response)
    writer.writerow(["name", "slug", "parent_slug", "is_active"])

    for cat in queryset:
        writer.writerow([
            cat.name,
            cat.slug,
            cat.parent.slug if cat.parent else "",
            int(cat.is_active),
        ])

    return response

def export_all_categories_csv(request):
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="categories_all.csv"'

    writer = csv.writer(response)
    writer.writerow(["name", "slug", "parent_slug", "is_active"])

    for cat in Category.objects.all():
        writer.writerow([
            cat.name,
            cat.slug,
            cat.parent.slug if cat.parent else "",
            int(cat.is_active),
        ])

    return response


class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'parent', 'is_active')
    list_filter = ('is_active', 'parent')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}
    fields = ("name", "slug", "image", "banner")
    actions = [export_categories_csv]

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "import-csv/",
                self.admin_site.admin_view(self.import_csv),
                name="category_import_csv",
            ),
            path(
                "export-csv/",
                self.admin_site.admin_view(export_all_categories_csv),
                name="category_export_csv",
            ),
        ]
        return custom_urls + urls
    
    def import_csv(self, request):
        if request.method == "POST":
            csv_file = request.FILES.get("csv_file")

            if not csv_file.name.endswith(".csv"):
                messages.error(request, "Please upload a CSV file.")
                return redirect("..")

            decoded = csv_file.read().decode("utf-8").splitlines()
            reader = csv.DictReader(decoded)

            for row in reader:
                parent = None
                parent_slug = row.get("parent_slug")

                if parent_slug:
                    parent = Category.objects.filter(slug=parent_slug).first()

                Category.objects.update_or_create(
                    slug=row["slug"],
                    defaults={
                        "name": row["name"],
                        "parent": parent,
                        "is_active": bool(int(row.get("is_active", 1))),
                    },
                )

            messages.success(request, "Categories imported successfully!")
            return redirect("..")

        return render(request, "admin/catalog/category/import_csv.html")

admin.site.register(Category, CategoryAdmin)

def export_products_csv(modeladmin, request, queryset):
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="products.csv"'

    writer = csv.writer(response)

    writer.writerow([
        "name",
        "slug",
        "sku",
        "category_slug",
        "subcategory_slug",
        "mrp",
        "sale_price",
        "stock",
        "description",
        "specifications",
        "image_url",
        "is_active",
    ])

    for p in queryset:
        writer.writerow([
            p.name,
            p.slug,
            p.sku,
            p.category.slug if p.category else "",
            p.subcategory.slug if p.subcategory else "",
            p.mrp,
            p.sale_price,
            p.stock,
            p.description,
            p.specifications,
            p.image.url if p.image else "",
            p.is_active,
        ])

    return response

export_products_csv.short_description = "Export Products CSV"

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'sku', 'category', 'sale_price',
        'stock', 'is_active'
    )

    list_filter = ('category', 'is_active')
    search_fields = ('name', 'sku')
    prepopulated_fields = {'slug': ('name',)}

    readonly_fields = ('created_at', 'updated_at')

    actions = [export_products_csv]

    change_list_template = "admin/catalog/product/change_list.html"

    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'slug', 'sku', 'category', 'subcategory')
        }),
        ('Pricing', {
            'fields': ('mrp', 'sale_price', 'stock')
        }),
        ('Content', {
            'fields': ('description', 'specifications', 'image')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    # -----------------------
    # EXPORT CSV
    # -----------------------
    def export_products_csv(self, request):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="products.csv"'

        writer = csv.writer(response)
        writer.writerow([
            # "Name", "Slug", "SKU",
            # "Category", "Subcategory",
            # "MRP", "Sale Price", "Stock",
            # "Description", "Specifications", "Image"
            "SKU",
            "Product Name",
            "Slug",
            "Category",
            "Subcategory",  
            #"Brand",
            "MRP",
            "Sale Price",
            "Stock",
            "Description",
            "Specifications",
            "Image",
        ])

        for product in Product.objects.select_related("category"):
            if product.category and product.category.parent:
                category_name = product.category.parent.name
                subcategory_name = product.category.name
            else:
                category_name = product.category.name if product.category else ""
                subcategory_name = ""
            writer.writerow([
                # product.name,
                # product.slug,
                # product.sku,
                # category_name,
                # subcategory_name,
                # product.mrp,
                # product.sale_price,
                # product.stock,
                # product.description,
                # product.specifications,
                # product.image.name if product.image else "",
                product.sku,
                product.name,
                product.slug,
                product.category.name if product.category else "",
                product.subcategory.name if product.subcategory else "",
                #product.brand.name if product.brand else "",
                product.mrp,
                product.sale_price,   # 🔥 campaign > product > category
                product.stock,
                product.description,
                product.specifications,
                product.image.url if product.image else "",
            ])

        return response
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path("export-csv/", self.export_products_csv),
            path("import-csv/", self.import_products_csv),
        ]
        return custom_urls + urls

    def import_products_csv(self, request):
        if request.method != "POST":
            return render(request, "admin/catalog/product/import_csv.html")

        csv_file = request.FILES.get("csv_file")

        if not csv_file:
            self.message_user(request, "No CSV file uploaded", level=messages.ERROR)
            return redirect("..")

        # -----------------------------
        # READ FILE (UTF-8 / EXCEL SAFE)
        # -----------------------------
        try:
            content = csv_file.read()
            decoded = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                decoded = content.decode("latin-1")
            except UnicodeDecodeError:
                self.message_user(
                    request,
                    "Invalid file encoding. Please save CSV as UTF-8.",
                    level=messages.ERROR
                )
                return redirect("..")

        reader = csv.reader(decoded.splitlines())
        headers = next(reader)

        # -----------------------------
        # HEADER NORMALIZATION & MAP
        # -----------------------------
        raw_headers = [h.strip() for h in headers]

        header_map = {
            # "name": ["name", "product name"],
            # "slug": ["slug"],
            # "sku": ["sku", "sku code"],
            # "category": ["category", "parent category"],
            # "subcategory": ["subcategory", "child category"],
            # "mrp": ["mrp", "price", "list price"],
            # "sale price": ["sale price", "selling price", "discount price"],
            # "stock": ["stock", "qty", "quantity"],
            # "description": ["description", "desc"],
            # "specifications": ["specifications", "specs"],
            # "image": ["image", "image path", "image_url"],

            # "sku": ["sku", "sku code"],
            # "name": ["name", "product name"],
            # "slug": ["slug"],
            # "category": ["category", "parent category"],
            # "subcategory": ["subcategory", "child category"],
            # "mrp": ["mrp", "price", "list price"],
            # "sale price": ["sale price", "selling price", "discount price"],
            # "stock": ["stock", "qty", "quantity"],
            # "description": ["description", "desc"],
            # "specifications": ["specifications", "specs"],
            # "image": ["image", "image path", "image_url"],

            "SKU": ["sku", "sku code"],
            "Product Name": ["name", "product name"],
            "Slug": ["slug"],
            "Category": ["category", "parent category"],
            "Subcategory": ["subcategory", "child category"],
            "MRP": ["mrp", "price", "list price"],
            "Sale Price": ["sale price", "selling price", "discount price"],
            "Stock": ["stock", "qty", "quantity"],
            "Description": ["description", "desc"],
            "Specifications": ["specifications", "specs"],
            "Image": ["image", "image path", "image_url"],
        }

        normalized_headers = {}

        for canonical, aliases in header_map.items():
            for h in raw_headers:
                if h.lower() in aliases:
                    normalized_headers[canonical] = h
                    break

        required_headers = {
            # "name", "slug", "sku", "category", "subcategory",
            # "mrp", "sale price", "stock", "description", "specifications"
            #"sku", "name", "slug", "category", "subcategory", "mrp", "sale price", "stock", "description", "specifications", "image",
            "SKU",
            "Product Name",
            "Slug",
            "Category",
            "Subcategory",  
            #"Brand",
            "MRP",
            "Sale Price",
            "Stock",
            "Description",
            "Specifications",
            "Image",
        }

        missing = required_headers - normalized_headers.keys()
        if missing:
            self.message_user(
                request,
                f"Missing required columns: {missing}",
                level=messages.ERROR
            )
            return redirect("..")

        created = updated = skipped = 0

        # -----------------------------
        # PROCESS ROWS
        # -----------------------------
        for row_values in reader:
            raw_row = dict(zip(raw_headers, row_values))

            row = {
                key: raw_row.get(csv_col, "").strip()
                for key, csv_col in normalized_headers.items()
            }

            # sku = row.get("sku")
            # name = row.get("name")
            # category_name = row.get("category")
            # subcategory_name = row.get("subcategory")

            sku = row.get("SKU")
            name = row.get("Product Name")
            category_name = row.get("Category")
            subcategory_name = row.get("Subcategory")

            self.message_user(request, f"Processing SKU={sku}, Name={name}, Image={row.get('Image')}")
            print("CSV HEADERS:", raw_headers, row_values)

            # -----------------------------
            # REQUIRED FIELD CHECK
            # -----------------------------
            if not all([sku, name, category_name, subcategory_name]):
                skipped += 1
                continue

            # -----------------------------
            # CATEGORY & SUBCATEGORY
            # -----------------------------
            category, _ = Category.objects.get_or_create(
                name=category_name,
                parent=None,
                defaults={"slug": slugify(category_name)}
            )

            subcategory, _ = Category.objects.get_or_create(
                name=subcategory_name,
                parent=category,
                defaults={"slug": slugify(subcategory_name)}
            )

            # -----------------------------
            # SAFE NUMERIC VALUES
            # -----------------------------
            try:
                # mrp = float(row.get("mrp") or 0)
                # sale_price = float(row.get("sale price") or mrp)
                # stock = int(float(row.get("stock") or 0))
                mrp = float(row.get("MRP") or 0)
                sale_price = float(row.get("Sale Price") or mrp)
                stock = int(float(row.get("Stock") or 0))
            except ValueError:
                skipped += 1
                continue

            if mrp <= 0:
                skipped += 1
                continue

            # -----------------------------
            # CREATE / UPDATE PRODUCT
            # -----------------------------
            product, created_flag = Product.objects.get_or_create(
                sku=sku,
                defaults={
                    "name": name,
                    "slug": row.get("slug") or slugify(name),
                    "category": subcategory,
                    "mrp": mrp,
                    "sale_price": sale_price,
                    "stock": stock,
                    "description": row.get("Description", ""),
                    "specifications": row.get("Specifications", ""),
                }
            )

            if created_flag:
                created += 1
            else:
                updated_fields = False

                def update(field, value):
                    nonlocal updated_fields
                    if getattr(product, field) != value:
                        setattr(product, field, value)
                        updated_fields = True

                update("name", name)
                update("slug", row.get("slug") or slugify(name))
                update("category", subcategory)
                update("mrp", mrp)
                update("sale_price", sale_price)
                update("stock", stock)
                update("description", row.get("Description", ""))
                update("specifications", row.get("Specifications", ""))

                if updated_fields:
                    product.save()
                    updated += 1

            # -----------------------------
            # IMAGE HANDLING
            # -----------------------------
            image_path = row.get("Image")
            if image_path:
                image_path = image_path.replace("\\", "/")

                # Avoid re-upload if same image already set
                if not product.image or not product.image.name.endswith(image_path):
                    product.image.name = image_path
                    product.save(update_fields=["image"])

        # -----------------------------
        # FINAL MESSAGE
        # -----------------------------
        self.message_user(
            request,
            f"Import completed → Created: {created}, Updated: {updated}, Skipped: {skipped}",
            level=messages.SUCCESS
        )

        return redirect("..")


    
    








