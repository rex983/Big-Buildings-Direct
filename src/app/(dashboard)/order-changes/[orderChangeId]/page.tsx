import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/utils";

async function getOrderChange(orderChangeId: string) {
  return prisma.orderChange.findUnique({
    where: { id: orderChangeId },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          buildingType: true,
          buildingSize: true,
          totalPrice: true,
          depositAmount: true,
        },
      },
      salesRep: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
}

async function getSalesReps() {
  return prisma.user.findMany({
    where: {
      isActive: true,
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });
}

async function updateOrderChange(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const allowedRoles = ["Admin", "Manager", "BST"];
  if (!allowedRoles.includes(session.user.roleName)) {
    throw new Error("Unauthorized - insufficient permissions");
  }

  const orderChangeId = formData.get("orderChangeId") as string;
  const additionalNotes = (formData.get("additionalNotes") as string)?.trim() || null;
  const salesRepId = (formData.get("salesRepId") as string) || null;
  const changeType = (formData.get("changeType") as string) || null;
  const depositCharged = (formData.get("depositCharged") as string)?.trim() || null;
  const manufacturer = (formData.get("manufacturer") as string)?.trim() || null;
  const orderFormName = (formData.get("orderFormName") as string)?.trim() || null;
  const customerEmail = (formData.get("customerEmail") as string)?.trim() || null;
  const uploadsUrl = (formData.get("uploadsUrl") as string)?.trim() || null;
  const rexProcess = (formData.get("rexProcess") as string)?.trim() || null;
  const sabrinaProcess = formData.get("sabrinaProcess") === "on";
  const updatedInNewSale = formData.get("updatedInNewSale") === "on";

  // Parse decimal values
  const parseDecimal = (value: string | null): number | null => {
    if (!value) return null;
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const oldOrderTotal = parseDecimal(formData.get("oldOrderTotal") as string);
  const newOrderTotal = parseDecimal(formData.get("newOrderTotal") as string);
  const oldDepositTotal = parseDecimal(formData.get("oldDepositTotal") as string);
  const newDepositTotal = parseDecimal(formData.get("newDepositTotal") as string);
  const orderTotalDiff = parseDecimal(formData.get("orderTotalDiff") as string);
  const depositDiff = parseDecimal(formData.get("depositDiff") as string);

  // Verify order change exists
  const orderChange = await prisma.orderChange.findUnique({
    where: { id: orderChangeId },
    include: { order: true },
  });

  if (!orderChange) {
    throw new Error("Order change not found");
  }

  await prisma.orderChange.update({
    where: { id: orderChangeId },
    data: {
      additionalNotes,
      salesRepId: salesRepId || null,
      changeType,
      depositCharged,
      manufacturer,
      orderFormName,
      customerEmail,
      uploadsUrl,
      rexProcess,
      sabrinaProcess,
      updatedInNewSale,
      oldOrderTotal,
      newOrderTotal,
      oldDepositTotal,
      newDepositTotal,
      orderTotalDiff,
      depositDiff,
    },
  });

  revalidatePath(`/order-changes/${orderChangeId}`);
  revalidatePath(`/order-changes`);
  revalidatePath(`/orders/${orderChange.orderId}`);
}

function ChangeTypeBadge({ type }: { type: string | null }) {
  if (!type) return <Badge variant="outline">Unknown</Badge>;

  const colors: Record<string, string> = {
    "Building Update": "bg-blue-100 text-blue-800",
    "Information Update": "bg-purple-100 text-purple-800",
    "Changing Manufacturer": "bg-orange-100 text-orange-800",
    "Other": "bg-gray-100 text-gray-800",
  };

  return (
    <Badge className={colors[type] || colors["Other"]} variant="outline">
      {type.includes("Building") ? "Building Update" :
       type.includes("Information") ? "Info Update" :
       type.includes("Manufacturer") ? "Mfr Change" : "Other"}
    </Badge>
  );
}

export default async function OrderChangeDetailPage({
  params,
}: {
  params: Promise<{ orderChangeId: string }>;
}) {
  const session = await auth();
  const user = session!.user;

  const allowedRoles = ["Admin", "Manager", "BST", "Customer"];
  if (!allowedRoles.includes(user.roleName)) {
    redirect("/dashboard");
  }

  const { orderChangeId } = await params;
  const [orderChange, salesReps] = await Promise.all([
    getOrderChange(orderChangeId),
    getSalesReps(),
  ]);

  if (!orderChange) {
    notFound();
  }

  const canEdit = ["Admin", "Manager", "BST"].includes(user.roleName);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/order-changes">
            <Button variant="ghost" size="sm">
              &larr; Back to Order Changes
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Order Change</h1>
              <ChangeTypeBadge type={orderChange.changeType} />
              {orderChange.rexProcess === "Complete" && (
                <Badge variant="success">Complete</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Order{" "}
              <Link
                href={`/orders/${orderChange.order.id}`}
                className="text-primary hover:underline"
              >
                {orderChange.order.orderNumber}
              </Link>{" "}
              - {orderChange.orderFormName || orderChange.order.customerName}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {orderChange.uploadsUrl && (
            <a
              href={orderChange.uploadsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline">
                <svg
                  className="h-4 w-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                View Files
              </Button>
            </a>
          )}
          <Link href={`/orders/${orderChange.order.id}`}>
            <Button variant="outline">View Order</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block">Change Date</span>
                <span className="font-medium">{formatDate(orderChange.changeDate)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Manufacturer</span>
                <span className="font-medium">{orderChange.manufacturer || "N/A"}</span>
              </div>
              {orderChange.oldOrderTotal && (
                <div>
                  <span className="text-muted-foreground block">Old Order Total</span>
                  <span>{formatCurrency(orderChange.oldOrderTotal.toString())}</span>
                </div>
              )}
              {orderChange.newOrderTotal && (
                <div>
                  <span className="text-muted-foreground block">New Order Total</span>
                  <span>{formatCurrency(orderChange.newOrderTotal.toString())}</span>
                </div>
              )}
              {orderChange.oldDepositTotal && (
                <div>
                  <span className="text-muted-foreground block">Old Deposit</span>
                  <span>{formatCurrency(orderChange.oldDepositTotal.toString())}</span>
                </div>
              )}
              {orderChange.newDepositTotal && (
                <div>
                  <span className="text-muted-foreground block">New Deposit</span>
                  <span>{formatCurrency(orderChange.newDepositTotal.toString())}</span>
                </div>
              )}
              {orderChange.orderTotalDiff && (
                <div>
                  <span className="text-muted-foreground block">Order Total Diff</span>
                  <span
                    className={
                      Number(orderChange.orderTotalDiff) >= 0
                        ? "text-green-600 font-medium"
                        : "text-red-600 font-medium"
                    }
                  >
                    {Number(orderChange.orderTotalDiff) >= 0 ? "+" : ""}
                    {formatCurrency(orderChange.orderTotalDiff.toString())}
                  </span>
                </div>
              )}
              {orderChange.depositDiff && (
                <div>
                  <span className="text-muted-foreground block">Deposit Diff</span>
                  <span
                    className={
                      Number(orderChange.depositDiff) >= 0
                        ? "text-green-600 font-medium"
                        : "text-red-600 font-medium"
                    }
                  >
                    {Number(orderChange.depositDiff) >= 0 ? "+" : ""}
                    {formatCurrency(orderChange.depositDiff.toString())}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Workflow Status */}
        <Card>
          <CardHeader>
            <CardTitle>Workflow Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                {orderChange.sabrinaProcess ? (
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                )}
                <span>Sabrina Process</span>
              </div>
              <div className="flex items-center gap-2">
                {orderChange.updatedInNewSale ? (
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                )}
                <span>Updated in New Sale</span>
              </div>
              <div className="flex items-center gap-2">
                {orderChange.rexProcess === "Complete" ? (
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                )}
                <span>Rex Process: {orderChange.rexProcess || "Pending"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-sm">Deposit Charged</span>
                <Badge
                  variant={
                    orderChange.depositCharged?.toLowerCase().includes("accepted")
                      ? "default"
                      : orderChange.depositCharged?.toLowerCase().includes("refund")
                      ? "secondary"
                      : "outline"
                  }
                >
                  {orderChange.depositCharged || "pending"}
                </Badge>
              </div>
            </div>
            {orderChange.additionalNotes && (
              <div className="pt-4 border-t">
                <span className="text-muted-foreground block text-sm mb-1">Additional Notes</span>
                <p className="whitespace-pre-wrap">{orderChange.additionalNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Editable Form */}
      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit Order Change Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateOrderChange} className="space-y-6">
              <input type="hidden" name="orderChangeId" value={orderChange.id} />

              {/* Workflow Status */}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sabrinaProcess"
                    name="sabrinaProcess"
                    defaultChecked={orderChange.sabrinaProcess}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="sabrinaProcess">Sabrina Process</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="updatedInNewSale"
                    name="updatedInNewSale"
                    defaultChecked={orderChange.updatedInNewSale}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="updatedInNewSale">Updated in New Sale</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rexProcess">Rex Process</Label>
                  <select
                    id="rexProcess"
                    name="rexProcess"
                    defaultValue={orderChange.rexProcess || ""}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Pending</option>
                    <option value="Complete">Complete</option>
                    <option value="In Progress">In Progress</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depositCharged">Deposit Charged</Label>
                  <select
                    id="depositCharged"
                    name="depositCharged"
                    defaultValue={orderChange.depositCharged || ""}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">-- Select --</option>
                    <option value="no charge needed">No charge needed</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Accepted-S">Accepted-S</option>
                    <option value="Refunded">Refunded</option>
                    <option value="Refunded-S">Refunded-S</option>
                    <option value="Ready">Ready</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="changeType">Change Type</Label>
                  <select
                    id="changeType"
                    name="changeType"
                    defaultValue={orderChange.changeType || ""}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">-- Select --</option>
                    <option value="Building Update - color update, size change, windows remove etc.">Building Update</option>
                    <option value="Information Update - change of address, order name update, etc">Information Update</option>
                    <option value="Changing Manufacturer">Changing Manufacturer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salesRepId">Sales Rep</Label>
                  <select
                    id="salesRepId"
                    name="salesRepId"
                    defaultValue={orderChange.salesRepId || ""}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">-- Select Sales Rep --</option>
                    {salesReps.map((rep) => (
                      <option key={rep.id} value={rep.id}>
                        {rep.firstName} {rep.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input
                    id="manufacturer"
                    name="manufacturer"
                    defaultValue={orderChange.manufacturer || ""}
                  />
                </div>
              </div>

              {/* Customer Info */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="orderFormName">Order Form Name</Label>
                  <Input
                    id="orderFormName"
                    name="orderFormName"
                    defaultValue={orderChange.orderFormName || ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Customer Email</Label>
                  <Input
                    id="customerEmail"
                    name="customerEmail"
                    type="email"
                    defaultValue={orderChange.customerEmail || ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uploadsUrl">Uploads URL</Label>
                  <Input
                    id="uploadsUrl"
                    name="uploadsUrl"
                    type="url"
                    defaultValue={orderChange.uploadsUrl || ""}
                    placeholder="https://drive.google.com/..."
                  />
                </div>
              </div>

              {/* Financial */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="oldOrderTotal">Old Order Total</Label>
                  <Input
                    id="oldOrderTotal"
                    name="oldOrderTotal"
                    defaultValue={orderChange.oldOrderTotal?.toString() || ""}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newOrderTotal">New Order Total</Label>
                  <Input
                    id="newOrderTotal"
                    name="newOrderTotal"
                    defaultValue={orderChange.newOrderTotal?.toString() || ""}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orderTotalDiff">Order Total Diff</Label>
                  <Input
                    id="orderTotalDiff"
                    name="orderTotalDiff"
                    defaultValue={orderChange.orderTotalDiff?.toString() || ""}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="oldDepositTotal">Old Deposit Total</Label>
                  <Input
                    id="oldDepositTotal"
                    name="oldDepositTotal"
                    defaultValue={orderChange.oldDepositTotal?.toString() || ""}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newDepositTotal">New Deposit Total</Label>
                  <Input
                    id="newDepositTotal"
                    name="newDepositTotal"
                    defaultValue={orderChange.newDepositTotal?.toString() || ""}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depositDiff">Deposit Diff</Label>
                  <Input
                    id="depositDiff"
                    name="depositDiff"
                    defaultValue={orderChange.depositDiff?.toString() || ""}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="additionalNotes">Additional Notes</Label>
                <textarea
                  id="additionalNotes"
                  name="additionalNotes"
                  rows={4}
                  defaultValue={orderChange.additionalNotes || ""}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <Button type="submit">Save Changes</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        /* Read-only view for Customers */
        <Card>
          <CardHeader>
            <CardTitle>Order Change Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <span className="text-muted-foreground block text-sm">Sales Rep</span>
                <p>
                  {orderChange.salesRep
                    ? `${orderChange.salesRep.firstName} ${orderChange.salesRep.lastName}`
                    : "N/A"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground block text-sm">Manufacturer</span>
                <p>{orderChange.manufacturer || "N/A"}</p>
              </div>
            </div>

            {orderChange.additionalNotes && (
              <div>
                <span className="text-muted-foreground block text-sm">Additional Notes</span>
                <p className="whitespace-pre-wrap">{orderChange.additionalNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
