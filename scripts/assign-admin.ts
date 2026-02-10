import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminRole = await prisma.role.findUnique({ where: { name: "Admin" } });
  if (!adminRole) {
    console.log("Admin role not found");
    return;
  }

  const user = await prisma.user.update({
    where: { email: "rex@bigbuildingsdirect.com" },
    data: { roleId: adminRole.id },
    include: { role: true },
  });

  console.log(`Updated: ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.role.name}`);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
