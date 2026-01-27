import { useState, useMemo } from "react";
import {
  Product,
  getPriceComparisonStatus,
  calculateRecommendedPrice,
} from "@/types/price";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  Search,
  Loader2,
  ExternalLink,
  Bot,
  TrendingUp,
  TrendingDown,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  FileSearch,
  Hash,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import {
  batchMatchProducts,
  COUNTRY_CONFIGS,
  Country,
  SearchStep,
  getMatchStepDescription,
  getConfidenceColor,
} from "@/utils/aiProductMatcher";
import { convertCurrency } from "@/utils/currencyConverter";

interface CompetitorBenchmarkProps {
  products: Product[];
  onUpdateProducts: (products: Product[]) => void;
  onCountryChange?: (country: Country) => void;
}

// Mini sparkline bar component
function MiniPriceBar({
  ourPrice,
  competitorPrice,
}: {
  ourPrice: number;
  competitorPrice: number;
}) {
  const maxPrice = Math.max(ourPrice, competitorPrice);
  const ourWidth = (ourPrice / maxPrice) * 100;
  const compWidth = (competitorPrice / maxPrice) * 100;
  const status = getPriceComparisonStatus(ourPrice, competitorPrice);

  const ourColor =
    status === "aligned"
      ? "bg-success"
      : status === "lower"
      ? "bg-destructive"
      : "bg-warning";

  return (
    <div className="w-24 space-y-1">
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground w-6">Us</span>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${ourColor} rounded-full transition-all`}
            style={{ width: `${ourWidth}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground w-6">Cmp</span>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary/50 rounded-full transition-all"
            style={{ width: `${compWidth}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Match method icon
function MatchMethodIcon({ method }: { method: SearchStep }) {
  switch (method) {
    case "title":
      return <FileSearch className="h-3 w-3" />;
    case "sku":
      return <Hash className="h-3 w-3" />;
    case "brand":
      return <Building2 className="h-3 w-3" />;
  }
}

// Validate URL format
function isValidUrl(urls: string): boolean {
  if (!urls.trim()) return true; // Empty is OK
  // Parse comma-separated URLs
  const urlList = urls
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
  if (urlList.length === 0) return true;

  return urlList.every((url) => {
    try {
      const urlToTest = url.startsWith("http") ? url : `https://${url}`;
      new URL(urlToTest);
      return /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i.test(
        urlToTest
      );
    } catch {
      return false;
    }
  });
}

export function CompetitorBenchmark({
  products,
  onUpdateProducts,
  onCountryChange,
}: CompetitorBenchmarkProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentProduct, setCurrentProduct] = useState("");
  const [currentStep, setCurrentStep] = useState<SearchStep>("title");
  const [searchUrl, setSearchUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>("IN");
  const [previousCountry, setPreviousCountry] = useState<Country>("IN"); // Track previous country for conversion

  const handleUrlChange = (value: string) => {
    setSearchUrl(value);
    if (value && !isValidUrl(value)) {
      setUrlError(
        "Please enter valid URL(s) (e.g., amazon.com or https://amazon.com/category). Separate multiple URLs with commas."
      );
    } else {
      setUrlError("");
    }
  };

  // Handle country change with currency conversion
  const handleCountryChange = (newCountry: Country) => {
    if (newCountry === selectedCountry) return;

    // Convert all product prices from previous currency to new currency
    const convertedProducts = products.map((product) => ({
      ...product,
      sellingPrice: convertCurrency(
        product.sellingPrice,
        previousCountry,
        newCountry
      ),
      originalPrice: convertCurrency(
        product.originalPrice,
        previousCountry,
        newCountry
      ),
      costPrice: convertCurrency(
        product.costPrice,
        previousCountry,
        newCountry
      ),
      competitorPrice: product.competitorPrice
        ? convertCurrency(product.competitorPrice, previousCountry, newCountry)
        : undefined,
      recommendedPrice: product.recommendedPrice
        ? convertCurrency(product.recommendedPrice, previousCountry, newCountry)
        : undefined,
    }));

    // Update products with converted prices
    onUpdateProducts(convertedProducts);

    // Update country selection
    setSelectedCountry(newCountry);
    setPreviousCountry(newCountry);

    // Notify parent component of country change
    onCountryChange?.(newCountry);

    toast.success(
      `Currency converted to ${COUNTRY_CONFIGS[newCountry].currencySymbol}${COUNTRY_CONFIGS[newCountry].currency}`,
      {
        description: `All prices have been converted using current exchange rates`,
      }
    );
  };

  const runBenchmark = async () => {
    // Validate URL(s) if provided (but it's optional)
    if (searchUrl && !isValidUrl(searchUrl)) {
      setUrlError("Please enter valid URL(s) before running analysis");
      return;
    }

    // Check if OpenAI API key is configured
    const envKey = import.meta.env.VITE_OPENAI_API_KEY;
    const storedKey = sessionStorage.getItem("openai_api_key");

    if (!envKey && !storedKey) {
      toast.error("OpenAI API key not configured", {
        description:
          "Please set VITE_OPENAI_API_KEY environment variable or provide your API key in settings.",
      });
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);
    setCurrentProduct("");

    // Use AI matcher with optional URL filtering
    // If URL provided: search only that website
    // If no URL: search all available websites (authors and commentators across all sources)
    const matchResults = await batchMatchProducts(
      products,
      selectedCountry,
      (prog, productName, step) => {
        setProgress(prog);
        setCurrentProduct(productName);
        setCurrentStep(step);
      },
      searchUrl.trim() || undefined // Pass URL if provided, undefined to search all sources
    );

    // Update products with match results
    const updatedProducts = products.map((product) => {
      const match = matchResults.get(product.id);
      if (!match) return product;

      const priceStatus = getPriceComparisonStatus(
        product.sellingPrice,
        match.competitorPrice
      );
      const recommendedPrice = calculateRecommendedPrice(
        product.sellingPrice,
        match.competitorPrice,
        product.costPrice
      );

      return {
        ...product,
        competitorPrice: match.competitorPrice,
        competitorSource: match.competitorSource,
        competitorProductUrl: match.competitorProductUrl || undefined,
        matchedBy: match.matchedBy,
        matchConfidence: match.confidence,
        recommendation: generateRecommendation(
          product.sellingPrice,
          match.competitorPrice
        ),
        recommendedPrice,
        priceComparisonStatus: priceStatus,
        status:
          priceStatus === "lower"
            ? ("low" as const)
            : priceStatus === "higher"
            ? ("high" as const)
            : product.profitMargin < 10
            ? ("warning" as const)
            : ("valid" as const),
        // Store fallback indicator and error from AI matcher
        isFallback: match.isFallback || false,
        aiError: match.error || undefined,
      };
    });

    onUpdateProducts(updatedProducts);
    setIsAnalyzing(false);
    toast.success("AI Competitor analysis complete!", {
      description: `Analyzed ${products.length} products for ${COUNTRY_CONFIGS[selectedCountry].name}`,
    });
  };

  const generateRecommendation = (
    ourPrice: number,
    competitorPrice: number
  ): string => {
    const diff = ((ourPrice - competitorPrice) / competitorPrice) * 100;
    if (diff > 5) {
      return `Price is ${diff.toFixed(
        1
      )}% higher than competitor. Consider reducing to improve conversion.`;
    } else if (diff < -5) {
      return `Price is ${Math.abs(diff).toFixed(
        1
      )}% lower than competitor. Opportunity to increase margin.`;
    }
    return "Price is competitive and aligned with market (within ±5%)";
  };

  const getComparisonIcon = (ourPrice: number, competitorPrice?: number) => {
    if (!competitorPrice) return null;
    const status = getPriceComparisonStatus(ourPrice, competitorPrice);
    if (status === "higher")
      return <TrendingUp className="h-4 w-4 text-warning" />;
    if (status === "lower")
      return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <CheckCircle className="h-4 w-4 text-success" />;
  };

  // Only include products that were successfully matched (not fallback/simulated)
  const productsWithCompetitor = products.filter(
    (p) => p.competitorPrice && !p.isFallback
  );

  // Calculate summary stats
  const stats = useMemo(() => {
    if (productsWithCompetitor.length === 0) return null;
    const aligned = productsWithCompetitor.filter(
      (p) =>
        getPriceComparisonStatus(p.sellingPrice, p.competitorPrice) ===
        "aligned"
    ).length;
    const lower = productsWithCompetitor.filter(
      (p) =>
        getPriceComparisonStatus(p.sellingPrice, p.competitorPrice) === "lower"
    ).length;
    const higher = productsWithCompetitor.filter(
      (p) =>
        getPriceComparisonStatus(p.sellingPrice, p.competitorPrice) === "higher"
    ).length;
    const avgDiff =
      productsWithCompetitor.reduce((acc, p) => {
        return (
          acc +
          ((p.sellingPrice - (p.competitorPrice || 0)) /
            (p.competitorPrice || 1)) *
            100
        );
      }, 0) / productsWithCompetitor.length;
    return {
      aligned,
      lower,
      higher,
      avgDiff,
      total: productsWithCompetitor.length,
    };
  }, [productsWithCompetitor]);

  return (
    <Card className="shadow-card animate-fade-in">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              AI Competitor Benchmarking
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            AI Powered
          </Badge>
        </div>
        <CardDescription>
          AI automatically compares prices with competitors and flags
          discrepancies based on ±5% threshold
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Country Selection and URL Input */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-48">
              <Select
                value={selectedCountry}
                onValueChange={(v) => handleCountryChange(v as Country)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(COUNTRY_CONFIGS).map((config) => (
                    <SelectItem key={config.code} value={config.code}>
                      <span className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        {config.name} ({config.currencySymbol})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Input
                placeholder="(Optional) Enter specific website URL to filter results to that site only"
                value={searchUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className={`w-full ${
                  urlError
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }`}
              />
              {urlError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {urlError}
                </p>
              )}
              {!urlError && (
                <p className="text-xs text-muted-foreground">
                  {searchUrl
                    ? "✓ Search will be filtered to this website only"
                    : "Leave empty to search all competitor websites and authors. Or enter a specific URL to filter to that website."}
                </p>
              )}
            </div>
            <Button
              onClick={runBenchmark}
              disabled={isAnalyzing || products.length === 0 || !!urlError}
              className="gradient-primary text-primary-foreground"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Run AI Analysis
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Search Progress with Step Info */}
        {isAnalyzing && (
          <div className="space-y-3 p-4 rounded-lg bg-muted/30 border">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-muted-foreground">AI searching for:</span>
                <span className="font-medium truncate max-w-[200px]">
                  {currentProduct}
                </span>
              </div>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex items-center gap-4 text-xs">
              <span className="text-muted-foreground">Search method:</span>
              <div className="flex items-center gap-1">
                <MatchMethodIcon method={currentStep} />
                <span
                  className={
                    currentStep === "title"
                      ? "text-success"
                      : currentStep === "sku"
                      ? "text-warning"
                      : "text-muted-foreground"
                  }
                >
                  {getMatchStepDescription(currentStep)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileSearch className="h-3 w-3" /> Title →{" "}
              <Hash className="h-3 w-3" /> SKU →{" "}
              <Building2 className="h-3 w-3" /> Brand
            </div>
          </div>
        )}

        {/* Fallback Warning Banner - Show if any product used simulated values */}
        {(() => {
          const fallbackProducts = products.filter(
            (p) => p.isFallback && p.competitorPrice
          );
          const foundProducts = products.filter(
            (p) => !p.isFallback && p.competitorPrice
          );

          if (fallbackProducts.length > 0) {
            // Extract product names from error messages or use product data
            const notFoundList = fallbackProducts
              .filter((p) => p.aiError?.includes("not found"))
              .map((p) => p.name);

            return (
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 space-y-3">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                  <div className="space-y-3 flex-1">
                    <p className="text-sm font-semibold text-warning">
                      ⚠️ {fallbackProducts.length} of{" "}
                      {productsWithCompetitor.length} product
                      {fallbackProducts.length !== 1 ? "s" : ""} showing
                      simulated prices
                    </p>
                    <p className="text-xs text-muted-foreground">
                      These prices are estimated based on historical data and
                      should NOT be used for pricing decisions. Please verify
                      actual competitor prices on the websites before taking
                      action.
                    </p>

                    {/* Found/Not Found Lists */}
                    <div className="space-y-2 mt-3">
                      {foundProducts.length > 0 && (
                        <div className="text-xs">
                          <p className="font-medium text-success mb-1">
                            ✓ Products Found:
                          </p>
                          <ul className="space-y-0.5 pl-4">
                            {foundProducts.map((p) => (
                              <li key={p.id} className="text-muted-foreground">
                                • {p.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {notFoundList.length > 0 && (
                        <div className="text-xs">
                          <p className="font-medium text-destructive mb-1">
                            ✗ Products Not Found:
                          </p>
                          <ul className="space-y-0.5 pl-4">
                            {notFoundList.map((name) => (
                              <li key={name} className="text-muted-foreground">
                                • {name} — We can't find this product
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Summary Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-bold text-foreground">
                {stats.total}
              </p>
              <p className="text-xs text-muted-foreground">Analyzed</p>
            </div>
            <div className="p-3 rounded-lg bg-success/10 text-center">
              <p className="text-2xl font-bold text-success">{stats.aligned}</p>
              <p className="text-xs text-muted-foreground">Aligned (±5%)</p>
            </div>
            <div className="p-3 rounded-lg bg-destructive/10 text-center">
              <p className="text-2xl font-bold text-destructive">
                {stats.lower}
              </p>
              <p className="text-xs text-muted-foreground">Lower (&gt;5%)</p>
            </div>
            <div className="p-3 rounded-lg bg-warning/10 text-center">
              <p className="text-2xl font-bold text-warning">{stats.higher}</p>
              <p className="text-xs text-muted-foreground">Higher (&gt;5%)</p>
            </div>
          </div>
        )}

        {productsWithCompetitor.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Price Comparison ({productsWithCompetitor.length} products)
              </h4>
              {stats && (
                <Badge
                  variant="outline"
                  className={
                    stats.avgDiff > 5
                      ? "text-warning"
                      : stats.avgDiff < -5
                      ? "text-destructive"
                      : "text-success"
                  }
                >
                  Avg: {stats.avgDiff > 0 ? "+" : ""}
                  {stats.avgDiff.toFixed(1)}%
                </Badge>
              )}
            </div>
            <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
              {productsWithCompetitor.slice(0, 10).map((product) => {
                const diff =
                  ((product.sellingPrice - (product.competitorPrice || 0)) /
                    (product.competitorPrice || 1)) *
                  100;
                const status = getPriceComparisonStatus(
                  product.sellingPrice,
                  product.competitorPrice
                );
                const config = COUNTRY_CONFIGS[selectedCountry];

                return (
                  <div
                    key={product.id}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      status === "aligned"
                        ? "bg-success/5 hover:bg-success/10"
                        : status === "lower"
                        ? "bg-destructive/5 hover:bg-destructive/10"
                        : "bg-warning/5 hover:bg-warning/10"
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {getComparisonIcon(
                        product.sellingPrice,
                        product.competitorPrice
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {product.name}
                          </p>
                          {/* Match method indicator */}
                          {product.matchedBy && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-4 gap-1"
                            >
                              <MatchMethodIcon method={product.matchedBy} />
                              {product.matchConfidence && (
                                <span
                                  className={getConfidenceColor(
                                    product.matchConfidence
                                  )}
                                >
                                  {Math.round(product.matchConfidence * 100)}%
                                </span>
                              )}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Ours: {config.currencySymbol}
                          {product.sellingPrice.toLocaleString("en-IN")} •{" "}
                          {product.competitorSource}: {config.currencySymbol}
                          {product.competitorPrice?.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {/* Mini graph */}
                      <MiniPriceBar
                        ourPrice={product.sellingPrice}
                        competitorPrice={product.competitorPrice!}
                      />
                      {/* Diff badge */}
                      <Badge
                        variant="outline"
                        className={
                          status === "aligned"
                            ? "border-success/50 text-success bg-success/10"
                            : status === "lower"
                            ? "border-destructive/50 text-destructive bg-destructive/10"
                            : "border-warning/50 text-warning bg-warning/10"
                        }
                      >
                        {diff > 0 ? "+" : ""}
                        {diff.toFixed(1)}%
                      </Badge>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 py-2 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-success" />
            Green: Within ±5%
          </span>
          <span className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-destructive" />
            Red: &gt;5% Lower
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-warning" />
            Orange: &gt;5% Higher
          </span>
        </div>

        {/* Live AI Success Badge - Only show when all results are real (not fallback) */}
        {(() => {
          const hasAnyFallback = productsWithCompetitor.some(
            (p) => p.isFallback
          );
          if (!hasAnyFallback && productsWithCompetitor.length > 0) {
            return (
              <div className="p-4 rounded-lg bg-success/5 border border-success/20">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      ✓ Live AI Data Fetched
                    </p>
                    <p className="text-xs text-muted-foreground">
                      All prices were successfully fetched from live competitor
                      websites using AI crawling. Data updates dynamically on
                      each analysis run.
                    </p>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}
      </CardContent>
    </Card>
  );
}
