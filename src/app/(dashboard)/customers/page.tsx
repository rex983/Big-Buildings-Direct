import { auth } from "@/lib/auth";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCustomerList } from "@/lib/order-process";

interface SearchParams {
  page?: string;
  search?: string;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session) return null;

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);

  const { customers, total, totalPages } = await getCustomerList({
    search: params.search,
    page,
    pageSize: 20,
  });

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
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Sent to MFR</TableHead>
                    <TableHead>Last Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.email}>
                      <TableCell>
                        <Link
                          href={`/customers/${encodeURIComponent(customer.email)}`}
                          className="font-medium hover:underline"
                        >
                          {customer.name}
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
                      <TableCell>{customer.orderCount}</TableCell>
                      <TableCell>
                        {formatCurrency(customer.totalValue)}
                      </TableCell>
                      <TableCell>{customer.sentToMfr}</TableCell>
                      <TableCell>
                        {formatDate(customer.lastOrderDate)}
                      </TableCell>
                    </TableRow>
                  ))}
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
