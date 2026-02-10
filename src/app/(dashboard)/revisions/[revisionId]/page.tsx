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
import { FileAttachments } from "@/components/features/files";

async function getRevision(revisionId: string) {
  return prisma.revision.findUnique({
    where: { id: revisionId },
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
        select: { id: true, firstName: true, lastName: true },
      },
      files: {
        include: {
          file: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

async function getSalesReps() {
  return prisma.user.findMany({
    where: {
      role: { name: "Sales Rep" },
      isActive: true,
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });
}

async function updateRevision(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const allowedRoles = ["Admin", "Manager", "BST"];
  if (!allowedRoles.includes(session.user.roleName)) {
    throw new Error("Unauthorized - insufficient permissions");
  }

  const revisionId = formData.get("revisionId") as string;
  const revisionNotes = (formData.get("revisionNotes") as string)?.trim() || null;
  const repNotes = (formData.get("repNotes") as string)?.trim() || null;
  const salesRepId = (formData.get("salesRepId") as string) || null;
  const sentToCustomer = formData.get("sentToCustomer") === "on";
  const customerSigned = formData.get("customerSigned") === "on";
  const sentToManufacturer = formData.get("sentToManufacturer") === "on";
  const changingManufacturer = formData.get("changingManufacturer") === "on";
  const originalManufacturer = (formData.get("originalManufacturer") as string)?.trim() || null;
  const newManufacturer = (formData.get("newManufacturer") as string)?.trim() || null;
  const newManufacturerEmail = (formData.get("newManufacturerEmail") as string)?.trim() || null;
  const depositCharge = (formData.get("depositCharge") as string)?.trim() || null;

  // Parse decimal values
  const parseDecimal = (value: string | null): number | null => {
    if (!value) return null;
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const revisionFee = parseDecimal(formData.get("revisionFee") as string);
  const totalCharge = parseDecimal(formData.get("totalCharge") as string);

  // Verify revision exists
  const revision = await prisma.revision.findUnique({
    where: { id: revisionId },
    include: { order: true },
  });

  if (!revision) {
    throw new Error("Revision not found");
  }

  await prisma.revision.update({
    where: { id: revisionId },
    data: {
      revisionNotes,
      repNotes,
      salesRepId: salesRepId || null,
      sentToCustomer,
      customerSigned,
      sentToManufacturer,
      changingManufacturer,
      originalManufacturer,
      newManufacturer,
      newManufacturerEmail,
      depositCharge,
      revisionFee,
      totalCharge,
      lastEditedSTC: sentToCustomer ? new Date() : revision.lastEditedSTC,
      lastEditedSigned: customerSigned ? new Date() : revision.lastEditedSigned,
      lastEditedSTM: sentToManufacturer ? new Date() : revision.lastEditedSTM,
    },
  });

  revalidatePath(`/revisions/${revisionId}`);
  revalidatePath(`/revisions`);
  revalidatePath(`/orders/${revision.orderId}`);
}

export default async function RevisionDetailPage({
  params,
}: {
  params: Promise<{ revisionId: string }>;
}) {
  const session = await auth();
  const user = session!.user;

  const allowedRoles = ["Admin", "Manager", "BST", "Customer"];
  if (!allowedRoles.includes(user.roleName)) {
    redirect("/dashboard");
  }

  const { revisionId } = await params;
  const [revision, salesReps] = await Promise.all([
    getRevision(revisionId),
    getSalesReps(),
  ]);

  if (!revision) {
    notFound();
  }

  const canEdit = ["Admin", "Manager", "BST"].includes(user.roleName);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/revisions">
            <Button variant="ghost" size="sm">
              &larr; Back to Revisions
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{revision.revisionNumber}</h1>
              {revision.changingManufacturer && (
                <Badge variant="warning">Manufacturer Change</Badge>
              )}
              {revision.changeInPrice === "Change In Deposit Total" && (
                <Badge variant="info">Price Change</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Order{" "}
              <Link
                href={`/orders/${revision.order.id}`}
                className="text-primary hover:underline"
              >
                {revision.order.orderNumber}
              </Link>{" "}
              - {revision.order.customerName}
            </p>
          </div>
        </div>
        <Link href={`/orders/${revision.order.id}?tab=revisions`}>
          <Button variant="outline">View Order</Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Read-Only Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block">Revision Date</span>
                <span className="font-medium">{formatDate(revision.revisionDate)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Change Type</span>
                <span className="font-medium">{revision.changeInPrice || "N/A"}</span>
              </div>
              {revision.oldOrderTotal && (
                <div>
                  <span className="text-muted-foreground block">Old Order Total</span>
                  <span>{formatCurrency(revision.oldOrderTotal.toString())}</span>
                </div>
              )}
              {revision.newOrderTotal && (
                <div>
                  <span className="text-muted-foreground block">New Order Total</span>
                  <span>{formatCurrency(revision.newOrderTotal.toString())}</span>
                </div>
              )}
              {revision.oldDepositTotal && (
                <div>
                  <span className="text-muted-foreground block">Old Deposit</span>
                  <span>{formatCurrency(revision.oldDepositTotal.toString())}</span>
                </div>
              )}
              {revision.newDepositTotal && (
                <div>
                  <span className="text-muted-foreground block">New Deposit</span>
                  <span>{formatCurrency(revision.newDepositTotal.toString())}</span>
                </div>
              )}
              {revision.orderTotalDiff && (
                <div>
                  <span className="text-muted-foreground block">Order Total Diff</span>
                  <span
                    className={
                      Number(revision.orderTotalDiff) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {Number(revision.orderTotalDiff) >= 0 ? "+" : ""}
                    {formatCurrency(revision.orderTotalDiff.toString())}
                  </span>
                </div>
              )}
              {revision.depositDiff && (
                <div>
                  <span className="text-muted-foreground block">Deposit Diff</span>
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
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* External Links */}
        <Card>
          <CardHeader>
            <CardTitle>Forms & Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {revision.formsSubmittedUrl ? (
              <div>
                <span className="text-muted-foreground block text-sm">Forms Submitted</span>
                <a
                  href={revision.formsSubmittedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {revision.formsSubmittedUrl}
                </a>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No forms link</p>
            )}
            {revision.sabrinaFormsUrl && (
              <div>
                <span className="text-muted-foreground block text-sm">Sabrina Forms</span>
                <a
                  href={revision.sabrinaFormsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {revision.sabrinaFormsUrl}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Files */}
      <FileAttachments
        entityType="revision"
        entityId={revision.id}
        files={revision.files}
        canUpload={canEdit}
        canDelete={canEdit}
      />

      {/* Editable Form */}
      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit Revision Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateRevision} className="space-y-6">
              <input type="hidden" name="revisionId" value={revision.id} />

              {/* Workflow Status */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sentToCustomer"
                    name="sentToCustomer"
                    defaultChecked={revision.sentToCustomer}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="sentToCustomer">Sent to Customer</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="customerSigned"
                    name="customerSigned"
                    defaultChecked={revision.customerSigned}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="customerSigned">Customer Signed</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sentToManufacturer"
                    name="sentToManufacturer"
                    defaultChecked={revision.sentToManufacturer}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="sentToManufacturer">Sent to Manufacturer</Label>
                </div>
              </div>

              {/* Sales Rep */}
              <div className="space-y-2">
                <Label htmlFor="salesRepId">Sales Rep</Label>
                <select
                  id="salesRepId"
                  name="salesRepId"
                  defaultValue={revision.salesRepId || ""}
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

              {/* Manufacturer Change */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="changingManufacturer"
                    name="changingManufacturer"
                    defaultChecked={revision.changingManufacturer}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="changingManufacturer">Changing Manufacturer</Label>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="originalManufacturer">Original Manufacturer</Label>
                    <Input
                      id="originalManufacturer"
                      name="originalManufacturer"
                      defaultValue={revision.originalManufacturer || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newManufacturer">New Manufacturer</Label>
                    <Input
                      id="newManufacturer"
                      name="newManufacturer"
                      defaultValue={revision.newManufacturer || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newManufacturerEmail">New Manufacturer Email</Label>
                    <Input
                      id="newManufacturerEmail"
                      name="newManufacturerEmail"
                      type="email"
                      defaultValue={revision.newManufacturerEmail || ""}
                    />
                  </div>
                </div>
              </div>

              {/* Fees */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="revisionFee">Revision Fee</Label>
                  <Input
                    id="revisionFee"
                    name="revisionFee"
                    defaultValue={revision.revisionFee?.toString() || ""}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalCharge">Total Charge</Label>
                  <Input
                    id="totalCharge"
                    name="totalCharge"
                    defaultValue={revision.totalCharge?.toString() || ""}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depositCharge">Deposit Charge Status</Label>
                  <Input
                    id="depositCharge"
                    name="depositCharge"
                    defaultValue={revision.depositCharge || ""}
                    placeholder="e.g., Accepted"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="revisionNotes">Revision Notes</Label>
                  <textarea
                    id="revisionNotes"
                    name="revisionNotes"
                    rows={4}
                    defaultValue={revision.revisionNotes || ""}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repNotes">Rep Notes</Label>
                  <textarea
                    id="repNotes"
                    name="repNotes"
                    rows={4}
                    defaultValue={revision.repNotes || ""}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <Button type="submit">Save Changes</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        /* Read-only view for Customers */
        <Card>
          <CardHeader>
            <CardTitle>Revision Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-2">
                <Badge variant={revision.sentToCustomer ? "success" : "secondary"}>
                  {revision.sentToCustomer ? "Sent to Customer" : "Not Sent"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={revision.customerSigned ? "success" : "secondary"}>
                  {revision.customerSigned ? "Signed" : "Unsigned"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={revision.sentToManufacturer ? "success" : "secondary"}>
                  {revision.sentToManufacturer ? "Sent to Mfr" : "Not Sent to Mfr"}
                </Badge>
              </div>
            </div>

            {revision.changingManufacturer && (
              <div className="p-4 border rounded-lg">
                <p className="font-medium mb-2">Manufacturer Change</p>
                <p className="text-sm">
                  {revision.originalManufacturer && (
                    <span>{revision.originalManufacturer} → </span>
                  )}
                  <span className="font-medium">{revision.newManufacturer || "New Manufacturer"}</span>
                </p>
              </div>
            )}

            {revision.revisionNotes && (
              <div>
                <p className="text-muted-foreground text-sm">Revision Notes</p>
                <p>{revision.revisionNotes}</p>
              </div>
            )}

            {revision.salesRep && (
              <div>
                <p className="text-muted-foreground text-sm">Sales Rep</p>
                <p>
                  {revision.salesRep.firstName} {revision.salesRep.lastName}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
