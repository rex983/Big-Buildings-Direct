import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CustomerOrderMessages } from "@/components/features/orders/customer-order-messages";
import { getOrder } from "@/lib/order-process";
import { OP_STAGE_MAP, OP_STATUS_ORDER } from "@/types/order-process";

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.roleName !== "Customer") {
    redirect("/dashboard");
  }

  const { orderId } = await params;

  // Get order from Order Process
  const order = await getOrder(orderId);

  if (!order) {
    notFound();
  }

  // Verify this order belongs to the logged-in customer (by email)
  if (
    order.customerEmail.toLowerCase() !== session.user.email.toLowerCase()
  ) {
    notFound();
  }

  // Get BBD-specific data (documents, messages) from Prisma
  const [documents, messages] = await Promise.all([
    prisma.document
      .findMany({
        where: {
          orderId,
          status: { in: ["SENT", "VIEWED", "SIGNED"] },
        },
        include: { file: true },
        orderBy: { createdAt: "desc" },
      })
      .catch(() => []),
    prisma.message
      .findMany({
        where: { orderId, isInternal: false },
        include: {
          sender: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })
      .catch(() => []),
  ]);

  // Build stage progress display
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{order.orderNumber}</h1>
          <p className="text-muted-foreground">
            {order.buildingType} - {order.buildingSize}
          </p>
        </div>
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

      {/* Progress */}
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Order Details */}
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Building Type:</span>
              <span>{order.buildingType}</span>
              <span className="text-muted-foreground">Size:</span>
              <span>{order.buildingSize}</span>
              {order.manufacturer && (
                <>
                  <span className="text-muted-foreground">Manufacturer:</span>
                  <span>{order.manufacturer}</span>
                </>
              )}
              <span className="text-muted-foreground">Total Price:</span>
              <span className="font-medium">
                {formatCurrency(order.totalPrice)}
              </span>
              <span className="text-muted-foreground">Deposit:</span>
              <span>
                {formatCurrency(order.depositAmount)}
                {order.depositCollected ? (
                  <Badge variant="success" className="ml-2">
                    Paid
                  </Badge>
                ) : (
                  <Badge variant="warning" className="ml-2">
                    Pending
                  </Badge>
                )}
              </span>
              <span className="text-muted-foreground">Order Date:</span>
              <span>{formatDate(order.createdAt)}</span>
            </div>
          </CardContent>
        </Card>

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
      </div>

      {/* Documents */}
      {documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{doc.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {doc.status === "SIGNED"
                        ? `Signed on ${formatDate(doc.signedAt!)}`
                        : "Awaiting your signature"}
                    </p>
                  </div>
                  {doc.status !== "SIGNED" && doc.signingToken && (
                    <a
                      href={`/sign/${doc.signingToken}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Sign Document
                    </a>
                  )}
                  {doc.status === "SIGNED" && (
                    <Badge variant="success">Signed</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Process Files */}
      {(order.files.orderFormPdf ||
        order.files.renderings.length > 0 ||
        order.files.extraFiles.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {order.files.orderFormPdf && (
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{order.files.orderFormPdf.name}</p>
                    <p className="text-xs text-muted-foreground">Order Form</p>
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
                <div
                  key={i}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
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
                <div
                  key={i}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages */}
      <CustomerOrderMessages orderId={order.id} messages={messages} />
    </div>
  );
}
