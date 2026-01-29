from django.db import models
from django.urls import reverse
from decimal import Decimal
from django.utils import timezone
from django.apps import apps
#from promotions.models import Promotion
from pricing_monitor.models import ProductCSVUpload
from django.utils.text import slugify

# Create your models here.


class Category(models.Model):
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=160, unique=True, blank=True)
    image = models.ImageField(upload_to='categories/', blank=True, null=True)

    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        related_name='children',
        blank=True,
        null=True
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ['name']

    banner = models.ImageField(
        upload_to="categories/banners/",
        blank=True,
        null=True
    )

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 1

            while Category.objects.filter(slug=slug).exclude(id=self.id).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1

            self.slug = slug

        super().save(*args, **kwargs)

    def __str__(self):
        if self.parent:
            return f"{self.parent.name} → {self.name}"
        return self.name
    

# catalog/models.py

from django.db import models
from django.utils.text import slugify

class Product(models.Model):
    category = models.ForeignKey(
        'Category',
        on_delete=models.CASCADE,
        related_name='products'
    )
    subcategory = models.ForeignKey(
        'Category',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sub_products'
    )

    # csv_upload = models.ForeignKey(
    #     ProductCSVUpload,
    #     on_delete=models.SET_NULL,
    #     null=True,
    #     blank=True,
    #     related_name="imported_products"
    # )

    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100, unique=True)

    mrp = models.DecimalField(max_digits=10, decimal_places=2)
    sale_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    stock = models.PositiveIntegerField(default=0)

    description = models.TextField(blank=True)
    specifications = models.TextField(blank=True)

    slug = models.SlugField(max_length=255, unique=True, blank=True)

    image = models.ImageField(upload_to='products/', blank=True, null=True)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_deal_price = models.BooleanField(default=False)

    # def get_promotion_label(self):
    #     """
    #     Determines promotion label for frontend display
    #     Priority:
    #     1. Pricing monitor import
    #     2. Product promotion
    #     3. Category promotion
    #     """

    #     # 1️⃣ Special Promotion (Pricing Monitor)
    #     from pricing_monitor.models import ProductCSVUpload

    #     # if ProductCSVUpload.objects.filter(product=self).exists():
    #     if ProductCSVUpload.objects.filter(imported_products__product=self).exists():
    #         return "Special Promotion"

    #     # 2️⃣ Product Promotion
    #     if hasattr(self, "active_product_promotion") and self.active_product_promotion:
    #         return "Product Promotion"

    #     # 3️⃣ Category Promotion
    #     if self.category and hasattr(self.category, "active_category_promotion"):
    #         if self.category.active_category_promotion:
    #             return "Category Promotion"

    #     return None

    # @property
    # def active_product_promotion(self):
    #     """
    #     Returns active product promotion if exists
    #     """
    #     now = timezone.now()
    #     return (
    #         self.product_promotions
    #         .filter(is_active=True, start_date__lte=now, end_date__gte=now)
    #         .first()
    #     )

    # @property
    # def active_product_promotion(self):
    #     """
    #     Returns active product promotion if exists
    #     """
    #     now = timezone.now()
    #     return (
    #         self.productpromotion_set
    #         .filter(is_active=True, start_date__lte=now, end_date__gte=now)
    #         .first()
    #     )

    @property
    def active_product_promotion(self):
        now = timezone.now()
        return (
            self.product_promotions
            .filter(
                is_active=True,
                start_date__lte=now,
                end_date__gte=now
            )
            .first()
        )
    
    @property
    def active_category_promotion(self):
        now = timezone.now()
        return (
            self.category_promotions
            .filter(
                is_active=True,
                start_date__lte=now,
                end_date__gte=now,
            ).first()
        )
    
    # @property
    # def active_category_promotion(self):
    #     from promotions.models import CategoryPromotion

    #     now = timezone.now()
    #     return CategoryPromotion.objects.filter(
    #         category=self,
    #         is_active=True,
    #         start_date__lte=now,
    #         end_date__gte=now,
    #     ).first()


    def get_promotion_label(self):
        """
        Determines promotion label for frontend display
        Priority:
        1. Pricing monitor import
        2. Product promotion
        3. Category promotion
        """

        
        
        from pricing_monitor.models import ProductCSVUpload
        from promotions.models import ProductPromotion, CategoryPromotion
        from django.utils import timezone

        now = timezone.now()

        # 1️⃣ Special Promotion (Pricing Monitor)
        if ProductCSVUpload.objects.filter(
            imported_products__product=self
        ).exists():
            return "Special Promotion"

        # 2️⃣ Product Promotion
        # if hasattr(self, "active_product_promotion") and self.active_product_promotion:
        #     return "Product Promotion"
        # 2️⃣ Product Promotion
        if ProductPromotion.objects.filter(
            product=self,
            is_active=True,
            start_date__lte=now,
            end_date__gte=now,
        ).exists():
            return "Product Promotion"


        # 3️⃣ Category Promotion
        # if self.category and hasattr(self.category, "active_category_promotion"):
        #     if self.category.active_category_promotion:
        #         return "Category Promotion"
        # 3️⃣ Category Promotion
        if self.category and CategoryPromotion.objects.filter(
            category=self.category,
            is_active=True,
            start_date__lte=now,
            end_date__gte=now,
        ).exists():
            return "Category Promotion"

        return None

    # active_promotion = models.ForeignKey(
    #     "promotions.Promotion",
    #     null=True,
    #     blank=True,
    #     on_delete=models.SET_NULL
    # )

    # @property
    # def final_price(self):
    #     return get_final_price(self)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
    
    def get_absolute_url(self):
        return reverse("catalog:product_detail", args=[self.slug])

    # def __str__(self):
    #     return self.name
    
    # ===============================
    # FINAL PRICE LOGIC (ADD BELOW)
    # ===============================

    @property
    def has_deal_price(self):
        """
        Pricing Monitor price has highest priority
        """
        # return (
        #     self.sale_price is not None
        #     and self.sale_price > 0
        #     and self.sale_price < self.mrp
        # )
    
        # return (
        #     self.is_deal_price is True
        #     and self.sale_price is not None
        #     and self.sale_price > 0
        #     and self.sale_price < self.mrp
        # )
        return self.is_deal_price and self.sale_price
    
    # def active_promotion(self):
    #     """
    #     Promotion priority:
    #     1. ProductPromotion (date-based)
    #     2. CategoryPromotion (is_active only)

    #     Pricing-monitor deal price is handled separately
    #     """
    #     now = timezone.now()

    #     ProductPromotion = apps.get_model("promotions", "ProductPromotion")
    #     CategoryPromotion = apps.get_model("promotions", "CategoryPromotion")

    #     # 1️⃣ PRODUCT PROMOTION (HIGHEST PRIORITY)
    #     product_promo = ProductPromotion.objects.filter(
    #         product=self,
    #         is_active=True,
    #         start_date__lte=now,
    #         end_date__gte=now,
    #     ).order_by("-discount_value").first()

    #     if product_promo:
    #         return product_promo

    #     # 2️⃣ CATEGORY PROMOTION (NO DATE FIELDS)
    #     category_promo = CategoryPromotion.objects.filter(
    #         category=self.category,
    #         is_active=True,
    #     ).order_by("-updated_at").first()

    #     return category_promo

    @property
    def active_promotion(self):
        """
        Promotion priority:
        1. ProductPromotion
        2. CategoryPromotion (self, child, parent)
        """
        now = timezone.now()

        ProductPromotion = apps.get_model("promotions", "ProductPromotion")
        CategoryPromotion = apps.get_model("promotions", "CategoryPromotion")

        # 1️⃣ PRODUCT PROMOTION
        product_promo = ProductPromotion.objects.filter(
            product=self,
            is_active=True,
            start_date__lte=now,
            end_date__gte=now,
        ).order_by("-discount_value").first()

        if product_promo:
            return product_promo

        category = self.category

        # 2️⃣ SAME CATEGORY
        category_promo = CategoryPromotion.objects.filter(
            category=category,
            is_active=True,
            start_date__lte=now,
            end_date__gte=now,
        ).order_by("-updated_at").first()

        if category_promo:
            return category_promo

        # 3️⃣ CHILD CATEGORY PROMOTION (Mobiles → OnePlus)
        child_category_promo = CategoryPromotion.objects.filter(
            category__parent=category,
            is_active=True,
            start_date__lte=now,
            end_date__gte=now,
        ).order_by("-updated_at").first()

        if child_category_promo:
            return child_category_promo

        # 4️⃣ PARENT CATEGORY PROMOTION
        if category.parent:
            parent_category_promo = CategoryPromotion.objects.filter(
                category=category.parent,
                is_active=True,
                start_date__lte=now,
                end_date__gte=now,
            ).order_by("-updated_at").first()

            if parent_category_promo:
                return parent_category_promo

        return None

    @property
    def display_price(self):
        """
        Single pricing authority for frontend
        """
        # if self.has_deal_price:
        #     return self.sale_price

        # if self.active_promotion:
        #     return self.active_promotion.final_price(self)

        # return self.mrp
        if self.has_deal_price:
            return self.sale_price

        if self.final_price and self.final_price < self.mrp:
            return self.final_price

        return self.mrp

    @property
    def show_mrp_strike(self):
        """
        Decide when MRP should be struck
        """
        return self.has_deal_price or self.active_promotion is not None

    @property
    def show_no_promo(self):
        """
        Show NO PROMO only if nothing applied
        """
        return not self.has_deal_price and not self.active_promotion
    
    

    def get_effective_sale_price(self):
        """
        Returns the actual sale price considering:
        1. Product promotion
        2. Category promotion
        3. sale_price
        4. mrp
        """

        # 1️⃣ Product promotion
        promo = self.product_promotions.filter(
            is_active=True,
            start_date__lte=timezone.now(),
            end_date__gte=timezone.now()
        ).first()

        if promo:
            if promo.discount_type == "percentage":
                return self.sale_price * (Decimal("1") - promo.discount_value / 100)
            return max(self.sale_price - promo.discount_value, Decimal("0"))

        # 2️⃣ Category promotion
        if self.category:
            cat_promo = self.category.categorypromotion_set.filter(
                is_active=True,
                start_date__lte=timezone.now(),
                end_date__gte=timezone.now()
            ).first()

            if cat_promo:
                if cat_promo.discount_type == "PERCENTAGE":
                    return self.sale_price * (Decimal("1") - cat_promo.discount_value / 100)
                return max(self.sale_price - cat_promo.discount_value, Decimal("0"))

        # 3️⃣ Normal sale price
        if self.sale_price:
            return self.sale_price

        # 4️⃣ Fallback
        return self.mrp


    def __str__(self):
        return self.name



