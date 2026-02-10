import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";
import { findOrCreateCustomer } from "../src/lib/customers";

const prisma = new PrismaClient();

// CSV column mapping to our database fields
interface CSVRow {
  ON: string;
  "Date Sold": string;
  "Sales Rep": string;
  "Order Form Name": string;
  State: string;
  "Customer Email": string;
  Installer: string;
  "Payment Notes": string;
  "Submitted Forms": string;
  "Special Notes": string;
  "Deposit Charge": string;
  "Sent To Cust": string;
  Signed: string;
  "Sent To Man": string;
  "Sales Rep Email": string;
  "Building Address": string;
  "Building Type": string;
  "Building Width": string;
  "Building Length": string;
  "Building Height": string;
  "Foundation Type": string;
  "Permit Structure": string;
  "Customer Ready Status": string;
  "Permit Type": string;
  "Lull Lift Required": string;
  "Building Dimension": string;
  Revisions: string;
  "Paragraph 1": string;
  "Paragraph 2": string;
  Subject: string;
  "Email body": string;
  "Sabrina Forms": string;
  "Order Total": string;
  Deposit: string;
  "% check": string;
  "Date STC": string;
  "Last Modified OT/DEP": string;
  "Last Modified STM": string;
  "Days Since STM": string;
  "Customer Phone Number": string;
  Cancellations: string;
  "Date Signed": string;
  "last modified  deposit": string;
  "last modified order total": string;
  "last modified Sabrina Link": string;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === "") return null;

  // Handle various date formats: MM/DD/YYYY, M/D/YYYY, MM/DD/YYYY HH:MMam/pm
  const cleanDate = dateStr.split(" ")[0]; // Remove time portion if present
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

function extractState(state: string): string {
  return (state || "").trim() || "Unknown";
}

async function main() {
  const csvPath = process.argv[2] || "C:/Users/Redir/Downloads/New Sales-Raw Data.csv";

  console.log(`Reading CSV from: ${csvPath}`);
  const content = fs.readFileSync(csvPath, "utf-8");

  const records: CSVRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  console.log(`Found ${records.length} records to import`);

  // Get the Sales Rep role
  const salesRepRole = await prisma.role.findUnique({
    where: { name: "Sales Rep" },
  });

  if (!salesRepRole) {
    console.error("Sales Rep role not found. Run db:seed first.");
    process.exit(1);
  }

  // Get order stages
  const stages = await prisma.orderStage.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const stageMap = new Map(stages.map(s => [s.name.toLowerCase(), s]));
  const depositStage = stages.find(s => s.isDefault) || stages[0];
  const signedStage = stageMap.get("customer signed");
  const sentToManStage = stageMap.get("sent to manufacturer");
  const completedStage = stageMap.get("completed");

  // Track unique sales reps and customers
  const salesRepCache = new Map<string, string>(); // email -> userId
  const customerCache = new Map<string, string>(); // email -> userId
  const hashedPassword = await bcrypt.hash("changeme123", 12);

  // Import in batches
  const batchSize = 100;
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    for (const row of batch) {
      try {
        const orderNumber = row.ON?.trim();
        if (!orderNumber) {
          skipped++;
          continue;
        }

        // Check if order already exists
        const existing = await prisma.order.findUnique({
          where: { orderNumber },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Get or create sales rep
        let salesRepId: string | null = null;
        const salesRepEmail = (row["Sales Rep Email"] || "").trim().toLowerCase();
        const salesRepName = (row["Sales Rep"] || "").trim();

        if (salesRepEmail && salesRepName) {
          if (salesRepCache.has(salesRepEmail)) {
            salesRepId = salesRepCache.get(salesRepEmail)!;
          } else {
            let salesRep = await prisma.user.findUnique({
              where: { email: salesRepEmail },
            });

            if (!salesRep) {
              const nameParts = salesRepName.split(" ");
              const firstName = nameParts[0] || "Sales";
              const lastName = nameParts.slice(1).join(" ") || "Rep";

              salesRep = await prisma.user.create({
                data: {
                  email: salesRepEmail,
                  password: hashedPassword,
                  firstName,
                  lastName,
                  roleId: salesRepRole.id,
                  isActive: true,
                },
              });
            }

            salesRepId = salesRep.id;
            salesRepCache.set(salesRepEmail, salesRepId);
          }
        }

        // Get or create customer
        let customerId: string | null = null;
        const customerEmail = (row["Customer Email"] || "").trim().toLowerCase();
        const customerName = (row["Order Form Name"] || "").trim();

        if (customerEmail) {
          if (customerCache.has(customerEmail)) {
            customerId = customerCache.get(customerEmail)!;
          } else {
            try {
              customerId = await findOrCreateCustomer(
                customerEmail,
                customerName || "Unknown Customer",
                row["Customer Phone Number"]?.trim() || null
              );
              customerCache.set(customerEmail, customerId);
            } catch (e) {
              // Non-fatal: order can still be created without customerId
              console.warn(`Could not resolve customer for ${customerEmail}:`, e);
            }
          }
        }

        // Determine current stage based on workflow status
        let currentStageId = depositStage?.id;
        const sentToCust = normalizeBoolean(row["Sent To Cust"]);
        const signed = normalizeBoolean(row.Signed);
        const sentToMan = normalizeBoolean(row["Sent To Man"]);
        const isCancelled = row.Cancellations?.includes(orderNumber);

        if (sentToMan && sentToManStage) {
          currentStageId = sentToManStage.id;
        } else if (signed && signedStage) {
          currentStageId = signedStage.id;
        }

        // Parse dates
        const dateSold = parseDate(row["Date Sold"]);
        const customerSignedDate = parseDate(row["Date Signed"]);

        // Create order
        const order = await prisma.order.create({
          data: {
            orderNumber,
            customerName: row["Order Form Name"]?.trim() || "Unknown Customer",
            customerEmail: row["Customer Email"]?.trim() || "",
            customerPhone: row["Customer Phone Number"]?.trim() || null,

            // Building details
            buildingType: row["Building Type"]?.trim() || "Metal Building",
            buildingSize: row["Building Dimension"]?.trim() || "",
            buildingWidth: row["Building Width"]?.trim() || null,
            buildingLength: row["Building Length"]?.trim() || null,
            buildingHeight: row["Building Height"]?.trim() || null,
            foundationType: row["Foundation Type"]?.trim() || null,
            lullLiftRequired: row["Lull Lift Required"]?.toLowerCase().includes("yes") || false,

            // Delivery
            deliveryAddress: row["Building Address"]?.trim() || "",
            deliveryCity: "",
            deliveryState: extractState(row.State),
            deliveryZip: "",

            // Permit info
            permitStructure: row["Permit Structure"]?.trim() || null,
            customerReadyStatus: row["Customer Ready Status"]?.trim() || null,
            permitType: row["Permit Type"]?.trim() || null,

            // Installer
            installer: row.Installer?.trim() || null,

            // Financial
            totalPrice: parseMoney(row["Order Total"]),
            depositAmount: parseMoney(row.Deposit),
            depositCollected: row["Deposit Charge"]?.toLowerCase().includes("accepted") || false,
            depositChargeStatus: row["Deposit Charge"]?.trim() || null,
            depositPercentage: row["% check"]?.trim() || null,

            // Status
            status: isCancelled ? "CANCELLED" : "ACTIVE",
            priority: "NORMAL",

            // Workflow tracking
            sentToCustomer: sentToCust,
            customerSigned: signed,
            customerSignedDate: customerSignedDate,
            sentToManufacturer: sentToMan,

            // External links
            submittedFormsUrl: row["Submitted Forms"]?.trim() || null,
            sabrinaFormsUrl: row["Sabrina Forms"]?.trim() || null,

            // Notes
            specialNotes: row["Special Notes"]?.trim() || null,
            paymentNotes: row["Payment Notes"]?.trim() || null,

            // Revisions
            revisionOf: row.Revisions?.trim() || null,

            // Timestamps
            dateSold: dateSold,
            createdAt: dateSold || new Date(),
            cancelledAt: isCancelled ? new Date() : null,
            cancelReason: isCancelled ? "Imported as cancelled" : null,

            // Relations
            customerId,
            salesRepId,
            currentStageId,
          },
        });

        imported++;

        if (imported % 500 === 0) {
          console.log(`Imported ${imported} orders...`);
        }
      } catch (error) {
        errors++;
        console.error(`Error importing order ${row.ON}:`, error);
      }
    }
  }

  console.log("\n=== Import Complete ===");
  console.log(`Imported: ${imported}`);
  console.log(`Skipped (already exists or no order number): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Sales reps created/found: ${salesRepCache.size}`);
  console.log(`Customers created/found: ${customerCache.size}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
