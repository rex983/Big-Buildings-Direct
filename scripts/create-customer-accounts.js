/**
 * Script to create customer user accounts from orders data
 * and link orders to their customer accounts.
 *
 * Usage: node scripts/create-customer-accounts.js [--limit N]
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Generic password for all customer accounts
const GENERIC_PASSWORD = 'Customer123!';

async function main() {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;

  console.log('=== Creating Customer Accounts ===\n');

  // Get the Customer role
  const customerRole = await prisma.role.findFirst({
    where: { name: 'Customer' },
  });

  if (!customerRole) {
    console.error('ERROR: Customer role not found!');
    process.exit(1);
  }

  console.log('Customer Role ID:', customerRole.id);

  // Get existing customer emails to avoid duplicates
  const existingCustomers = await prisma.user.findMany({
    where: { roleId: customerRole.id },
    select: { email: true },
  });
  const existingEmails = new Set(existingCustomers.map(u => u.email.toLowerCase()));
  console.log('Existing customer accounts:', existingEmails.size);

  // Get unique customers from orders (by email)
  // First get all distinct customer emails
  const allOrders = await prisma.order.findMany({
    select: {
      customerEmail: true,
      customerName: true,
      customerPhone: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Deduplicate by email in JavaScript
  const seenEmails = new Set();
  const orderCustomersQuery = allOrders.filter(o => {
    if (!o.customerEmail) return false;
    const email = o.customerEmail.toLowerCase();
    if (seenEmails.has(email)) return false;
    seenEmails.add(email);
    return true;
  }).slice(0, limit || allOrders.length);

  // Filter out existing customers and invalid emails
  const newCustomers = orderCustomersQuery.filter(o => {
    const email = o.customerEmail?.toLowerCase();
    if (!email || !email.includes('@')) return false;
    if (existingEmails.has(email)) return false;
    return true;
  });

  console.log('New customers to create:', newCustomers.length);
  if (limit) console.log('(Limited to', limit, ')');

  // Hash the generic password once
  const hashedPassword = await bcrypt.hash(GENERIC_PASSWORD, 12);

  // Create customer accounts in batches
  let created = 0;
  let errors = 0;
  const batchSize = 100;

  for (let i = 0; i < newCustomers.length; i += batchSize) {
    const batch = newCustomers.slice(i, i + batchSize);

    for (const customer of batch) {
      try {
        // Parse name into first/last
        const nameParts = (customer.customerName || 'Customer').split(' ');
        const firstName = nameParts[0] || 'Customer';
        const lastName = nameParts.slice(1).join(' ') || 'User';

        // Create the user
        const user = await prisma.user.create({
          data: {
            email: customer.customerEmail.toLowerCase(),
            password: hashedPassword,
            firstName: firstName.substring(0, 50), // Limit length
            lastName: lastName.substring(0, 50),
            phone: customer.customerPhone,
            roleId: customerRole.id,
            isActive: true,
          },
        });

        // Update all orders with this email to link to the customer
        // SQLite doesn't support case-insensitive mode, so we'll match exact email
        await prisma.order.updateMany({
          where: {
            customerEmail: customer.customerEmail,
            customerId: null,
          },
          data: {
            customerId: user.id,
          },
        });

        created++;
      } catch (err) {
        errors++;
        if (err.code !== 'P2002') { // Ignore unique constraint errors
          console.error('Error creating customer:', customer.customerEmail, err.message);
        }
      }
    }

    console.log(`Progress: ${Math.min(i + batchSize, newCustomers.length)}/${newCustomers.length}`);
  }

  console.log('\n=== Summary ===');
  console.log('Created:', created);
  console.log('Errors:', errors);
  console.log('\nGeneric password for all accounts:', GENERIC_PASSWORD);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
