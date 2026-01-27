import { Product } from '@/types/price';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Trophy, TrendingDown, TrendingUp, Eye, Award, Zap } from 'lucide-react';

interface CompetitorPriceComparisonProps {
  product: Product;
  onOpenChange?: (open: boolean) => void;
}

export function CompetitorPriceComparison({ product, onOpenChange }: CompetitorPriceComparisonProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const lowestPrice = product.lowestCompetitorPrice || product.competitorPrice;
  const lowestSource = product.lowestCompetitorSource || product.competitorSource || 'Unknown';

  if (!lowestPrice) {
    return (
      <Dialog onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Eye className="h-4 w-4" />
            View Details
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-warning" />
              Competitor Price Analysis
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center text-muted-foreground">
            <p>No competitor pricing data available for this product.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const priceDiff = product.sellingPrice - lowestPrice;
  const priceDiffPercent = (priceDiff / lowestPrice) * 100;
  const isCompetitive = priceDiff < 0;

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Eye className="h-4 w-4" />
          View Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-warning" />
            Competitor Price Analysis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Info */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Product</p>
            <p className="font-semibold">{product.name}</p>
            <p className="text-xs text-muted-foreground mt-1">SKU: {product.sku}</p>
          </div>

          <Separator />

          {/* Price Comparison */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground">Price Comparison</p>
            
            {/* Your Price */}
            <div className="rounded-lg bg-card border border-border p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Your Price</span>
                <Badge variant="secondary">Current</Badge>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(product.sellingPrice)}</p>
            </div>

            {/* Lowest Competitor Price */}
            <div className={`rounded-lg border p-3 ${isCompetitive ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Trophy className={`h-4 w-4 ${isCompetitive ? 'text-success' : 'text-destructive'}`} />
                  <span className="text-sm text-muted-foreground">Lowest Competitor</span>
                </div>
                <Badge variant={isCompetitive ? 'default' : 'destructive'}>
                  {lowestSource}
                </Badge>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(lowestPrice)}</p>
            </div>

            {/* Price Difference */}
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                {isCompetitive ? (
                  <>
                    <TrendingDown className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium text-success">You're Cheaper</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">You're More Expensive</span>
                  </>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <p className={`text-lg font-bold ${isCompetitive ? 'text-success' : 'text-destructive'}`}>
                  {isCompetitive ? '−' : '+'}${Math.abs(priceDiff).toFixed(2)}
                </p>
                <p className={`text-sm ${isCompetitive ? 'text-success' : 'text-destructive'}`}>
                  ({isCompetitive ? '−' : '+'}${Math.abs(priceDiffPercent).toFixed(1)}%)
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Recommendation */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">Recommendation</p>
            <div className="text-sm space-y-2">
              {isCompetitive ? (
                <div className="flex items-start gap-2 rounded-lg bg-success/10 p-2 border border-success/20">
                  <Award className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                  <p className="text-success font-medium">
                    Excellent positioning! You have a competitive advantage.
                    {priceDiffPercent < -10 && ` You could increase price by up to ${Math.abs(priceDiffPercent).toFixed(1)}% to match competitors.`}
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2 border border-destructive/20">
                  <Award className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-destructive font-medium">
                    Consider reducing your price by ${priceDiff.toFixed(2)} to match the lowest competitor and remain competitive.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Profit Margin Info */}
          {product.profitMargin && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">Profit Margin</p>
                <p className="text-lg font-bold">
                  {product.profitMargin.toFixed(1)}%
                  <span className={`text-xs ml-2 ${product.profitMargin >= 15 ? 'text-success' : 'text-destructive'}`}>
                    {product.profitMargin >= 15 ? '✓ Healthy' : '⚠ Low'}
                  </span>
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CompetitorPricingTableProps {
  products: Product[];
  title?: string;
  description?: string;
}

export function CompetitorPricingTable({ 
  products, 
  title = 'Competitor Price Comparison', 
  description = 'See how your prices compare to competitors' 
}: CompetitorPricingTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const productsWithCompetitorData = products.filter(
    p => p.lowestCompetitorPrice || p.competitorPrice
  );

  if (productsWithCompetitorData.length === 0) {
    return (
      <Card className="shadow-card animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-warning" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No competitor pricing data available yet.</p>
            <p className="text-sm mt-2">Upload a file with competitor URLs to get started.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card animate-slide-up">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-warning" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Product</TableHead>
                <TableHead className="font-semibold text-right">Your Price</TableHead>
                <TableHead className="font-semibold text-right">Competitor Price</TableHead>
                <TableHead className="font-semibold text-right">Difference</TableHead>
                <TableHead className="font-semibold text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsWithCompetitorData.map((product) => {
                const lowestPrice = product.lowestCompetitorPrice || product.competitorPrice;
                const lowestSource = product.lowestCompetitorSource || product.competitorSource;
                
                if (!lowestPrice) return null;

                const diff = product.sellingPrice - lowestPrice;
                const diffPercent = (diff / lowestPrice) * 100;
                const isCompetitive = diff < 0;

                return (
                  <TableRow key={product.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium max-w-[250px] truncate">
                      <div>
                        <p>{product.name}</p>
                        <p className="text-xs text-muted-foreground">{lowestSource}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(product.sellingPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(lowestPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className={isCompetitive ? 'text-success font-medium' : 'text-destructive font-medium'}>
                          {isCompetitive ? '−' : '+'}${Math.abs(diff).toFixed(2)}
                        </span>
                        <span className={`text-xs ${isCompetitive ? 'text-success' : 'text-destructive'}`}>
                          ({isCompetitive ? '−' : '+'}${Math.abs(diffPercent).toFixed(1)}%)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={isCompetitive ? 'secondary' : 'destructive'}>
                        {isCompetitive ? 'Competitive' : 'Review'}
                      </Badge>
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
