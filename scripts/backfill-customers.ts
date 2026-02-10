import { PrismaClient } from "@prisma/client";
import { findOrCreateCustomer } from "../src/lib/customers";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Customer Backfill Script ===\n");

  // Fetch all orders where customerId is null and customerEmail is not empty
  const orders = await prisma.order.findMany({
    where: {
      customerId: null,
      customerEmail: { not: "" },
    },
    select: {
      id: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found ${orders.length} orders with no customerId\n`);

  if (orders.length === 0) {
    console.log("Nothing to backfill. All orders already have a customerId.");
    return;
  }

  // Group by lowercase email
  const emailGroups = new Map<
    string,
    { name: string; phone: string | null; orderIds: string[] }
  >();

  for (const order of orders) {
    const email = order.customerEmail.toLowerCase().trim();
    if (!emailGroups.has(email)) {
      // First entry is the most recent order (sorted desc) — use its name/phone
      emailGroups.set(email, {
        name: order.customerName,
        phone: order.customerPhone,
        orderIds: [],
      });
    }
    emailGroups.get(email)!.orderIds.push(order.id);
  }

  console.log(`Grouped into ${emailGroups.size} unique customer emails\n`);

  let ordersUpdated = 0;
  let customersCreated = 0;
  let customersMatched = 0;
  let errors = 0;

  for (const [email, group] of emailGroups) {
    try {
      // Check if this customer already exists before calling findOrCreate
      const existingBefore = await prisma.user.findFirst({
        where: { email, role: { name: "Customer" } },
        select: { id: true },
      });

      const customerId = await findOrCreateCustomer(
        email,
        group.name,
        group.phone
      );

      if (existingBefore) {
        customersMatched++;
      } else {
        customersCreated++;
      }

      // Link all orders for this email
      const result = await prisma.order.updateMany({
        where: {
          id: { in: group.orderIds },
          customerId: null,
        },
        data: { customerId },
      });

      ordersUpdated += result.count;

      if ((customersCreated + customersMatched) % 50 === 0) {
        console.log(
          `Progress: ${customersCreated + customersMatched}/${emailGroups.size} customers processed...`
        );
      }
    } catch (error) {
      errors++;
      console.error(`Error processing ${email}:`, error);
    }
  }

  console.log("\n=== Backfill Complete ===");
  console.log(`Orders updated:       ${ordersUpdated}`);
  console.log(`Customers created:    ${customersCreated}`);
  console.log(`Customers matched:    ${customersMatched}`);
  console.log(`Errors:               ${errors}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
