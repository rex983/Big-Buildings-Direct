import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  const orders = await prisma.order.count();
  const roles = await prisma.role.count();
  const permissions = await prisma.permission.count();
  const stages = await prisma.orderStage.count();
  const manufacturers = await prisma.manufacturer.count();

  console.log("=== Supabase Database Contents ===");
  console.log("Users:", users);
  console.log("Orders:", orders);
  console.log("Roles:", roles);
  console.log("Permissions:", permissions);
  console.log("Order Stages:", stages);
  console.log("Manufacturers:", manufacturers);

  if (users > 0) {
    const allUsers = await prisma.user.findMany({
      select: { email: true, firstName: true, lastName: true, role: { select: { name: true } } },
    });
    console.log("\nUsers:");
    allUsers.forEach((u) =>
      console.log(`  - ${u.email} (${u.firstName} ${u.lastName}, ${u.role.name})`)
    );
  }

  await prisma.$disconnect();
}

main();
