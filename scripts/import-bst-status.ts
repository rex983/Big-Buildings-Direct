import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// CSV parsing helper
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n");
  // Remove BOM if present
  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const headers = parseCSVLine(headerLine);

  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header.trim()] = values[index]?.trim() || "";
    });

    records.push(record);
  }

  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

// Parse WC Status - handles combined status values
function parseWcAndLppStatus(wcStatusRaw: string, lppStatusRaw: string): { wcStatus: string | null; lppStatus: string | null } {
  const wcNormalized = wcStatusRaw.trim().toLowerCase();
  const lppNormalized = lppStatusRaw.trim().toLowerCase();

  let wcStatus: string | null = null;
  let lppStatus: string | null = null;

  // Handle combined status "Contact Made Ready For Install"
  if (wcNormalized === "contact made ready for install") {
    wcStatus = "Contact Made";
    lppStatus = "Ready for Install";
  } else {
    // Map WC Status
    const wcMapping: Record<string, string> = {
      "contact made": "Contact Made",
      "pending": "Pending",
      "no contact made": "No Contact Made",
    };
    wcStatus = wcNormalized ? (wcMapping[wcNormalized] || wcStatusRaw.trim()) : null;

    // Map LP&P Status
    const lppMapping: Record<string, string> = {
      "ready for install": "Ready for Install",
      "pending": "Pending",
    };
    lppStatus = lppNormalized ? (lppMapping[lppNormalized] || lppStatusRaw.trim()) : null;
  }

  // Clean up empty strings to null
  if (wcStatus === "") wcStatus = null;
  if (lppStatus === "") lppStatus = null;

  return { wcStatus, lppStatus };
}

async function main() {
  const csvPath = "C:/Users/Redir/Downloads/Work Flow-All Sales.csv";

  console.log("Reading CSV file...");
  const content = fs.readFileSync(csvPath, "utf-8");
  const records = parseCSV(content);

  console.log(`Found ${records.length} records in CSV`);

  // Get unique WC Status and LP&P Status values for verification
  const wcStatuses = new Set<string>();
  const lppStatuses = new Set<string>();

  records.forEach((record) => {
    if (record["WC Status"]) wcStatuses.add(record["WC Status"]);
    if (record["LP&P Status"]) lppStatuses.add(record["LP&P Status"]);
  });

  console.log("\nUnique WC Status values found:", Array.from(wcStatuses));
  console.log("Unique LP&P Status values found:", Array.from(lppStatuses));

  // Update orders
  let updated = 0;
  let notFound = 0;
  let skipped = 0;

  console.log("\nUpdating orders...");

  for (const record of records) {
    const orderNumber = record["Order Number"];
    if (!orderNumber) {
      skipped++;
      continue;
    }

    const { wcStatus, lppStatus } = parseWcAndLppStatus(
      record["WC Status"] || "",
      record["LP&P Status"] || ""
    );

    // Skip if no BST status to update
    if (wcStatus === null && lppStatus === null) {
      skipped++;
      continue;
    }

    try {
      const result = await prisma.order.updateMany({
        where: { orderNumber: orderNumber },
        data: {
          wcStatus: wcStatus,
          lppStatus: lppStatus,
          wcStatusDate: wcStatus ? new Date() : null,
          lppStatusDate: lppStatus ? new Date() : null,
        },
      });

      if (result.count > 0) {
        updated++;
      } else {
        notFound++;
      }
    } catch (error) {
      console.error(`Error updating order ${orderNumber}:`, error);
    }
  }

  console.log("\n--- Import Complete ---");
  console.log(`Updated: ${updated}`);
  console.log(`Not found in DB: ${notFound}`);
  console.log(`Skipped (no status): ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
