export interface CompetitorPriceInfo {
  source: string;
  price: number;
  url?: string;
  confidence?: number;
  lastUpdated: Date;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand?: string;
  originalPrice: number;
  sellingPrice: number;
  discountPercent: number;
  costPrice: number;
  profitMargin: number;
  status: "valid" | "low" | "high" | "warning";
  competitorUrl?: string;
  competitorPrice?: number;
  competitorSource?: string;
  competitorProductUrl?: string;
  // New fields for lowest competitor price tracking
  lowestCompetitorPrice?: number;
  lowestCompetitorSource?: string;
  lowestCompetitorUrl?: string;
  allCompetitorPrices?: CompetitorPriceInfo[];
  recommendation?: string;
  recommendedPrice?: number;
  priceComparisonStatus?: "aligned" | "lower" | "higher";
  matchedBy?: "title" | "sku" | "brand";
  matchConfidence?: number;
  // Indicates if this result is a simulated fallback (not real AI-fetched)
  isFallback?: boolean;
  // Error message if AI call failed
  aiError?: string;

  __rawRow?: Record<string, any>;
}

// Calculate price comparison status based on ±5% threshold
export function getPriceComparisonStatus(
  ourPrice: number,
  competitorPrice?: number
): "aligned" | "lower" | "higher" | undefined {
  if (!competitorPrice) return undefined;
  const diff = ((ourPrice - competitorPrice) / competitorPrice) * 100;
  if (diff > 5) return "higher";
  if (diff < -5) return "lower";
  return "aligned";
}

// Calculate AI-recommended price based on competitor data
export function calculateRecommendedPrice(
  ourPrice: number,
  competitorPrice?: number,
  costPrice?: number
): number | undefined {
  if (!competitorPrice) return undefined;
  // Target: match competitor within 2% while maintaining minimum 10% margin
  const targetPrice = competitorPrice * 0.98;
  const minMarginPrice = costPrice ? costPrice * 1.1 : ourPrice * 0.7;
  return Math.max(targetPrice, minMarginPrice);
}

export interface PriceThreshold {
  minDiscount: number;
  maxDiscount: number;
  minMargin: number;
  maxMargin: number;
  lowPriceThreshold: number;
  highPriceThreshold: number;
}

export interface ValidationResult {
  productId: string;
  issues: string[];
  severity: "low" | "medium" | "high";
  recommendation: string;
}

export interface CompetitorData {
  source: string;
  price: number;
  url: string;
  lastUpdated: Date;
}

export interface AnalyticsSummary {
  totalProducts: number;
  validProducts: number;
  lowPricedProducts: number;
  highPricedProducts: number;
  averageMargin: number;
  potentialRevenueLoss: number;
}
