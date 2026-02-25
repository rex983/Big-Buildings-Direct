import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { RealtimeOrdersRefresh } from "@/components/features/orders/realtime-orders-refresh";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Allow unauthenticated access to signing pages
  const isSigningPage = false; // Will be determined by the page itself

  if (!session?.user && !isSigningPage) {
    redirect("/login");
  }

  return (
    <>
      <RealtimeOrdersRefresh />
      <ImpersonationBanner />
      <div className="min-h-screen bg-muted/30">
        {/* Header */}
        <header className="bg-card border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/portal" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                BB
              </div>
              <span className="font-semibold">Customer Portal</span>
            </Link>

            {session?.user && (
              <nav className="flex items-center gap-6">
                <Link
                  href="/my-orders"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  My Orders
                </Link>
                <Link
                  href="/account"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Account
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button
                    type="submit"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    Sign Out
                  </button>
                </form>
              </nav>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-sm text-muted-foreground text-center">
            Big Buildings Direct - Quality buildings delivered to your door
          </p>
        </div>
      </footer>
      </div>
    </>
  );
}
