import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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

    // Batch-load existing order changes for duplicate detection
    const orderIds = [...new Set([...orderMap.values()])];
    const existingChanges = orderIds.length > 0
      ? await prisma.orderChange.findMany({
          where: { orderId: { in: orderIds } },
          select: { orderId: true, changeDate: true, additionalNotes: true },
        })
      : [];

    // Build a Set of "orderId|changeDate|notes" keys for O(1) duplicate lookup
    const existingKeys = new Set(
      existingChanges.map(
        (c) => `${c.orderId}|${c.changeDate.toISOString()}|${c.additionalNotes ?? ""}`
      )
    );

    const results = {
      total: rows.length,
      imported: 0,
      skipped: 0,
      errors: [] as { row: number; orderNumber: string; error: string }[],
    };

    // Prepare all valid creates, then batch them
    const toCreate: Prisma.OrderChangeCreateManyInput[] = [];
    const rowMeta: { row: number; orderNumber: string }[] = [];

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
          row: i + 2,
          orderNumber,
          error: `Order #${orderNumber} not found`,
        });
        results.skipped++;
        continue;
      }

      const salesRepName = row["Sales rep"]?.toLowerCase();
      const salesRepId = salesRepName ? userMap.get(salesRepName) : null;

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

      // Check duplicate using in-memory Set
      const notes = row["Additional Notes"] || null;
      const key = `${orderId}|${changeDate.toISOString()}|${notes ?? ""}`;
      if (existingKeys.has(key)) {
        results.skipped++;
        continue;
      }

      // Mark as seen to prevent duplicates within the same import
      existingKeys.add(key);

      toCreate.push({
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
        additionalNotes: notes,
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
      });
      rowMeta.push({ row: i + 2, orderNumber });
    }

    // Batch create in chunks of 50 to avoid SQLite variable limits
    const chunkSize = 50;
    for (let i = 0; i < toCreate.length; i += chunkSize) {
      const chunk = toCreate.slice(i, i + chunkSize);
      try {
        await prisma.orderChange.createMany({ data: chunk });
        results.imported += chunk.length;
      } catch (error) {
        // If batch fails, fall back to individual creates for this chunk
        for (let j = 0; j < chunk.length; j++) {
          try {
            await prisma.orderChange.create({ data: chunk[j] });
            results.imported++;
          } catch (innerError) {
            const meta = rowMeta[i + j];
            results.errors.push({
              row: meta.row,
              orderNumber: meta.orderNumber,
              error: innerError instanceof Error ? innerError.message : "Unknown error",
            });
            results.skipped++;
          }
        }
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
