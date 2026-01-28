import { useState } from "react";
import {
  Product,
  getPriceComparisonStatus,
  calculateRecommendedPrice,
} from "@/types/price";
import { validateProduct, DEFAULT_THRESHOLDS } from "@/utils/priceValidation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  AlertCircle,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  Info,
  Edit2,
  Check,
  X,
  Upload,
  Search,
  ExternalLink,
} from "lucide-react";

interface EditableProductTableProps {
  products: Product[];
  onProductUpdate: (updatedProducts: Product[]) => void;
  onExport: () => void;
  clientUrl?: string;
  selectedCountry?: string;
  onPriceUpdate?: (productId: string, newPrice: number) => void;
}

export function EditableProductTable({
  products,
  onProductUpdate,
  onExport,
  clientUrl,
  selectedCountry,
  onPriceUpdate,
}: EditableProductTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Escape special regex characters for safe search
  const escapeRegex = (str: string) =>
    str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const filteredProducts = products.filter((product) => {
    if (!searchQuery.trim()) return true;
    const escapedQuery = escapeRegex(searchQuery.toLowerCase());
    const regex = new RegExp(escapedQuery, "i");
    return (
      regex.test(product.name) ||
      regex.test(product.id) ||
      regex.test(product.category) ||
      regex.test(product.sku)
    );
  });

  const getStatusBadge = (status: Product["status"]) => {
    switch (status) {
      case "valid":
        return (
          <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Valid
          </Badge>
        );
      case "low":
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20 hover:bg-warning/20">
            <TrendingDown className="h-3 w-3 mr-1" />
            Low Price
          </Badge>
        );
      case "high":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20">
            <TrendingUp className="h-3 w-3 mr-1" />
            High Price
          </Badge>
        );
      case "warning":
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20 hover:bg-warning/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Warning
          </Badge>
        );
      default:
        return null;
    }
  };

  // Get color for price comparison (±5% threshold)
  const getPriceComparisonColor = (
    ourPrice: number,
    competitorPrice?: number
  ) => {
    const status = getPriceComparisonStatus(ourPrice, competitorPrice);
    switch (status) {
      case "aligned":
        return "text-success bg-success/10";
      case "lower":
        return "text-destructive bg-destructive/10"; // Red for >5% lower
      case "higher":
        return "text-warning bg-warning/10"; // Orange for >5% higher
      default:
        return "";
    }
  };

  const getPriceDiffBadge = (ourPrice: number, competitorPrice?: number) => {
    if (!competitorPrice) return null;
    const diff = ((ourPrice - competitorPrice) / competitorPrice) * 100;
    const status = getPriceComparisonStatus(ourPrice, competitorPrice);

    const colorClass =
      status === "aligned"
        ? "bg-success/10 text-success border-success/30"
        : status === "lower"
          ? "bg-destructive/10 text-destructive border-destructive/30"
          : "bg-warning/10 text-warning border-warning/30";

    return (
      <Badge className={`text-xs ${colorClass}`}>
        {diff > 0 ? "+" : ""}
        {diff.toFixed(1)}%
      </Badge>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleEdit = (productId: string, currentPrice: number) => {
    setEditingId(productId);
    setEditValue(currentPrice.toString());
  };

  const handleSave = (productId: string) => {
    const newPrice = parseFloat(editValue);
    if (isNaN(newPrice) || newPrice <= 0) {
      setEditingId(null);
      return;
    }

    const updatedProducts = products.map((product) => {
      if (product.id === productId) {
        const newDiscount =
          ((product.originalPrice - newPrice) / product.originalPrice) * 100;
        const newMargin = ((newPrice - product.costPrice) / newPrice) * 100;
        const priceStatus = getPriceComparisonStatus(
          newPrice,
          product.competitorPrice
        );

        const updatedProduct = {
          ...product,
          sellingPrice: newPrice,
          discountPercent: Math.max(0, newDiscount),
          profitMargin: newMargin,
          priceComparisonStatus: priceStatus,
        };

        // Recalculate status based on ±5% rule
        if (priceStatus === "lower") {
          updatedProduct.status = "low";
        } else if (priceStatus === "higher") {
          updatedProduct.status = "high";
        } else if (newMargin < 10 || newDiscount > 50) {
          updatedProduct.status = "warning";
        } else {
          updatedProduct.status = "valid";
        }

        return updatedProduct;
      }
      return product;
    });

    onProductUpdate(updatedProducts);
    setEditingId(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue("");
  };

  const applyRecommendedPrice = (
    productId: string,
    recommendedPrice: number
  ) => {
    setEditingId(productId);
    setEditValue(recommendedPrice.toString());
  };

  const issuesCount = products.filter((p) => p.status !== "valid").length;
  const validCount = products.filter((p) => p.status === "valid").length;
  // Only count aligned products that were successfully found (not fallback)
  const alignedCount = products.filter(
    (p) =>
      !p.isFallback &&
      getPriceComparisonStatus(p.sellingPrice, p.competitorPrice) === "aligned"
  ).length;

  return (
    <Card className="shadow-card animate-slide-up">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="text-lg font-semibold">
              Review & Correct Pricing
            </CardTitle>
            <CardDescription>
              {clientUrl && <span className="text-primary">{clientUrl}</span>}
              {" • "}
              {issuesCount > 0 ? (
                <span className="text-warning">
                  {issuesCount} issues detected
                </span>
              ) : (
                <span className="text-success">All prices validated</span>
              )}
              {" • "}
              <span className="text-success">{alignedCount} aligned</span>
              {" • "}
              {validCount}/{products.length} valid
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
            <Button
              onClick={onExport}
              className="gradient-primary text-primary-foreground"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload to Server
            </Button>
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-xs flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-success/20 border border-success/50 font-semibold" />
            Medium (±5% Aligned)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/50" />
            Low Price (&gt;5% Cheaper)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-destructive/20 border border-destructive/50" />
            High Price (&gt;5% Expensive)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/50" />
            Risk (Low Margin)
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Product ID</TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Category</TableHead>
                <TableHead className="font-semibold text-right">
                  Net Price
                </TableHead>
                <TableHead className="font-semibold text-right">
                  Competitor
                </TableHead>
                <TableHead className="font-semibold text-right">Diff</TableHead>
                <TableHead className="font-semibold text-right">
                  AI Recommended
                </TableHead>
                <TableHead className="font-semibold text-right">
                  Margin
                </TableHead>
                <TableHead className="font-semibold text-center">
                  Status
                </TableHead>
                <TableHead className="font-semibold text-center">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const validation = validateProduct(product, DEFAULT_THRESHOLDS);
                const isEditing = editingId === product.id;
                const priceStatus = getPriceComparisonStatus(
                  product.sellingPrice,
                  product.competitorPrice
                );
                const recommendedPrice = calculateRecommendedPrice(
                  product.sellingPrice,
                  product.competitorPrice,
                  product.costPrice
                );
                const hasIssue = product.status !== "valid";

                return (
                  <TableRow
                    key={product.id}
                    className={`transition-colors ${hasIssue ? "bg-warning/5" : ""
                      }`}
                  >
                    <TableCell className="font-mono text-sm">
                      {product.id}
                    </TableCell>
                    <TableCell className="font-medium max-w-[180px] truncate">
                      {product.competitorProductUrl ? (
                        <a
                          href={product.competitorProductUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline cursor-pointer flex items-center gap-1"
                          title={`Click to view ${product.competitorSource} product page`}
                        >
                          {product.name}
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      ) : (
                        product.name
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.category}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-24 h-8 text-right"
                            step="0.01"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleSave(product.id)}
                          >
                            <Check className="h-4 w-4 text-success" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={handleCancel}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <span
                          className={`font-medium px-2 py-1 rounded ${getPriceComparisonColor(
                            product.sellingPrice,
                            product.competitorPrice
                          )}`}
                        >
                          {formatCurrency(product.sellingPrice)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.isFallback ? (
                        <Badge
                          variant="outline"
                          className="text-destructive border-destructive/50 bg-destructive/10"
                        >
                          Not Found
                        </Badge>
                      ) : product.competitorPrice ? (
                        <div className="flex flex-col items-end gap-1">
                          <span>{formatCurrency(product.competitorPrice)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {getPriceDiffBadge(
                        product.sellingPrice,
                        product.competitorPrice
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {recommendedPrice ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto py-1 px-2 font-medium text-primary hover:bg-primary/10"
                                onClick={() =>
                                  applyRecommendedPrice(
                                    product.id,
                                    recommendedPrice
                                  )
                                }
                              >
                                {formatCurrency(recommendedPrice)}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                Click to apply AI recommended price
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          product.profitMargin < 15
                            ? "text-destructive"
                            : product.profitMargin > 50
                              ? "text-success"
                              : ""
                        }
                      >
                        {product.profitMargin.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center py-3 px-2">
                      {getStatusBadge(product.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {!isEditing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                              handleEdit(product.id, product.sellingPrice)
                            }
                          >
                            <Edit2 className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                              >
                                <Info className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="left"
                              className="max-w-[300px]"
                            >
                              <div className="space-y-2">
                                {validation.issues.length > 0 ? (
                                  <ul className="text-sm space-y-1">
                                    {validation.issues.map((issue, i) => (
                                      <li key={i} className="text-destructive">
                                        • {issue}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-success">
                                    No issues detected
                                  </p>
                                )}
                                <p className="text-sm font-medium pt-2 border-t">
                                  {product.recommendation ||
                                    validation.recommendation}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
