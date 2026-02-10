import * as fs from "fs";

// CSV parsing helper
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n");
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

async function main() {
  const csvPath = "C:/Users/Redir/Downloads/Work Flow-All Sales.csv";
  const content = fs.readFileSync(csvPath, "utf-8");
  const records = parseCSV(content);

  console.log("=== CSV HEADERS ===");
  const headers = Object.keys(records[0]);
  headers.forEach((h, i) => console.log(`  ${i + 1}. ${h}`));

  console.log("\n=== TICKETING COLUMN ANALYSIS ===");
  const ticketingColumn = "Ticketing - Live Sept 1st";
  const ticketingValues = new Map<string, number>();

  records.forEach((r) => {
    const val = r[ticketingColumn] || "(empty)";
    ticketingValues.set(val, (ticketingValues.get(val) || 0) + 1);
  });

  // Sort by count
  const sorted = Array.from(ticketingValues.entries()).sort((a, b) => b[1] - a[1]);
  console.log("\nTicketing Status Distribution:");
  sorted.slice(0, 30).forEach(([val, count]) => {
    console.log(`  ${count.toString().padStart(6)} : ${val}`);
  });

  console.log("\n=== WC STATUS COLUMN ANALYSIS ===");
  const wcValues = new Map<string, number>();
  records.forEach((r) => {
    const val = r["WC Status"] || "(empty)";
    wcValues.set(val, (wcValues.get(val) || 0) + 1);
  });
  const wcSorted = Array.from(wcValues.entries()).sort((a, b) => b[1] - a[1]);
  console.log("\nWC Status Distribution:");
  wcSorted.forEach(([val, count]) => {
    console.log(`  ${count.toString().padStart(6)} : ${val}`);
  });

  console.log("\n=== LP&P STATUS COLUMN ANALYSIS ===");
  const lppValues = new Map<string, number>();
  records.forEach((r) => {
    const val = r["LP&P Status"] || "(empty)";
    lppValues.set(val, (lppValues.get(val) || 0) + 1);
  });
  const lppSorted = Array.from(lppValues.entries()).sort((a, b) => b[1] - a[1]);
  console.log("\nLP&P Status Distribution:");
  lppSorted.forEach(([val, count]) => {
    console.log(`  ${count.toString().padStart(6)} : ${val}`);
  });

  // Look for records with non-empty ticketing values
  console.log("\n=== SAMPLE RECORDS WITH TICKETING DATA ===");
  const withTicketing = records.filter(
    (r) =>
      r[ticketingColumn] &&
      (r[ticketingColumn].includes("Pending") ||
        r[ticketingColumn].includes("Contact") ||
        r[ticketingColumn].includes("Ready"))
  );
  console.log(`\nFound ${withTicketing.length} records with ticketing statuses`);
  withTicketing.slice(0, 10).forEach((r) => {
    console.log(`\n  Order: ${r["Order Number"]}`);
    console.log(`    WC Status: ${r["WC Status"]}`);
    console.log(`    LP&P Status: ${r["LP&P Status"]}`);
    console.log(`    Ticketing: ${r[ticketingColumn]}`);
  });

  // Check for any date/timestamp columns
  console.log("\n=== LOOKING FOR DATE COLUMNS ===");
  const dateColumns = headers.filter(
    (h) =>
      h.toLowerCase().includes("date") ||
      h.toLowerCase().includes("time") ||
      h.toLowerCase().includes("sold")
  );
  console.log("Date-related columns:", dateColumns);

  // Sample some records to see date formats
  if (dateColumns.length > 0) {
    console.log("\nSample date values:");
    records.slice(0, 5).forEach((r) => {
      dateColumns.forEach((col) => {
        if (r[col]) console.log(`  ${col}: ${r[col]}`);
      });
    });
  }

  // Check other columns that might be related to workflow
  console.log("\n=== OTHER WORKFLOW COLUMNS ===");
  console.log("\nSTM Column values:");
  const stmValues = new Map<string, number>();
  records.forEach((r) => {
    const val = r["STM"] || "(empty)";
    stmValues.set(val, (stmValues.get(val) || 0) + 1);
  });
  Array.from(stmValues.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([val, count]) => {
      console.log(`  ${count.toString().padStart(6)} : ${val}`);
    });

  console.log("\nOrder Change column values:");
  const ocValues = new Map<string, number>();
  records.forEach((r) => {
    const val = r["Order Change"] || "(empty)";
    ocValues.set(val, (ocValues.get(val) || 0) + 1);
  });
  Array.from(ocValues.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([val, count]) => {
      console.log(`  ${count.toString().padStart(6)} : ${val}`);
    });

  console.log("\nRevisions column values:");
  const revValues = new Map<string, number>();
  records.forEach((r) => {
    const val = r["Revisions"] || "(empty)";
    revValues.set(val, (revValues.get(val) || 0) + 1);
  });
  Array.from(revValues.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([val, count]) => {
      console.log(`  ${count.toString().padStart(6)} : ${val}`);
    });

  console.log("\nCancels column values:");
  const cancelValues = new Map<string, number>();
  records.forEach((r) => {
    const val = r["Cancels"] || "(empty)";
    cancelValues.set(val, (cancelValues.get(val) || 0) + 1);
  });
  Array.from(cancelValues.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([val, count]) => {
      console.log(`  ${count.toString().padStart(6)} : ${val}`);
    });

  console.log("\nCancellation (BST) column values:");
  const bstCancelValues = new Map<string, number>();
  records.forEach((r) => {
    const val = r["Cancellation (BST)"] || "(empty)";
    bstCancelValues.set(val, (bstCancelValues.get(val) || 0) + 1);
  });
  Array.from(bstCancelValues.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([val, count]) => {
      console.log(`  ${count.toString().padStart(6)} : ${val}`);
    });
}

main().catch(console.error);
