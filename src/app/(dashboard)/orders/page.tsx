import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

interface SearchParams {
  page?: string;
  status?: string;
  search?: string;
}

async function getOrders(
  userId: string,
  roleName: string,
  isAdmin: boolean,
  canViewAll: boolean,
  searchParams: SearchParams
) {
  const page = parseInt(searchParams.page || "1", 10);
  const pageSize = 10;
  const skip = (page - 1) * pageSize;
  const isSalesRep = roleName === "Sales Rep";

  const baseWhere = isAdmin || canViewAll ? {} : { salesRepId: userId };

  // For sales reps, treat "sent to manufacturer" as completed
  // They should only see orders that haven't been sent to manufacturer yet (their active work)
  let statusFilter = {};
  if (searchParams.status) {
    if (isSalesRep && searchParams.status === "COMPLETED") {
      // Sales reps viewing "completed" = sent to manufacturer
      statusFilter = { sentToManufacturer: true };
    } else if (isSalesRep && searchParams.status === "ACTIVE") {
      // Sales reps viewing "active" = not yet sent to manufacturer
      statusFilter = { status: "ACTIVE", sentToManufacturer: false };
    } else {
      statusFilter = { status: searchParams.status };
    }
  }

  const searchFilter = searchParams.search
    ? {
        OR: [
          { orderNumber: { contains: searchParams.search } },
          { customerName: { contains: searchParams.search } },
          { customerEmail: { contains: searchParams.search } },
        ],
      }
    : {};

  const where = { ...baseWhere, ...statusFilter, ...searchFilter };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        currentStage: true,
        salesRep: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  // For sales reps, mark orders sent to manufacturer as "completed" in display
  const processedOrders = orders.map(order => ({
    ...order,
    displayStatus: isSalesRep && order.sentToManufacturer ? "COMPLETED" : order.status,
  }));

  return {
    orders: processedOrders,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    isSalesRep,
  };
}

function getStatusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return <Badge variant="info">Active</Badge>;
    case "COMPLETED":
      return <Badge variant="success">Completed</Badge>;
    case "CANCELLED":
      return <Badge variant="destructive">Cancelled</Badge>;
    case "ON_HOLD":
      return <Badge variant="warning">On Hold</Badge>;
    default:
      return null;
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "URGENT":
      return <Badge variant="destructive">Urgent</Badge>;
    case "HIGH":
      return <Badge variant="warning">High</Badge>;
    case "NORMAL":
      return null;
    case "LOW":
      return <Badge variant="secondary">Low</Badge>;
    default:
      return null;
  }
}

function StatusIndicator({ completed, label }: { completed: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5" title={label}>
      {completed ? (
        <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="h-5 w-5 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      )}
    </div>
  );
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const user = session!.user;
  const isAdmin = user.roleName === "Admin";
  const canViewAll = user.permissions.includes("orders.view_all");
  const canCreate = isAdmin || user.permissions.includes("orders.create");

  const params = await searchParams;
  const { orders, total, page, totalPages, isSalesRep } = await getOrders(
    user.id,
    user.roleName,
    isAdmin,
    canViewAll,
    params
  );

  // Determine if user can edit status checkboxes
  const canEditStatus =
    isAdmin ||
    user.roleName === "Manager" ||
    user.roleName === "BST" ||
    user.permissions.includes("orders.edit");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-muted-foreground">
            Manage and track building orders
          </p>
        </div>
        {canCreate && (
          <Link href="/orders/new">
            <Button>New Order</Button>
          </Link>
        )}
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
              <select
                name="status"
                defaultValue={params.status}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
              <Button type="submit" size="sm">
                Filter
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
                    <TableHead className="text-center">Deposit</TableHead>
                    <TableHead className="text-center">Sent to Customer</TableHead>
                    <TableHead className="text-center">Signed</TableHead>
                    <TableHead className="text-center">Sent to Mfr</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.orderNumber}
                        {getPriorityBadge(order.priority) && (
                          <span className="ml-2">
                            {getPriorityBadge(order.priority)}
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
                      <TableCell className="text-center">
                        <StatusCheckbox
                          orderId={order.id}
                          field="depositCollected"
                          checked={order.depositCollected}
                          canEdit={canEditStatus}
                          label="Deposit Collected"
                        />
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
                      <TableCell>{formatCurrency(order.totalPrice.toString())}</TableCell>
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
                      <Link href={`/orders?page=${page - 1}&status=${params.status || ""}&search=${params.search || ""}`}>
                        <Button variant="outline" size="sm">Previous</Button>
                      </Link>
                    )}
                    {page < totalPages && (
                      <Link href={`/orders?page=${page + 1}&status=${params.status || ""}&search=${params.search || ""}`}>
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
