import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { TestModeBanner } from "@/components/layout/test-mode-banner";
import { RealtimeOrdersRefresh } from "@/components/features/orders/realtime-orders-refresh";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Redirect customers to portal
  if (session.user.roleName === "Customer") {
    redirect("/portal");
  }

  return (
    <>
      <RealtimeOrdersRefresh />
      <TestModeBanner />
      <ImpersonationBanner />
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto bg-muted/30 p-6">{children}</main>
        </div>
      </div>
    </>
  );
}
