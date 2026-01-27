import { Product } from '@/types/price';
import { validateProduct, DEFAULT_THRESHOLDS } from '@/utils/priceValidation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, TrendingDown, TrendingUp, Info, Award, Zap } from 'lucide-react';
import { CompetitorPriceComparison } from './CompetitorPriceComparison';
import { PricingOptimizer } from './PricingOptimizer';

interface ProductTableProps {
  products: Product[];
  onProductSelect?: (product: Product) => void;
  onPriceUpdate?: (productId: string, newPrice: number) => void;
}

export function ProductTable({ products, onProductSelect, onPriceUpdate }: ProductTableProps) {
  const getStatusBadge = (status: Product['status']) => {
    switch (status) {
      case 'valid':
        return (
          <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Valid
          </Badge>
        );
      case 'low':
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20 hover:bg-warning/20">
            <TrendingDown className="h-3 w-3 mr-1" />
            Low
          </Badge>
        );
      case 'high':
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20">
            <TrendingUp className="h-3 w-3 mr-1" />
            High
          </Badge>
        );
      case 'warning':
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getPriceAdvantageColor = (ourPrice: number, competitorPrice?: number): string => {
    if (!competitorPrice || competitorPrice === 0) return '';
    const diff = ((ourPrice - competitorPrice) / competitorPrice) * 100;
    if (diff < -5) return 'text-success'; // We're cheaper
    if (diff > 5) return 'text-destructive'; // We're more expensive
    return 'text-warning'; // About the same
  };

  const getLowestPriceInfo = (product: Product) => {
    if (!product.competitorPrice && !product.lowestCompetitorPrice) {
      return null;
    }

    const lowestPrice = product.lowestCompetitorPrice || product.competitorPrice;
    const lowestSource = product.lowestCompetitorSource || product.competitorSource;
    
    return { lowestPrice, lowestSource };
  };

  return (
    <Card className="shadow-card animate-slide-up">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Product Pricing Analysis</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Product ID</TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Category</TableHead>
                <TableHead className="font-semibold text-right">Original</TableHead>
                <TableHead className="font-semibold text-right">Selling</TableHead>
                <TableHead className="font-semibold text-right">Discount</TableHead>
                <TableHead className="font-semibold text-right">Margin</TableHead>
                <TableHead className="font-semibold text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Zap className="h-4 w-4 text-warning" />
                    Lowest Competitor
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-center">Advantage</TableHead>
                <TableHead className="font-semibold text-center">Status</TableHead>
                <TableHead className="font-semibold text-center">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const validation = validateProduct(product, DEFAULT_THRESHOLDS);
                return (
                  <TableRow
                    key={product.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => onProductSelect?.(product)}
                  >
                    <TableCell className="font-mono text-sm">{product.id}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {product.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{product.category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(product.originalPrice)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(product.sellingPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={product.discountPercent > 40 ? 'text-warning' : ''}>
                        {product.discountPercent.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          product.profitMargin < 15
                            ? 'text-destructive'
                            : product.profitMargin > 50
                            ? 'text-success'
                            : ''
                        }
                      >
                        {product.profitMargin.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {product.isFallback ? (
                        <Badge variant="outline" className="text-destructive border-destructive/50 bg-destructive/10">
                          Not Found
                        </Badge>
                      ) : product.competitorPrice ? (
                        <div className="flex flex-col items-end">
                          <span>{formatCurrency(product.competitorPrice)}</span>
                          <span className="text-xs text-muted-foreground">
                            {product.competitorSource}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const lowestInfo = getLowestPriceInfo(product);
                        if (!lowestInfo) {
                          return <span className="text-muted-foreground">-</span>;
                        }

                        const diff = ((product.sellingPrice - lowestInfo.lowestPrice) / lowestInfo.lowestPrice) * 100;
                        const isAdvantage = diff < 0;
                        const advantageText = isAdvantage 
                          ? `${Math.abs(diff).toFixed(1)}% Better`
                          : `${diff.toFixed(1)}% Higher`;

                        return (
                          <div className="flex items-center justify-center gap-1">
                            {isAdvantage ? (
                              <>
                                <Award className="h-4 w-4 text-success" />
                                <span className={getPriceAdvantageColor(product.sellingPrice, lowestInfo.lowestPrice)}>
                                  {advantageText}
                                </span>
                              </>
                            ) : (
                              <span className={getPriceAdvantageColor(product.sellingPrice, lowestInfo.lowestPrice)}>
                                {advantageText}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-center">{getStatusBadge(product.status)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Info className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-[300px]">
                              <div className="space-y-2">
                                {validation.issues.length > 0 ? (
                                  <ul className="text-sm space-y-1">
                                    {validation.issues.map((issue, i) => (
                                      <li key={i} className="text-destructive">• {issue}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-success">No issues detected</p>
                                )}
                                <p className="text-sm font-medium pt-2 border-t">
                                  {validation.recommendation}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <CompetitorPriceComparison product={product} />
                        <PricingOptimizer 
                          product={product} 
                          onPriceUpdate={(newPrice) => onPriceUpdate?.(product.id, newPrice)}
                        />
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
