import csv
from django.http import HttpResponse
from django.contrib import admin, messages
from .models import ImportedProduct, ProductCSVUpload, SkippedPriceImport
from .services.csv_processor import process_csv_upload
from django.urls import reverse, path
from django.shortcuts import redirect
from django.utils.html import format_html
from catalog.models import Product

# class ImportedProductInline(admin.TabularInline):
#     model = Product
#     extra = 0
#     fields = ("sku", "name", "mrp", "sale_price", "stock")
#     readonly_fields = ("sku", "name")
#     show_change_link = True

class ImportedProductInline(admin.TabularInline):
    model = ImportedProduct
    extra = 0
    readonly_fields = (
        "product",
        "mrp",
        "previous_price",
        "updated_price",
        "created_at",
    )
    fields = (
        "product",
        "mrp",
        "previous_price",
        "updated_price",
        "created_at",
    )
    can_delete = True
    # template = "admin/catalog/product/tabular_inline.html"

# ================= EXPORT SKIPPED PRICE IMPORTS =================

def export_skipped_prices_csv(request):
    last_upload = ProductCSVUpload.objects.order_by("-uploaded_at").first()

    if not last_upload:
        return redirect(request.META.get("HTTP_REFERER", "/admin/"))

    csv_file_path = last_upload.file.path

    original_rows = {}
    with open(csv_file_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            original_rows[row["SKU"]] = row

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = (
        'attachment; filename="skipped_price_imports.csv"'
    )

    writer = csv.writer(response)

    writer.writerow([
        "SKU",
        "Category",
        "Sub-category",
        "Brand",
        "Product Name",
        "MRP",
        "Discount",
        "Discount Amount",
        "Net Price",
        "Stock",
        "Rating",
    ])

    for skipped in SkippedPriceImport.objects.all():
        row = original_rows.get(skipped.sku)
        if not row:
            continue

        writer.writerow([
            row.get("SKU"),
            row.get("Category"),
            row.get("Sub-category"),
            row.get("Brand"),
            row.get("Product Name"),
            row.get("MRP"),
            row.get("Discount"),
            row.get("Discount Amount"),
            row.get("Net Price"),
            row.get("Stock"),
            row.get("Rating"),
        ])

    return response


@admin.register(ProductCSVUpload)
class ProductCSVUploadAdmin(admin.ModelAdmin):
    # list_display = ("id", "uploaded_at", "processed", "min_net_price_percent")
    # list_display = ("id", "uploaded_at", "processed")
    # list_display = (
    #     "id",
    #     "file",
    #     "status",
    #     "consider_price_validation",
    #     "uploaded_at",
    # )
    # list_editable = ("min_net_price_percent",)
    list_display = ("id","file", "consider_price_validation", "uploaded_at")
    list_editable = ("consider_price_validation",)
    readonly_fields = ("uploaded_at", "processed")
    inlines = [ImportedProductInline]
    actions = ["process_csv"]

    fieldsets = (
        (None, {
            "fields": ("file", "consider_price_validation"),
        }),
        ("Status", {
            "fields": ("status",),
        }),
    )

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if obj is None:  # ADD page
            form.base_fields["file"].required = True
        else:           # CHANGE page
            form.base_fields["file"].required = False
        return form
    
    def save_model(self, request, obj, form, change):
        print("FILES RECEIVED:", request.FILES)
        super().save_model(request, obj, form, change)

    def process_csv(self, request, queryset):
        print("🧠 ADMIN ACTION TRIGGERED") 
        for upload in queryset:
            print(f"📂 PROCESSING FILE: {upload.file.name}") 
            #imported, skipped = process_csv_upload(upload.file)
            imported, skipped = process_csv_upload(upload)
            upload.processed = True
            upload.save(update_fields=["processed"])

            self.message_user(
                request,
                f"CSV Processed: Imported {imported}, Skipped {skipped}",
                level=messages.SUCCESS,
            )

    process_csv.short_description = "Process CSV & Validate Prices"


@admin.register(SkippedPriceImport)
class SkippedPriceImportAdmin(admin.ModelAdmin):
    list_display = (
        "row_number",
        "sku",
        "product_name",
        "mrp",
        "current_sale_price",
        "price",
        "reason",
        "edit_product", 
        "created_at",
    )

    readonly_fields = (
        "row_number",
        "sku",
        "product_name",
        "mrp",
        "current_sale_price",
        "price",
        "reason",
        "created_at",
    )

    search_fields = ("sku", "product_name", "reason")
    list_filter = ("created_at",)

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "export-csv/",
                self.admin_site.admin_view(export_skipped_prices_csv),
                name="export-skipped-prices",
            )
        ]
        return custom_urls + urls

    def edit_product(self, obj):
        product = Product.objects.filter(sku=obj.sku).first()

        if not product:
            return format_html("<span style='color:red;'>No Product</span>")

        url = reverse(
            "admin:catalog_product_change",
            args=[product.id],
        )

        return format_html(
            '<a class="button" href="{}">✏️</a>',
            url
        )

    edit_product.short_description = "Edit Product"
 