import { Product } from '@/types/price';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface PriceChartsProps {
  products: Product[];
}

export function PriceCharts({ products }: PriceChartsProps) {
  const statusData = [
    { name: 'Valid', value: products.filter(p => p.status === 'valid').length, color: 'hsl(142, 76%, 36%)' },
    { name: 'Low', value: products.filter(p => p.status === 'low').length, color: 'hsl(38, 92%, 50%)' },
    { name: 'High', value: products.filter(p => p.status === 'high').length, color: 'hsl(0, 84%, 60%)' },
    { name: 'Warning', value: products.filter(p => p.status === 'warning').length, color: 'hsl(262, 83%, 58%)' },
  ].filter(d => d.value > 0);

  const categoryMargins = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = { total: 0, count: 0 };
    }
    acc[product.category].total += product.profitMargin;
    acc[product.category].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  const marginData = Object.entries(categoryMargins)
    .map(([category, data]) => ({
      category: category.length > 12 ? category.substring(0, 12) + '...' : category,
      margin: Math.round(data.total / data.count),
    }))
    .slice(0, 8);

  const priceComparisonData = products
    .filter(p => p.competitorPrice)
    .slice(0, 10)
    .map(p => ({
      name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
      ourPrice: p.sellingPrice,
      competitor: p.competitorPrice,
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      <Card className="shadow-card animate-slide-up">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Pricing Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card animate-slide-up" style={{ animationDelay: '100ms' }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Avg. Margin by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marginData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Margin']}
                />
                <Bar dataKey="margin" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {priceComparisonData.length > 0 && (
        <Card className="shadow-card animate-slide-up lg:col-span-2 xl:col-span-1" style={{ animationDelay: '200ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Price vs Competitor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priceComparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                  />
                  <Legend wrapperStyle={{ paddingTop: 10 }} />
                  <Bar dataKey="ourPrice" name="Our Price" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="competitor" name="Competitor" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
