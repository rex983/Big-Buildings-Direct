import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

async function getCustomerData(customerId: string) {
  const [orders, pendingDocuments, unreadMessages] = await Promise.all([
    prisma.order.findMany({
      where: { customerId },
      include: { currentStage: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.document.count({
      where: {
        order: { customerId },
        status: { in: ["SENT", "VIEWED"] },
      },
    }),
    prisma.message.count({
      where: {
        order: { customerId },
        isInternal: false,
        isRead: false,
      },
    }),
  ]);

  return { orders, pendingDocuments, unreadMessages };
}

export default async function PortalPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.roleName !== "Customer") {
    redirect("/dashboard");
  }

  const { orders, pendingDocuments, unreadMessages } = await getCustomerData(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome, {session.user.firstName}!</h1>
        <p className="text-muted-foreground">
          Track your orders and manage your account
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter((o) => o.status === "ACTIVE").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Documents to Sign</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingDocuments}</div>
            {pendingDocuments > 0 && (
              <p className="text-xs text-destructive mt-1">Action required</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unread Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreadMessages}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your Orders</CardTitle>
            <Link
              href="/my-orders"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              You don&apos;t have any orders yet.
            </p>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/my-orders/${order.id}`}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.buildingType} - {order.buildingSize}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ordered {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(order.totalPrice.toString())}</p>
                    {order.currentStage && (
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: order.currentStage.color,
                          color: order.currentStage.color,
                        }}
                      >
                        {order.currentStage.name}
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
