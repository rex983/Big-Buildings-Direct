import { auth } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrders, getOfficeSalesPersons, getOrderFilterOptions } from "@/lib/order-process";
import { OrdersToolbar } from "@/components/features/orders/orders-toolbar";
import { OrdersTable } from "@/components/features/orders/orders-table";

interface SearchParams {
  page?: string;
  search?: string;
  status?: string;
  payment?: string;
  sort?: string;
  state?: string;
  installer?: string;
  rep?: string;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const user = session!.user;
  const isAdminUser = user.roleName === "Admin";
  const isManager = user.roleName === "Manager";
  const canViewAll = user.permissions.includes("orders.view_all");

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);

  // Determine filter scope
  let salesPerson: string | undefined;
  let salesPersons: string[] | undefined;

  if (isAdminUser) {
    // Admin sees everything
  } else if (isManager && user.office) {
    salesPersons = await getOfficeSalesPersons(user.office);
  } else if (canViewAll) {
    // BST, R&D see everything
  } else {
    salesPerson = `${user.firstName} ${user.lastName}`;
  }

  // Parse sort param
  const [sortBy, sortDir] = (params.sort || "created_at:desc").split(":");

  const [result, filterOptions] = await Promise.all([
    getOrders({
      page,
      pageSize: 20,
      search: params.search,
      salesPerson,
      salesPersons,
      status: params.status as import("@/types/order-process").OPOrderStatus | undefined,
      paymentStatus: params.payment,
      state: params.state,
      installer: params.installer,
      salesRepFilter: params.rep,
      sortBy,
      sortDir: sortDir as "asc" | "desc",
    }),
    getOrderFilterOptions(),
  ]);

  const { orders, total, totalPages } = result;
  const showSalesRepFilter = isAdminUser || isManager || canViewAll;

  // Statuses are managed by Order Processing — read-only in BBD
  const canEditStatus = false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-muted-foreground">
            Manage and track building orders
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle>All Orders ({total})</CardTitle>
              <form className="flex items-center gap-2">
                <input
                  type="text"
                  name="search"
                  placeholder="Search orders..."
                  defaultValue={params.search}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
                <Button type="submit" size="sm">
                  Search
                </Button>
              </form>
            </div>
            <OrdersToolbar
              states={filterOptions.states}
              installers={filterOptions.installers}
              salesReps={filterOptions.salesReps}
              showSalesRepFilter={showSalesRepFilter}
            />
          </div>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No orders found
            </p>
          ) : (
            <>
              <OrdersTable orders={orders} canEditStatus={canEditStatus} />

              {totalPages > 1 && (() => {
                const pageSize = 20;
                const buildPageUrl = (p: number) => {
                  const qp = new URLSearchParams();
                  if (p > 1) qp.set("page", String(p));
                  if (params.search) qp.set("search", params.search);
                  if (params.status) qp.set("status", params.status);
                  if (params.payment) qp.set("payment", params.payment);
                  if (params.sort && params.sort !== "created_at:desc") qp.set("sort", params.sort);
                  if (params.state) qp.set("state", params.state);
                  if (params.installer) qp.set("installer", params.installer);
                  if (params.rep) qp.set("rep", params.rep);
                  const qs = qp.toString();
                  return `/orders${qs ? `?${qs}` : ""}`;
                };

                return (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} orders
                    </p>
                    <div className="flex gap-2">
                      {page > 1 && (
                        <Link href={buildPageUrl(page - 1)}>
                          <Button variant="outline" size="sm">Previous</Button>
                        </Link>
                      )}
                      {page < totalPages && (
                        <Link href={buildPageUrl(page + 1)}>
                          <Button variant="outline" size="sm">Next</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
