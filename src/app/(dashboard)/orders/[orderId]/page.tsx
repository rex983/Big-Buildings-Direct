import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderFiles } from "@/components/features/orders/order-files";
import { OrderMessages } from "@/components/features/orders/order-messages";
import { OrderActivity } from "@/components/features/orders/order-activity";
import { StatusCheckbox } from "@/components/features/orders/status-checkbox";
import { OrderRealtimeListener } from "@/components/features/orders/order-realtime-listener";
import { getOrder } from "@/lib/order-process";
import { OP_STAGE_MAP, OP_STATUS_ORDER } from "@/types/order-process";
import { getInteractionHistory } from "@/lib/queries/interaction-history";
import { OrderInteractionHistory } from "@/components/features/orders/order-interaction-history";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { orderId } = await params;
  const { tab } = await searchParams;
  const defaultTab = tab || "details";
  const session = await auth();
  const user = session!.user;
  const isAdminUser = user.roleName === "Admin";
  const canViewAll = user.permissions.includes("orders.view_all");
  // Statuses are managed by Order Processing — read-only in BBD
  const canEditStatus = false;
  const canViewInternal = isAdminUser || user.permissions.includes("messages.view_internal");

  // Get order data from Order Process
  const order = await getOrder(orderId);

  if (!order) {
    notFound();
  }

  // Access check: non-admins can only see their orders
  const userName = `${user.firstName} ${user.lastName}`;
  if (!isAdminUser && !canViewAll && order.salesPerson !== userName) {
    notFound();
  }

  // Get interaction history from Order Process Supabase tables
  const interactionHistory = await getInteractionHistory(order);

  // Get BBD-specific data (messages, activities, files, documents) from Prisma
  // These may not exist yet if the order hasn't had any BBD interactions
  const [messages, activities, files, documents] = await Promise.all([
    prisma.message
      .findMany({
        where: { orderId },
        include: {
          sender: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
      .catch(() => []),
    prisma.orderActivity
      .findMany({
        where: { orderId },
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
      .catch(() => []),
    prisma.orderFile
      .findMany({
        where: { orderId },
        include: { file: true },
        orderBy: { createdAt: "desc" },
      })
      .catch(() => []),
    prisma.document
      .findMany({
        where: { orderId },
        include: {
          file: true,
          createdBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      .catch(() => []),
  ]);

  // Build the stage progress display from Order Process status
  const statusIndex = OP_STATUS_ORDER.indexOf(order.status);
  const stageSteps = OP_STATUS_ORDER.filter((s) => s !== "cancelled").map(
    (status, i) => ({
      name: OP_STAGE_MAP[status].name,
      color: OP_STAGE_MAP[status].color,
      completed: order.status !== "cancelled" && statusIndex >= i,
      current: order.status === status,
    })
  );

  return (
    <div className="space-y-6">
      <OrderRealtimeListener orderId={order.id} />
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{order.orderNumber}</h1>
            <Badge
              variant="outline"
              style={{
                borderColor: order.currentStage.color,
                color: order.currentStage.color,
              }}
            >
              {order.currentStage.name}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Created {formatDateTime(order.createdAt)}
          </p>
        </div>
      </div>

      {/* Stage Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Order Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {stageSteps.map((step, i) => (
              <div key={step.name} className="flex items-center gap-2 flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 ${
                    step.completed
                      ? "text-white"
                      : "text-muted-foreground border-muted"
                  }`}
                  style={
                    step.completed
                      ? { backgroundColor: step.color, borderColor: step.color }
                      : undefined
                  }
                >
                  {step.completed ? "✓" : i + 1}
                </div>
                <span
                  className={`text-xs ${
                    step.current ? "font-bold" : "text-muted-foreground"
                  }`}
                  style={step.current ? { color: step.color } : undefined}
                >
                  {step.name}
                </span>
                {i < stageSteps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 ${
                      step.completed ? "bg-green-500" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Workflow Checkboxes */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-around">
            {(
              [
                { field: "depositCollected" as const, label: "Deposit Collected", checked: order.depositCollected },
                { field: "sentToCustomer" as const, label: "Sent to Customer", checked: order.sentToCustomer },
                { field: "customerSigned" as const, label: "Customer Signed", checked: order.customerSigned },
                { field: "sentToManufacturer" as const, label: "Sent to Manufacturer", checked: order.sentToManufacturer },
              ] as const
            ).map((item) => (
              <div key={item.field} className="flex flex-col items-center gap-1">
                <StatusCheckbox
                  orderId={order.id}
                  field={item.field}
                  checked={item.checked}
                  canEdit={canEditStatus}
                  label={item.label}
                />
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
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
              <p className="font-medium">{order.customerName}</p>
              <p className="text-sm text-muted-foreground">{order.customerEmail}</p>
              {order.customerPhone && (
                <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
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
              <span className="text-muted-foreground">Manufacturer:</span>
              <span>{order.manufacturer}</span>
              <span className="text-muted-foreground">Type:</span>
              <span>{order.buildingType}</span>
              <span className="text-muted-foreground">Size:</span>
              <span>{order.buildingSize}</span>
              {order.buildingHeight && (
                <>
                  <span className="text-muted-foreground">Height:</span>
                  <span>{order.buildingHeight}</span>
                </>
              )}
              {order.foundationType && (
                <>
                  <span className="text-muted-foreground">Foundation:</span>
                  <span>{order.foundationType}</span>
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
              <span className="font-medium">{formatCurrency(order.totalPrice)}</span>
              <span className="text-muted-foreground">Deposit:</span>
              <span>{formatCurrency(order.depositAmount)}</span>
              <span className="text-muted-foreground">Deposit Status:</span>
              <span>
                {order.depositCollected ? (
                  <Badge variant="success">Collected</Badge>
                ) : (
                  <Badge variant="warning">Pending</Badge>
                )}
              </span>
              {order.ledgerSummary && (
                <>
                  <span className="text-muted-foreground">Net Received:</span>
                  <span>{formatCurrency(order.ledgerSummary.netReceived)}</span>
                  <span className="text-muted-foreground">Balance:</span>
                  <span
                    className={
                      order.ledgerSummary.balanceStatus === "paid"
                        ? "text-green-600"
                        : order.ledgerSummary.balanceStatus === "overpaid"
                          ? "text-blue-600"
                          : "text-amber-600"
                    }
                  >
                    {formatCurrency(order.ledgerSummary.balance)} ({order.ledgerSummary.balanceStatus})
                  </span>
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
            {order.deliveryState} {order.deliveryZip}
          </p>
        </CardContent>
      </Card>

      {/* Notes */}
      {(order.specialNotes || order.paymentNotes) && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.specialNotes && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Special Notes: </span>
                <span className="text-sm">{order.specialNotes}</span>
              </div>
            )}
            {order.paymentNotes && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Payment Notes: </span>
                <span className="text-sm">{order.paymentNotes}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Interaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Interaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderInteractionHistory items={interactionHistory} />
        </CardContent>
      </Card>

      {/* Tabs for BBD-specific features */}
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="details">Order Files</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="messages">Messages ({messages.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          {/* Show Order Process files from JSONB */}
          <Card>
            <CardHeader>
              <CardTitle>Order Files</CardTitle>
            </CardHeader>
            <CardContent>
              {(!order.files.orderFormPdf &&
                order.files.renderings.length === 0 &&
                order.files.extraFiles.length === 0 &&
                order.files.installerFiles.length === 0) ? (
                <p className="text-muted-foreground text-center py-4">No files attached</p>
              ) : (
                <div className="space-y-3">
                  {order.files.orderFormPdf && (
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{order.files.orderFormPdf.name}</p>
                        <p className="text-xs text-muted-foreground">Order Form PDF</p>
                      </div>
                      <a
                        href={order.files.orderFormPdf.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Download
                      </a>
                    </div>
                  )}
                  {order.files.renderings.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">Rendering</p>
                      </div>
                      <a
                        href={file.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                  {order.files.extraFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">Extra File</p>
                      </div>
                      <a
                        href={file.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                  {order.files.installerFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">Installer File</p>
                      </div>
                      <a
                        href={file.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Also show BBD-uploaded files */}
          {files.length > 0 && (
            <OrderFiles orderId={order.id} files={files} />
          )}
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No documents yet</p>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{doc.title}</p>
                        <p className="text-sm text-muted-foreground">
                          Created by {doc.createdBy.firstName} {doc.createdBy.lastName}
                        </p>
                      </div>
                      <Badge
                        variant={
                          doc.status === "SIGNED"
                            ? "success"
                            : doc.status === "SENT"
                              ? "info"
                              : doc.status === "VIEWED"
                                ? "warning"
                                : "secondary"
                        }
                      >
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
            messages={messages}
            canViewInternal={canViewInternal}
          />
        </TabsContent>

        <TabsContent value="activity">
          <OrderActivity activities={activities} />
        </TabsContent>

      </Tabs>
    </div>
  );
}
