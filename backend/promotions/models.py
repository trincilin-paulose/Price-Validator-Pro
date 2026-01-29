# promotions/models.py
from django.db import models
from django.utils import timezone
from catalog.models import Category, Product


class CategoryPromotion(models.Model):
    DISCOUNT_TYPE_CHOICES = (
        ("PERCENTAGE", "Percentage"),
        ("FLAT", "Flat Amount"),
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name="category_promotions"
    )
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)

    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        label = "Category Promotion"
        return label
        # return f"{self.category.name} ({self.discount_value})"

    def is_valid(self):
        now = timezone.now()
        return self.is_active and self.start_date <= now <= self.end_date

    @property
    def currently_active(self):
        now = timezone.now()
        return self.is_active and self.start_date <= now <= self.end_date

    def get_discounted_price(self, product):
        """
        Category promotion needs product price
        """
        price = product.sale_price or product.mrp

        if not price:
            return None

        if self.discount_type == "PERCENTAGE":
            return price - (price * self.discount_value / 100)

        if self.discount_type == "FLAT":
            return price - self.discount_value

        return price


class ProductPromotion(models.Model):
    DISCOUNT_TYPE_CHOICES = (
        ("percentage", "Percentage"),
        ("flat", "Flat Amount"),
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="product_promotions"
    )

    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)

    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Product promotion"
        verbose_name_plural = "Product promotions"

    def __str__(self):
        label = "Product Promotion"
        return label
        # return f"{self.product.name} Promotion"

    def is_valid(self):
        now = timezone.now()
        return self.is_active and self.start_date <= now <= self.end_date

    @property
    def currently_active(self):
        now = timezone.now()
        return self.is_active and self.start_date <= now <= self.end_date

    def get_discounted_price(self):
        """
        Returns discounted price for THIS product promotion
        """
        price = self.product.sale_price or self.product.mrp

        if not price:
            return None

        if self.discount_type == "percentage":
            return price - (price * self.discount_value / 100)

        if self.discount_type == "flat":
            return price - self.discount_value

        return price
