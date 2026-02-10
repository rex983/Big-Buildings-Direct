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

function analyzeColumn(records: Record<string, string>[], columnName: string, label: string, limit = 20) {
  console.log(`\n${label}:`);
  const values = new Map<string, number>();
  records.forEach((r) => {
    const val = r[columnName] || "(empty)";
    values.set(val, (values.get(val) || 0) + 1);
  });
  const sorted = Array.from(values.entries()).sort((a, b) => b[1] - a[1]);
  sorted.slice(0, limit).forEach(([val, count]) => {
    console.log(`  ${count.toString().padStart(6)} : ${val.substring(0, 80)}${val.length > 80 ? '...' : ''}`);
  });
  return values;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║              COMPLETE WORKFLOW SYSTEM ANALYSIS                     ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  // Analyze Work Flow CSV
  console.log("\n" + "=".repeat(70));
  console.log("WORK FLOW - ALL SALES (Main Orders Sheet)");
  console.log("=".repeat(70));

  const workflowPath = "C:/Users/Redir/Downloads/Work Flow-All Sales.csv";
  const workflowContent = fs.readFileSync(workflowPath, "utf-8");
  const workflowRecords = parseCSV(workflowContent);

  console.log(`\nTotal Records: ${workflowRecords.length}`);
  console.log("\nColumns:");
  Object.keys(workflowRecords[0]).forEach((h, i) => console.log(`  ${(i + 1).toString().padStart(2)}. ${h}`));

  // Analyze each workflow column
  analyzeColumn(workflowRecords, "STM", "STM (Sent to Manufacturer) Status");
  analyzeColumn(workflowRecords, "WC Status", "WC Status (Welcome Call)");
  analyzeColumn(workflowRecords, "LP&P Status", "LP&P Status (Land, Pad & Permit)");
  analyzeColumn(workflowRecords, "Installer", "Installer Distribution", 15);
  analyzeColumn(workflowRecords, "Foundation Type", "Foundation Types");
  analyzeColumn(workflowRecords, "State", "States", 15);

  // Analyze Order Change CSV
  console.log("\n\n" + "=".repeat(70));
  console.log("ORDER CHANGE - ALL DATA (Change Tracking Sheet)");
  console.log("=".repeat(70));

  const orderChangePath = "C:/Users/Redir/Downloads/Order Change-All Data.csv";
  const orderChangeContent = fs.readFileSync(orderChangePath, "utf-8");
  const orderChangeRecords = parseCSV(orderChangeContent);

  console.log(`\nTotal Records: ${orderChangeRecords.length}`);
  console.log("\nColumns:");
  Object.keys(orderChangeRecords[0]).forEach((h, i) => console.log(`  ${(i + 1).toString().padStart(2)}. ${h}`));

  // Analyze each order change column
  analyzeColumn(orderChangeRecords, "Change Type", "Change Types");
  analyzeColumn(orderChangeRecords, "Deposit Charged", "Deposit Charged Status");
  analyzeColumn(orderChangeRecords, "Sabrina Process", "Sabrina Process Status");
  analyzeColumn(orderChangeRecords, "Updated numbers in New Sale", "Updated in New Sale Status");
  analyzeColumn(orderChangeRecords, "Rex Process", "Rex Process Status");
  analyzeColumn(orderChangeRecords, "Manufacturer", "Manufacturers", 15);

  // Analyze date formats
  console.log("\n\n" + "=".repeat(70));
  console.log("DATE/TIMESTAMP ANALYSIS");
  console.log("=".repeat(70));

  console.log("\nSample Date of Change values:");
  orderChangeRecords.slice(0, 10).forEach((r) => {
    if (r["Date of Change"]) {
      console.log(`  ${r["Order Number"]}: ${r["Date of Change"]}`);
    }
  });

  console.log("\nSample Sold dates:");
  workflowRecords.slice(0, 10).forEach((r) => {
    if (r["Sold"]) {
      console.log(`  ${r["Order Number"]}: ${r["Sold"]}`);
    }
  });

  // Cross-reference analysis
  console.log("\n\n" + "=".repeat(70));
  console.log("WORKFLOW STAGE SUMMARY");
  console.log("=".repeat(70));

  // Calculate stage counts
  const stmYes = workflowRecords.filter(r => r["STM"]?.toLowerCase().includes("yes")).length;
  const stmNo = workflowRecords.filter(r => r["STM"]?.toLowerCase() === "no").length;
  const stmCancelled = workflowRecords.filter(r => r["STM"]?.toLowerCase().includes("cancel")).length;
  const stmPending = workflowRecords.filter(r => r["STM"]?.toLowerCase().includes("pending")).length;

  console.log("\nSTM Summary:");
  console.log(`  Sent (yes/yes rev): ${stmYes}`);
  console.log(`  Not Sent (no): ${stmNo}`);
  console.log(`  Cancelled: ${stmCancelled}`);
  console.log(`  Pending: ${stmPending}`);

  // WC Stage pipeline
  const wcNull = workflowRecords.filter(r => !r["WC Status"] || r["WC Status"] === "").length;
  const wcPending = workflowRecords.filter(r => r["WC Status"] === "Pending").length;
  const wcNoContact = workflowRecords.filter(r => r["WC Status"] === "No Contact Made").length;
  const wcContactMade = workflowRecords.filter(r => r["WC Status"] === "Contact Made").length;
  const wcContactMadeReady = workflowRecords.filter(r => r["WC Status"] === "Contact Made Ready For Install").length;

  console.log("\nWC Status Pipeline:");
  console.log(`  1. Not Started (null): ${wcNull}`);
  console.log(`  2. Pending: ${wcPending}`);
  console.log(`  3. No Contact Made: ${wcNoContact}`);
  console.log(`  4. Contact Made: ${wcContactMade}`);
  console.log(`  5. Contact Made Ready For Install: ${wcContactMadeReady}`);

  // LP&P Status
  const lppNull = workflowRecords.filter(r => !r["LP&P Status"] || r["LP&P Status"] === "").length;
  const lppPending = workflowRecords.filter(r => r["LP&P Status"] === "Pending").length;
  const lppReady = workflowRecords.filter(r => r["LP&P Status"] === "Ready for Install").length;

  console.log("\nLP&P Status Pipeline:");
  console.log(`  1. Not Started (null): ${lppNull}`);
  console.log(`  2. Pending: ${lppPending}`);
  console.log(`  3. Ready for Install: ${lppReady}`);

  // Change Type breakdown
  console.log("\n\n" + "=".repeat(70));
  console.log("ORDER CHANGE WORKFLOW");
  console.log("=".repeat(70));

  const changeTypes = new Map<string, number>();
  orderChangeRecords.forEach(r => {
    const type = r["Change Type"] || "(empty)";
    changeTypes.set(type, (changeTypes.get(type) || 0) + 1);
  });

  console.log("\nChange Type Distribution:");
  Array.from(changeTypes.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${count.toString().padStart(4)}: ${type}`);
    });

  // Deposit Charged status
  const depositStatuses = new Map<string, number>();
  orderChangeRecords.forEach(r => {
    const status = r["Deposit Charged"] || "(empty)";
    depositStatuses.set(status, (depositStatuses.get(status) || 0) + 1);
  });

  console.log("\nDeposit Charged Status Distribution:");
  Array.from(depositStatuses.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`  ${count.toString().padStart(4)}: ${status}`);
    });

  // Process completion analysis
  const sabrinaYes = orderChangeRecords.filter(r => r["Sabrina Process"]?.toLowerCase() === "yes").length;
  const sabrinaNo = orderChangeRecords.filter(r => !r["Sabrina Process"] || r["Sabrina Process"].toLowerCase() === "no").length;
  const newSaleYes = orderChangeRecords.filter(r => r["Updated numbers in New Sale"]?.toLowerCase() === "yes").length;
  const rexComplete = orderChangeRecords.filter(r => r["Rex Process"]?.toLowerCase() === "complete").length;

  console.log("\nProcess Completion:");
  console.log(`  Sabrina Process Complete: ${sabrinaYes} / ${orderChangeRecords.length}`);
  console.log(`  Updated in New Sale: ${newSaleYes} / ${orderChangeRecords.length}`);
  console.log(`  Rex Process Complete: ${rexComplete} / ${orderChangeRecords.length}`);
}

main().catch(console.error);
