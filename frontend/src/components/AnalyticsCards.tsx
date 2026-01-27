import { Product, AnalyticsSummary } from '@/types/price';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, CheckCircle, TrendingDown, TrendingUp, Percent, DollarSign, Zap, Award } from 'lucide-react';
import { calculatePriceAdvantage } from '@/utils/competitorCrawler';

interface AnalyticsCardsProps {
  analytics: AnalyticsSummary;
  products?: Product[];
}

export function AnalyticsCards({ analytics, products = [] }: AnalyticsCardsProps) {
  // Calculate competitor pricing metrics if products are available
  const priceAdvantage = products.length > 0 ? calculatePriceAdvantage(products) : null;

  const cards = [
    {
      title: 'Total Products',
      value: analytics.totalProducts,
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Valid Pricing',
      value: analytics.validProducts,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
      suffix: `/ ${analytics.totalProducts}`,
    },
    {
      title: 'Low Priced',
      value: analytics.lowPricedProducts,
      icon: TrendingDown,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      alert: analytics.lowPricedProducts > 0,
    },
    {
      title: 'High Priced',
      value: analytics.highPricedProducts,
      icon: TrendingUp,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      alert: analytics.highPricedProducts > 0,
    },
    {
      title: 'Avg. Margin',
      value: `${analytics.averageMargin.toFixed(1)}%`,
      icon: Percent,
      color: analytics.averageMargin >= 20 ? 'text-success' : 'text-warning',
      bgColor: analytics.averageMargin >= 20 ? 'bg-success/10' : 'bg-warning/10',
    },
    {
      title: 'Potential Loss',
      value: `$${analytics.potentialRevenueLoss.toFixed(0)}`,
      icon: DollarSign,
      color: analytics.potentialRevenueLoss > 0 ? 'text-destructive' : 'text-muted-foreground',
      bgColor: analytics.potentialRevenueLoss > 0 ? 'bg-destructive/10' : 'bg-muted',
    },
    ...(priceAdvantage && priceAdvantage.productsWithCompetitorData > 0 ? [
      {
        title: 'Competitor Coverage',
        value: priceAdvantage.productsWithCompetitorData,
        icon: Zap,
        color: 'text-warning',
        bgColor: 'bg-warning/10',
        suffix: `/ ${analytics.totalProducts}`,
      },
      {
        title: 'Price Advantage',
        value: `${Math.abs(priceAdvantage.averageAdvantagePercent).toFixed(1)}%`,
        icon: Award,
        color: priceAdvantage.averageAdvantagePercent < 0 ? 'text-success' : 'text-destructive',
        bgColor: priceAdvantage.averageAdvantagePercent < 0 ? 'bg-success/10' : 'bg-destructive/10',
        description: priceAdvantage.averageAdvantagePercent < 0 ? 'Better than competitors' : 'Higher than competitors',
      },
    ] : []),
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {cards.map((card, index) => (
        <Card
          key={card.title}
          className="shadow-card hover:shadow-card-hover transition-shadow duration-200 animate-slide-up"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {card.title}
                </p>
                <div className="flex items-baseline space-x-1">
                  <p className="text-2xl font-bold">{card.value}</p>
                  {card.suffix && (
                    <span className="text-sm text-muted-foreground">{card.suffix}</span>
                  )}
                </div>
                {card.description && (
                  <p className="text-xs text-muted-foreground mt-2">{card.description}</p>
                )}
              </div>
              <div className={`p-2 rounded-lg ${card.bgColor} flex-shrink-0`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
