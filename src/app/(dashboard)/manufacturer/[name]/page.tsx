import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailStatCards } from "@/components/features/dashboard/detail-stat-cards";
import { DetailOrdersTable } from "@/components/features/dashboard/detail-orders-table";
import {
  getDetailStats,
  getDetailOrders,
  buildOrderWhere,
} from "@/lib/queries/detail-pages";

export default async function ManufacturerDetailPage({
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

  const orderWhere = buildOrderWhere("manufacturer", decodedName);

  const [stats, orders, manufacturer] = await Promise.all([
    getDetailStats(orderWhere),
    getDetailOrders(orderWhere),
    prisma.manufacturer.findFirst({ where: { name: decodedName } }),
  ]);

  if (orders.length === 0) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            ← Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">
          Manufacturer: {decodedName}
        </h1>
        {manufacturer && (
          <Badge variant={manufacturer.isActive ? "success" : "destructive"}>
            {manufacturer.isActive ? "Active" : "Inactive"}
          </Badge>
        )}
      </div>

      <DetailStatCards stats={stats} />

      <div>
        <h2 className="text-lg font-semibold mb-4">
          Orders ({orders.length})
        </h2>
        <DetailOrdersTable
          orders={orders}
          showSalesRep
          showState
        />
      </div>
    </div>
  );
}
