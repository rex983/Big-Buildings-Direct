import { auth } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusCheckbox } from "@/components/features/orders/status-checkbox";
import { getOrders, getOfficeSalesPersons } from "@/lib/order-process";

interface SearchParams {
  page?: string;
  search?: string;
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

  const result = await getOrders({
    page,
    pageSize: 10,
    search: params.search,
    salesPerson,
    salesPersons,
  });

  const { orders, total, totalPages } = result;

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
          <div className="flex items-center justify-between">
            <CardTitle>All Orders</CardTitle>
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
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No orders found
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Building</TableHead>
                    <TableHead className="text-right">Deposit</TableHead>
                    <TableHead className="text-center">Payment</TableHead>
                    <TableHead className="text-center">Sent to Customer</TableHead>
                    <TableHead className="text-center">Signed</TableHead>
                    <TableHead className="text-center">Sent to Mfr</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.orderNumber}
                        {order.status === "cancelled" && (
                          <span className="ml-2">
                            <Badge variant="destructive">Cancelled</Badge>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{order.customerName}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.customerEmail}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{order.buildingType}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.buildingSize}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(order.depositAmount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            order.paymentStatus === "paid" || order.paymentStatus === "manually_approved"
                              ? "success"
                              : order.paymentStatus === "pending"
                                ? "warning"
                                : "secondary"
                          }
                        >
                          {order.paymentStatus === "paid"
                            ? "Paid"
                            : order.paymentStatus === "manually_approved"
                              ? "Approved"
                              : order.paymentStatus === "pending"
                                ? "Pending"
                                : "Unpaid"}
                        </Badge>
                        {order.paymentType && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {order.paymentType === "stripe_already_paid"
                              ? "Stripe"
                              : order.paymentType === "check"
                                ? "Check"
                                : order.paymentType === "wire"
                                  ? "Wire"
                                  : order.paymentType.replace(/_/g, " ")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusCheckbox
                          orderId={order.id}
                          field="sentToCustomer"
                          checked={order.sentToCustomer}
                          canEdit={canEditStatus}
                          label="Sent to Customer"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusCheckbox
                          orderId={order.id}
                          field="customerSigned"
                          checked={order.customerSigned}
                          canEdit={canEditStatus}
                          label="Customer Signed"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusCheckbox
                          orderId={order.id}
                          field="sentToManufacturer"
                          checked={order.sentToManufacturer}
                          canEdit={canEditStatus}
                          label="Sent to Manufacturer"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(order.totalPrice)}</TableCell>
                      <TableCell>{formatDate(order.createdAt)}</TableCell>
                      <TableCell>
                        <Link href={`/orders/${order.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, total)} of {total} orders
                  </p>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <Link href={`/orders?page=${page - 1}&search=${params.search || ""}`}>
                        <Button variant="outline" size="sm">Previous</Button>
                      </Link>
                    )}
                    {page < totalPages && (
                      <Link href={`/orders?page=${page + 1}&search=${params.search || ""}`}>
                        <Button variant="outline" size="sm">Next</Button>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
