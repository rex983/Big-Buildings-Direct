import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { DetailStatCards } from "@/components/features/dashboard/detail-stat-cards";
import { DetailOrdersTable } from "@/components/features/dashboard/detail-orders-table";
import {
  getDetailStats,
  getDetailOrders,
  buildOrderWhere,
  buildRevisionWhere,
} from "@/lib/queries/detail-pages";

export default async function StateDetailPage({
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

  const orderWhere = buildOrderWhere("state", decodedName);
  const revisionWhere = buildRevisionWhere("state", decodedName);

  const [stats, orders] = await Promise.all([
    getDetailStats(orderWhere, revisionWhere),
    getDetailOrders(orderWhere),
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
        <h1 className="text-2xl font-bold">State: {decodedName}</h1>
      </div>

      <DetailStatCards stats={stats} />

      <div>
        <h2 className="text-lg font-semibold mb-4">
          Orders ({orders.length})
        </h2>
        <DetailOrdersTable
          orders={orders}
          showSalesRep
          showManufacturer
        />
      </div>
    </div>
  );
}
