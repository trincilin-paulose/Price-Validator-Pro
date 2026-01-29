from .models import Category

def menu_categories(request):
    categories = Category.objects.filter(
        parent__isnull=True,
        is_active=True
    ).prefetch_related('children')

    return {
        'menu_categories': categories
    }
