import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { DetailPageStats } from "@/lib/queries/detail-pages";

export function DetailStatCards({ stats }: { stats: DetailPageStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Total Sales</p>
          <p className="text-2xl font-bold mt-1">
            {stats.totalSales.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Orders (excl. cancelled)
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Total Order Amount</p>
          <p className="text-2xl font-bold mt-1">
            {formatCurrency(stats.totalOrderAmount)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Total Deposits</p>
          <p className="text-2xl font-bold mt-1">
            {formatCurrency(stats.totalDeposits)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Collected deposits
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
