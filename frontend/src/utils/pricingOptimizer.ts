import { Product } from '@/types/price';

export interface PriceOptimization {
  currentPrice: number;
  currentMargin: number;
  lowestCompetitorPrice?: number;
  competitorAdvantage?: number; // % diff from competitor
  
  // Price recommendations at different margins
  priceAt15Margin: number;    // Minimum healthy margin
  priceAt20Margin: number;    // Conservative
  priceAt25Margin: number;    // Balanced
  priceAt30Margin: number;    // Comfortable
  priceAt40Margin: number;    // Current (if applicable)
  priceAt50Margin: number;    // Premium/max reasonable
  
  // Strategic recommendations
  recommendations: PricingRecommendation[];
  
  // Competitive positioning
  positioningAnalysis: PositioningAnalysis;
}

export interface PricingRecommendation {
  strategy: 'compete' | 'premium' | 'maximize' | 'penetrate';
  targetPrice: number;
  targetMargin: number;
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface PositioningAnalysis {
  status: 'cheaper' | 'aligned' | 'premium';
  competitivenessScore: number; // 0-100, higher is better
  recommendedAction: string;
  potentialRevenue: number; // If you adjust price
}

/**
 * Calculate optimal pricing strategies for a product
 */
export function optimizePrice(product: Product): PriceOptimization {
  const costPrice = product.costPrice;
  const currentPrice = product.sellingPrice;
  const currentMargin = product.profitMargin;
  const lowestCompetitorPrice = product.lowestCompetitorPrice || product.competitorPrice;

  // Calculate prices at different margin points
  const priceAt15Margin = calculatePriceForMargin(costPrice, 15);
  const priceAt20Margin = calculatePriceForMargin(costPrice, 20);
  const priceAt25Margin = calculatePriceForMargin(costPrice, 25);
  const priceAt30Margin = calculatePriceForMargin(costPrice, 30);
  const priceAt40Margin = calculatePriceForMargin(costPrice, 40);
  const priceAt50Margin = calculatePriceForMargin(costPrice, 50);

  // Calculate competitor advantage
  const competitorAdvantage = lowestCompetitorPrice
    ? ((currentPrice - lowestCompetitorPrice) / lowestCompetitorPrice) * 100
    : undefined;

  // Generate recommendations
  const recommendations = generateRecommendations(
    product,
    costPrice,
    currentPrice,
    currentMargin,
    lowestCompetitorPrice,
    competitorAdvantage
  );

  // Analyze competitive positioning
  const positioningAnalysis = analyzePositioning(
    product,
    currentPrice,
    lowestCompetitorPrice
  );

  return {
    currentPrice,
    currentMargin,
    lowestCompetitorPrice,
    competitorAdvantage,
    priceAt15Margin,
    priceAt20Margin,
    priceAt25Margin,
    priceAt30Margin,
    priceAt40Margin,
    priceAt50Margin,
    recommendations,
    positioningAnalysis,
  };
}

/**
 * Calculate what price is needed for a target margin
 * Formula: Price = Cost / (1 - Margin%)
 */
export function calculatePriceForMargin(costPrice: number, targetMarginPercent: number): number {
  if (costPrice <= 0 || targetMarginPercent >= 100) return 0;
  const marginDecimal = targetMarginPercent / 100;
  return Math.round((costPrice / (1 - marginDecimal)) * 100) / 100;
}

/**
 * Calculate what margin you'll have at a given price
 * Formula: Margin% = ((Price - Cost) / Price) * 100
 */
export function calculateMarginForPrice(price: number, costPrice: number): number {
  if (price <= 0) return 0;
  return Math.round((((price - costPrice) / price) * 100) * 100) / 100;
}

/**
 * Calculate profit per unit at a given price
 */
export function calculateProfitPerUnit(price: number, costPrice: number): number {
  return Math.max(0, price - costPrice);
}

/**
 * Generate pricing recommendations based on strategy
 */
function generateRecommendations(
  product: Product,
  costPrice: number,
  currentPrice: number,
  currentMargin: number,
  lowestCompetitorPrice?: number,
  competitorAdvantage?: number
): PricingRecommendation[] {
  const recommendations: PricingRecommendation[] = [];

  // Strategy 1: Compete with lowest price
  if (lowestCompetitorPrice) {
    const competitivePrice = Math.round(lowestCompetitorPrice * 0.98 * 100) / 100; // 2% undercut
    const competitiveMargin = calculateMarginForPrice(competitivePrice, costPrice);

    if (competitiveMargin >= 15) {
      recommendations.push({
        strategy: 'compete',
        targetPrice: competitivePrice,
        targetMargin: competitiveMargin,
        reasoning: `Match/undercut competitor price (${(lowestCompetitorPrice).toFixed(2)}) while maintaining ${competitiveMargin.toFixed(1)}% margin`,
        riskLevel: competitiveMargin < 20 ? 'high' : 'medium',
      });
    }
  }

  // Strategy 2: Premium positioning (if currently cheaper)
  if (competitorAdvantage && competitorAdvantage < -10) {
    const premiumPrice = Math.round(lowestCompetitorPrice! * 0.95 * 100) / 100; // 5% below competitor
    const premiumMargin = calculateMarginForPrice(premiumPrice, costPrice);

    if (premiumMargin >= 25) {
      recommendations.push({
        strategy: 'premium',
        targetPrice: premiumPrice,
        targetMargin: premiumMargin,
        reasoning: `You're ${Math.abs(competitorAdvantage).toFixed(1)}% cheaper. Increase to ${premiumPrice.toFixed(2)} and still beat competitor by 5%`,
        riskLevel: 'low',
      });
    }
  }

  // Strategy 3: Maximize profit (30% margin sweet spot)
  const maximizePrice = calculatePriceForMargin(costPrice, 30);
  const maximizeMargin = 30;

  if (currentPrice !== maximizePrice && maximizePrice > (lowestCompetitorPrice || 0) * 0.9) {
    recommendations.push({
      strategy: 'maximize',
      targetPrice: maximizePrice,
      targetMargin: maximizeMargin,
      reasoning: `Set price to ${maximizePrice.toFixed(2)} for balanced 30% margin (sweet spot between profitability & competitiveness)`,
      riskLevel: 'low',
    });
  }

  // Strategy 4: Penetrate market (lower price, high volume)
  if (currentMargin > 25) {
    const penetratePrice = calculatePriceForMargin(costPrice, 20);
    const penetrateMargin = 20;

    recommendations.push({
      strategy: 'penetrate',
      targetPrice: penetratePrice,
      targetMargin: penetrateMargin,
      reasoning: `Reduce to ${penetratePrice.toFixed(2)} for 20% margin. Lower price = higher sales volume potential`,
      riskLevel: 'medium',
    });
  }

  return recommendations;
}

/**
 * Analyze competitive positioning
 */
function analyzePositioning(
  product: Product,
  currentPrice: number,
  lowestCompetitorPrice?: number
): PositioningAnalysis {
  if (!lowestCompetitorPrice) {
    return {
      status: 'aligned',
      competitivenessScore: 50,
      recommendedAction: 'No competitor data - maintain current pricing',
      potentialRevenue: 0,
    };
  }

  const priceDiff = currentPrice - lowestCompetitorPrice;
  const priceDiffPercent = (priceDiff / lowestCompetitorPrice) * 100;

  let status: 'cheaper' | 'aligned' | 'premium';
  let competitivenessScore: number;
  let recommendedAction: string;

  if (priceDiffPercent < -5) {
    status = 'cheaper';
    competitivenessScore = Math.min(100, 75 + Math.abs(priceDiffPercent) / 2);
    recommendedAction = `🎉 Excellent: You're ${Math.abs(priceDiffPercent).toFixed(1)}% cheaper! Consider raising price to increase margins.`;
  } else if (priceDiffPercent > 5) {
    status = 'premium';
    competitivenessScore = Math.max(0, 50 - priceDiffPercent);
    recommendedAction = `⚠️ Warning: You're ${priceDiffPercent.toFixed(1)}% more expensive. Consider matching competitor price.`;
  } else {
    status = 'aligned';
    competitivenessScore = 75;
    recommendedAction = `✓ Good: You're aligned with competitor within 5%. Maintain current positioning.`;
  }

  // Calculate potential revenue if price adjusted
  const potentialRevenue = priceDiff;

  return {
    status,
    competitivenessScore,
    recommendedAction,
    potentialRevenue,
  };
}

/**
 * Bulk optimize prices for all products
 */
export function optimizeAllPrices(products: Product[]): Map<string, PriceOptimization> {
  const optimizations = new Map<string, PriceOptimization>();

  products.forEach(product => {
    optimizations.set(product.id, optimizePrice(product));
  });

  return optimizations;
}

/**
 * Get products sorted by optimization opportunity
 */
export function getOptimizationOpportunities(products: Product[]): ProductOpportunity[] {
  const opportunities: ProductOpportunity[] = products
    .map(product => {
      const optimization = optimizePrice(product);
      const currentMargin = product.profitMargin;
      const optimalMargin = 30; // Target margin

      // Calculate potential profit gain/loss
      const optimalPrice = calculatePriceForMargin(product.costPrice, optimalMargin);
      const currentProfit = (product.sellingPrice - product.costPrice);
      const optimalProfit = (optimalPrice - product.costPrice);
      const profitDifference = optimalProfit - currentProfit;

      // Priority score (higher = more opportunity)
      let priorityScore = 0;

      // Factor 1: Distance from optimal margin
      priorityScore += Math.abs(currentMargin - optimalMargin) * 2;

      // Factor 2: Competitor advantage
      if (optimization.competitorAdvantage) {
        if (optimization.competitorAdvantage < -15) {
          priorityScore += 20; // High opportunity to raise price
        } else if (optimization.competitorAdvantage > 15) {
          priorityScore += 10; // Opportunity to lower price
        }
      }

      return {
        product,
        optimization,
        profitDifference,
        priorityScore,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  return opportunities;
}

export interface ProductOpportunity {
  product: Product;
  optimization: PriceOptimization;
  profitDifference: number;
  priorityScore: number;
}

/**
 * Generate pricing summary for dashboard
 */
export function generatePricingSummary(products: Product[]) {
  const opportunities = getOptimizationOpportunities(products);

  const summary = {
    totalProducts: products.length,
    productsOptimizable: opportunities.length,
    topOpportunities: opportunities.slice(0, 5),
    
    // Aggregate metrics
    averageCurrentMargin: products.reduce((sum, p) => sum + p.profitMargin, 0) / products.length,
    averageOptimalMargin: 30,
    
    // Potential improvements
    totalPotentialMarginImprovement: opportunities.reduce((sum, o) => sum + o.profitDifference, 0),
    averageProfitPerProduct: opportunities.reduce((sum, o) => sum + o.profitDifference, 0) / Math.max(1, opportunities.length),
    
    // Competitive analysis
    productsWithCompetitorData: products.filter(p => p.lowestCompetitorPrice || p.competitorPrice).length,
    productsUnderpriced: products.filter(p => {
      const lowest = p.lowestCompetitorPrice || p.competitorPrice;
      return lowest && p.sellingPrice < lowest * 0.95;
    }).length,
    productsOverpriced: products.filter(p => {
      const lowest = p.lowestCompetitorPrice || p.competitorPrice;
      return lowest && p.sellingPrice > lowest * 1.15;
    }).length,
  };

  return summary;
}
