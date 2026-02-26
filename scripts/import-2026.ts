import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

interface CSVRow {
  ON: string;
  "Date Sold": string;
  "Sales Rep": string;
  "Special Notes": string;
  "Order Form Name": string;
  State: string;
  "Customer Email": string;
  Installer: string;
  "Deposit Charge": string;
  "Sent To Cust": string;
  "Deposit Charged (from Order Change)": string;
  Signed: string;
  "Sent To Man": string;
  "Sabrina Forms": string;
  "Order Total": string;
  Deposit: string;
  "% check": string;
  "Submitted Forms": string;
  Subject: string;
  "Email body": string;
  Revisions: string;
  Cancellations: string;
  "Payment Notes": string;
  "Order Change": string;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === "") return null;
  const cleanDate = dateStr.split(" ")[0];
  const parts = cleanDate.split("/");
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  return new Date(year, month - 1, day);
}

function parseMoney(moneyStr: string): number {
  if (!moneyStr) return 0;
  const cleaned = moneyStr.replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function normalizeBoolean(value: string): boolean {
  const lower = (value || "").toLowerCase().trim();
  return lower === "yes" || lower === "true" || lower === "1";
}

async function main() {
  const csvPath = process.argv[2] || "C:/Users/Redir/Downloads/New Sales-2026.csv";

  console.log(`Reading CSV from: ${csvPath}`);
  const content = fs.readFileSync(csvPath, "utf-8");

  const records: CSVRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  console.log(`Found ${records.length} records to import`);

  // Build sales rep lookup by full name
  const allUsers = await prisma.user.findMany({
    select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } },
  });

  const salesRepByName = new Map<string, string>();
  for (const u of allUsers) {
    const fullName = `${u.firstName} ${u.lastName}`.trim();
    salesRepByName.set(fullName.toLowerCase(), u.id);
  }

  // Get Sales Rep role for creating missing reps
  const salesRepRole = await prisma.role.findUnique({ where: { name: "Sales Rep" } });
  const hashedPassword = await bcrypt.hash("changeme123", 12);

  // Get order stages
  const stages = await prisma.orderStage.findMany({ orderBy: { sortOrder: "asc" } });
  const depositStage = stages.find((s) => s.isDefault) || stages[0];
  const signedStage = stages.find((s) => s.name.toLowerCase() === "customer signed");
  const sentToManStage = stages.find((s) => s.name.toLowerCase() === "sent to manufacturer");

  let imported = 0;
  let skipped = 0;
  let updated = 0;
  let errors = 0;
  const createdReps: string[] = [];

  for (const row of records) {
    try {
      const orderNumber = row.ON?.trim();
      if (!orderNumber) {
        skipped++;
        continue;
      }

      // Match sales rep by name
      const salesRepName = (row["Sales Rep"] || "").trim();
      let salesRepId: string | null = null;

      if (salesRepName) {
        salesRepId = salesRepByName.get(salesRepName.toLowerCase()) || null;

        // Create sales rep if missing
        if (!salesRepId && salesRepRole) {
          const nameParts = salesRepName.split(" ");
          const firstName = nameParts[0] || "Sales";
          const lastName = nameParts.slice(1).join(" ") || "Rep";
          const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s/g, "")}@bigbuildingsdirect.com`;

          const newRep = await prisma.user.create({
            data: {
              email,
              password: hashedPassword,
              firstName,
              lastName,
              roleId: salesRepRole.id,
              isActive: true,
            },
          });

          salesRepId = newRep.id;
          salesRepByName.set(salesRepName.toLowerCase(), salesRepId);
          createdReps.push(`${salesRepName} (${email})`);
          console.log(`  Created sales rep: ${salesRepName} -> ${email}`);
        }
      }

      // Parse fields
      const dateSold = parseDate(row["Date Sold"]);
      const sentToCust = normalizeBoolean(row["Sent To Cust"]);
      const signed = normalizeBoolean(row.Signed);
      const sentToMan = normalizeBoolean(row["Sent To Man"]);
      const isCancelled = !!(row.Cancellations && row.Cancellations.trim() && row.Cancellations.includes(orderNumber));
      const depositChargeStatus = row["Deposit Charge"]?.trim() || null;
      const depositCollected = depositChargeStatus?.toLowerCase().includes("accepted") || false;

      // Determine current stage
      let currentStageId = depositStage?.id || null;
      if (sentToMan && sentToManStage) {
        currentStageId = sentToManStage.id;
      } else if (signed && signedStage) {
        currentStageId = signedStage.id;
      }

      const orderData = {
        customerName: row["Order Form Name"]?.trim() || "Unknown Customer",
        customerEmail: row["Customer Email"]?.trim() || "",
        deliveryState: (row.State || "").trim() || "Unknown",
        deliveryAddress: "",
        deliveryCity: "",
        deliveryZip: "",
        buildingType: "Metal Building",
        buildingSize: "",
        installer: row.Installer?.trim() || null,
        totalPrice: parseMoney(row["Order Total"]),
        depositAmount: parseMoney(row.Deposit),
        depositCollected,
        depositChargeStatus,
        depositPercentage: row["% check"]?.trim() || null,
        status: isCancelled ? "CANCELLED" : "ACTIVE",
        priority: "NORMAL",
        sentToCustomer: sentToCust,
        customerSigned: signed,
        sentToManufacturer: sentToMan,
        submittedFormsUrl: row["Submitted Forms"]?.trim() || null,
        sabrinaFormsUrl: row["Sabrina Forms"]?.trim() || null,
        specialNotes: row["Special Notes"]?.trim() || null,
        paymentNotes: row["Payment Notes"]?.trim() || null,
        revisionOf: row.Revisions?.trim() || null,
        dateSold,
        cancelledAt: isCancelled ? new Date() : null,
        cancelReason: isCancelled ? "Cancelled" : null,
        salesRepId,
        currentStageId,
      };

      // Check if order already exists
      const existing = await prisma.order.findUnique({
        where: { orderNumber },
      });

      if (existing) {
        // Update existing order
        await prisma.order.update({
          where: { orderNumber },
          data: orderData,
        });
        updated++;
      } else {
        // Create new order
        await prisma.order.create({
          data: {
            orderNumber,
            ...orderData,
            createdAt: dateSold || new Date(),
          },
        });
        imported++;
      }

      if ((imported + updated) % 100 === 0) {
        console.log(`Progress: ${imported} imported, ${updated} updated...`);
      }
    } catch (error) {
      errors++;
      console.error(`Error importing order ${row.ON}:`, error);
    }
  }

  console.log("\n=== Import Complete ===");
  console.log(`New orders imported: ${imported}`);
  console.log(`Existing orders updated: ${updated}`);
  console.log(`Skipped (no order number): ${skipped}`);
  console.log(`Errors: ${errors}`);
  if (createdReps.length > 0) {
    console.log(`New sales reps created: ${createdReps.join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
