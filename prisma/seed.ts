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

  // Create all users from Order Processing app profiles
  console.log("Creating users...");
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const roleMap: Record<string, string> = {
    admin: adminRole.id,
    manager: managerRole.id,
    sales_rep: salesRole.id,
  };

  const officeMap: Record<string, string> = {
    Marion: "Marion Office",
    Harbor: "Harbor Office",
  };

  // All profiles from Order Processing Supabase (source of truth)
  const opProfiles = [
    // Admin
    { email: "rex@bigbuildingsdirect.com", firstName: "Rex", lastName: "Wu", role: "admin", office: "All" },
    // Managers
    { email: "garrett@bigbuildingsdirect.com", firstName: "Garrett", lastName: "Ryder", role: "manager", office: "Harbor" },
    { email: "kelvin@bigbuildingsdirect.com", firstName: "Kelvin", lastName: "Soto", role: "manager", office: "Harbor" },
    { email: "robin@bigbuildingsdirect.com", firstName: "Robin", lastName: "Campbell", role: "manager", office: "Marion" },
    // Sales Reps — Harbor Office
    { email: "t.woodmansee@bigbuildingsdirect.com", firstName: "Tom", lastName: "Woodmansee", role: "sales_rep", office: "Harbor" },
    { email: "k.occe@bigbuildingsdirect.com", firstName: "Kayani", lastName: "Occe", role: "sales_rep", office: "Harbor" },
    { email: "y.pandit@bigbuildingsdirect.com", firstName: "Yesha", lastName: "Pandit", role: "sales_rep", office: "Harbor" },
    { email: "reed@bigbuildingsdirect.com", firstName: "Reed", lastName: "Hunt", role: "sales_rep", office: "Harbor" },
    { email: "m.wright@bigbuildingsdirect.com", firstName: "Max", lastName: "Wright", role: "sales_rep", office: "Harbor" },
    { email: "e.quesada@bigbuildingsdirect.com", firstName: "Emily", lastName: "Quesada", role: "sales_rep", office: "Harbor" },
    { email: "a.chase@bigbuildingsdirect.com", firstName: "Alyssa", lastName: "Chase", role: "sales_rep", office: "Harbor" },
    { email: "tucker@bigbuildingsdirect.com", firstName: "Tucker", lastName: "Fine", role: "sales_rep", office: "Harbor" },
    { email: "salita@bigbuildingsdirect.com", firstName: "Salita", lastName: "Bengochea", role: "sales_rep", office: "Harbor" },
    { email: "t.simpson@bigbuildingsdirect.com", firstName: "Ty", lastName: "Simpson", role: "sales_rep", office: "Harbor" },
    { email: "d.rodriguez@bigbuildingsdirect.com", firstName: "Dariel", lastName: "Rodriguez", role: "sales_rep", office: "Harbor" },
    { email: "j.mayers@bigbuildingsdirect.com", firstName: "Jakari", lastName: "Mayers", role: "sales_rep", office: "Harbor" },
    { email: "c.wade@bigbuildingsdirect.com", firstName: "Cayman", lastName: "Wade", role: "sales_rep", office: "Harbor" },
    { email: "e.smeltzer@bigbuildingsdirect.com", firstName: "Evan", lastName: "Smeltzer", role: "sales_rep", office: "Harbor" },
    { email: "c.murphy@bigbuildingsdirect.com", firstName: "Chase", lastName: "Murphy", role: "sales_rep", office: "Harbor" },
    { email: "t.hughes@bigbuildingsdirect.com", firstName: "Tyler", lastName: "Hughes", role: "sales_rep", office: "Harbor" },
    { email: "d.schmidt@bigbuildingsdirect.com", firstName: "Dylan", lastName: "Schmidt", role: "sales_rep", office: "Harbor" },
    { email: "s.farabaugh@bigbuildingsdirect.com", firstName: "Samantha", lastName: "Farabaugh", role: "sales_rep", office: "Harbor" },
    { email: "r.cavallo@bigbuildingsdirect.com", firstName: "Ray", lastName: "Cavallo", role: "sales_rep", office: "Harbor" },
    { email: "l.arasimowicz@bigbuildingsdirect.com", firstName: "Liliana", lastName: "Arasimowicz", role: "sales_rep", office: "Harbor" },
    { email: "gabe@bigbuildingsdirect.com", firstName: "Gabriel", lastName: "DeAlba", role: "sales_rep", office: "Harbor" },
    { email: "j.lemon@bigbuildingsdirect.com", firstName: "Jordan", lastName: "Lemon", role: "sales_rep", office: "Harbor" },
    { email: "a.blust@bigbuildingsdirect.com", firstName: "Aidan", lastName: "Blust", role: "sales_rep", office: "Harbor" },
    { email: "jason@bigbuildingsdirect.com", firstName: "Jason", lastName: "Porcelli", role: "sales_rep", office: "Harbor" },
    { email: "r.lopez@bigbuildingsdirect.com", firstName: "Rob", lastName: "Lopez", role: "sales_rep", office: "Harbor" },
    { email: "n.deboe@bigbuildingsdirect.com", firstName: "Nicholas", lastName: "Deboe", role: "sales_rep", office: "Harbor" },
    // Sales Reps — Marion Office
    { email: "adam@bigbuildingsdirect.com", firstName: "Adam", lastName: "Niemann", role: "sales_rep", office: "Marion" },
    { email: "bill@bigbuildingsdirect.com", firstName: "Bill", lastName: "Alexander", role: "sales_rep", office: "Marion" },
    { email: "nick@bigbuildingsdirect.com", firstName: "Nick", lastName: "Brunsman", role: "sales_rep", office: "Marion" },
    { email: "richard@bigbuildingsdirect.com", firstName: "Richard", lastName: "Kalley", role: "sales_rep", office: "Marion" },
    { email: "samantha@bigbuildingsdirect.com", firstName: "Samantha", lastName: "Napoli", role: "sales_rep", office: "Marion" },
    { email: "rob@bigbuildingsdirect.com", firstName: "Rob", lastName: "Salaita", role: "sales_rep", office: "Marion" },
    { email: "timothy@bigbuildingsdirect.com", firstName: "Timothy", lastName: "Hickman", role: "sales_rep", office: "Marion" },
  ];

  for (const profile of opProfiles) {
    await prisma.user.upsert({
      where: { email: profile.email },
      update: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        password: hashedPassword,
        roleId: roleMap[profile.role],
        office: officeMap[profile.office] || undefined,
      },
      create: {
        email: profile.email,
        password: hashedPassword,
        firstName: profile.firstName,
        lastName: profile.lastName,
        roleId: roleMap[profile.role],
        office: officeMap[profile.office] || undefined,
      },
    });
  }

  console.log(`  Created/updated ${opProfiles.length} users`);

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
