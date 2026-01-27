import { useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Product, PriceThreshold, AnalyticsSummary } from "@/types/price";
import {
  DEFAULT_THRESHOLDS,
  calculateAnalytics,
  determineProductStatus,
  generateMockCompetitorPrices,
} from "@/utils/priceValidation";
import { parseExcelFile, exportToExcel } from "@/utils/excelParser";
import {
  crawlCompetitorPrices,
  mergeCompetitorPrices,
  calculatePriceAdvantage,
} from "@/utils/competitorCrawler";
import { ClientUploadForm } from "@/components/ClientUploadForm";
import { EditableProductTable } from "@/components/EditableProductTable";
import { AnalyticsCards } from "@/components/AnalyticsCards";
import { ThresholdConfig } from "@/components/ThresholdConfig";
import { PriceCharts } from "@/components/PriceCharts";
import { CompetitorBenchmark } from "@/components/CompetitorBenchmark";
import { CompetitorPricingTable } from "@/components/CompetitorPriceComparison";
import { BulkPricingOptimizer } from "@/components/PricingOptimizer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  Plus,
  BarChart3,
  Settings,
  Globe,
  FileSpreadsheet,
  RotateCcw,
  Zap,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Country } from "@/utils/aiProductMatcher";

const Index = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [thresholds, setThresholds] =
    useState<PriceThreshold>(DEFAULT_THRESHOLDS);
  const [isLoading, setIsLoading] = useState(false);
  const [clientUrl, setClientUrl] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>("IN");
  const [analytics, setAnalytics] = useState<AnalyticsSummary>({
    totalProducts: 0,
    validProducts: 0,
    lowPricedProducts: 0,
    highPricedProducts: 0,
    averageMargin: 0,
    potentialRevenueLoss: 0,
  });

  const handleUploadSubmit = useCallback(
    async (file: File, url: string) => {
      setIsLoading(true);
      setClientUrl(url);
      console.log("Uploading file:", file);
      try {
        const parsedProducts = await parseExcelFile(file);

        // Show initial toast for file parsing
        toast.loading("Analyzing prices...", { id: "crawler-progress" });

        // Add competitor crawling with AI
        try {
          const crawlResults = await crawlCompetitorPrices(
            parsedProducts,
            selectedCountry
          );
          const productsWithCrawledPrices = mergeCompetitorPrices(
            parsedProducts,
            crawlResults
          );
          const productsWithCompetitor = productsWithCrawledPrices.map((p) => ({
            ...p,
            status: determineProductStatus(p, DEFAULT_THRESHOLDS),
          }));

          setProducts(productsWithCompetitor);
          setAnalytics(calculateAnalytics(productsWithCompetitor));

          const issuesCount = productsWithCompetitor.filter(
            (p) => p.status !== "valid"
          ).length;
          const crawledCount = crawlResults.filter(
            (r) => r.isCompleted && r.lowestPrice
          ).length;

          toast.dismiss("crawler-progress");
          toast.success("Price analysis complete!", {
            description: `Analyzed ${parsedProducts.length} products, found ${issuesCount} issues, crawled ${crawledCount} competitors`,
          });
        } catch (crawlError) {
          // Fallback to mock competitor prices if crawling fails
          console.warn(
            "Competitor crawling failed, using mock prices:",
            crawlError
          );
          const productsWithCompetitor =
            generateMockCompetitorPrices(parsedProducts);

          setProducts(productsWithCompetitor);
          setAnalytics(calculateAnalytics(productsWithCompetitor));

          const issuesCount = productsWithCompetitor.filter(
            (p) => p.status !== "valid"
          ).length;

          toast.dismiss("crawler-progress");
          toast.success(
            "Price analysis complete! (Using mock competitor data)",
            {
              description: `Analyzed ${parsedProducts.length} products, found ${issuesCount} pricing issues`,
            }
          );
        }
      } catch (error) {
        toast.dismiss("crawler-progress");
        toast.error("Failed to process file", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [selectedCountry]
  );

  const handleReset = () => {
    setProducts([]);
    setClientUrl("");
    setAnalytics({
      totalProducts: 0,
      validProducts: 0,
      lowPricedProducts: 0,
      highPricedProducts: 0,
      averageMargin: 0,
      potentialRevenueLoss: 0,
    });
  };

  const handleThresholdsChange = useCallback(
    (newThresholds: PriceThreshold) => {
      setThresholds(newThresholds);

      // Revalidate all products with new thresholds
      const updatedProducts = products.map((product) => ({
        ...product,
        status: determineProductStatus(product, newThresholds),
      }));

      setProducts(updatedProducts);
      setAnalytics(calculateAnalytics(updatedProducts));
    },
    [products]
  );

  const handleExport = () => {
    if (products.length === 0) {
      toast.error("No products to export");
      return;
    }
    exportToExcel(products);
    toast.success("Export complete!", {
      description: "Check your downloads folder",
    });
  };

  const handleProductsUpdate = (updatedProducts: Product[]) => {
    setProducts(updatedProducts);
    setAnalytics(calculateAnalytics(updatedProducts));
  };

  const handlePriceUpdate = (productId: string, newPrice: number) => {
    const updatedProducts = products.map((p) => {
      if (p.id === productId) {
        const updatedProduct = { ...p, sellingPrice: newPrice };
        // Recalculate discount and margin
        const discount =
          p.originalPrice > 0
            ? ((p.originalPrice - newPrice) / p.originalPrice) * 100
            : 0;
        const margin =
          newPrice > 0 ? ((newPrice - p.costPrice) / newPrice) * 100 : 0;
        return {
          ...updatedProduct,
          discountPercent: discount,
          profitMargin: margin,
          status: determineProductStatus(
            {
              ...updatedProduct,
              discountPercent: discount,
              profitMargin: margin,
            },
            DEFAULT_THRESHOLDS
          ),
        };
      }
      return p;
    });

    handleProductsUpdate(updatedProducts);
    toast.success("Price updated!", {
      description: `New price: $${newPrice.toFixed(2)}`,
    });
  };

  const handleCountryChange = (newCountry: Country) => {
    setSelectedCountry(newCountry);
  };

  return (
    <>
      <Helmet>
        <title>Price Validator Pro | E-commerce Pricing Intelligence</title>
        <meta
          name="description"
          content="AI-powered price validation and competitor benchmarking for e-commerce. Optimize profit margins and conversion rates with intelligent pricing recommendations."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg gradient-primary">
                  <BarChart3 className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">
                    Price Validator Pro
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    E-commerce Pricing Intelligence
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {products.length > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      New Analysis
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport}>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 space-y-8">
          {products.length === 0 ? (
            <div className="py-8">
              <ClientUploadForm
                onSubmit={handleUploadSubmit}
                isLoading={isLoading}
              />
            </div>
          ) : (
            <>
              {/* Analytics Summary */}
              <AnalyticsCards analytics={analytics} products={products} />

              {/* Tabs */}
              <Tabs defaultValue="products" className="space-y-6">
                <TabsList className="grid w-full max-w-md grid-cols-5">
                  <TabsTrigger value="products" className="text-xs sm:text-sm">
                    <FileSpreadsheet className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Products</span>
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="text-xs sm:text-sm">
                    <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Analytics</span>
                  </TabsTrigger>
                  <TabsTrigger value="optimize" className="text-xs sm:text-sm">
                    <TrendingUp className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Optimize</span>
                  </TabsTrigger>
                  <TabsTrigger value="benchmark" className="text-xs sm:text-sm">
                    <Globe className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Benchmark</span>
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="text-xs sm:text-sm">
                    <Settings className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Settings</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="products" className="space-y-4">
                  <EditableProductTable
                    products={products}
                    onProductUpdate={handleProductsUpdate}
                    onExport={handleExport}
                    clientUrl={clientUrl}
                    selectedCountry={selectedCountry}
                    onPriceUpdate={handlePriceUpdate}
                  />
                </TabsContent>

                <TabsContent value="analytics">
                  <PriceCharts products={products} />
                </TabsContent>

                <TabsContent value="optimize">
                  <BulkPricingOptimizer
                    products={products}
                    onPriceUpdate={handlePriceUpdate}
                  />
                </TabsContent>

                <TabsContent value="benchmark">
                  <div className="space-y-6">
                    <CompetitorPricingTable
                      products={products}
                      title="Your Price vs. Lowest Competitor"
                      description="Compare your prices with the lowest competitor prices found for each product"
                    />
                    <CompetitorBenchmark
                      products={products}
                      onUpdateProducts={handleProductsUpdate}
                      onCountryChange={handleCountryChange}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="settings">
                  <ThresholdConfig
                    thresholds={thresholds}
                    onThresholdsChange={handleThresholdsChange}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </main>
      </div>
    </>
  );
};

export default Index;
