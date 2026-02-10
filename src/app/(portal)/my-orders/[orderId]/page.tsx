import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrderTimeline } from "@/components/features/orders/order-timeline";
import { CustomerOrderMessages } from "@/components/features/orders/customer-order-messages";

async function getOrderForCustomer(orderId: string, customerId: string) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      customerId,
    },
    include: {
      currentStage: true,
      stageHistory: {
        include: { stage: true },
        orderBy: { createdAt: "asc" },
      },
      files: {
        include: { file: true },
        orderBy: { createdAt: "desc" },
      },
      documents: {
        where: { status: { in: ["SENT", "VIEWED", "SIGNED"] } },
        include: { file: true },
        orderBy: { createdAt: "desc" },
      },
      messages: {
        where: { isInternal: false },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return order;
}

async function getStages() {
  return prisma.orderStage.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

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
  const [order, stages] = await Promise.all([
    getOrderForCustomer(orderId, session.user.id),
    getStages(),
  ]);

  if (!order) {
    notFound();
  }

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
          variant={
            order.status === "ACTIVE"
              ? "info"
              : order.status === "COMPLETED"
                ? "success"
                : order.status === "CANCELLED"
                  ? "destructive"
                  : "secondary"
          }
        >
          {order.status}
        </Badge>
      </div>

      {/* Progress Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Order Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTimeline
            stages={stages}
            currentStageId={order.currentStageId}
            stageHistory={order.stageHistory}
          />
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
              {order.buildingColor && (
                <>
                  <span className="text-muted-foreground">Color:</span>
                  <span>{order.buildingColor}</span>
                </>
              )}
              <span className="text-muted-foreground">Total Price:</span>
              <span className="font-medium">
                {formatCurrency(order.totalPrice.toString())}
              </span>
              <span className="text-muted-foreground">Deposit:</span>
              <span>
                {formatCurrency(order.depositAmount.toString())}
                {order.depositCollected ? (
                  <Badge variant="success" className="ml-2">Paid</Badge>
                ) : (
                  <Badge variant="warning" className="ml-2">Pending</Badge>
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
              {order.deliveryCity}, {order.deliveryState} {order.deliveryZip}
            </p>
            {order.deliveryNotes && (
              <p className="mt-4 text-sm text-muted-foreground">
                Notes: {order.deliveryNotes}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Documents */}
      {order.documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.documents.map((doc) => (
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

      {/* Files */}
      {order.files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {order.files.map(({ file }) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{file.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(file.createdAt)}
                    </p>
                  </div>
                  <a
                    href={`/api/files/${file.id}?download=true`}
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
      <CustomerOrderMessages orderId={order.id} messages={order.messages} />
    </div>
  );
}
