import {
  Product,
  getPriceComparisonStatus,
  calculateRecommendedPrice,
} from "@/types/price";

export type SearchStep = "title" | "sku" | "brand";
export type Country = "IN" | "US" | "UK" | "AE" | "DE";

export interface MatchResult {
  matchedBy: SearchStep;
  confidence: number;
  competitorPrice: number;
  competitorSource: string;
  country: Country;
  competitorProductUrl?: string;
  priceComparisonStatus?: "aligned" | "lower" | "higher";
  recommendedPrice?: number;
  recommendation?: string;
  // Indicates this result was produced by the simulated fallback (not real AI)
  isFallback?: boolean;
  // Optional error message when AI call failed
  error?: string;
}

export interface CountryConfig {
  code: Country;
  name: string;
  currency: string;
  currencySymbol: string;
  sources: string[];
}

export const COUNTRY_CONFIGS: Record<Country, CountryConfig> = {
  IN: {
    code: "IN",
    name: "India",
    currency: "INR",
    currencySymbol: "₹",
    sources: [
      "flipkart.com",
      "Amazon.in",
      "Myntra",
      "Croma",
      "Reliance Digital",
      "Snapdeal",
    ],
  },
  US: {
    code: "US",
    name: "United States",
    currency: "USD",
    currencySymbol: "$",
    sources: ["Amazon.com", "Walmart", "Best Buy", "Target", "Newegg", "B&H"],
  },
  UK: {
    code: "UK",
    name: "United Kingdom",
    currency: "GBP",
    currencySymbol: "£",
    sources: ["Amazon.co.uk", "Currys", "Argos", "John Lewis", "AO.com"],
  },
  AE: {
    code: "AE",
    name: "UAE",
    currency: "AED",
    currencySymbol: "د.إ",
    sources: [
      "Amazon.ae",
      "Noon",
      "Jumbo Electronics",
      "Sharaf DG",
      "Carrefour",
    ],
  },
  DE: {
    code: "DE",
    name: "Germany",
    currency: "EUR",
    currencySymbol: "€",
    sources: ["Amazon.de", "MediaMarkt", "Saturn", "Otto", "Conrad"],
  },
};

// Get OpenAI API key from environment or session storage
function getOpenAIApiKey(): string {
  // Check environment variable first
  const envKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (envKey) return envKey;

  // Check session storage (user can provide it at runtime)
  const storedKey = sessionStorage.getItem("openai_api_key");
  if (storedKey) return storedKey;

  throw new Error(
    "OpenAI API key not found. Please provide your API key via environment variable VITE_OPENAI_API_KEY or through the UI.",
  );
}

// Parse comma-separated URLs and normalize them
export function parseUrls(urlString: string): string[] {
  if (!urlString || !urlString.trim()) return [];
  return urlString
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
    .map((url) => (url.startsWith("http") ? url : `https://${url}`));
}

// Fetch real competitor prices using ChatGPT via OpenAI API
export async function fetchCompetitorPriceViaChatGPT(
  product: Product,
  country: Country,
  competitorUrl?: string,
): Promise<MatchResult> {
  try {
    const apiKey = getOpenAIApiKey();
    console.log(`Using OpenAI API key`);
    const config = COUNTRY_CONFIGS[country];

    // Parse multiple URLs if provided as comma-separated string
    const customUrls = parseUrls(competitorUrl || product.competitorUrl || "");
    const searchAllWebsites = customUrls.length === 0;

    // Check if any URL is a full product URL (direct product page)
    const isFullProductUrl =
      customUrls.length > 0 &&
      customUrls.some(
        (url) =>
          url.includes("/p/") ||
          url.includes("/product/") ||
          url.match(/\/[a-z0-9-]+\/p\//i),
      );

    const websitesToSearch =
      customUrls.length > 0 ? customUrls : config.sources;

    const websitesList = websitesToSearch.join(", ");

    // Build search strategy text based on number of URLs
    let searchStrategyText: string;
    if (isFullProductUrl) {
      searchStrategyText = `DIRECT URL(S) PROVIDED:
- Fetch the price from these EXACT product URL(s): ${websitesList}
- Extract the MAIN LIST PRICE shown on each product page
- Do NOT search other websites or products
- If multiple URLs: return the most reliable match
- IMPORTANT: Do not return prices from any websites not listed above; if not found on these URLs, return found:false`;
    } else if (customUrls.length > 0) {
      searchStrategyText = `SEARCH STRATEGY (Multiple Websites):
- Search ONLY within these websites: ${websitesList}
- Find the product on ANY of these websites
- Use title/SKU/brand matching to locate the exact product
- Return the best/most reliable match across these websites
- IMPORTANT: Do NOT search or return results from other websites. If the product is not available on these websites, return found:false`;
    } else {
      searchStrategyText = `SEARCH STRATEGY (Like Google Search):
- Search across these competitor websites: ${websitesList}
- Find the product on ANY of these websites
- Pick the one with the BEST/most reliable match`;
    }

    // Matching steps only for multi-website search
    const matchingStepsText = isFullProductUrl
      ? ""
      : `
  MULTI-STEP MATCHING (Use in this exact order):
  1. FIRST: Search using the FULL PRODUCT NAME/TITLE: "${product.name}"
    - Search across the google with website name using the exact product title
    - Look for exact or near-exact title matches (including model/version/spec)
    - If mutiple results, prefer to take the first listed or highest rated
    - If a match is found, return that result immediately

  2. IF NOT FOUND by full title: Search using BRAND ONLY: "${
    product.brand || "N/A"
  }"
    - Browse the brand's listings on each website and look for identical or very similar models
    - Prefer matches that include the exact model number or SKU in the title or product details
    product.brand || "N/A"
  }"
    - Browse the brand's listings on each website and look for identical or very similar models
    - Prefer matches that include the exact model number or SKU in the title or product details
    product.brand || "N/A"
  }"
    - Browse the brand's listings on each website and look for identical or very similar models
    - Prefer matches that include the exact model number or SKU in the title or product details

  3. IF STILL NOT FOUND by brand: Search using the SKU/ID: "${
    product.sku || "N/A"
  }"
    - Search using the SKU across the selected websites and product pages
    - Match SKU exactly when possible

  4. BEFORE RETURNING NOT FOUND: Confirm the provided site(s) or category is correct
    - Verify the site and category you provided are valid for this product type (e.g., electronics TV listings)
    - If the site/category appears incorrect, include a short note suggesting verification

  IF NONE OF THE ABOVE YIELD A MATCH, return found:false (price:null) and include a short note explaining that the product was not found on the provided websites or the site/category may be incorrect.`;

    const prompt = `You are a comprehensive price research assistant. Your task is to find the EXACT CURRENT LIST PRICE for a product from the best available source;

PRODUCT DETAILS:
- Product Name: ${product.name}
- SKU/ID: ${product.sku || "N/A"}
- Brand: ${product.brand || "N/A"}
- Target Country: ${config.name}
- Currency: ${config.currency} (${config.currencySymbol})

${searchStrategyText}
${matchingStepsText}

PRICING EXTRACTION (CRITICAL):
Once you find the product:
- Extract the EXACT LIST PRICE displayed on the website
- This is the main/current price shown prominently
- Ignore sale prices, discounted prices, or promotional pricing unless specifically labeled as current
- Return the price as a number only (e.g., 9850 for ₹9,850)
- Record the EXACT URL of the product page
- Note which website the best match came from
- Note which matching method was used (${
      isFullProductUrl ? "direct URL" : "title/sku/brand"
    })

RESPONSE FORMAT:
You MUST respond with ONLY valid JSON, no markdown, no explanations, no additional text:

{
  "found": true/false,
  "matchedBy": "${isFullProductUrl ? "direct" : "title"}" or "sku" or "brand",
  "price": exact_number_only (null if not found),
  "currency": "${config.currency}",
  "source": "${isFullProductUrl ? "direct_url" : "website_name_where_found"}",
  "url": "exact_product_url",
  "confidence": ${isFullProductUrl ? "1.0" : "0.0_to_1.0"},
  "notes": "${
    isFullProductUrl ? "direct_url_fetch" : "best_match_across_websites"
  }"
}

IMPORTANT RULES:
${
  isFullProductUrl
    ? `✓ Fetch ONLY the provided product URL(s): ${websitesList}
✓ Extract the EXACT LIST PRICE shown on that page`
    : `✓ Search ACROSS ALL SPECIFIED WEBSITES for the best match
✓ Extract ONLY the main list price shown on the website`
}
✓ Use decimal format for price (e.g., 9850.00 for ₹9,850)
${
  isFullProductUrl
    ? "✓ Return confidence 1.0 for direct URL fetch"
    : "✓ Confidence: 1.0 for exact title match, 0.85 for SKU match, 0.65 for brand match"
}
✓ Return ONLY JSON, absolutely no other text
`;

    // Build preferred model list: env override -> session override -> fallbacks
    const sessionModel = sessionStorage.getItem("openai_model") || undefined;

    const preferredModels = [
      import.meta.env.VITE_OPENAI_MODEL,
      sessionModel,
      "gpt-4.1",
    ].filter(Boolean) as string[];
    let response: Response | undefined;
    let usedModel = "";

    // Quick offline check
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const fallback = matchProduct(product, country);
      return {
        ...fallback,
        isFallback: true,
        error: "Client appears offline (navigator.onLine=false)",
      };
    }

    const errorsPerModel: string[] = [];

    for (const model of preferredModels) {
      try {
        // allow using a local proxy by setting VITE_OPENAI_PROXY_URL in .env.local
        const openaiEndpoint = "https://api.openai.com/v1/chat/completions";
        const resp = await fetch(openaiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // If using direct OpenAI endpoint, send server-side key in Authorization
            Authorization: `Bearer ${apiKey}`,
            // If using proxy that requires a token, frontend can set VITE_OPENAI_PROXY_TOKEN
            ...(import.meta.env.VITE_OPENAI_PROXY_TOKEN
              ? { "x-proxy-token": import.meta.env.VITE_OPENAI_PROXY_TOKEN }
              : {}),
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.2, // Very low temperature for precise, consistent results
            max_tokens: 600,
          }),
        });

        if (resp.ok) {
          response = resp;
          usedModel = model;
          break;
        }

        // Log non-ok responses and continue to next model
        const text = await resp.text();
        const msg = `model ${model} returned ${resp.status}: ${text}`;
        console.warn(msg);
        errorsPerModel.push(msg);
      } catch (err) {
        const msg = `request for model ${model} failed: ${String(err)}`;
        console.warn(msg);
        errorsPerModel.push(msg);
      }
    }

    if (!response) {
      // No model responded successfully — return a simulated fallback but include errors
      const errMsg = errorsPerModel.length
        ? errorsPerModel.join(" | ")
        : "No model responded";
      console.warn("All OpenAI model attempts failed:", errMsg);
      const fallbackUrl = product.competitorUrl || competitorUrl;
      const fallback = matchProduct(product, country, fallbackUrl);
      return {
        ...fallback,
        isFallback: true,
        error: `OpenAI attempts failed: ${errMsg}`,
      };
    }

    console.log(`OpenAI request succeeded using model: ${usedModel}`);

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    // Debug: log raw ChatGPT response
    console.log(`ChatGPT raw response for "${product.name}":`, content);

    if (!content) {
      throw new Error("No response from ChatGPT");
    }

    // Parse the JSON response
    let priceData;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      priceData = JSON.parse(cleanContent);
    } catch (e) {
      console.error(
        `Failed to parse ChatGPT response for "${product.name}":`,
        content,
        e,
      );
      throw new Error(`Failed to parse ChatGPT response: ${content}`);
    }

    // Debug: log parsed JSON from ChatGPT
    console.log(`Parsed priceData for "${product.name}":`, priceData);

    const searchTarget = websitesList;

    if (
      !priceData.found ||
      priceData.price === null ||
      priceData.price === undefined
    ) {
      throw new Error(`Product "${product.name}" not found on ${searchTarget}`);
    }

    const parsedPrice = Number(priceData.price);
    if (Number.isNaN(parsedPrice)) {
      console.error(
        `Invalid price value returned for "${product.name}":`,
        priceData.price,
      );
      throw new Error(
        `Invalid price value returned for "${product.name}": ${priceData.price}`,
      );
    }

    // If user provided specific URL(s), ensure the returned source/url is within those URLs.
    if (customUrls.length > 0) {
      try {
        const allowedHosts = customUrls.map((u) => {
          try {
            return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
          } catch {
            return u
              .replace(/^https?:\/\//, "")
              .replace(/^www\./, "")
              .toLowerCase();
          }
        });

        const resultUrl = priceData.url
          ? (() => {
              try {
                return new URL(priceData.url).hostname
                  .replace(/^www\./, "")
                  .toLowerCase();
              } catch {
                return String(priceData.url).toLowerCase();
              }
            })()
          : "";

        const resultSource = String(priceData.source || "").toLowerCase();

        const matchesHost = resultUrl
          ? allowedHosts.some((h) => resultUrl.includes(h))
          : false;
        const matchesSource = allowedHosts.some(
          (h) =>
            resultSource.includes(h) ||
            resultSource.includes(h.replace(".", "")),
        );

        if (!matchesHost && !matchesSource) {
          throw new Error(
            `Result came from outside provided URLs: ${
              priceData.source || priceData.url
            }`,
          );
        }
      } catch (e) {
        console.warn(
          "Returned result is outside provided URLs, treating as not found:",
          e,
        );
        throw new Error(
          `Product "${product.name}" not found on provided URL(s)`,
        );
      }
    }

    // Compute comparison and recommendation
    const priceStatus = getPriceComparisonStatus(
      product.sellingPrice,
      parsedPrice,
    );
    const recommendedPrice = calculateRecommendedPrice(
      product.sellingPrice,
      parsedPrice,
      product.costPrice,
    );
    const diffPercent =
      ((product.sellingPrice - parsedPrice) / parsedPrice) * 100;
    let recommendationText =
      "Price is competitive and aligned with market (within ±5%)";
    if (priceStatus === "lower") {
      recommendationText = `Competitor price is ${Math.abs(diffPercent).toFixed(
        1,
      )}% lower. Recommend reducing to ${recommendedPrice?.toFixed(
        2,
      )} to match or beat competitor.`;
    } else if (priceStatus === "higher") {
      recommendationText = `Competitor price is ${diffPercent.toFixed(
        1,
      )}% higher. Consider a discount or maintain margin.`;
    }

    const result: MatchResult = {
      matchedBy: (priceData.matchedBy as SearchStep) || "title",
      confidence: Math.min(Number(priceData.confidence) || 0.9, 1),
      competitorPrice: parsedPrice,
      competitorSource: priceData.source || String(searchTarget),
      country,
      competitorProductUrl: priceData.url || undefined,
      priceComparisonStatus: priceStatus,
      recommendedPrice: recommendedPrice ?? undefined,
      recommendation: recommendationText,
    };

    // Debug: log final match result
    console.log(`Match result for "${product.name}":`, result);

    return result;
  } catch (error) {
    console.error("Error fetching competitor price:", error);
    // Return a simulated fallback result so the frontend still displays values
    const specificUrl = product.competitorUrl || competitorUrl;
    const customUrls = parseUrls(specificUrl || "");
    // Pass the URLs string to matchProduct (it will handle parsing internally)
    const fallback = matchProduct(product, country, competitorUrl);
    return { ...fallback, isFallback: true, error: String(error) };
  }
}

// Ensure this function is updated to pass the array correctly
export async function batchMatchProducts(
  products: Product[],
  country: Country,
  onProgress?: (progress: number, current: string, step: SearchStep) => void,
  searchUrl?: string,
): Promise<Map<string, MatchResult>> {
  onProgress?.(20, "Analyzing market data...", "title");

  console.log(
    `Starting batchMatchProducts for ${products.length} products in ${country}`,
  );

  // This is the SINGLE call to OpenAI
  const results = await fetchCompetitorPriceViaChatGPT(
    products,
    country,
    searchUrl,
  );

  onProgress?.(100, "Sync Complete", "title");
  return results;
}

// Fallback: Use matchProduct if ChatGPT is unavailable
export function matchProduct(
  product: Product,
  country: Country = "IN",
  restrictedUrl?: string,
): MatchResult {
  const config = COUNTRY_CONFIGS[country];

  // Parse restricted URLs (can be comma-separated)
  const customUrls = parseUrls(restrictedUrl || "");
  let availableSources: string[];

  if (customUrls.length > 0) {
    availableSources = customUrls;
  } else {
    availableSources = config.sources;
  }

  // Fallback to title match with high confidence
  const matchedBy: SearchStep = "title";
  const confidence = 0.95;

  // Calculate a reasonable competitor price (80-120% of our price)
  const baseVariance = 0.8 + Math.random() * 0.4;
  const competitorPrice = parseFloat(
    (product.sellingPrice * baseVariance).toFixed(2),
  );

  // Select random source from available sources
  const competitorSource =
    availableSources[Math.floor(Math.random() * availableSources.length)];

  // Compute comparison and recommendation for fallback
  const priceStatus = getPriceComparisonStatus(
    product.sellingPrice,
    competitorPrice,
  );
  const recommendedPrice = calculateRecommendedPrice(
    product.sellingPrice,
    competitorPrice,
    product.costPrice,
  );
  const diffPercent =
    ((product.sellingPrice - competitorPrice) / competitorPrice) * 100;
  let recommendationText =
    "Price is competitive and aligned with market (within ±5%)";
  if (priceStatus === "lower") {
    recommendationText = `Competitor price is ${Math.abs(diffPercent).toFixed(
      1,
    )}% lower. Recommend reducing to ${recommendedPrice?.toFixed(
      2,
    )} to match or beat competitor.`;
  } else if (priceStatus === "higher") {
    recommendationText = `Competitor price is ${diffPercent.toFixed(
      1,
    )}% higher. Consider a discount or maintain margin.`;
  }

  const result: MatchResult = {
    matchedBy,
    confidence,
    competitorPrice,
    competitorSource,
    country,
    competitorProductUrl: undefined,
    priceComparisonStatus: priceStatus,
    recommendedPrice: recommendedPrice ?? undefined,
    recommendation: recommendationText,
    isFallback: true,
    error: "Simulated fallback used (OpenAI unavailable or failed)",
  };

  // Debug: log fallback simulated match
  //console.log(`Fallback matchProduct result for "${product.name}":`, result);

  return result;
}

// Get match step description
export function getMatchStepDescription(step: SearchStep): string {
  switch (step) {
    case "title":
      return "Matched by product title";
    case "sku":
      return "Matched by SKU/ID";
    case "brand":
      return "Matched by brand name";
  }
}

// Get confidence color
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return "text-success";
  if (confidence >= 0.75) return "text-warning";
  return "text-destructive";
}
