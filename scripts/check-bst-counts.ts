import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkCounts() {
  // Get WC Status counts
  const wcCounts = await prisma.order.groupBy({
    by: ["wcStatus"],
    _count: { _all: true },
    where: { sentToManufacturer: true, status: { not: "CANCELLED" } },
  });

  // Get LP&P Status counts
  const lppCounts = await prisma.order.groupBy({
    by: ["lppStatus"],
    _count: { _all: true },
    where: { sentToManufacturer: true, status: { not: "CANCELLED" } },
  });

  // Get BST pipeline stage counts
  const baseWhere = { sentToManufacturer: true, status: { not: "CANCELLED" as const } };

  const [stmPending, wcPending, noContactMade, wcDoneLpp, readyToInstall] = await Promise.all([
    prisma.order.count({ where: { ...baseWhere, wcStatus: null } }),
    prisma.order.count({ where: { ...baseWhere, wcStatus: "Pending" } }),
    prisma.order.count({ where: { ...baseWhere, wcStatus: "No Contact Made" } }),
    prisma.order.count({
      where: {
        ...baseWhere,
        wcStatus: "Contact Made",
        OR: [{ lppStatus: null }, { lppStatus: "Pending" }],
      },
    }),
    prisma.order.count({
      where: {
        ...baseWhere,
        wcStatus: "Contact Made",
        lppStatus: "Ready for Install",
      },
    }),
  ]);

  console.log("=== WC Status Distribution ===");
  wcCounts.forEach((c) =>
    console.log(`  ${c.wcStatus || "(null)"}: ${c._count._all}`)
  );

  console.log("\n=== LP&P Status Distribution ===");
  lppCounts.forEach((c) =>
    console.log(`  ${c.lppStatus || "(null)"}: ${c._count._all}`)
  );

  console.log("\n=== BST Pipeline Stage Counts ===");
  console.log(`  Stage 1 - STM Pending:      ${stmPending}`);
  console.log(`  Stage 2 - WC Pending:       ${wcPending}`);
  console.log(`  Stage 3 - No Contact Made:  ${noContactMade}`);
  console.log(`  Stage 4 - WC Done, LP&P:    ${wcDoneLpp}`);
  console.log(`  Stage 5 - Ready to Install: ${readyToInstall}`);
  console.log(`  ---------------------------------`);
  console.log(`  Total:                      ${stmPending + wcPending + noContactMade + wcDoneLpp + readyToInstall}`);

  await prisma.$disconnect();
}

checkCounts().catch(console.error);
