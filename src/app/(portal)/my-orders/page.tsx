import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

async function getCustomerOrders(customerId: string) {
  return prisma.order.findMany({
    where: { customerId },
    include: { currentStage: true },
    orderBy: { createdAt: "desc" },
  });
}

export default async function MyOrdersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.roleName !== "Customer") {
    redirect("/dashboard");
  }

  const orders = await getCustomerOrders(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Orders</h1>
        <p className="text-muted-foreground">
          View and track all your building orders
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
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
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium">{order.orderNumber}</p>
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
                    <p className="text-sm text-muted-foreground mt-1">
                      {order.buildingType} - {order.buildingSize}
                      {order.buildingColor && ` - ${order.buildingColor}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Delivery: {order.deliveryCity}, {order.deliveryState}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Ordered {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-lg">
                      {formatCurrency(order.totalPrice.toString())}
                    </p>
                    {order.currentStage && (
                      <p
                        className="text-sm mt-1"
                        style={{ color: order.currentStage.color }}
                      >
                        {order.currentStage.name}
                      </p>
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
