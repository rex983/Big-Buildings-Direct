import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
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
import { formatCurrency, formatDate, truncate } from "@/lib/utils";

interface SearchParams {
  page?: string;
  search?: string;
}

async function getCustomers(searchParams: SearchParams) {
  const page = parseInt(searchParams.page || "1", 10);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const searchFilter = searchParams.search
    ? {
        OR: [
          { firstName: { contains: searchParams.search } },
          { lastName: { contains: searchParams.search } },
          { email: { contains: searchParams.search } },
        ],
      }
    : {};

  const where = {
    role: { name: "Customer" },
    ...searchFilter,
  };

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        customerOrders: {
          select: {
            id: true,
            status: true,
            totalPrice: true,
            createdAt: true,
            sentToManufacturer: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    customers,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const params = await searchParams;
  const { customers, total, page, totalPages } = await getCustomers(params);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground">
            All customers ({total} total)
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Customers</CardTitle>
            <form className="flex items-center gap-2">
              <input
                type="text"
                name="search"
                placeholder="Search customers..."
                defaultValue={params.search}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-64"
              />
              <button
                type="submit"
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium"
              >
                Search
              </button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No customers found
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Last Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => {
                    const orderCount = customer.customerOrders.length;
                    const activeOrders = customer.customerOrders.filter(
                      (o) => o.status === "ACTIVE" && !o.sentToManufacturer
                    ).length;
                    const completedOrders = customer.customerOrders.filter(
                      (o) => o.status === "COMPLETED" || o.sentToManufacturer
                    ).length;
                    const totalValue = customer.customerOrders.reduce(
                      (sum, o) => sum + Number(o.totalPrice),
                      0
                    );
                    const lastOrder = customer.customerOrders[0];

                    return (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <Link
                            href={`/customers/${customer.id}`}
                            className="font-mono text-xs text-primary hover:underline"
                          >
                            {truncate(customer.id, 12)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/customers/${customer.id}`}
                            className="font-medium hover:underline"
                          >
                            {customer.firstName} {customer.lastName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{customer.email}</p>
                          {customer.phone && (
                            <p className="text-sm text-muted-foreground">
                              {customer.phone}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{orderCount} total</span>
                            {activeOrders > 0 && (
                              <Badge variant="info">
                                {activeOrders} active
                              </Badge>
                            )}
                            {completedOrders > 0 && (
                              <Badge variant="success">
                                {completedOrders} completed
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatCurrency(totalValue)}
                        </TableCell>
                        <TableCell>
                          {lastOrder
                            ? formatDate(lastOrder.createdAt)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 20 + 1} to{" "}
                    {Math.min(page * 20, total)} of {total} customers
                  </p>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <Link
                        href={`/customers?page=${page - 1}&search=${params.search || ""}`}
                      >
                        <button className="h-9 px-4 rounded-md border text-sm font-medium">
                          Previous
                        </button>
                      </Link>
                    )}
                    {page < totalPages && (
                      <Link
                        href={`/customers?page=${page + 1}&search=${params.search || ""}`}
                      >
                        <button className="h-9 px-4 rounded-md border text-sm font-medium">
                          Next
                        </button>
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
