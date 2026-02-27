import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";

// ── Load .env ────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, "../.env");
for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
  const m = line.match(/^([^#=\s]+)\s*=\s*["']?(.*?)["']?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── CSV column interface ─────────────────────────────────────────────
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

// ── Helpers ──────────────────────────────────────────────────────────

function parseDate(dateStr: string): string | null {
  if (!dateStr?.trim()) return null;
  const parts = dateStr.trim().split(" ")[0].split("/");
  if (parts.length !== 3) return null;
  const [month, day, year] = parts.map(Number);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  return new Date(year, month - 1, day).toISOString();
}

function parseMoney(s: string): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function isYes(s: string): boolean {
  return (s || "").trim().toLowerCase() === "yes";
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) {
    return { firstName: "Unknown", lastName: "" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function deriveStatus(row: CSVRow): string {
  const on = row.ON?.trim();
  if (row.Cancellations?.includes(on)) return "cancelled";
  if (isYes(row["Sent To Man"])) return "ready_for_manufacturer";
  if (isYes(row.Signed)) return "signed";
  if (isYes(row["Sent To Cust"])) return "sent_for_signature";
  const dc = (row["Deposit Charge"] || "").toLowerCase();
  if (dc.startsWith("accepted")) return "pending_payment";
  return "draft";
}

function derivePaymentStatus(depositCharge: string): string {
  const dc = (depositCharge || "").toLowerCase().trim();
  if (dc.startsWith("accepted")) return "paid";
  if (dc.includes("declined")) return "failed";
  return "pending";
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const csvPath =
    process.argv[2] || "C:/Users/Redir/Downloads/New Sales-2026.csv";

  console.log(`Reading CSV from: ${csvPath}`);
  const content = fs.readFileSync(csvPath, "utf-8");

  const records: CSVRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
  });

  // Only rows with numeric order numbers
  const validRecords = records.filter((r) => /^\d+$/.test((r.ON || "").trim()));
  console.log(
    `Found ${records.length} CSV rows, ${validRecords.length} with valid order numbers`
  );

  // Fetch existing order numbers from Supabase to skip duplicates
  console.log("Fetching existing order numbers from Supabase...");
  const existingSet = new Set<string>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("orders")
      .select("order_number")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to fetch existing orders: ${error.message}`);
    for (const r of data || []) existingSet.add(r.order_number);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`${existingSet.size} orders already in database`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const batchSize = 50;

  for (let i = 0; i < validRecords.length; i += batchSize) {
    const batch = validRecords.slice(i, i + batchSize);
    const inserts: Record<string, unknown>[] = [];

    for (const row of batch) {
      const orderNumber = row.ON.trim();

      // Skip duplicates (from DB or within this CSV)
      if (existingSet.has(orderNumber)) {
        skipped++;
        continue;
      }
      existingSet.add(orderNumber);

      const status = deriveStatus(row);
      const { firstName, lastName } = splitName(row["Order Form Name"]);
      const createdAt = parseDate(row["Date Sold"]) || new Date().toISOString();
      const depositAccepted = (row["Deposit Charge"] || "")
        .toLowerCase()
        .startsWith("accepted");
      const isCancelled = status === "cancelled";

      const sentForSig = [
        "sent_for_signature",
        "signed",
        "ready_for_manufacturer",
      ].includes(status);
      const signed = ["signed", "ready_for_manufacturer"].includes(status);
      const readyForMfr = status === "ready_for_manufacturer";

      inserts.push({
        order_number: orderNumber,
        status,
        customer: {
          firstName,
          lastName,
          email: (row["Customer Email"] || "").trim(),
          phone: "",
          state: (row.State || "").trim(),
          deliveryAddress: "",
          city: "",
          zip: "",
        },
        building: {
          manufacturer: (row.Installer || "").trim(),
          buildingType: "Metal Building",
          overallWidth: "",
          buildingLength: "",
          baseRailLength: "",
          buildingHeight: "",
          lullLiftRequired: false,
          foundationType: "",
          permittingStructure: "",
          drawingType: "",
          customerLandIsReady: false,
        },
        pricing: {
          subtotalBeforeTax: parseMoney(row["Order Total"]),
          extraMoneyFluff: 0,
          deposit: parseMoney(row.Deposit),
        },
        payment: {
          type: "credit_card",
          status: derivePaymentStatus(row["Deposit Charge"]),
        },
        files: { renderings: [], extraFiles: [], installerFiles: [] },
        sales_person: (row["Sales Rep"] || "").trim(),
        order_form_name: (row["Order Form Name"] || "").trim(),
        special_notes: (row["Special Notes"] || "").trim(),
        payment_notes: (row["Payment Notes"] || "").trim(),
        referred_by: "",
        created_by: "00000000-0000-0000-0000-000000000000",
        is_test_mode: false,
        needs_manager_approval: false,
        needs_payment_approval: false,
        needs_audit: false,
        created_at: createdAt,
        updated_at: createdAt,
        ...(depositAccepted && { paid_at: createdAt }),
        ...(sentForSig && { sent_for_signature_at: createdAt }),
        ...(signed && { signed_at: createdAt }),
        ...(readyForMfr && { ready_for_manufacturer_at: createdAt }),
        ...(isCancelled && {
          cancelled_at: createdAt,
          cancel_reason: "Imported as cancelled",
        }),
      });
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from("orders").insert(inserts);
      if (error) {
        console.error(`Batch error at row ${i}:`, error.message);
        // Fall back to individual inserts
        for (const row of inserts) {
          const { error: singleErr } = await supabase
            .from("orders")
            .insert(row);
          if (singleErr) {
            console.error(
              `  Error inserting ${row.order_number}:`,
              singleErr.message
            );
            errors++;
          } else {
            imported++;
          }
        }
      } else {
        imported += inserts.length;
      }
    }

    if ((i + batchSize) % 500 < batchSize) {
      console.log(
        `Progress: ${Math.min(i + batchSize, validRecords.length)}/${validRecords.length} processed...`
      );
    }
  }

  console.log("\n=== Import Complete ===");
  console.log(`Imported: ${imported}`);
  console.log(`Skipped (already exists): ${skipped}`);
  console.log(`Errors: ${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
