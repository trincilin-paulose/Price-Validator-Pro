from django.db import models
from decimal import Decimal

# from checkout import admin


class SkippedPriceImport(models.Model):
    row_number = models.IntegerField()
    sku = models.CharField(max_length=100, blank=True)
    product_name = models.CharField(max_length=255, blank=True)
    mrp = models.DecimalField(max_digits=10, decimal_places=2)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.TextField()
    suggestion = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    min_price_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    current_sale_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    def __str__(self):
        return f"{self.sku} - Row {self.row_number}"

class ProductCSVUpload(models.Model):
    # file = models.FileField(upload_to="csv_uploads/", blank=True, null=True)
    file = models.FileField(upload_to='pricing_monitor/uploads/', blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    processed = models.BooleanField(default=False)
    status = models.CharField(max_length=20, default='pending')

    consider_price_validation = models.BooleanField(
        default=True,
        help_text="If unchecked, CSV prices will be imported without validation"
    )

    # min_net_price_percent = models.DecimalField(
    #     max_digits=5,
    #     decimal_places=2,
    #     default=Decimal("50.00"),
    #     help_text="Minimum Net Price percentage of MRP (e.g. 50 = 50%)"
    # )

    def __str__(self):
        return f"Upload #{self.id}"

# @admin.register(ProductCSVUpload)
# class ProductCSVUploadAdmin(admin.ModelAdmin):
#     list_display = ("id", "file", "processed", "consider_price_validation", "uploaded_at")
#     list_filter = ("processed", "consider_price_validation")

class CSVImportLog(models.Model):
    file_name = models.CharField(max_length=255)
    imported = models.IntegerField()
    skipped = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)


class ImportedProduct(models.Model):
    csv_upload = models.ForeignKey(
        ProductCSVUpload,
        on_delete=models.CASCADE,
        related_name="imported_products"
    )
    product = models.ForeignKey(
        "catalog.Product",
        on_delete=models.CASCADE
    )

    mrp = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    previous_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    updated_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.product.sku} (Upload {self.csv_upload.id})"