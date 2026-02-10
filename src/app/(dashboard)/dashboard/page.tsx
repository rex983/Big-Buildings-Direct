import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { AnalyticsCharts } from "@/components/features/dashboard/analytics-charts";
import { StatusCheckbox } from "@/components/features/orders/status-checkbox";

interface MonthlyData {
  month: string;
  year: number;
  monthNum: number;
  quantity: number;
  totalSales: number;
}

async function getStats(userId: string, isAdmin: boolean, canViewAll: boolean) {
  const whereClause = isAdmin || canViewAll ? {} : { salesRepId: userId };

  const [
    totalOrders,
    activeOrders,
    sentToManufacturer,
    totalRevenue,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count({ where: whereClause }),
    prisma.order.count({ where: { ...whereClause, status: "ACTIVE" } }),
    // Count buildings successfully sent to manufacturer
    prisma.order.count({ where: { ...whereClause, sentToManufacturer: true } }),
    prisma.order.aggregate({
      where: { ...whereClause, depositCollected: true },
      _sum: { depositAmount: true },
    }),
    // Orders sold within the last 45 days
    (() => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 45);
      return prisma.order.findMany({
        where: {
          ...whereClause,
          dateSold: { gte: cutoff },
          sentToManufacturer: false,
        },
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          totalPrice: true,
          dateSold: true,
          depositCollected: true,
          sentToCustomer: true,
          customerSigned: true,
          sentToManufacturer: true,
          currentStage: { select: { name: true, color: true } },
          salesRep: { select: { firstName: true, lastName: true } },
        },
        orderBy: { dateSold: "desc" },
      });
    })(),
  ]);

  return {
    totalOrders,
    activeOrders,
    sentToManufacturer,
    totalRevenue: totalRevenue._sum.depositAmount?.toNumber() || 0,
    recentOrders,
  };
}

async function getMonthlyBreakdown(userId: string, isAdmin: boolean, canViewAll: boolean): Promise<MonthlyData[]> {
  const whereClause = isAdmin || canViewAll ? {} : { salesRepId: userId };

  // Get orders from the last 12 months with dateSold
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: {
      ...whereClause,
      dateSold: { gte: twelveMonthsAgo },
    },
    select: {
      dateSold: true,
      totalPrice: true,
    },
  });

  // Aggregate by month
  const monthlyMap = new Map<string, { quantity: number; totalSales: number; year: number; monthNum: number }>();

  // Initialize all 12 months
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    monthlyMap.set(key, {
      quantity: 0,
      totalSales: 0,
      year: date.getFullYear(),
      monthNum: date.getMonth(),
    });
  }

  // Aggregate orders
  orders.forEach((order) => {
    if (order.dateSold) {
      const date = new Date(order.dateSold);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const existing = monthlyMap.get(key);
      if (existing) {
        existing.quantity += 1;
        existing.totalSales += order.totalPrice.toNumber();
      }
    }
  });

  // Convert to array and sort by date
  return Array.from(monthlyMap.entries())
    .map(([, data]) => ({
      month: monthNames[data.monthNum],
      year: data.year,
      monthNum: data.monthNum,
      quantity: data.quantity,
      totalSales: data.totalSales,
    }))
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthNum - b.monthNum;
    });
}

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user;
  const isAdmin = user.roleName === "Admin";
  const canViewAll = user.permissions.includes("orders.view_all");
  const isManager = user.roleName === "Manager";
  const canEdit = isAdmin || isManager || user.permissions.includes("orders.edit");
  const isTeamView = isAdmin || canViewAll;

  const [stats, monthlyData] = await Promise.all([
    getStats(user.id, isAdmin, canViewAll),
    getMonthlyBreakdown(user.id, isAdmin, canViewAll),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user.firstName}!
          {!isTeamView && " Here's your personal performance overview."}
        </p>
      </div>

      {/* Monthly Sales Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {isTeamView ? "Team" : "Your"} Monthly Sales (Last 12 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {monthlyData.map((month, index) => (
              <div
                key={index}
                className="flex-shrink-0 min-w-[100px] rounded-lg border bg-card p-3 text-center"
              >
                <p className="text-xs text-muted-foreground font-medium">
                  {month.month} {month.year !== new Date().getFullYear() ? `'${String(month.year).slice(-2)}` : ""}
                </p>
                <p className="text-lg font-bold">{month.quantity}</p>
                <p className="text-xs text-muted-foreground">buildings</p>
                <p className="text-sm font-semibold text-primary mt-1">
                  {formatCurrency(month.totalSales)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isTeamView ? "Total Orders" : "Your Total Orders"}</CardTitle>
            <svg
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">{isTeamView ? "All team orders" : "Your orders"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isTeamView ? "Active Orders" : "Your Active Orders"}</CardTitle>
            <svg
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeOrders}</div>
            <p className="text-xs text-muted-foreground">{isTeamView ? "Currently in progress" : "In progress"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isTeamView ? "Sent to Manufacturer" : "Your Sent to Mfr"}</CardTitle>
            <svg
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sentToManufacturer}</div>
            <p className="text-xs text-muted-foreground">{isTeamView ? "Successfully sent" : "Your sent orders"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isTeamView ? "Deposits Collected" : "Your Deposits"}</CardTitle>
            <svg
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">{isTeamView ? "Total deposits" : "Your collected deposits"}</p>
          </CardContent>
        </Card>
      </div>

      {/* New Sales Performance Analytics */}
      <AnalyticsCharts
        title={isTeamView ? "New Sales (Team)" : "Your New Sales"}
        apiEndpoint="/api/dashboard/analytics"
      />

      {/* Revisions Performance Analytics */}
      <AnalyticsCharts
        title={isTeamView ? "Revisions (Team)" : "Your Revisions"}
        apiEndpoint="/api/dashboard/revisions-analytics"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{isTeamView ? "Recent Team Orders" : "Your Recent Orders"}</CardTitle>
            <span className="text-sm text-muted-foreground">Last 45 days</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {stats.recentOrders.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No orders in the last 45 days</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Order</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Customer</th>
                    {isTeamView && (
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Rep</th>
                    )}
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground">Total</th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground">Deposit</th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground">Sent to Cust.</th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground">Signed</th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground">Sent to Mfr.</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Date Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentOrders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <Link href={`/orders/${order.id}`} className="text-sm font-medium text-primary hover:underline">
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="p-3 text-sm">{order.customerName}</td>
                      {isTeamView && (
                        <td className="p-3 text-sm text-muted-foreground">
                          {order.salesRep ? `${order.salesRep.firstName} ${order.salesRep.lastName}` : "—"}
                        </td>
                      )}
                      <td className="p-3 text-sm text-right font-medium">{formatCurrency(order.totalPrice.toString())}</td>
                      <td className="p-3 text-center">
                        <StatusCheckbox
                          orderId={order.id}
                          field="depositCollected"
                          checked={order.depositCollected}
                          canEdit={canEdit}
                          label="Deposit Collected"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <StatusCheckbox
                          orderId={order.id}
                          field="sentToCustomer"
                          checked={order.sentToCustomer}
                          canEdit={canEdit}
                          label="Sent to Customer"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <StatusCheckbox
                          orderId={order.id}
                          field="customerSigned"
                          checked={order.customerSigned}
                          canEdit={canEdit}
                          label="Customer Signed"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <StatusCheckbox
                          orderId={order.id}
                          field="sentToManufacturer"
                          checked={order.sentToManufacturer}
                          canEdit={canEdit}
                          label="Sent to Manufacturer"
                        />
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {order.dateSold
                          ? new Date(order.dateSold).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
