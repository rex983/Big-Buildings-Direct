import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

interface CsvRow {
  "Order Number": string;
  "Date of Change": string;
  "Sales rep": string;
  "Order Form Name": string;
  Manufacturer: string;
  "Old Order Total": string;
  "New Order Total": string;
  "Old Deposit Total": string;
  "New Deposit Total": string;
  "Order Total Difference": string;
  "Deposit difference": string;
  "Additional Notes": string;
  Uploads: string;
  "Change Type": string;
  "Deposit Charged": string;
  "Sabrina Process": string;
  "Updated numbers in New Sale": string;
  "Rex Process": string;
  "Cust Email": string;
  "New Sales": string;
  Revisions: string;
  Cancellations: string;
}

function parseCurrency(value: string): number | null {
  if (!value || value.trim() === "") return null;
  // Remove $ and , from currency values
  const cleaned = value.replace(/[$,]/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseDate(value: string): Date | null {
  if (!value || value.trim() === "") return null;
  // Format: "5/12/2025 16:33:37" or similar
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function parseBoolean(value: string): boolean {
  return value?.toLowerCase() === "yes";
}

function parseCSV(csvText: string): CsvRow[] {
  const lines = csvText.split("\n");
  if (lines.length < 2) return [];

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  const rows: CsvRow[] = [];
  let currentLine = "";

  for (let i = 1; i < lines.length; i++) {
    currentLine += (currentLine ? "\n" : "") + lines[i];

    // Check if we have a complete row (even number of quotes)
    const quoteCount = (currentLine.match(/"/g) || []).length;
    if (quoteCount % 2 === 0) {
      const values = parseCSVLine(currentLine);
      if (values.length >= headers.length) {
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header.trim()] = values[index]?.trim() || "";
        });
        rows.push(row as unknown as CsvRow);
      }
      currentLine = "";
    }
  }

  return rows;
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

export async function POST(request: NextRequest) {
  try {
    await requirePermission("orders.edit");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    // Remove BOM if present
    const cleanedCsv = csvText.replace(/^\uFEFF/, "");
    const rows = parseCSV(cleanedCsv);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "No data rows found in CSV" },
        { status: 400 }
      );
    }

    // Get all orders by order number for lookup
    const orderNumbers = [...new Set(rows.map((r) => r["Order Number"]).filter(Boolean))];
    const orders = await prisma.order.findMany({
      where: { orderNumber: { in: orderNumbers } },
      select: { id: true, orderNumber: true },
    });
    const orderMap = new Map(orders.map((o) => [o.orderNumber, o.id]));

    // Get all users for sales rep lookup
    const users = await prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true },
    });
    const userMap = new Map<string, string>();
    users.forEach((u) => {
      const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
      userMap.set(fullName, u.id);
      // Also map by first name only for partial matches
      userMap.set(u.firstName.toLowerCase(), u.id);
    });

    const results = {
      total: rows.length,
      imported: 0,
      skipped: 0,
      errors: [] as { row: number; orderNumber: string; error: string }[],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const orderNumber = row["Order Number"];

      if (!orderNumber) {
        results.skipped++;
        continue;
      }

      const orderId = orderMap.get(orderNumber);
      if (!orderId) {
        results.errors.push({
          row: i + 2, // +2 for header row and 0-index
          orderNumber,
          error: `Order #${orderNumber} not found`,
        });
        results.skipped++;
        continue;
      }

      // Find sales rep
      const salesRepName = row["Sales rep"]?.toLowerCase();
      const salesRepId = salesRepName ? userMap.get(salesRepName) : null;

      // Parse change date
      const changeDate = parseDate(row["Date of Change"]);
      if (!changeDate) {
        results.errors.push({
          row: i + 2,
          orderNumber,
          error: "Invalid or missing change date",
        });
        results.skipped++;
        continue;
      }

      try {
        // Check for duplicate (same order, same date, same notes)
        const existingChange = await prisma.orderChange.findFirst({
          where: {
            orderId,
            changeDate,
            additionalNotes: row["Additional Notes"] || null,
          },
        });

        if (existingChange) {
          results.skipped++;
          continue;
        }

        await prisma.orderChange.create({
          data: {
            orderId,
            changeDate,
            salesRepId,
            orderFormName: row["Order Form Name"] || null,
            manufacturer: row["Manufacturer"] || null,
            oldOrderTotal: parseCurrency(row["Old Order Total"]),
            newOrderTotal: parseCurrency(row["New Order Total"]),
            oldDepositTotal: parseCurrency(row["Old Deposit Total"]),
            newDepositTotal: parseCurrency(row["New Deposit Total"]),
            orderTotalDiff: parseCurrency(row["Order Total Difference"]),
            depositDiff: parseCurrency(row["Deposit difference"]),
            additionalNotes: row["Additional Notes"] || null,
            uploadsUrl: row["Uploads"] || null,
            changeType: row["Change Type"] || null,
            depositCharged: row["Deposit Charged"] || null,
            sabrinaProcess: parseBoolean(row["Sabrina Process"]),
            updatedInNewSale: parseBoolean(row["Updated numbers in New Sale"]),
            rexProcess: row["Rex Process"] || null,
            customerEmail: row["Cust Email"]?.trim() || null,
            newSalesRef: row["New Sales"] || null,
            revisionsRef: row["Revisions"] || null,
            cancellationsRef: row["Cancellations"] || null,
          },
        });

        results.imported++;
      } catch (error) {
        results.errors.push({
          row: i + 2,
          orderNumber,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        results.skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("POST /api/order-changes/import error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to import order changes" },
      { status: 500 }
    );
  }
}
