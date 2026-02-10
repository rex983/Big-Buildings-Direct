import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

interface CSVRow {
  "First Name [Required]": string;
  "Last Name [Required]": string;
  "Email Address [Required]": string;
  "Status [READ ONLY]": string;
  "Mobile Phone": string;
  "Work Phone": string;
  "Home Phone": string;
  "Recovery Phone [MUST BE IN THE E.164 FORMAT]": string;
}

// Service/department accounts to skip
const SERVICE_ACCOUNTS = new Set([
  "building projects",
  "cancellations department",
  "customer order",
  "customer customer",
  "developer k",
  "order processer",
  "revisions department",
  "sales big buildings",
  "success team",
  "support big buildings",
  "manufacture m",
  "christy c",
  "macedona big",
  "sabrina big buildings",
]);

function isServiceAccount(firstName: string, lastName: string, email: string): boolean {
  const fullName = `${firstName} ${lastName}`.toLowerCase();

  // Check against known service accounts
  if (SERVICE_ACCOUNTS.has(fullName)) return true;

  // Check for common patterns
  if (firstName.toLowerCase() === "customer" || lastName.toLowerCase() === "customer") return true;
  if (firstName.toLowerCase() === "department" || lastName.toLowerCase() === "department") return true;
  if (lastName.toLowerCase() === "big buildings") return true;
  if (lastName.length === 1 && lastName !== lastName.toLowerCase()) return true; // Single letter last name

  // Check email patterns
  const emailPrefix = email.split("@")[0].toLowerCase();
  const serviceEmails = ["orders", "sales", "support", "customer", "projects", "cancellations", "revisions", "manufacture", "successteam", "customerorders"];
  if (serviceEmails.includes(emailPrefix)) return true;

  return false;
}

function cleanPhone(phone: string): string | null {
  if (!phone) return null;
  // Remove non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned || null;
}

async function main() {
  const csvPath = process.argv[2] || "C:/Users/Redir/Downloads/User_Download_30012026_185154.csv";

  console.log(`Reading CSV from: ${csvPath}`);
  const content = fs.readFileSync(csvPath, "utf-8");

  const records: CSVRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  console.log(`Found ${records.length} total records`);

  // Get the Sales Rep role
  const salesRepRole = await prisma.role.findUnique({
    where: { name: "Sales Rep" },
  });

  if (!salesRepRole) {
    console.error("Sales Rep role not found. Run db:seed first.");
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash("changeme123", 12);

  let imported = 0;
  let skipped = 0;
  let alreadyExists = 0;

  for (const row of records) {
    const firstName = (row["First Name [Required]"] || "").trim();
    const lastName = (row["Last Name [Required]"] || "").trim();
    const email = (row["Email Address [Required]"] || "").trim().toLowerCase();
    const status = (row["Status [READ ONLY]"] || "").trim();

    // Skip invalid rows
    if (!firstName || !lastName || !email) {
      skipped++;
      continue;
    }

    // Skip suspended/inactive accounts
    if (status !== "Active") {
      console.log(`Skipping inactive user: ${firstName} ${lastName} (${email}) - Status: ${status}`);
      skipped++;
      continue;
    }

    // Skip service/department accounts
    if (isServiceAccount(firstName, lastName, email)) {
      console.log(`Skipping service account: ${firstName} ${lastName} (${email})`);
      skipped++;
      continue;
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      console.log(`User already exists: ${email}`);
      alreadyExists++;
      continue;
    }

    // Get phone number (try multiple fields)
    const phone = cleanPhone(row["Mobile Phone"])
      || cleanPhone(row["Recovery Phone [MUST BE IN THE E.164 FORMAT]"])
      || cleanPhone(row["Work Phone"])
      || cleanPhone(row["Home Phone"]);

    // Create user
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        roleId: salesRepRole.id,
        isActive: true,
      },
    });

    console.log(`Created user: ${firstName} ${lastName} (${email})`);
    imported++;
  }

  console.log("\n=== Import Complete ===");
  console.log(`Imported: ${imported}`);
  console.log(`Skipped (service accounts/inactive): ${skipped}`);
  console.log(`Already existed: ${alreadyExists}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
