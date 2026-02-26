import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('Reading CSV...');
  const csv = readFileSync('C:\\Users\\Redir\\Downloads\\Work Flow-All Sales.csv', 'utf-8');
  const records = parse(csv, { columns: true, skip_empty_lines: true, bom: true });
  console.log(`Total CSV rows: ${records.length}`);

  // Get admin user to use as ticket creator
  const adminUser = await prisma.user.findFirst({
    where: { role: { name: 'Admin' } },
  });
  if (!adminUser) {
    throw new Error('No admin user found');
  }
  console.log(`Using admin user: ${adminUser.firstName} ${adminUser.lastName} (${adminUser.id})`);

  // Get the current highest ticket number
  const lastTicket = await prisma.ticket.findFirst({
    orderBy: { ticketNumber: 'desc' },
  });
  let ticketCounter = lastTicket
    ? parseInt(lastTicket.ticketNumber.replace('TKT-', ''), 10)
    : 0;
  console.log(`Starting ticket counter at: ${ticketCounter}`);

  // Build a map of all orders by orderNumber for fast lookup
  console.log('Loading orders from database...');
  const allOrders = await prisma.order.findMany({
    select: { id: true, orderNumber: true },
  });
  const orderMap = new Map<string, string>();
  for (const o of allOrders) {
    orderMap.set(o.orderNumber, o.id);
  }
  console.log(`Loaded ${orderMap.size} orders`);

  // Filter CSV rows that have ticketing data
  const ticketRows = records.filter((r: any) => (r['Ticketing - Live Sept 1st'] || '').trim());
  console.log(`Rows with ticketing data: ${ticketRows.length}`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches to avoid overwhelming the DB
  const BATCH_SIZE = 100;

  for (let i = 0; i < ticketRows.length; i += BATCH_SIZE) {
    const batch = ticketRows.slice(i, i + BATCH_SIZE);
    const ticketCreateData: any[] = [];
    const activityCreateData: any[] = [];

    for (const row of batch as Record<string, string>[]) {
      const orderNumber = (row['Order Number'] || '').trim();
      const ticketingName = (row['Ticketing - Live Sept 1st'] || '').trim();
      const wcStatus = (row['WC Status'] || '').trim();
      const lppStatus = (row['LP&P Status'] || '').trim();
      const orderChange = (row['Order Change'] || '').trim();
      const revisions = (row['Revisions'] || '').trim();
      const cancels = (row['Cancels'] || '').trim();
      const cancelBst = (row['Cancellation (BST)'] || '').trim();
      const salesRep = (row['Sales Rep'] || '').trim();
      const installer = (row['Installer'] || '').trim();
      const foundationType = (row['Foundation Type'] || '').trim();
      const address = (row['Building Address'] || '').trim();
      const state = (row['State'] || '').trim();
      const phone = (row['Customer Phone Number'] || '').trim();
      const email = (row['Customer Email'] || '').trim();
      const zip = (row['Building Zip'] || '').trim();
      const soldDate = (row['Sold'] || '').trim();
      const stm = (row['STM'] || '').trim();
      const attachments = (row['Attachments'] || '').trim();

      const orderId = orderMap.get(orderNumber);
      if (!orderId) {
        skipped++;
        continue;
      }

      ticketCounter++;
      const ticketNumber = `TKT-${String(ticketCounter).padStart(5, '0')}`;

      // Determine ticket type based on available data
      let type = 'OTHER';
      if (wcStatus === 'No Contact Made' || wcStatus === 'Pending') {
        type = 'WELCOME_CALL';
      } else if (lppStatus === 'Pending') {
        type = 'LPP';
      } else if (orderChange) {
        type = 'BUILDING_UPDATE';
      } else if (revisions) {
        type = 'BUILDING_UPDATE';
      }

      // Determine priority
      let priority = 'NORMAL';
      if (cancels) {
        priority = 'URGENT';
      } else if (wcStatus === 'No Contact Made') {
        priority = 'HIGH';
      } else if (orderChange) {
        priority = 'HIGH';
      }

      // Determine status
      let status = 'OPEN';
      if (wcStatus === 'Contact Made' && lppStatus === 'Ready for Install') {
        status = 'RESOLVED';
      } else if (wcStatus === 'Contact Made') {
        status = 'IN_PROGRESS';
      } else if (cancels) {
        status = 'CLOSED';
      }

      // Build subject
      const subject = `${ticketingName} - Order #${orderNumber}`;

      // Build description with all CSV info
      const descParts: string[] = [];
      descParts.push(`Customer: ${ticketingName}`);
      descParts.push(`Order Number: ${orderNumber}`);
      if (soldDate) descParts.push(`Date Sold: ${soldDate}`);
      if (salesRep) descParts.push(`Sales Rep: ${salesRep}`);
      if (address) descParts.push(`Building Address: ${address}`);
      if (state) descParts.push(`State: ${state}`);
      if (zip) descParts.push(`Building Zip: ${zip}`);
      if (installer) descParts.push(`Installer: ${installer}`);
      if (foundationType) descParts.push(`Foundation Type: ${foundationType}`);
      if (stm) descParts.push(`STM: ${stm}`);
      if (wcStatus) descParts.push(`WC Status: ${wcStatus}`);
      if (lppStatus) descParts.push(`LP&P Status: ${lppStatus}`);
      if (orderChange) descParts.push(`Order Change: ${orderChange}`);
      if (revisions) descParts.push(`Revisions: ${revisions}`);
      if (cancels) descParts.push(`Cancels: ${cancels}`);
      if (cancelBst) descParts.push(`Cancellation (BST): ${cancelBst}`);
      if (phone) descParts.push(`Customer Phone: ${phone}`);
      if (email) descParts.push(`Customer Email: ${email}`);
      if (attachments) descParts.push(`Attachments: ${attachments}`);

      const description = descParts.join('\n');

      // Resolution text for resolved/closed
      let resolution: string | null = null;
      let resolvedAt: Date | null = null;
      let closedAt: Date | null = null;

      if (status === 'RESOLVED') {
        resolution = `WC Status: ${wcStatus}, LP&P Status: ${lppStatus}`;
        resolvedAt = new Date();
      } else if (status === 'CLOSED') {
        resolution = cancels ? `Cancelled - Order(s): ${cancels}` : 'Closed';
        closedAt = new Date();
      }

      const ticketId = `tkt-import-${orderNumber}-${ticketCounter}`;

      ticketCreateData.push({
        id: ticketId,
        ticketNumber,
        subject,
        description,
        type,
        status,
        priority,
        resolution,
        resolvedAt,
        closedAt,
        orderId,
        createdById: adminUser.id,
      });

      activityCreateData.push({
        action: 'CREATED',
        description: `Ticket created from CSV import - ${ticketingName}`,
        metadata: JSON.stringify({
          source: 'csv-import',
          csvFile: 'Work Flow-All Sales.csv',
          type,
          priority,
          wcStatus,
          lppStatus,
        }),
        ticketId,
        userId: adminUser.id,
      });
    }

    // Bulk create tickets
    if (ticketCreateData.length > 0) {
      try {
        await prisma.$transaction(async (tx) => {
          for (const ticket of ticketCreateData) {
            await tx.ticket.create({ data: ticket });
          }
          for (const activity of activityCreateData) {
            await tx.ticketActivity.create({ data: activity });
          }
        });
        created += ticketCreateData.length;
      } catch (err: any) {
        console.error(`Error in batch starting at index ${i}:`, err.message);
        errors += ticketCreateData.length;
      }
    }

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= ticketRows.length) {
      console.log(`Progress: ${Math.min(i + BATCH_SIZE, ticketRows.length)}/${ticketRows.length} | Created: ${created} | Skipped: ${skipped} | Errors: ${errors}`);
    }
  }

  console.log('\n=== Import Complete ===');
  console.log(`Total created: ${created}`);
  console.log(`Total skipped (no matching order): ${skipped}`);
  console.log(`Total errors: ${errors}`);

  // Verify
  const totalTickets = await prisma.ticket.count();
  console.log(`Total tickets in database: ${totalTickets}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
