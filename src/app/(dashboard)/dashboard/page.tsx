import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { AnalyticsCharts } from "@/components/features/dashboard/analytics-charts";
import { StatusCheckbox } from "@/components/features/orders/status-checkbox";
import { YearSelector } from "@/components/features/dashboard/year-selector";
import {
  getOrderStats,
  getMonthlyBreakdown,
  getOrdersNotSentToManufacturer,
  getAvailableYears,
  getOfficeSalesPersons,
} from "@/lib/order-process";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const currentCalendarYear = new Date().getFullYear();
  const selectedYear = yearParam ? parseInt(yearParam, 10) : currentCalendarYear;
  const year = isNaN(selectedYear) ? currentCalendarYear : selectedYear;

  const session = await auth();
  const user = session!.user;
  const isAdminUser = user.roleName === "Admin";
  const canViewAll = user.permissions.includes("orders.view_all");
  const isManager = user.roleName === "Manager";
  // Statuses are managed by Order Processing — read-only in BBD
  const canEdit = false;
  const isTeamView = isAdminUser || canViewAll;
  const orderProcessingUrl = process.env.NEXT_PUBLIC_ORDER_PROCESSING_URL || "https://big-buildings-direct-mj5l.vercel.app";

  // Determine filter scope:
  // - Admin: sees all orders (no filter)
  // - Manager: sees orders from their office's sales reps
  // - Sales Rep: sees only their own orders
  let salesPerson: string | undefined;
  let salesPersons: string[] | undefined;

  if (isAdminUser) {
    // Admin sees everything
  } else if (isManager && user.office) {
    // Manager sees their office's orders
    salesPersons = await getOfficeSalesPersons(user.office);
  } else if (isTeamView) {
    // Other roles with view_all (e.g. BST, R&D) see everything
  } else {
    // Individual rep sees only their own
    salesPerson = `${user.firstName} ${user.lastName}`;
  }

  const [stats, monthlyData, recentOrders, availableYears] = await Promise.all([
    getOrderStats({ year, salesPerson, salesPersons }),
    getMonthlyBreakdown({ year, salesPerson, salesPersons }),
    getOrdersNotSentToManufacturer({ year, salesPerson, salesPersons }),
    getAvailableYears(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user.firstName}!
            {isManager && user.office ? ` Showing ${user.office} office.` : !isTeamView ? " Here's your personal performance overview." : ""}
          </p>
        </div>
        <YearSelector currentYear={year} availableYears={availableYears} />
      </div>

      {/* Monthly Sales Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {isTeamView ? "Team" : "Your"} Monthly Sales ({year})
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
                  {month.month}
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isTeamView ? "Total Orders" : "Your Total Orders"}</CardTitle>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">{year} {isTeamView ? "team orders" : "your orders"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isTeamView ? "Sent to Manufacturer" : "Your Sent to Mfr"}</CardTitle>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sentToManufacturer}</div>
            <p className="text-xs text-muted-foreground">{year} {isTeamView ? "successfully sent" : "your sent orders"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isTeamView ? "Deposits Collected" : "Your Deposits"}</CardTitle>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalDepositsCollected)}</div>
            <p className="text-xs text-muted-foreground">{year} {isTeamView ? "total deposits" : "your collected deposits"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <AnalyticsCharts
        title={isTeamView ? "New Sales (Team)" : "Your New Sales"}
        apiEndpoint="/api/dashboard/analytics"
        year={year}
      />
      <AnalyticsCharts
        title={isTeamView ? "Revisions (Team)" : "Your Revisions"}
        apiEndpoint="/api/dashboard/revisions-analytics"
        year={year}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {orderProcessingUrl ? (
                <a
                  href={`${orderProcessingUrl}?email=${encodeURIComponent(user.email)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  {isTeamView ? "Team Orders" : "Your Orders"} — Not Yet Sent to Manufacturer
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : (
                <>{isTeamView ? "Team Orders" : "Your Orders"} — Not Yet Sent to Manufacturer</>
              )}
            </CardTitle>
            <span className="text-sm text-muted-foreground">{year}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recentOrders.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No pending orders in {year}</p>
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
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <Link href={`/orders/${order.id}`} className="text-sm font-medium text-primary hover:underline">
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="p-3 text-sm">{order.customerName}</td>
                      {isTeamView && (
                        <td className="p-3 text-sm text-muted-foreground">
                          {order.salesPerson || "—"}
                        </td>
                      )}
                      <td className="p-3 text-sm text-right font-medium">{formatCurrency(order.totalPrice)}</td>
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
