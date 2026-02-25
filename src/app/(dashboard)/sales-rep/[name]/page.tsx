import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailStatCards } from "@/components/features/dashboard/detail-stat-cards";
import { DetailOrdersTable } from "@/components/features/dashboard/detail-orders-table";
import {
  getSalesRepByName,
  getDetailStats,
  getDetailOrders,
  buildOrderWhere,
  buildRevisionWhere,
} from "@/lib/queries/detail-pages";

export default async function SalesRepDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const session = await auth();
  const user = session!.user;
  const isAdmin = user.roleName === "Admin";
  const isManager = user.roleName === "Manager";

  if (!isAdmin && !isManager) {
    redirect("/dashboard");
  }

  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  const rep = await getSalesRepByName(decodedName);
  if (!rep) {
    notFound();
  }

  const orderWhere = buildOrderWhere("salesRep", decodedName, rep.id);
  const revisionWhere = buildRevisionWhere("salesRep", decodedName, rep.id);

  const [stats, orders] = await Promise.all([
    getDetailStats(orderWhere, revisionWhere),
    getDetailOrders(orderWhere),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            ← Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Sales Rep: {decodedName}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rep Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{rep.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Office</p>
              <p className="font-medium">{rep.office || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Department</p>
              <p className="font-medium">{rep.department || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Role</p>
              <p className="font-medium">
                {rep.role.name}
                {rep.isActive ? (
                  <Badge variant="success" className="ml-2">Active</Badge>
                ) : (
                  <Badge variant="destructive" className="ml-2">Inactive</Badge>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <DetailStatCards stats={stats} />

      <div>
        <h2 className="text-lg font-semibold mb-4">
          Orders ({orders.length})
        </h2>
        <DetailOrdersTable
          orders={orders}
          showManufacturer
          showState
        />
      </div>
    </div>
  );
}
