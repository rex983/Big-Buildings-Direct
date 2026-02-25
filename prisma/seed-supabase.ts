import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

// Load .env manually
const envPath = path.resolve(__dirname, "../.env");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) continue;
  const key = trimmed.slice(0, eqIndex);
  let value = trimmed.slice(eqIndex + 1);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = value;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Import DEFAULT_PERMISSIONS from types
import { DEFAULT_PERMISSIONS } from "../src/types";

// Helper: generate CUID-like ID (matches Prisma's default)
function cuid(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `c${timestamp}${random}`;
}

async function upsertRow(
  table: string,
  data: Record<string, unknown>,
  conflictColumn: string
) {
  const { data: existing } = await supabase
    .from(table)
    .select("id")
    .eq(conflictColumn, data[conflictColumn])
    .single();

  if (existing) {
    return existing;
  }

  const id = (data.id as string) || cuid();
  const { data: inserted, error } = await supabase
    .from(table)
    .insert({ id, ...data })
    .select()
    .single();

  if (error) {
    console.error(`  Error inserting into ${table}:`, error.message);
    return null;
  }
  return inserted;
}

async function main() {
  console.log("Seeding BBD reference data via Supabase admin client...\n");

  // 1. Create permissions
  console.log("Creating permissions...");
  const permissionMap = new Map<string, string>();

  for (const perm of DEFAULT_PERMISSIONS) {
    const result = await upsertRow("Permission", {
      name: perm.name,
      category: perm.category,
      description: perm.description,
      createdAt: new Date().toISOString(),
    }, "name");

    if (result) {
      permissionMap.set(perm.name, result.id);
    }
  }
  console.log(`  ✓ ${permissionMap.size} permissions created\n`);

  // 2. Create roles
  console.log("Creating roles...");

  const roleConfigs: {
    name: string;
    description: string;
    perms: string[] | "all";
  }[] = [
    {
      name: "Admin",
      description: "Full access to all features",
      perms: "all",
    },
    {
      name: "Manager",
      description: "Full access to orders, users, and communications",
      perms: [
        "orders.view", "orders.view_all", "orders.create", "orders.edit",
        "orders.delete", "orders.advance_stage",
        "users.view", "users.create", "users.edit", "users.delete",
        "roles.view",
        "files.view", "files.upload", "files.delete",
        "documents.view", "documents.create", "documents.send",
        "messages.view", "messages.send", "messages.view_internal",
        "emails.view", "emails.send",
        "pay.plan.view", "pay.plan.edit",
        "settings.view",
      ],
    },
    {
      name: "BST",
      description:
        "Building Success Team - post-sale customer success and order fulfillment",
      perms: [
        "orders.view", "orders.view_all", "orders.edit", "orders.advance_stage",
        "files.view", "files.upload",
        "documents.view", "documents.create", "documents.send",
        "messages.view", "messages.send", "messages.view_internal",
        "emails.view", "emails.send",
      ],
    },
    {
      name: "Sales Rep",
      description: "Create and manage own orders until sent to manufacturer",
      perms: [
        "orders.view", "orders.create", "orders.edit",
        "files.view", "files.upload",
        "documents.view", "documents.create", "documents.send",
        "messages.view", "messages.send",
        "emails.view", "emails.send",
      ],
    },
    {
      name: "R&D",
      description: "Research and Development - view-only access for analysis",
      perms: [
        "orders.view", "orders.view_all",
        "files.view",
        "documents.view",
        "messages.view",
      ],
    },
    {
      name: "Customer",
      description:
        "Customer portal - view own orders, sign documents, communicate",
      perms: [
        "orders.view",
        "files.view", "files.upload",
        "documents.view",
        "messages.view", "messages.send",
      ],
    },
  ];

  const roleMap = new Map<string, string>();

  for (const rc of roleConfigs) {
    const role = await upsertRow("Role", {
      name: rc.name,
      description: rc.description,
      isSystem: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, "name");

    if (!role) continue;
    roleMap.set(rc.name, role.id);

    // Assign permissions
    const permNames =
      rc.perms === "all"
        ? Array.from(permissionMap.keys())
        : rc.perms;

    for (const permName of permNames) {
      const permId = permissionMap.get(permName);
      if (!permId) continue;

      // Check if already exists
      const { data: existing } = await supabase
        .from("RolePermission")
        .select("roleId")
        .eq("roleId", role.id)
        .eq("permissionId", permId)
        .single();

      if (!existing) {
        await supabase.from("RolePermission").insert({
          roleId: role.id,
          permissionId: permId,
          createdAt: new Date().toISOString(),
        });
      }
    }

    console.log(
      `  ✓ ${rc.name}: ${permNames.length} permissions assigned`
    );
  }

  // 3. Create order stages
  console.log("\nCreating order stages...");
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
    const { data: existing } = await supabase
      .from("OrderStage")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) {
      const { error } = await supabase.from("OrderStage").insert({
        id,
        ...stage,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (error) {
        console.error(`  Error creating stage ${stage.name}:`, error.message);
      }
    }
    console.log(`  ✓ ${stage.name}`);
  }

  // 4. Create demo users
  console.log("\nCreating demo users...");
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const users = [
    {
      email: "admin@bigbuildingsdirect.com",
      firstName: "Admin",
      lastName: "User",
      role: "Admin",
    },
    {
      email: "sales@bigbuildingsdirect.com",
      firstName: "John",
      lastName: "Sales",
      role: "Sales Rep",
    },
    {
      email: "customer@example.com",
      firstName: "Jane",
      lastName: "Customer",
      role: "Customer",
    },
  ];

  for (const u of users) {
    const roleId = roleMap.get(u.role);
    if (!roleId) {
      console.error(`  ✗ Role ${u.role} not found for user ${u.email}`);
      continue;
    }

    const result = await upsertRow("User", {
      email: u.email,
      password: hashedPassword,
      firstName: u.firstName,
      lastName: u.lastName,
      roleId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, "email");

    if (result) {
      console.log(`  ✓ ${u.email} (${u.role})`);
    }
  }

  console.log("\nSeed completed successfully!");

  // Verify counts
  console.log("\n--- Verification ---");
  const { count: roles } = await supabase.from("Role").select("*", { count: "exact", head: true });
  const { count: perms } = await supabase.from("Permission").select("*", { count: "exact", head: true });
  const { count: rps } = await supabase.from("RolePermission").select("*", { count: "exact", head: true });
  const { count: stgs } = await supabase.from("OrderStage").select("*", { count: "exact", head: true });
  const { count: usrs } = await supabase.from("User").select("*", { count: "exact", head: true });
  const { count: opOrders } = await supabase.from("orders").select("*", { count: "exact", head: true });

  console.log(`Roles: ${roles}`);
  console.log(`Permissions: ${perms}`);
  console.log(`RolePermissions: ${rps}`);
  console.log(`OrderStages: ${stgs}`);
  console.log(`Users: ${usrs}`);
  console.log(`Order Process orders: ${opOrders} (untouched)`);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
