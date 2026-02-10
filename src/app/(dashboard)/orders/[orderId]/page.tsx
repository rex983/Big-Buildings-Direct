import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderStageAdvance } from "@/components/features/orders/order-stage-advance";
import { OrderTimeline } from "@/components/features/orders/order-timeline";
import { OrderFiles } from "@/components/features/orders/order-files";
import { OrderMessages } from "@/components/features/orders/order-messages";
import { OrderActivity } from "@/components/features/orders/order-activity";
import { StatusSelect } from "@/components/features/orders/status-select";

// WC Status options for the dropdown
const wcStatusOptions = [
  { value: "Pending", label: "Pending", color: "gray" },
  { value: "No Contact Made", label: "No Contact Made", color: "orange" },
  { value: "Contact Made", label: "Contact Made", color: "green" },
];

// LP&P Status options for the dropdown
const lppStatusOptions = [
  { value: "Pending", label: "Pending", color: "gray" },
  { value: "Ready for Install", label: "Ready for Install", color: "green" },
];

async function getOrder(orderId: string, userId: string, isAdmin: boolean, canViewAll: boolean) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      currentStage: true,
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      salesRep: { select: { id: true, firstName: true, lastName: true } },
      stageHistory: {
        include: { stage: true },
        orderBy: { createdAt: "asc" },
      },
      files: {
        include: { file: true },
        orderBy: { createdAt: "desc" },
      },
      documents: {
        include: { file: true, createdBy: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
      },
      messages: {
        include: { sender: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      activities: {
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      revisions: {
        include: { salesRep: { select: { firstName: true, lastName: true } } },
        orderBy: { revisionDate: "desc" },
      },
    },
  });

  if (!order) return null;

  // Check access
  if (!isAdmin && !canViewAll && order.salesRepId !== userId) {
    return null;
  }

  return order;
}

async function getStages() {
  return prisma.orderStage.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { orderId } = await params;
  const { tab } = await searchParams;
  const defaultTab = tab || "files";
  const session = await auth();
  const user = session!.user;
  const isAdmin = user.roleName === "Admin";
  const canViewAll = user.permissions.includes("orders.view_all");
  const canAdvance = isAdmin || user.permissions.includes("orders.advance_stage");
  const canViewInternal = isAdmin || user.permissions.includes("messages.view_internal");
  const canEditBstStatus = isAdmin || user.roleName === "Manager" || user.roleName === "BST";

  const [order, stages] = await Promise.all([
    getOrder(orderId, user.id, isAdmin, canViewAll),
    getStages(),
  ]);

  if (!order) {
    notFound();
  }

  const statusColors: Record<string, string> = {
    ACTIVE: "info",
    COMPLETED: "success",
    CANCELLED: "destructive",
    ON_HOLD: "warning",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{order.orderNumber}</h1>
            <Badge variant={statusColors[order.status] as "default"}>
              {order.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Created {formatDateTime(order.createdAt)}
          </p>
        </div>
      </div>

      {/* Stage Progress */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Order Progress</CardTitle>
          {canAdvance && order.status === "ACTIVE" && (
            <OrderStageAdvance
              orderId={order.id}
              currentStageId={order.currentStageId}
              stages={stages}
            />
          )}
        </CardHeader>
        <CardContent>
          <OrderTimeline
            stages={stages}
            currentStageId={order.currentStageId}
            stageHistory={order.stageHistory}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              {order.customer ? (
                <Link
                  href={`/customers/${order.customer.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {order.customerName}
                </Link>
              ) : (
                <p className="font-medium">{order.customerName}</p>
              )}
              <p className="text-sm text-muted-foreground">{order.customerEmail}</p>
              {order.customerPhone && (
                <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
              )}
              {order.customer && (
                <>
                  <p className="text-xs text-muted-foreground mt-2">
                    Customer ID: {order.customer.id.slice(0, 12)}...
                  </p>
                  <Link
                    href={`/customers/${order.customer.id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    View Full Journey
                  </Link>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Building Details */}
        <Card>
          <CardHeader>
            <CardTitle>Building</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Type:</span>
              <span>{order.buildingType}</span>
              <span className="text-muted-foreground">Size:</span>
              <span>{order.buildingSize}</span>
              {order.buildingColor && (
                <>
                  <span className="text-muted-foreground">Color:</span>
                  <span>{order.buildingColor}</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Financial */}
        <Card>
          <CardHeader>
            <CardTitle>Financials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Total Price:</span>
              <span className="font-medium">{formatCurrency(order.totalPrice.toString())}</span>
              <span className="text-muted-foreground">Deposit:</span>
              <span>{formatCurrency(order.depositAmount.toString())}</span>
              <span className="text-muted-foreground">Deposit Status:</span>
              <span>
                {order.depositCollected ? (
                  <Badge variant="success">Collected</Badge>
                ) : (
                  <Badge variant="warning">Pending</Badge>
                )}
              </span>
              {order.depositDate && (
                <>
                  <span className="text-muted-foreground">Deposit Date:</span>
                  <span>{formatDate(order.depositDate)}</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery Address */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Address</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{order.deliveryAddress}</p>
          <p>
            {order.deliveryCity}, {order.deliveryState} {order.deliveryZip}
          </p>
          {order.deliveryNotes && (
            <p className="mt-2 text-sm text-muted-foreground">
              Notes: {order.deliveryNotes}
            </p>
          )}
        </CardContent>
      </Card>

      {/* BST Status - only show when order has been sent to manufacturer */}
      {order.sentToManufacturer && (
        <Card>
          <CardHeader>
            <CardTitle>BST Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Welcome Call Status
                </label>
                <StatusSelect
                  orderId={order.id}
                  field="wcStatus"
                  value={order.wcStatus}
                  options={wcStatusOptions}
                  canEdit={canEditBstStatus}
                  label="Welcome Call Status"
                />
                {order.wcStatusDate && (
                  <p className="text-xs text-muted-foreground">
                    Updated: {formatDate(order.wcStatusDate)}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Land, Pad & Permit Status
                </label>
                <StatusSelect
                  orderId={order.id}
                  field="lppStatus"
                  value={order.lppStatus}
                  options={lppStatusOptions}
                  canEdit={canEditBstStatus}
                  label="LP&P Status"
                />
                {order.lppStatusDate && (
                  <p className="text-xs text-muted-foreground">
                    Updated: {formatDate(order.lppStatusDate)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Files, Messages, Activity, Revisions */}
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="files">Files ({order.files.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({order.documents.length})</TabsTrigger>
          <TabsTrigger value="messages">Messages ({order.messages.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({order.activities.length})</TabsTrigger>
          <TabsTrigger value="revisions">Revisions ({order.revisions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          <OrderFiles orderId={order.id} files={order.files} />
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {order.documents.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No documents yet</p>
              ) : (
                <div className="space-y-3">
                  {order.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{doc.title}</p>
                        <p className="text-sm text-muted-foreground">
                          Created by {doc.createdBy.firstName} {doc.createdBy.lastName}
                        </p>
                      </div>
                      <Badge variant={
                        doc.status === "SIGNED" ? "success" :
                        doc.status === "SENT" ? "info" :
                        doc.status === "VIEWED" ? "warning" : "secondary"
                      }>
                        {doc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages">
          <OrderMessages
            orderId={order.id}
            messages={order.messages}
            canViewInternal={canViewInternal}
          />
        </TabsContent>

        <TabsContent value="activity">
          <OrderActivity activities={order.activities} />
        </TabsContent>

        <TabsContent value="revisions">
          <Card>
            <CardHeader>
              <CardTitle>Order Revisions</CardTitle>
            </CardHeader>
            <CardContent>
              {order.revisions.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No revisions for this order</p>
              ) : (
                <div className="space-y-4">
                  {order.revisions.map((revision) => (
                    <div key={revision.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{revision.revisionNumber}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(revision.revisionDate)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {revision.changingManufacturer && (
                            <Badge variant="warning">Mfr Change</Badge>
                          )}
                          {revision.changeInPrice === "Change In Deposit Total" ? (
                            <Badge variant="info">Price Change</Badge>
                          ) : (
                            <Badge variant="secondary">Update</Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {revision.oldOrderTotal && (
                          <div>
                            <span className="text-muted-foreground block">Old Total</span>
                            <span>{formatCurrency(revision.oldOrderTotal.toString())}</span>
                          </div>
                        )}
                        {revision.newOrderTotal && (
                          <div>
                            <span className="text-muted-foreground block">New Total</span>
                            <span>{formatCurrency(revision.newOrderTotal.toString())}</span>
                          </div>
                        )}
                        {revision.depositDiff && (
                          <div>
                            <span className="text-muted-foreground block">Deposit Change</span>
                            <span className={Number(revision.depositDiff) >= 0 ? "text-green-600" : "text-red-600"}>
                              {Number(revision.depositDiff) >= 0 ? "+" : ""}
                              {formatCurrency(revision.depositDiff.toString())}
                            </span>
                          </div>
                        )}
                        {revision.revisionFee && (
                          <div>
                            <span className="text-muted-foreground block">Rev Fee</span>
                            <span>{formatCurrency(revision.revisionFee.toString())}</span>
                          </div>
                        )}
                      </div>

                      {revision.changingManufacturer && (
                        <div className="text-sm bg-muted/50 p-2 rounded">
                          <span className="text-muted-foreground">Manufacturer: </span>
                          {revision.originalManufacturer && (
                            <span>{revision.originalManufacturer} → </span>
                          )}
                          <span className="font-medium">{revision.newManufacturer || "New Manufacturer"}</span>
                        </div>
                      )}

                      {revision.revisionNotes && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Notes: </span>
                          <span>{revision.revisionNotes}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm pt-2 border-t">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            {revision.sentToCustomer ? (
                              <Badge variant="success" className="text-xs">Sent to Customer</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Not Sent</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {revision.customerSigned ? (
                              <Badge variant="success" className="text-xs">Signed</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Unsigned</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {revision.sentToManufacturer ? (
                              <Badge variant="success" className="text-xs">Sent to Mfr</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Not Sent to Mfr</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {revision.salesRep && (
                            <span className="text-muted-foreground">
                              Rep: {revision.salesRep.firstName} {revision.salesRep.lastName}
                            </span>
                          )}
                          <Link href={`/revisions/${revision.id}`}>
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
