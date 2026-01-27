import { Product } from "@/types/price";
import {
  COUNTRY_CONFIGS,
  Country,
  fetchCompetitorPriceViaChatGPT,
} from "./aiProductMatcher";

/**
 * Represents a competitor price from a specific source
 */
export interface CompetitorPriceResult {
  source: string;
  price: number;
  url?: string;
  confidence?: number;
  lastUpdated: Date;
}

/**
 * Result of crawling competitor prices for a single product
 */
export interface CrawlResult {
  productId: string;
  productName: string;
  prices: CompetitorPriceResult[];
  lowestPrice?: number;
  lowestSource?: string;
  lowestUrl?: string;
  error?: string;
  isCompleted: boolean;
}

/**
 * Main crawler function that fetches competitor prices for all products
 * Uses the AI matcher to find prices from referenced websites
 */
export async function crawlCompetitorPrices(
  products: Product[],
  country: Country = "IN",
  onProgress?: (progress: number, current: string) => void
): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];
  const totalProducts = products.length;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    // Notify progress
    if (onProgress) {
      onProgress((i / totalProducts) * 100, product.name);
    }

    try {
      const crawlResult = await crawlProductPrices(product, country);
      results.push(crawlResult);
    } catch (error) {
      results.push({
        productId: product.id,
        productName: product.name,
        prices: [],
        error: error instanceof Error ? error.message : "Unknown error",
        isCompleted: false,
      });
    }

    // Add a small delay between requests to avoid rate limiting
    if (i < products.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}

/**
 * Crawls competitor prices for a single product
 */
async function crawlProductPrices(
  product: Product,
  country: Country
): Promise<CrawlResult> {
  const prices: CompetitorPriceResult[] = [];

  try {
    // Use the AI matcher to fetch the competitor price
    // This leverages ChatGPT to search the referenced websites
    const matchResult = await fetchCompetitorPriceViaChatGPT(
      product,
      country,
      product.competitorUrl
    );

    if (matchResult && !matchResult.error) {
      prices.push({
        source: matchResult.competitorSource || "Unknown",
        price: matchResult.competitorPrice || 0,
        url: matchResult.competitorProductUrl,
        confidence: matchResult.confidence || 0.5,
        lastUpdated: new Date(),
      });
    }

    // If no direct competitor URL is set, try default competitors for the country
    if (!product.competitorUrl || prices.length === 0) {
      const defaultPrices = await fetchFromDefaultCompetitors(product, country);
      prices.push(...defaultPrices);
    }

    // Find the lowest price
    if (prices.length > 0) {
      const sortedPrices = prices.sort((a, b) => a.price - b.price);
      const lowestPrice = sortedPrices[0];

      return {
        productId: product.id,
        productName: product.name,
        prices,
        lowestPrice: lowestPrice.price,
        lowestSource: lowestPrice.source,
        lowestUrl: lowestPrice.url,
        isCompleted: true,
      };
    }

    return {
      productId: product.id,
      productName: product.name,
      prices: [],
      isCompleted: false,
    };
  } catch (error) {
    return {
      productId: product.id,
      productName: product.name,
      prices,
      error: error instanceof Error ? error.message : "Failed to crawl prices",
      isCompleted: false,
    };
  }
}

/**
 * Fetches prices from default competitors for a given country
 */
async function fetchFromDefaultCompetitors(
  product: Product,
  country: Country
): Promise<CompetitorPriceResult[]> {
  const prices: CompetitorPriceResult[] = [];
  const config = COUNTRY_CONFIGS[country];

  if (!config) {
    return prices;
  }

  // Try to fetch from top 3 default competitors for the country
  const topCompetitors = config.sources.slice(0, 3);

  for (const competitor of topCompetitors) {
    try {
      const matchResult = await fetchCompetitorPriceViaChatGPT(
        product,
        country,
        competitor
      );

      if (matchResult && !matchResult.error && matchResult.competitorPrice) {
        prices.push({
          source: matchResult.competitorSource || competitor,
          price: matchResult.competitorPrice,
          url: matchResult.competitorProductUrl,
          confidence: matchResult.confidence || 0.5,
          lastUpdated: new Date(),
        });
      }

      // Add delay between requests
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      // Log but continue to next competitor
      console.warn(`Failed to fetch from ${competitor}:`, error);
    }
  }

  return prices;
}

/**
 * Merges crawl results into products, updating their competitor pricing info
 */
export function mergeCompetitorPrices(
  products: Product[],
  crawlResults: CrawlResult[]
): Product[] {
  const resultMap = new Map(crawlResults.map((r) => [r.productId, r]));

  return products.map((product) => {
    const crawlResult = resultMap.get(product.id);

    if (!crawlResult || crawlResult.prices.length === 0) {
      return product;
    }

    // Use the lowest price from crawl results
    const lowestPrice = crawlResult.lowestPrice;
    const lowestSource = crawlResult.lowestSource;
    const lowestUrl = crawlResult.lowestUrl;

    return {
      ...product,
      competitorPrice: lowestPrice,
      competitorSource: lowestSource,
      competitorProductUrl: lowestUrl,
      // Additional metadata for detailed view (can be stored in session/state)
      // allCompetitorPrices: crawlResult.prices,
    };
  });
}

/**
 * Formats competitor price info for display
 */
export function formatCompetitorInfo(product: Product): string {
  if (!product.competitorPrice || !product.competitorSource) {
    return "N/A";
  }

  const priceDiff = product.sellingPrice - product.competitorPrice;
  const priceDiffPercent = (priceDiff / product.competitorPrice) * 100;

  if (priceDiff > 0) {
    return `${product.competitorSource}: $${product.competitorPrice.toFixed(
      2
    )} (You're ${priceDiffPercent.toFixed(1)}% higher)`;
  } else {
    return `${product.competitorSource}: $${product.competitorPrice.toFixed(
      2
    )} (You're ${Math.abs(priceDiffPercent).toFixed(1)}% lower)`;
  }
}

/**
 * Calculates the price advantage across all products
 */
export function calculatePriceAdvantage(products: Product[]): {
  averageCompetitorPrice: number;
  averageYourPrice: number;
  averageAdvantagePercent: number;
  productsWithCompetitorData: number;
} {
  const productsWithData = products.filter(
    (p) => p.competitorPrice && p.competitorPrice > 0
  );

  if (productsWithData.length === 0) {
    return {
      averageCompetitorPrice: 0,
      averageYourPrice: 0,
      averageAdvantagePercent: 0,
      productsWithCompetitorData: 0,
    };
  }

  const avgCompetitor =
    productsWithData.reduce((sum, p) => sum + (p.competitorPrice || 0), 0) /
    productsWithData.length;

  const avgYour =
    productsWithData.reduce((sum, p) => sum + p.sellingPrice, 0) /
    productsWithData.length;

  const avgAdvantagePercent = ((avgYour - avgCompetitor) / avgCompetitor) * 100;

  return {
    averageCompetitorPrice: avgCompetitor,
    averageYourPrice: avgYour,
    averageAdvantagePercent: avgAdvantagePercent,
    productsWithCompetitorData: productsWithData.length,
  };
}
