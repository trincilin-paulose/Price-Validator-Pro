import { Product, PriceThreshold, ValidationResult, AnalyticsSummary } from '@/types/price';

export const DEFAULT_THRESHOLDS: PriceThreshold = {
  minDiscount: 5,
  maxDiscount: 50,
  minMargin: 15,
  maxMargin: 80,
  lowPriceThreshold: 10,
  highPriceThreshold: 200,
};

export function validateProduct(product: Product, thresholds: PriceThreshold): ValidationResult {
  const issues: string[] = [];
  let severity: 'low' | 'medium' | 'high' = 'low';

  // Check discount percentage
  if (product.discountPercent < thresholds.minDiscount) {
    issues.push(`Discount (${product.discountPercent}%) is below minimum threshold (${thresholds.minDiscount}%)`);
  }
  if (product.discountPercent > thresholds.maxDiscount) {
    issues.push(`Discount (${product.discountPercent}%) exceeds maximum threshold (${thresholds.maxDiscount}%)`);
    severity = 'high';
  }

  // Check profit margin
  if (product.profitMargin < thresholds.minMargin) {
    issues.push(`Profit margin (${product.profitMargin.toFixed(1)}%) is below minimum (${thresholds.minMargin}%)`);
    severity = 'high';
  }
  if (product.profitMargin > thresholds.maxMargin) {
    issues.push(`Unusually high margin (${product.profitMargin.toFixed(1)}%) - verify pricing`);
    severity = 'medium';
  }

  // Check absolute price thresholds
  if (product.sellingPrice < thresholds.lowPriceThreshold) {
    issues.push(`Price ($${product.sellingPrice}) is suspiciously low`);
    severity = 'high';
  }
  if (product.sellingPrice > thresholds.highPriceThreshold && product.profitMargin < thresholds.minMargin) {
    issues.push(`High price with low margin - review cost structure`);
    severity = 'medium';
  }

  // Check competitor pricing
  if (product.competitorPrice) {
    const priceDiff = ((product.sellingPrice - product.competitorPrice) / product.competitorPrice) * 100;
    if (priceDiff > 20) {
      issues.push(`Price is ${priceDiff.toFixed(1)}% higher than competitor`);
      severity = severity === 'high' ? 'high' : 'medium';
    } else if (priceDiff < -30) {
      issues.push(`Price is ${Math.abs(priceDiff).toFixed(1)}% lower than competitor - potential margin loss`);
      severity = 'medium';
    }
  }

  // Generate recommendation
  let recommendation = '';
  if (issues.length === 0) {
    recommendation = 'Pricing is within acceptable ranges.';
  } else if (product.profitMargin < thresholds.minMargin) {
    const suggestedPrice = product.costPrice * (1 + thresholds.minMargin / 100);
    recommendation = `Consider raising price to $${suggestedPrice.toFixed(2)} to meet minimum margin.`;
  } else if (product.discountPercent > thresholds.maxDiscount) {
    const suggestedDiscount = thresholds.maxDiscount;
    const suggestedPrice = product.originalPrice * (1 - suggestedDiscount / 100);
    recommendation = `Reduce discount to ${suggestedDiscount}% (price: $${suggestedPrice.toFixed(2)}).`;
  } else if (product.competitorPrice && product.sellingPrice > product.competitorPrice * 1.1) {
    recommendation = `Consider matching competitor price of $${product.competitorPrice.toFixed(2)}.`;
  } else {
    recommendation = 'Review pricing strategy for this product.';
  }

  return {
    productId: product.id,
    issues,
    severity,
    recommendation,
  };
}

export function determineProductStatus(product: Product, thresholds: PriceThreshold): Product['status'] {
  // Check for warning conditions first (low margin or risky pricing)
  if (product.profitMargin < thresholds.minMargin || product.discountPercent > thresholds.maxDiscount) {
    return 'warning';
  }

  // If competitor price exists, use it to determine pricing position
  if (product.competitorPrice && product.competitorPrice > 0) {
    const priceDiff = product.sellingPrice - product.competitorPrice;
    const percentDiff = (priceDiff / product.competitorPrice) * 100;

    // High price: more than 5% higher than competitor
    if (percentDiff > 5) {
      return 'high';
    }

    // Low price: more than 5% lower than competitor
    if (percentDiff < -5) {
      return 'low';
    }

    // Medium: within ±5% of competitor (aligned)
    return 'valid';
  }

  // If no competitor price, check profit margin
  if (product.profitMargin > thresholds.maxMargin) {
    return 'high';
  }

  // Default to valid if all checks pass
  return 'valid';
}

export function calculateAnalytics(products: Product[]): AnalyticsSummary {
  if (products.length === 0) {
    return {
      totalProducts: 0,
      validProducts: 0,
      lowPricedProducts: 0,
      highPricedProducts: 0,
      averageMargin: 0,
      potentialRevenueLoss: 0,
    };
  }

  const validProducts = products.filter(p => p.status === 'valid').length;
  const lowPricedProducts = products.filter(p => p.status === 'low').length;
  const highPricedProducts = products.filter(p => p.status === 'high').length;
  const averageMargin = products.reduce((acc, p) => acc + p.profitMargin, 0) / products.length;

  // Estimate revenue loss from low-priced items
  const potentialRevenueLoss = products
    .filter(p => p.status === 'low' && p.competitorPrice)
    .reduce((acc, p) => acc + ((p.competitorPrice! - p.sellingPrice) * 0.8), 0);

  return {
    totalProducts: products.length,
    validProducts,
    lowPricedProducts,
    highPricedProducts,
    averageMargin,
    potentialRevenueLoss,
  };
}

export function generateMockCompetitorPrices(products: Product[]): Product[] {
  return products.map(product => ({
    ...product,
    competitorPrice: product.sellingPrice * (0.85 + Math.random() * 0.3),
    competitorSource: ['Amazon', 'Walmart', 'Target', 'Best Buy'][Math.floor(Math.random() * 4)],
  }));
}
