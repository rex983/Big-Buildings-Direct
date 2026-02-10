import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPayPlansForMonth, getLedgerForMonth, getOfficePayPlans, getPayAuditLogs } from "@/lib/queries/pay";
import { PayTabs } from "@/components/features/pay/pay-tabs";
import { MonthSelector } from "@/components/features/pay/month-selector";
import { PayPlanSection } from "@/components/features/pay/pay-plan-section";
import { PayLedgerTable } from "@/components/features/pay/pay-ledger-table";
import { SalaryTable } from "@/components/features/pay/salary-table";
import { OfficeTierEditor } from "@/components/features/pay/office-tier-editor";
import { PayAuditLog } from "@/components/features/pay/pay-audit-log";

interface SearchParams {
  tab?: string;
  month?: string;
  year?: string;
}

export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const user = session!.user;

  // Only Admin and Manager can access
  const allowedRoles = ["Admin", "Manager"];
  if (!allowedRoles.includes(user.roleName)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const isAdmin = user.roleName === "Admin";

  // If Manager tries to access ledger tab, force back to plan
  // Activity tab is available to both managers and admins
  let activeTab = params.tab || "plan";
  if (!isAdmin && activeTab === "ledger") {
    activeTab = "plan";
  }

  // Default to current month/year
  const now = new Date();
  const month = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();

  // Conditional data fetching based on active tab
  let planData;
  let ledgerData;
  let officePlans: Awaited<ReturnType<typeof getOfficePayPlans>> | undefined;
  let auditLogs: Awaited<ReturnType<typeof getPayAuditLogs>> | undefined;

  if (activeTab === "plan") {
    [planData, officePlans] = await Promise.all([
      getPayPlansForMonth(month, year),
      getOfficePayPlans(month, year),
    ]);
  } else if (activeTab === "ledger" && isAdmin) {
    ledgerData = await getLedgerForMonth(month, year);
  } else if (activeTab === "activity") {
    auditLogs = await getPayAuditLogs(100);
  }

  const canEditPlan =
    isAdmin || user.permissions.includes("pay.plan.edit");

  // ============ Plan Tab Content ============

  const allReps = planData ?? [];
  const marionReps = allReps.filter((r) => r.office === "Marion Office");
  const harborReps = allReps.filter((r) => r.office === "Harbor Office");

  const mapRepsToSalaryData = (reps: typeof allReps) =>
    reps.map((rep) => ({
      id: rep.id,
      firstName: rep.firstName,
      lastName: rep.lastName,
      salary: rep.salary.toString(),
      buildingsSold: rep.orderStats.buildingsSold,
      totalOrderAmount: rep.orderStats.totalOrderAmount.toString(),
    }));

  const mapOfficeTiers = (officeName: string) => {
    const plan = officePlans?.[officeName];
    if (!plan) return [];
    return plan.tiers.map((t) => ({
      type: t.type as "BUILDINGS_SOLD" | "ORDER_TOTAL",
      minValue: t.minValue.toString(),
      maxValue: t.maxValue?.toString() ?? "",
      bonusAmount: t.bonusAmount.toString(),
      bonusType: (t.bonusType as "FLAT" | "PERCENTAGE") ?? "FLAT",
    }));
  };

  const renderOfficeSection = (
    officeName: string,
    reps: typeof allReps
  ) => (
    <PayPlanSection title={officeName} defaultOpen>
      <SalaryTable
        reps={mapRepsToSalaryData(reps)}
        month={month}
        year={year}
        canEdit={canEditPlan}
      />
      <OfficeTierEditor
        office={officeName}
        month={month}
        year={year}
        initialTiers={mapOfficeTiers(officeName)}
        canEdit={canEditPlan}
      />
    </PayPlanSection>
  );

  const planContent = (
    <div className="space-y-4 mt-4">
      {allReps.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No active sales reps found.
        </p>
      )}
      {(marionReps.length > 0 || officePlans?.["Marion Office"]) &&
        renderOfficeSection("Marion Office", marionReps)}
      {(harborReps.length > 0 || officePlans?.["Harbor Office"]) &&
        renderOfficeSection("Harbor Office", harborReps)}
    </div>
  );

  // ============ Ledger Tab Content ============

  const ledgerContent = (
    <PayLedgerTable
      entries={
        ledgerData?.map((entry) => ({
          ...entry,
          totalOrderAmount: entry.totalOrderAmount.toString(),
          planTotal: entry.planTotal.toString(),
          adjustment: entry.adjustment.toString(),
          finalAmount: entry.finalAmount.toString(),
          reviewedAt: entry.reviewedAt?.toISOString() ?? null,
          payPlan: entry.payPlan
            ? {
                lineItems: entry.payPlan.lineItems.map((item) => ({
                  ...item,
                  amount: item.amount.toString(),
                })),
              }
            : null,
        })) ?? []
      }
      month={month}
      year={year}
    />
  );

  // ============ Activity Tab Content ============

  const activityContent = (
    <PayAuditLog
      entries={
        auditLogs?.map((entry) => ({
          id: entry.id,
          action: entry.action,
          description: entry.description,
          metadata: entry.metadata,
          createdAt: entry.createdAt.toISOString(),
          user: entry.user,
        })) ?? []
      }
    />
  );

  // ============ Render ============

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pay</h1>
          <p className="text-muted-foreground">
            Manage pay plans and payroll for sales reps
          </p>
        </div>
        <MonthSelector month={month} year={year} tab={activeTab} />
      </div>

      <PayTabs
        planContent={planContent}
        ledgerContent={ledgerContent}
        activityContent={activityContent}
        defaultTab={activeTab}
        showLedgerTab={isAdmin}
        month={month}
        year={year}
      />
    </div>
  );
}
