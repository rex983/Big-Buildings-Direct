import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
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

interface SearchParams {
  page?: string;
  search?: string;
  changeType?: string;
}

async function getRevisions(searchParams: SearchParams) {
  const page = parseInt(searchParams.page || "1", 10);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const searchFilter = searchParams.search
    ? {
        OR: [
          { order: { orderNumber: { contains: searchParams.search } } },
          { order: { customerName: { contains: searchParams.search } } },
          { revisionNotes: { contains: searchParams.search } },
        ],
      }
    : {};

  const changeTypeFilter = searchParams.changeType
    ? { changeInPrice: searchParams.changeType }
    : {};

  const where = { ...searchFilter, ...changeTypeFilter };

  const [revisions, total] = await Promise.all([
    prisma.revision.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerEmail: true,
          },
        },
        salesRep: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { revisionDate: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.revision.count({ where }),
  ]);

  return {
    revisions,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

async function getStats() {
  const [total, withPriceChange, withManufacturerChange] = await Promise.all([
    prisma.revision.count(),
    prisma.revision.count({
      where: { changeInPrice: "Change In Deposit Total" },
    }),
    prisma.revision.count({
      where: { changingManufacturer: true },
    }),
  ]);

  return { total, withPriceChange, withManufacturerChange };
}

export default async function RevisionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const user = session!.user;

  // Only BST, Admin, Manager, and Customer can access
  const allowedRoles = ["Admin", "Manager", "BST", "Customer"];
  if (!allowedRoles.includes(user.roleName)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const [{ revisions, total, page, totalPages }, stats] = await Promise.all([
    getRevisions(params),
    getStats(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Revisions</h1>
        <p className="text-muted-foreground">
          Order revisions and modifications after initial sale
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revisions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Price Changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{stats.withPriceChange}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Manufacturer Changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{stats.withManufacturerChange}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revisions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Revisions</CardTitle>
            <form className="flex items-center gap-2">
              <input
                type="text"
                name="search"
                placeholder="Search order #, customer, notes..."
                defaultValue={params.search}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-64"
              />
              <select
                name="changeType"
                defaultValue={params.changeType}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">All Types</option>
                <option value="Change In Deposit Total">Price Changed</option>
                <option value="No Change In Deposit Total">No Price Change</option>
              </select>
              <Button type="submit" size="sm">
                Filter
              </Button>
              {(params.search || params.changeType) && (
                <Link href="/revisions">
                  <Button variant="ghost" size="sm">
                    Clear
                  </Button>
                </Link>
              )}
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {revisions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No revisions found
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Revision</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Deposit</TableHead>
                    <TableHead className="text-center">Sent to Customer</TableHead>
                    <TableHead className="text-center">Signed</TableHead>
                    <TableHead className="text-center">Sent to Mfr</TableHead>
                    <TableHead>Price Change</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revisions.map((revision) => (
                    <TableRow key={revision.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/orders/${revision.order.id}`}
                          className="hover:underline text-primary"
                        >
                          {revision.order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{revision.order.customerName}</p>
                          <p className="text-sm text-muted-foreground">
                            {revision.order.customerEmail}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{revision.revisionNumber}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(revision.revisionDate)}</TableCell>
                      <TableCell className="text-center">
                        <StatusIndicator
                          completed={revision.depositCharge?.toLowerCase().includes("accepted") ?? false}
                          label="Deposit Collected"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusIndicator completed={revision.sentToCustomer} label="Sent to Customer" />
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusIndicator completed={revision.customerSigned} label="Customer Signed" />
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusIndicator completed={revision.sentToManufacturer} label="Sent to Manufacturer" />
                      </TableCell>
                      <TableCell>
                        {revision.depositDiff ? (
                          <span
                            className={
                              Number(revision.depositDiff) >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {Number(revision.depositDiff) >= 0 ? "+" : ""}
                            {formatCurrency(revision.depositDiff.toString())}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Link href={`/revisions/${revision.id}`}>
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                          </Link>
                          <Link href={`/orders/${revision.order.id}?tab=revisions`}>
                            <Button variant="ghost" size="sm">
                              Order
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of{" "}
                    {total} revisions
                  </p>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <Link
                        href={`/revisions?page=${page - 1}&search=${params.search || ""}&changeType=${params.changeType || ""}`}
                      >
                        <Button variant="outline" size="sm">
                          Previous
                        </Button>
                      </Link>
                    )}
                    {page < totalPages && (
                      <Link
                        href={`/revisions?page=${page + 1}&search=${params.search || ""}&changeType=${params.changeType || ""}`}
                      >
                        <Button variant="outline" size="sm">
                          Next
                        </Button>
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
