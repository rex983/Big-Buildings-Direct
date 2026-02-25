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
import { OrderChangeImportButton } from "@/components/features/order-changes/import-button";

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

function ChangeTypeBadge({ type }: { type: string | null }) {
  if (!type) return <Badge variant="outline">Unknown</Badge>;

  const colors: Record<string, string> = {
    "Building Update": "bg-blue-100 text-blue-800",
    "Information Update": "bg-purple-100 text-purple-800",
    "Changing Manufacturer": "bg-orange-100 text-orange-800",
    "Other": "bg-gray-100 text-gray-800",
  };

  // Extract short label
  let label = type;
  if (type.includes("Building Update")) label = "Building";
  else if (type.includes("Information Update")) label = "Info";
  else if (type.includes("Changing Manufacturer")) label = "Manufacturer";
  else if (type === "Other") label = "Other";

  return (
    <Badge className={colors[type] || colors["Other"]} variant="outline">
      {label}
    </Badge>
  );
}

interface SearchParams {
  page?: string;
  search?: string;
  changeType?: string;
}

async function getOrderChanges(searchParams: SearchParams) {
  const page = parseInt(searchParams.page || "1", 10);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const searchFilter = searchParams.search
    ? {
        OR: [
          { order: { orderNumber: { contains: searchParams.search } } },
          { order: { customerName: { contains: searchParams.search } } },
          { additionalNotes: { contains: searchParams.search } },
          { orderFormName: { contains: searchParams.search } },
        ],
      }
    : {};

  const changeTypeFilter = searchParams.changeType
    ? { changeType: { contains: searchParams.changeType } }
    : {};

  const where = { ...searchFilter, ...changeTypeFilter };

  const [orderChanges, total] = await Promise.all([
    prisma.orderChange.findMany({
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
      orderBy: { changeDate: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.orderChange.count({ where }),
  ]);

  return {
    orderChanges,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

async function getStats() {
  const [total, buildingUpdates, infoUpdates, manufacturerChanges] = await Promise.all([
    prisma.orderChange.count(),
    prisma.orderChange.count({
      where: { changeType: { contains: "Building Update" } },
    }),
    prisma.orderChange.count({
      where: { changeType: { contains: "Information Update" } },
    }),
    prisma.orderChange.count({
      where: { changeType: { contains: "Changing Manufacturer" } },
    }),
  ]);

  return { total, buildingUpdates, infoUpdates, manufacturerChanges };
}

export default async function OrderChangesPage({
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
  const [{ orderChanges, total, page, totalPages }, stats] = await Promise.all([
    getOrderChanges(params),
    getStats(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order Changes</h1>
          <p className="text-muted-foreground">
            Track all changes made to orders after initial sale
          </p>
        </div>
        <OrderChangeImportButton />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Building Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{stats.buildingUpdates}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Info Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">{stats.infoUpdates}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Manufacturer Changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{stats.manufacturerChanges}</p>
          </CardContent>
        </Card>
      </div>

      {/* Order Changes Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Order Changes</CardTitle>
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
                <option value="Building Update">Building Update</option>
                <option value="Information Update">Information Update</option>
                <option value="Changing Manufacturer">Manufacturer Change</option>
                <option value="Other">Other</option>
              </select>
              <Button type="submit" size="sm">
                Filter
              </Button>
              {(params.search || params.changeType) && (
                <Link href="/orders/order-changes">
                  <Button variant="ghost" size="sm">
                    Clear
                  </Button>
                </Link>
              )}
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {orderChanges.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No order changes found
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Sales Rep</TableHead>
                    <TableHead className="text-center">Sabrina</TableHead>
                    <TableHead className="text-center">Rex</TableHead>
                    <TableHead>Deposit Change</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderChanges.map((change) => (
                    <TableRow key={change.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/orders/${change.order.id}`}
                          className="hover:underline text-primary"
                        >
                          {change.order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{change.orderFormName || change.order.customerName}</p>
                          <p className="text-sm text-muted-foreground">
                            {change.customerEmail || change.order.customerEmail}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <ChangeTypeBadge type={change.changeType} />
                      </TableCell>
                      <TableCell>{formatDate(change.changeDate)}</TableCell>
                      <TableCell>
                        {change.salesRep
                          ? `${change.salesRep.firstName} ${change.salesRep.lastName}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusIndicator
                          completed={change.sabrinaProcess}
                          label="Sabrina Process"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusIndicator
                          completed={change.rexProcess === "Complete"}
                          label="Rex Process"
                        />
                      </TableCell>
                      <TableCell>
                        {change.depositDiff ? (
                          <span
                            className={
                              Number(change.depositDiff) >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {Number(change.depositDiff) >= 0 ? "+" : ""}
                            {formatCurrency(change.depositDiff.toString())}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            change.depositCharged?.toLowerCase().includes("accepted")
                              ? "default"
                              : change.depositCharged?.toLowerCase().includes("refund")
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {change.depositCharged || "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Link href={`/orders/order-changes/${change.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                          {change.uploadsUrl && (
                            <a
                              href={change.uploadsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="ghost" size="sm">
                                Files
                              </Button>
                            </a>
                          )}
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
                    {total} order changes
                  </p>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <Link
                        href={`/orders/order-changes?page=${page - 1}&search=${params.search || ""}&changeType=${params.changeType || ""}`}
                      >
                        <Button variant="outline" size="sm">
                          Previous
                        </Button>
                      </Link>
                    )}
                    {page < totalPages && (
                      <Link
                        href={`/orders/order-changes?page=${page + 1}&search=${params.search || ""}&changeType=${params.changeType || ""}`}
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
