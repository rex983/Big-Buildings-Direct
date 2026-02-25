import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_PERMISSIONS } from "../src/types";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // Create permissions
  console.log("Creating permissions...");
  for (const perm of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: {
        name: perm.name,
        category: perm.category,
        description: perm.description,
      },
    });
  }

  // Get all permissions
  const allPermissions = await prisma.permission.findMany();
  const permissionMap = new Map(allPermissions.map((p) => [p.name, p.id]));

  // Create roles
  console.log("Creating roles...");

  // Admin role - all permissions
  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: {
      name: "Admin",
      description: "Full access to all features",
      isSystem: true,
    },
  });

  // Assign all permissions to Admin
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    });
  }

  // Manager role - full access except system settings
  const managerPerms = [
    "orders.view", "orders.view_all", "orders.create", "orders.edit", "orders.delete", "orders.advance_stage",
    "users.view", "users.create", "users.edit", "users.delete",
    "roles.view",
    "files.view", "files.upload", "files.delete",
    "documents.view", "documents.create", "documents.send",
    "messages.view", "messages.send", "messages.view_internal",
    "emails.view", "emails.send",
    "pay.plan.view", "pay.plan.edit",
    "settings.view",
  ];

  const managerRole = await prisma.role.upsert({
    where: { name: "Manager" },
    update: { description: "Full access to orders, users, and communications" },
    create: {
      name: "Manager",
      description: "Full access to orders, users, and communications",
      isSystem: true,
    },
  });

  for (const permName of managerPerms) {
    const permId = permissionMap.get(permName);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: managerRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: {
          roleId: managerRole.id,
          permissionId: permId,
        },
      });
    }
  }

  // BST (Building Success Team) role - handles post-sale customer success
  const bstPerms = [
    "orders.view", "orders.view_all", "orders.edit", "orders.advance_stage",
    "files.view", "files.upload",
    "documents.view", "documents.create", "documents.send",
    "messages.view", "messages.send", "messages.view_internal",
    "emails.view", "emails.send",
  ];

  const bstRole = await prisma.role.upsert({
    where: { name: "BST" },
    update: { description: "Building Success Team - post-sale customer success and order fulfillment" },
    create: {
      name: "BST",
      description: "Building Success Team - post-sale customer success and order fulfillment",
      isSystem: true,
    },
  });

  for (const permName of bstPerms) {
    const permId = permissionMap.get(permName);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: bstRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: {
          roleId: bstRole.id,
          permissionId: permId,
        },
      });
    }
  }

  // Sales Rep role - create and manage own orders until sent to manufacturer
  const salesPerms = [
    "orders.view", "orders.create", "orders.edit",
    "files.view", "files.upload",
    "documents.view", "documents.create", "documents.send",
    "messages.view", "messages.send",
    "emails.view", "emails.send",
  ];

  const salesRole = await prisma.role.upsert({
    where: { name: "Sales Rep" },
    update: { description: "Create and manage own orders until sent to manufacturer" },
    create: {
      name: "Sales Rep",
      description: "Create and manage own orders until sent to manufacturer",
      isSystem: true,
    },
  });

  for (const permName of salesPerms) {
    const permId = permissionMap.get(permName);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: salesRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: {
          roleId: salesRole.id,
          permissionId: permId,
        },
      });
    }
  }

  // R&D role - research and development, limited order access
  const rndPerms = [
    "orders.view", "orders.view_all",
    "files.view",
    "documents.view",
    "messages.view",
  ];

  const rndRole = await prisma.role.upsert({
    where: { name: "R&D" },
    update: { description: "Research and Development - view-only access for analysis" },
    create: {
      name: "R&D",
      description: "Research and Development - view-only access for analysis",
      isSystem: true,
    },
  });

  for (const permName of rndPerms) {
    const permId = permissionMap.get(permName);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: rndRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: {
          roleId: rndRole.id,
          permissionId: permId,
        },
      });
    }
  }

  // Customer role (kept for portal access)
  const customerPerms = [
    "orders.view",
    "files.view", "files.upload",
    "documents.view",
    "messages.view", "messages.send",
  ];

  const customerRole = await prisma.role.upsert({
    where: { name: "Customer" },
    update: { description: "Customer portal - view own orders, sign documents, communicate" },
    create: {
      name: "Customer",
      description: "Customer portal - view own orders, sign documents, communicate",
      isSystem: true,
    },
  });

  for (const permName of customerPerms) {
    const permId = permissionMap.get(permName);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: customerRole.id,
            permissionId: permId,
          },
        },
        update: {},
        create: {
          roleId: customerRole.id,
          permissionId: permId,
        },
      });
    }
  }

  // Create order stages
  console.log("Creating order stages...");
  const stages = [
    { name: "Deposit Placed", sortOrder: 1, color: "#6366F1", isDefault: true, isFinal: false },
    { name: "Card Charged", sortOrder: 2, color: "#8B5CF6", isDefault: false, isFinal: false },
    { name: "Sent for Signing", sortOrder: 3, color: "#A855F7", isDefault: false, isFinal: false },
    { name: "Customer Signed", sortOrder: 4, color: "#D946EF", isDefault: false, isFinal: false },
    { name: "Sent to Manufacturer", sortOrder: 5, color: "#EC4899", isDefault: false, isFinal: false },
    { name: "Success Team Contact", sortOrder: 6, color: "#F43F5E", isDefault: false, isFinal: false },
    { name: "Checklist Sent", sortOrder: 7, color: "#F97316", isDefault: false, isFinal: false },
    { name: "Completed", sortOrder: 8, color: "#22C55E", isDefault: false, isFinal: true },
  ];

  for (const stage of stages) {
    const id = stage.name.toLowerCase().replace(/\s+/g, "-");
    await prisma.orderStage.upsert({
      where: { id },
      update: stage,
      create: {
        id,
        ...stage,
      },
    });
  }

  // Create admin user
  console.log("Creating admin user...");
  const hashedPassword = await bcrypt.hash("admin123", 12);

  await prisma.user.upsert({
    where: { email: "admin@bigbuildingsdirect.com" },
    update: {},
    create: {
      email: "admin@bigbuildingsdirect.com",
      password: hashedPassword,
      firstName: "Admin",
      lastName: "User",
      roleId: adminRole.id,
    },
  });

  // Create demo sales rep
  await prisma.user.upsert({
    where: { email: "sales@bigbuildingsdirect.com" },
    update: {},
    create: {
      email: "sales@bigbuildingsdirect.com",
      password: hashedPassword,
      firstName: "John",
      lastName: "Sales",
      roleId: salesRole.id,
    },
  });

  // Create demo customer
  await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      email: "customer@example.com",
      password: hashedPassword,
      firstName: "Jane",
      lastName: "Customer",
      roleId: customerRole.id,
    },
  });

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
