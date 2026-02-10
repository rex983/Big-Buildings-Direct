import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import * as fs from "fs";

const prisma = new PrismaClient();

interface CSVRow {
  "Order Number": string;
  "Date of Revision": string;
  "Sales Rep Email": string;
  "Sales Rep": string;
  "Change in Price": string;
  "New Total": string;
  "New Deposit": string;
  "Rev Fee": string;
  "Order Form Name": string;
  "Customer Email": string;
  "Original Sold Date": string;
  "Revision Number": string;
  "Revision Type": string;
  "Changing Manufacturer": string;
  "Original Manufacturer": string;
  "New Manufacturer Email": string;
  "Forms Submitted": string;
  "Revision Notes": string;
  "Rev notes (Reps)": string;
  "Deposit Charge": string;
  "Send to Cust": string;
  "Signed": string;
  "Send to Man.": string;
  "Old Order Total": string;
  "New Order Total": string;
  "Old Dep Total": string;
  "New Dep Total": string;
  "Order Total Diff": string;
  "Dep Diff": string;
  "Sabrina Forms": string;
  "Total Charge": string;
  "Last Edited STC": string;
  "Last Edited signed": string;
  "Last Edited STM": string;
  "Last Update Dep/OT": string;
  "New Manufacturer Dup": string;
  "sabrinas rev forms": string;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === "") return null;

  // Handle various date formats: MM/DD/YYYY, M/D/YYYY HH:MMam/pm
  const cleanDate = dateStr.trim();

  // Try parsing with time component
  const withTimeMatch = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(am|pm)?$/i);
  if (withTimeMatch) {
    const [, month, day, year, hours, minutes, ampm] = withTimeMatch;
    let hour = parseInt(hours, 10);
    if (ampm?.toLowerCase() === "pm" && hour !== 12) hour += 12;
    if (ampm?.toLowerCase() === "am" && hour === 12) hour = 0;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), hour, parseInt(minutes, 10));
  }

  // Try simple date format
  const simpleMatch = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (simpleMatch) {
    const [, month, day, year] = simpleMatch;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  }

  return null;
}

function parseMoney(moneyStr: string): number | null {
  if (!moneyStr || moneyStr.trim() === "") return null;
  const cleaned = moneyStr.replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function normalizeBoolean(value: string): boolean {
  const lower = (value || "").toLowerCase().trim();
  return lower === "yes" || lower === "true" || lower === "1";
}

function isValidRevisionNumber(revNum: string): boolean {
  return /^Revision\d+$/i.test(revNum?.trim() || "");
}

async function main() {
  const csvPath = process.argv[2] || "C:/Users/Redir/Downloads/Revisions-Raw View.csv";

  console.log(`Reading CSV from: ${csvPath}`);
  const content = fs.readFileSync(csvPath, "utf-8");

  const records: CSVRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
  });

  console.log(`Found ${records.length} revision records`);

  // Build order lookup map
  const orders = await prisma.order.findMany({
    select: { id: true, orderNumber: true },
  });
  const orderMap = new Map(orders.map((o) => [o.orderNumber, o.id]));
  console.log(`Loaded ${orderMap.size} orders for matching`);

  // Build sales rep lookup map
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  console.log(`Loaded ${userMap.size} users for matching`);

  let imported = 0;
  let skipped = 0;
  let noOrder = 0;
  let errors = 0;

  for (const row of records) {
    try {
      const orderNumber = row["Order Number"]?.trim();
      const revisionNumber = row["Revision Number"]?.trim();
      const revisionDateStr = row["Date of Revision"]?.trim();

      // Skip if no order number or invalid revision number
      if (!orderNumber) {
        skipped++;
        continue;
      }

      if (!isValidRevisionNumber(revisionNumber)) {
        skipped++;
        continue;
      }

      // Find the order
      const orderId = orderMap.get(orderNumber);
      if (!orderId) {
        noOrder++;
        continue;
      }

      // Parse revision date
      const revisionDate = parseDate(revisionDateStr);
      if (!revisionDate) {
        skipped++;
        continue;
      }

      // Check if this revision already exists
      const existing = await prisma.revision.findFirst({
        where: {
          orderId,
          revisionNumber,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Find sales rep
      const salesRepEmail = row["Sales Rep Email"]?.trim().toLowerCase();
      const salesRepId = salesRepEmail ? userMap.get(salesRepEmail) : null;

      // Create revision record
      await prisma.revision.create({
        data: {
          orderId,
          revisionNumber,
          revisionDate,
          salesRepId,

          // Price changes
          changeInPrice: row["Change in Price"]?.trim() || null,
          oldOrderTotal: parseMoney(row["Old Order Total"]),
          newOrderTotal: parseMoney(row["New Order Total"]) ?? parseMoney(row["New Total"]),
          oldDepositTotal: parseMoney(row["Old Dep Total"]),
          newDepositTotal: parseMoney(row["New Dep Total"]) ?? parseMoney(row["New Deposit"]),
          orderTotalDiff: parseMoney(row["Order Total Diff"]),
          depositDiff: parseMoney(row["Dep Diff"]),
          revisionFee: parseMoney(row["Rev Fee"]),
          totalCharge: parseMoney(row["Total Charge"]),

          // Customer info
          orderFormName: row["Order Form Name"]?.trim() || null,
          customerEmail: row["Customer Email"]?.trim() || null,

          // Manufacturer change
          changingManufacturer: normalizeBoolean(row["Changing Manufacturer"]),
          originalManufacturer: row["Original Manufacturer"]?.trim() || null,
          newManufacturer: row["New Manufacturer Dup"]?.trim() || null,
          newManufacturerEmail: row["New Manufacturer Email"]?.trim() || null,

          // Workflow tracking
          sentToCustomer: normalizeBoolean(row["Send to Cust"]),
          customerSigned: normalizeBoolean(row["Signed"]),
          sentToManufacturer: normalizeBoolean(row["Send to Man."]),

          // Timestamps
          lastEditedSTC: parseDate(row["Last Edited STC"]),
          lastEditedSigned: parseDate(row["Last Edited signed"]),
          lastEditedSTM: parseDate(row["Last Edited STM"]),
          lastUpdateDepOT: parseDate(row["Last Update Dep/OT"]),

          // Forms and notes
          formsSubmittedUrl: row["Forms Submitted"]?.trim() || null,
          sabrinaFormsUrl: row["Sabrina Forms"]?.trim() || row["sabrinas rev forms"]?.trim() || null,
          revisionNotes: row["Revision Notes"]?.trim() || null,
          repNotes: row["Rev notes (Reps)"]?.trim() || null,

          // Deposit charge status
          depositCharge: row["Deposit Charge"]?.trim() || null,
        },
      });

      imported++;

      if (imported % 500 === 0) {
        console.log(`Imported ${imported} revisions...`);
      }
    } catch (error) {
      errors++;
      console.error(`Error importing revision for order ${row["Order Number"]}:`, error);
    }
  }

  console.log("\n=== Import Complete ===");
  console.log(`Imported: ${imported}`);
  console.log(`Skipped (invalid/duplicate): ${skipped}`);
  console.log(`No matching order: ${noOrder}`);
  console.log(`Errors: ${errors}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
