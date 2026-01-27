import { useState } from 'react';
import { Product } from '@/types/price';
import { optimizePrice, calculatePriceForMargin, calculateMarginForPrice, generatePricingSummary } from '@/utils/pricingOptimizer';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { TrendingUp, TrendingDown, DollarSign, Target, AlertCircle, CheckCircle, Zap } from 'lucide-react';

interface PricingOptimizerProps {
  product: Product;
  onPriceUpdate?: (newPrice: number) => void;
}

export function PricingOptimizer({ product, onPriceUpdate }: PricingOptimizerProps) {
  const [desiredMargin, setDesiredMargin] = useState(30);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  const optimization = optimizePrice(product);
  const targetPrice = calculatePriceForMargin(product.costPrice, desiredMargin);
  const currentMarginAtTarget = calculateMarginForPrice(targetPrice, product.costPrice);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getMarginColor = (margin: number): string => {
    if (margin < 15) return 'text-destructive';
    if (margin < 20) return 'text-warning';
    if (margin > 50) return 'text-warning';
    return 'text-success';
  };

  const handleStrategySelect = (strategy: typeof optimization.recommendations[0], newPrice: number) => {
    setSelectedStrategy(strategy.strategy);
    onPriceUpdate?.(newPrice);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Target className="h-4 w-4" />
          Optimize Price
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-warning" />
            Price Optimizer - {product.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="calculator" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calculator">Calculator</TabsTrigger>
            <TabsTrigger value="strategies">Strategies</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
          </TabsList>

          {/* Calculator Tab */}
          <TabsContent value="calculator" className="space-y-6">
            <div className="space-y-4">
              {/* Current Status */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Current Price</p>
                      <p className="text-2xl font-bold">{formatCurrency(product.sellingPrice)}</p>
                      <p className={`text-sm font-medium ${getMarginColor(product.profitMargin)}`}>
                        {product.profitMargin.toFixed(1)}% margin
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Cost Price</p>
                      <p className="text-2xl font-bold">{formatCurrency(product.costPrice)}</p>
                      <p className="text-sm text-muted-foreground">Your acquisition cost</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Profit/Unit</p>
                      <p className="text-2xl font-bold">{formatCurrency(product.sellingPrice - product.costPrice)}</p>
                      <p className="text-sm text-success">Per sale profit</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Margin Slider */}
              <div className="space-y-4 rounded-lg border p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Target Margin</Label>
                    <span className={`text-2xl font-bold ${getMarginColor(desiredMargin)}`}>
                      {desiredMargin.toFixed(1)}%
                    </span>
                  </div>
                  <Slider
                    value={[desiredMargin]}
                    onValueChange={(val) => setDesiredMargin(val[0])}
                    min={10}
                    max={60}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>10% (Risky)</span>
                    <span>30% (Sweet Spot)</span>
                    <span>60% (Premium)</span>
                  </div>
                </div>

                {/* Price at Target Margin */}
                <div className="space-y-2 rounded-lg bg-primary/10 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Price at {desiredMargin.toFixed(1)}% margin:</span>
                    <span className="text-2xl font-bold text-primary">{formatCurrency(targetPrice)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This price maintains your {desiredMargin.toFixed(1)}% profit margin
                  </p>
                </div>

                {/* Comparison with Competitor */}
                {optimization.lowestCompetitorPrice && (
                  <div className={`space-y-2 rounded-lg p-3 ${
                    targetPrice <= optimization.lowestCompetitorPrice * 1.1
                      ? 'bg-success/10'
                      : 'bg-warning/10'
                  }`}>
                    <div className="flex items-center justify-between text-sm">
                      <span>vs. Lowest Competitor: {formatCurrency(optimization.lowestCompetitorPrice)}</span>
                      <span className={`font-medium ${
                        targetPrice <= optimization.lowestCompetitorPrice * 1.1
                          ? 'text-success'
                          : 'text-warning'
                      }`}>
                        {targetPrice <= optimization.lowestCompetitorPrice ? (
                          `${Math.abs((targetPrice - optimization.lowestCompetitorPrice) / optimization.lowestCompetitorPrice * 100).toFixed(1)}% cheaper`
                        ) : (
                          `${((targetPrice - optimization.lowestCompetitorPrice) / optimization.lowestCompetitorPrice * 100).toFixed(1)}% higher`
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Apply Button */}
                <Button
                  className="w-full"
                  onClick={() => onPriceUpdate?.(targetPrice)}
                  disabled={targetPrice === product.sellingPrice}
                >
                  {targetPrice === product.sellingPrice
                    ? 'No Change Needed'
                    : `Apply Price: ${formatCurrency(targetPrice)}`}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Strategies Tab */}
          <TabsContent value="strategies" className="space-y-4">
            {optimization.recommendations.length > 0 ? (
              <div className="space-y-3">
                {optimization.recommendations.map((rec, idx) => (
                  <Card key={idx} className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedStrategy === rec.strategy ? 'border-primary' : ''
                  }`}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold capitalize">{rec.strategy} Strategy</h4>
                              <Badge variant={
                                rec.riskLevel === 'low' ? 'default' :
                                rec.riskLevel === 'medium' ? 'secondary' :
                                'destructive'
                              }>
                                {rec.riskLevel} risk
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{rec.reasoning}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded bg-muted/50 p-2">
                            <p className="text-xs text-muted-foreground">Target Price</p>
                            <p className="text-lg font-bold">{formatCurrency(rec.targetPrice)}</p>
                          </div>
                          <div className="rounded bg-muted/50 p-2">
                            <p className="text-xs text-muted-foreground">Target Margin</p>
                            <p className={`text-lg font-bold ${getMarginColor(rec.targetMargin)}`}>
                              {rec.targetMargin.toFixed(1)}%
                            </p>
                          </div>
                          <div className="rounded bg-muted/50 p-2">
                            <p className="text-xs text-muted-foreground">vs. Current</p>
                            <p className={`text-lg font-bold ${
                              rec.targetPrice > product.sellingPrice ? 'text-success' : 'text-destructive'
                            }`}>
                              {rec.targetPrice > product.sellingPrice ? '+' : ''}
                              {formatCurrency(rec.targetPrice - product.sellingPrice)}
                            </p>
                          </div>
                        </div>

                        <Button
                          className="w-full"
                          onClick={() => handleStrategySelect(rec, rec.targetPrice)}
                        >
                          Apply {rec.strategy.charAt(0).toUpperCase() + rec.strategy.slice(1)} Strategy
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No strategies available. Check if competitor data is available.</p>
              </div>
            )}
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="space-y-4">
            {/* Positioning */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Market Positioning
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
                  {optimization.positioningAnalysis.status === 'cheaper' && (
                    <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-1" />
                  )}
                  {optimization.positioningAnalysis.status === 'premium' && (
                    <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-1" />
                  )}
                  {optimization.positioningAnalysis.status === 'aligned' && (
                    <CheckCircle className="h-5 w-5 text-info flex-shrink-0 mt-1" />
                  )}
                  <div>
                    <p className="font-semibold">{optimization.positioningAnalysis.recommendedAction}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Competitiveness Score: {optimization.positioningAnalysis.competitivenessScore.toFixed(0)}/100
                    </p>
                  </div>
                </div>

                {/* Margin Comparison Table */}
                <div>
                  <h4 className="font-semibold mb-3">Price Points at Different Margins</h4>
                  <div className="space-y-2">
                    {[
                      { margin: 15, label: 'Minimum', price: optimization.priceAt15Margin },
                      { margin: 20, label: 'Conservative', price: optimization.priceAt20Margin },
                      { margin: 25, label: 'Balanced', price: optimization.priceAt25Margin },
                      { margin: 30, label: 'Comfortable', price: optimization.priceAt30Margin },
                      { margin: 40, label: 'Current', price: optimization.priceAt40Margin },
                      { margin: 50, label: 'Premium', price: optimization.priceAt50Margin },
                    ].map((item) => (
                      <div key={item.margin} className="flex items-center justify-between p-2 rounded border">
                        <div>
                          <p className="text-sm font-medium">{item.margin}% - {item.label}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{formatCurrency(item.price)}</span>
                          {Math.abs(item.price - product.sellingPrice) < 1 && (
                            <Badge variant="secondary">Current</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Bulk Pricing Optimizer Component
 * Shows optimization opportunities for all products
 */
interface BulkPricingOptimizerProps {
  products: Product[];
  onPricesUpdate?: (productId: string, newPrice: number) => void;
}

export function BulkPricingOptimizer({ products, onPricesUpdate }: BulkPricingOptimizerProps) {
  const summary = generatePricingSummary(products);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Pricing Optimization Opportunities
        </CardTitle>
        <CardDescription>
          Identify products that can be repriced to optimize margins and competitiveness
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Optimizable Products</p>
              <p className="text-2xl font-bold">{summary.productsOptimizable}</p>
              <p className="text-xs text-muted-foreground">of {summary.totalProducts}</p>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Underpriced</p>
              <p className="text-2xl font-bold text-success">{summary.productsUnderpriced}</p>
              <p className="text-xs text-success">Raise price potential</p>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Overpriced</p>
              <p className="text-2xl font-bold text-destructive">{summary.productsOverpriced}</p>
              <p className="text-xs text-destructive">Lower to compete</p>
            </CardContent>
          </Card>

          <Card className="bg-primary/10">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Potential Profit Gain</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(summary.totalPotentialMarginImprovement)}
              </p>
              <p className="text-xs text-muted-foreground">Total across all products</p>
            </CardContent>
          </Card>
        </div>

        {/* Top Opportunities Table */}
        {summary.topOpportunities.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Top 5 Optimization Opportunities</h4>
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Current Price</TableHead>
                    <TableHead className="text-right">Optimal Price</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">Profit Gain/Loss</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.topOpportunities.map((opp) => {
                    const optimalPrice = calculatePriceForMargin(opp.product.costPrice, 30);
                    const change = optimalPrice - opp.product.sellingPrice;
                    const changePercent = (change / opp.product.sellingPrice) * 100;

                    return (
                      <TableRow key={opp.product.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {opp.product.name}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(opp.product.sellingPrice)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(optimalPrice)}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${
                          change > 0 ? 'text-success' : 'text-destructive'
                        }`}>
                          {change > 0 ? '+' : ''}{formatCurrency(change)}
                          <br />
                          <span className="text-xs text-muted-foreground">({changePercent.toFixed(1)}%)</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(opp.profitDifference)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPricesUpdate?.(opp.product.id, optimalPrice)}
                          >
                            Apply
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
