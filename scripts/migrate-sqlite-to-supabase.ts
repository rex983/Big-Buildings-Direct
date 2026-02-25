/**
 * Migrate all data from SQLite (prisma/dev.db) → Supabase PostgreSQL.
 *
 * Reads every table from the old SQLite database using better-sqlite3 and
 * inserts the rows into PostgreSQL via Prisma, respecting foreign-key order.
 *
 * Run with:  npx tsx scripts/migrate-sqlite-to-supabase.ts
 */

import Database from "better-sqlite3";
import { PrismaClient, Prisma } from "@prisma/client";

const SQLITE_PATH = "prisma/dev.db";
const BATCH_SIZE = 500;

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const prisma = new PrismaClient();

// ── helpers ───────────────────────────────────────────────────────────

function readAll<T>(table: string): T[] {
  return sqlite.prepare(`SELECT * FROM "${table}"`).all() as T[];
}

/** SQLite stores booleans as 0/1 integers */
function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  return v === 1 || v === "1" || v === true;
}

/** SQLite stores datetimes as ISO strings (or epoch ms). Return Date | null. */
function dt(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? null : d;
}

/** Convert to Prisma Decimal or null */
function dec(v: unknown): Prisma.Decimal | null {
  if (v == null || v === "") return null;
  return new Prisma.Decimal(String(v));
}

/** Required decimal — fallback to 0 */
function decReq(v: unknown): Prisma.Decimal {
  if (v == null || v === "") return new Prisma.Decimal("0");
  return new Prisma.Decimal(String(v));
}

function str(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

/** Batch an array into chunks */
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ── main ──────────────────────────────────────────────────────────────

async function main() {
  console.log("=== SQLite → Supabase Migration ===\n");

  // ─── 1. Clear existing seeded data (reverse FK order) ───────────────
  console.log("Clearing existing Supabase data...");
  // Use raw SQL to truncate in dependency order with CASCADE
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "PayAuditLog",
      "OfficePayPlanTier",
      "OfficePayPlan",
      "PayPlanLineItem",
      "PayLedger",
      "PayPlan",
      "TicketFile",
      "TicketActivity",
      "TicketNote",
      "Ticket",
      "RevisionFile",
      "OrderChange",
      "Revision",
      "Email",
      "Message",
      "Document",
      "OrderFile",
      "File",
      "OrderActivity",
      "OrderStageHistory",
      "Order",
      "OrderStage",
      "PasswordResetToken",
      "RolePermission",
      "User",
      "Permission",
      "Role",
      "Manufacturer"
    CASCADE
  `);
  console.log("  ✓ Cleared\n");

  // ─── 2. Roles ──────────────────────────────────────────────────────
  const roles = readAll<any>("Role");
  console.log(`Migrating Role (${roles.length})...`);
  await prisma.role.createMany({
    data: roles.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: str(r.description),
      isSystem: bool(r.isSystem),
      createdAt: dt(r.createdAt)!,
      updatedAt: dt(r.updatedAt)!,
    })),
  });
  console.log("  ✓ Role");

  // ─── 3. Permissions ────────────────────────────────────────────────
  const permissions = readAll<any>("Permission");
  console.log(`Migrating Permission (${permissions.length})...`);
  await prisma.permission.createMany({
    data: permissions.map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: str(p.description),
      createdAt: dt(p.createdAt)!,
    })),
  });
  console.log("  ✓ Permission");

  // ─── 4. RolePermission ────────────────────────────────────────────
  const rolePermissions = readAll<any>("RolePermission");
  console.log(`Migrating RolePermission (${rolePermissions.length})...`);
  await prisma.rolePermission.createMany({
    data: rolePermissions.map((rp: any) => ({
      roleId: rp.roleId,
      permissionId: rp.permissionId,
      createdAt: dt(rp.createdAt)!,
    })),
  });
  console.log("  ✓ RolePermission");

  // ─── 5. OrderStage ────────────────────────────────────────────────
  const stages = readAll<any>("OrderStage");
  console.log(`Migrating OrderStage (${stages.length})...`);
  await prisma.orderStage.createMany({
    data: stages.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: str(s.description),
      sortOrder: s.sortOrder,
      color: s.color,
      isDefault: bool(s.isDefault),
      isFinal: bool(s.isFinal),
      isActive: bool(s.isActive),
      createdAt: dt(s.createdAt)!,
      updatedAt: dt(s.updatedAt)!,
    })),
  });
  console.log("  ✓ OrderStage");

  // ─── 6. User ──────────────────────────────────────────────────────
  const users = readAll<any>("User");
  console.log(`Migrating User (${users.length})...`);
  for (const batch of chunk(users, BATCH_SIZE)) {
    await prisma.user.createMany({
      data: batch.map((u: any) => ({
        id: u.id,
        email: u.email,
        password: u.password,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: str(u.phone),
        avatar: str(u.avatar),
        office: str(u.office),
        department: str(u.department),
        isActive: bool(u.isActive),
        emailVerified: dt(u.emailVerified),
        createdAt: dt(u.createdAt)!,
        updatedAt: dt(u.updatedAt)!,
        roleId: u.roleId,
      })),
    });
  }
  console.log("  ✓ User");

  // ─── 7. Manufacturer ──────────────────────────────────────────────
  const manufacturers = readAll<any>("Manufacturer");
  if (manufacturers.length > 0) {
    console.log(`Migrating Manufacturer (${manufacturers.length})...`);
    await prisma.manufacturer.createMany({
      data: manufacturers.map((m: any) => ({
        id: m.id,
        name: m.name,
        isActive: bool(m.isActive),
        createdAt: dt(m.createdAt)!,
        updatedAt: dt(m.updatedAt)!,
      })),
    });
    console.log("  ✓ Manufacturer");
  }

  // ─── 8. Order ─────────────────────────────────────────────────────
  const orders = readAll<any>("Order");
  console.log(`Migrating Order (${orders.length})...`);
  let orderBatch = 0;
  for (const batch of chunk(orders, BATCH_SIZE)) {
    orderBatch++;
    await prisma.order.createMany({
      data: batch.map((o: any) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        customerPhone: str(o.customerPhone),
        buildingType: o.buildingType,
        buildingSize: o.buildingSize,
        buildingWidth: str(o.buildingWidth),
        buildingLength: str(o.buildingLength),
        buildingHeight: str(o.buildingHeight),
        buildingColor: str(o.buildingColor),
        buildingOptions: str(o.buildingOptions),
        foundationType: str(o.foundationType),
        lullLiftRequired: bool(o.lullLiftRequired),
        deliveryAddress: o.deliveryAddress,
        deliveryCity: o.deliveryCity,
        deliveryState: o.deliveryState,
        deliveryZip: o.deliveryZip,
        deliveryNotes: str(o.deliveryNotes),
        permitStructure: str(o.permitStructure),
        customerReadyStatus: str(o.customerReadyStatus),
        permitType: str(o.permitType),
        installer: str(o.installer),
        totalPrice: decReq(o.totalPrice),
        depositAmount: decReq(o.depositAmount),
        depositCollected: bool(o.depositCollected),
        depositDate: dt(o.depositDate),
        depositChargeStatus: str(o.depositChargeStatus),
        depositPercentage: str(o.depositPercentage),
        depositNotes: str(o.depositNotes),
        status: o.status,
        priority: o.priority,
        sentToCustomer: bool(o.sentToCustomer),
        sentToCustomerDate: dt(o.sentToCustomerDate),
        customerSigned: bool(o.customerSigned),
        customerSignedDate: dt(o.customerSignedDate),
        sentToManufacturer: bool(o.sentToManufacturer),
        sentToManufacturerDate: dt(o.sentToManufacturerDate),
        wcStatus: str(o.wcStatus),
        wcStatusDate: dt(o.wcStatusDate),
        lppStatus: str(o.lppStatus),
        lppStatusDate: dt(o.lppStatusDate),
        submittedFormsUrl: str(o.submittedFormsUrl),
        sabrinaFormsUrl: str(o.sabrinaFormsUrl),
        specialNotes: str(o.specialNotes),
        paymentNotes: str(o.paymentNotes),
        revisionOf: str(o.revisionOf),
        dateSold: dt(o.dateSold),
        createdAt: dt(o.createdAt)!,
        updatedAt: dt(o.updatedAt)!,
        completedAt: dt(o.completedAt),
        cancelledAt: dt(o.cancelledAt),
        cancelReason: str(o.cancelReason),
        customerId: str(o.customerId),
        salesRepId: str(o.salesRepId),
        currentStageId: str(o.currentStageId),
      })),
    });
    process.stdout.write(`  batch ${orderBatch}/${Math.ceil(orders.length / BATCH_SIZE)}\r`);
  }
  console.log(`  ✓ Order (${orders.length})`);

  // ─── 9. OrderStageHistory ─────────────────────────────────────────
  const stageHistory = readAll<any>("OrderStageHistory");
  if (stageHistory.length > 0) {
    console.log(`Migrating OrderStageHistory (${stageHistory.length})...`);
    await prisma.orderStageHistory.createMany({
      data: stageHistory.map((h: any) => ({
        id: h.id,
        notes: str(h.notes),
        createdAt: dt(h.createdAt)!,
        orderId: h.orderId,
        stageId: h.stageId,
        changedById: str(h.changedById),
      })),
    });
    console.log("  ✓ OrderStageHistory");
  }

  // ─── 10. OrderActivity ────────────────────────────────────────────
  const activities = readAll<any>("OrderActivity");
  if (activities.length > 0) {
    console.log(`Migrating OrderActivity (${activities.length})...`);
    await prisma.orderActivity.createMany({
      data: activities.map((a: any) => ({
        id: a.id,
        type: a.type,
        description: a.description,
        metadata: str(a.metadata),
        createdAt: dt(a.createdAt)!,
        orderId: a.orderId,
        userId: str(a.userId),
      })),
    });
    console.log("  ✓ OrderActivity");
  }

  // ─── 11. File ─────────────────────────────────────────────────────
  const files = readAll<any>("File");
  if (files.length > 0) {
    console.log(`Migrating File (${files.length})...`);
    await prisma.file.createMany({
      data: files.map((f: any) => ({
        id: f.id,
        filename: f.filename,
        storagePath: f.storagePath,
        mimeType: f.mimeType,
        size: f.size,
        category: f.category,
        description: str(f.description),
        createdAt: dt(f.createdAt)!,
        uploadedById: f.uploadedById,
      })),
    });
    console.log("  ✓ File");
  }

  // ─── 12. OrderFile ────────────────────────────────────────────────
  const orderFiles = readAll<any>("OrderFile");
  if (orderFiles.length > 0) {
    console.log(`Migrating OrderFile (${orderFiles.length})...`);
    await prisma.orderFile.createMany({
      data: orderFiles.map((of: any) => ({
        orderId: of.orderId,
        fileId: of.fileId,
        createdAt: dt(of.createdAt)!,
      })),
    });
    console.log("  ✓ OrderFile");
  }

  // ─── 13. Revision ────────────────────────────────────────────────
  const revisions = readAll<any>("Revision");
  console.log(`Migrating Revision (${revisions.length})...`);
  let revBatch = 0;
  for (const batch of chunk(revisions, BATCH_SIZE)) {
    revBatch++;
    await prisma.revision.createMany({
      data: batch.map((r: any) => ({
        id: r.id,
        revisionNumber: r.revisionNumber,
        revisionDate: dt(r.revisionDate)!,
        changeInPrice: str(r.changeInPrice),
        oldOrderTotal: dec(r.oldOrderTotal),
        newOrderTotal: dec(r.newOrderTotal),
        oldDepositTotal: dec(r.oldDepositTotal),
        newDepositTotal: dec(r.newDepositTotal),
        orderTotalDiff: dec(r.orderTotalDiff),
        depositDiff: dec(r.depositDiff),
        revisionFee: dec(r.revisionFee),
        totalCharge: dec(r.totalCharge),
        orderFormName: str(r.orderFormName),
        customerEmail: str(r.customerEmail),
        changingManufacturer: bool(r.changingManufacturer),
        originalManufacturer: str(r.originalManufacturer),
        newManufacturer: str(r.newManufacturer),
        newManufacturerEmail: str(r.newManufacturerEmail),
        sentToCustomer: bool(r.sentToCustomer),
        customerSigned: bool(r.customerSigned),
        sentToManufacturer: bool(r.sentToManufacturer),
        lastEditedSTC: dt(r.lastEditedSTC),
        lastEditedSigned: dt(r.lastEditedSigned),
        lastEditedSTM: dt(r.lastEditedSTM),
        lastUpdateDepOT: dt(r.lastUpdateDepOT),
        formsSubmittedUrl: str(r.formsSubmittedUrl),
        sabrinaFormsUrl: str(r.sabrinaFormsUrl),
        revisionNotes: str(r.revisionNotes),
        repNotes: str(r.repNotes),
        depositCharge: str(r.depositCharge),
        paymentMethod: str(r.paymentMethod),
        createdAt: dt(r.createdAt)!,
        updatedAt: dt(r.updatedAt)!,
        orderId: r.orderId,
        salesRepId: str(r.salesRepId),
      })),
    });
    process.stdout.write(`  batch ${revBatch}/${Math.ceil(revisions.length / BATCH_SIZE)}\r`);
  }
  console.log(`  ✓ Revision (${revisions.length})`);

  // ─── 14. RevisionFile ─────────────────────────────────────────────
  const revisionFiles = readAll<any>("RevisionFile");
  if (revisionFiles.length > 0) {
    console.log(`Migrating RevisionFile (${revisionFiles.length})...`);
    await prisma.revisionFile.createMany({
      data: revisionFiles.map((rf: any) => ({
        id: rf.id,
        revisionId: rf.revisionId,
        fileId: rf.fileId,
        createdAt: dt(rf.createdAt)!,
      })),
    });
    console.log("  ✓ RevisionFile");
  }

  // ─── 15. OrderChange ──────────────────────────────────────────────
  const orderChanges = readAll<any>("OrderChange");
  console.log(`Migrating OrderChange (${orderChanges.length})...`);
  await prisma.orderChange.createMany({
    data: orderChanges.map((oc: any) => ({
      id: oc.id,
      changeDate: dt(oc.changeDate)!,
      oldOrderTotal: dec(oc.oldOrderTotal),
      newOrderTotal: dec(oc.newOrderTotal),
      oldDepositTotal: dec(oc.oldDepositTotal),
      newDepositTotal: dec(oc.newDepositTotal),
      orderTotalDiff: dec(oc.orderTotalDiff),
      depositDiff: dec(oc.depositDiff),
      orderFormName: str(oc.orderFormName),
      manufacturer: str(oc.manufacturer),
      customerEmail: str(oc.customerEmail),
      changeType: str(oc.changeType),
      additionalNotes: str(oc.additionalNotes),
      uploadsUrl: str(oc.uploadsUrl),
      depositCharged: str(oc.depositCharged),
      sabrinaProcess: bool(oc.sabrinaProcess),
      updatedInNewSale: bool(oc.updatedInNewSale),
      rexProcess: str(oc.rexProcess),
      newSalesRef: str(oc.newSalesRef),
      revisionsRef: str(oc.revisionsRef),
      cancellationsRef: str(oc.cancellationsRef),
      createdAt: dt(oc.createdAt)!,
      updatedAt: dt(oc.updatedAt)!,
      orderId: oc.orderId,
      salesRepId: str(oc.salesRepId),
    })),
  });
  console.log("  ✓ OrderChange");

  // ─── 16. Document ─────────────────────────────────────────────────
  const documents = readAll<any>("Document");
  if (documents.length > 0) {
    console.log(`Migrating Document (${documents.length})...`);
    await prisma.document.createMany({
      data: documents.map((d: any) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        sentAt: dt(d.sentAt),
        viewedAt: dt(d.viewedAt),
        signedAt: dt(d.signedAt),
        signerIp: str(d.signerIp),
        signerAgent: str(d.signerAgent),
        signatureData: str(d.signatureData),
        createdAt: dt(d.createdAt)!,
        updatedAt: dt(d.updatedAt)!,
        fileId: d.fileId,
        orderId: d.orderId,
        createdById: d.createdById,
        signedById: str(d.signedById),
        signingToken: str(d.signingToken),
      })),
    });
    console.log("  ✓ Document");
  }

  // ─── 17. Message ──────────────────────────────────────────────────
  // Messages have self-referential parentId — insert parents first, then children
  const messages = readAll<any>("Message");
  if (messages.length > 0) {
    console.log(`Migrating Message (${messages.length})...`);
    const parents = messages.filter((m: any) => !m.parentId);
    const children = messages.filter((m: any) => m.parentId);
    const mapMsg = (m: any) => ({
      id: m.id,
      content: m.content,
      isInternal: bool(m.isInternal),
      isRead: bool(m.isRead),
      createdAt: dt(m.createdAt)!,
      updatedAt: dt(m.updatedAt)!,
      orderId: m.orderId,
      senderId: m.senderId,
      parentId: str(m.parentId),
    });
    if (parents.length > 0) {
      await prisma.message.createMany({ data: parents.map(mapMsg) });
    }
    if (children.length > 0) {
      await prisma.message.createMany({ data: children.map(mapMsg) });
    }
    console.log("  ✓ Message");
  }

  // ─── 18. Email ────────────────────────────────────────────────────
  const emails = readAll<any>("Email");
  if (emails.length > 0) {
    console.log(`Migrating Email (${emails.length})...`);
    await prisma.email.createMany({
      data: emails.map((e: any) => ({
        id: e.id,
        subject: e.subject,
        body: e.body,
        toAddress: e.toAddress,
        fromAddress: e.fromAddress,
        status: e.status,
        sentAt: dt(e.sentAt),
        deliveredAt: dt(e.deliveredAt),
        openedAt: dt(e.openedAt),
        failedAt: dt(e.failedAt),
        failReason: str(e.failReason),
        externalId: str(e.externalId),
        direction: e.direction,
        createdAt: dt(e.createdAt)!,
        orderId: str(e.orderId),
        sentById: str(e.sentById),
      })),
    });
    console.log("  ✓ Email");
  }

  // ─── 19. Ticket ───────────────────────────────────────────────────
  const tickets = readAll<any>("Ticket");
  console.log(`Migrating Ticket (${tickets.length})...`);
  let ticketBatch = 0;
  for (const batch of chunk(tickets, BATCH_SIZE)) {
    ticketBatch++;
    await prisma.ticket.createMany({
      data: batch.map((t: any) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        description: str(t.description),
        type: t.type,
        status: t.status,
        priority: t.priority,
        resolution: str(t.resolution),
        resolvedAt: dt(t.resolvedAt),
        closedAt: dt(t.closedAt),
        createdAt: dt(t.createdAt)!,
        updatedAt: dt(t.updatedAt)!,
        orderId: t.orderId,
        createdById: t.createdById,
        assignedToId: str(t.assignedToId),
      })),
    });
    process.stdout.write(`  batch ${ticketBatch}/${Math.ceil(tickets.length / BATCH_SIZE)}\r`);
  }
  console.log(`  ✓ Ticket (${tickets.length})`);

  // ─── 20. TicketNote ───────────────────────────────────────────────
  const ticketNotes = readAll<any>("TicketNote");
  if (ticketNotes.length > 0) {
    console.log(`Migrating TicketNote (${ticketNotes.length})...`);
    await prisma.ticketNote.createMany({
      data: ticketNotes.map((tn: any) => ({
        id: tn.id,
        content: tn.content,
        isInternal: bool(tn.isInternal),
        createdAt: dt(tn.createdAt)!,
        updatedAt: dt(tn.updatedAt)!,
        ticketId: tn.ticketId,
        authorId: tn.authorId,
      })),
    });
    console.log("  ✓ TicketNote");
  }

  // ─── 21. TicketActivity ───────────────────────────────────────────
  const ticketActivities = readAll<any>("TicketActivity");
  console.log(`Migrating TicketActivity (${ticketActivities.length})...`);
  let taBatch = 0;
  for (const batch of chunk(ticketActivities, BATCH_SIZE)) {
    taBatch++;
    await prisma.ticketActivity.createMany({
      data: batch.map((ta: any) => ({
        id: ta.id,
        action: ta.action,
        description: ta.description,
        metadata: str(ta.metadata),
        createdAt: dt(ta.createdAt)!,
        ticketId: ta.ticketId,
        userId: ta.userId,
      })),
    });
    process.stdout.write(`  batch ${taBatch}/${Math.ceil(ticketActivities.length / BATCH_SIZE)}\r`);
  }
  console.log(`  ✓ TicketActivity (${ticketActivities.length})`);

  // ─── 22. TicketFile ───────────────────────────────────────────────
  const ticketFiles = readAll<any>("TicketFile");
  if (ticketFiles.length > 0) {
    console.log(`Migrating TicketFile (${ticketFiles.length})...`);
    await prisma.ticketFile.createMany({
      data: ticketFiles.map((tf: any) => ({
        id: tf.id,
        ticketId: tf.ticketId,
        fileId: tf.fileId,
        createdAt: dt(tf.createdAt)!,
      })),
    });
    console.log("  ✓ TicketFile");
  }

  // ─── 23. OfficePayPlan ────────────────────────────────────────────
  const officePayPlans = readAll<any>("OfficePayPlan");
  if (officePayPlans.length > 0) {
    console.log(`Migrating OfficePayPlan (${officePayPlans.length})...`);
    await prisma.officePayPlan.createMany({
      data: officePayPlans.map((opp: any) => ({
        id: opp.id,
        office: opp.office,
        month: opp.month,
        year: opp.year,
        createdAt: dt(opp.createdAt)!,
        updatedAt: dt(opp.updatedAt)!,
      })),
    });
    console.log("  ✓ OfficePayPlan");
  }

  // ─── 24. OfficePayPlanTier ────────────────────────────────────────
  const officePayPlanTiers = readAll<any>("OfficePayPlanTier");
  if (officePayPlanTiers.length > 0) {
    console.log(`Migrating OfficePayPlanTier (${officePayPlanTiers.length})...`);
    await prisma.officePayPlanTier.createMany({
      data: officePayPlanTiers.map((t: any) => ({
        id: t.id,
        type: t.type,
        minValue: decReq(t.minValue),
        maxValue: dec(t.maxValue),
        bonusAmount: decReq(t.bonusAmount),
        bonusType: t.bonusType,
        sortOrder: t.sortOrder,
        createdAt: dt(t.createdAt)!,
        updatedAt: dt(t.updatedAt)!,
        officePayPlanId: t.officePayPlanId,
      })),
    });
    console.log("  ✓ OfficePayPlanTier");
  }

  // ─── 25. PayPlan ──────────────────────────────────────────────────
  const payPlans = readAll<any>("PayPlan");
  if (payPlans.length > 0) {
    console.log(`Migrating PayPlan (${payPlans.length})...`);
    await prisma.payPlan.createMany({
      data: payPlans.map((pp: any) => ({
        id: pp.id,
        month: pp.month,
        year: pp.year,
        salary: decReq(pp.salary),
        cancellationDeduction: decReq(pp.cancellationDeduction),
        createdAt: dt(pp.createdAt)!,
        updatedAt: dt(pp.updatedAt)!,
        salesRepId: pp.salesRepId,
        createdById: pp.createdById,
      })),
    });
    console.log("  ✓ PayPlan");
  }

  // ─── 26. PayPlanLineItem ──────────────────────────────────────────
  const payPlanLineItems = readAll<any>("PayPlanLineItem");
  if (payPlanLineItems.length > 0) {
    console.log(`Migrating PayPlanLineItem (${payPlanLineItems.length})...`);
    await prisma.payPlanLineItem.createMany({
      data: payPlanLineItems.map((li: any) => ({
        id: li.id,
        name: li.name,
        amount: decReq(li.amount),
        sortOrder: li.sortOrder,
        createdAt: dt(li.createdAt)!,
        updatedAt: dt(li.updatedAt)!,
        payPlanId: li.payPlanId,
      })),
    });
    console.log("  ✓ PayPlanLineItem");
  }

  // ─── 27. PayLedger ────────────────────────────────────────────────
  const payLedgers = readAll<any>("PayLedger");
  if (payLedgers.length > 0) {
    console.log(`Migrating PayLedger (${payLedgers.length})...`);
    await prisma.payLedger.createMany({
      data: payLedgers.map((pl: any) => ({
        id: pl.id,
        month: pl.month,
        year: pl.year,
        buildingsSold: pl.buildingsSold,
        totalOrderAmount: decReq(pl.totalOrderAmount),
        planTotal: decReq(pl.planTotal),
        tierBonusAmount: decReq(pl.tierBonusAmount),
        monthlySalary: decReq(pl.monthlySalary),
        commissionAmount: decReq(pl.commissionAmount),
        cancellationDeduction: decReq(pl.cancellationDeduction),
        cancellationNote: str(pl.cancellationNote),
        adjustment: decReq(pl.adjustment),
        adjustmentNote: str(pl.adjustmentNote),
        finalAmount: decReq(pl.finalAmount),
        status: pl.status,
        notes: str(pl.notes),
        reviewedAt: dt(pl.reviewedAt),
        createdAt: dt(pl.createdAt)!,
        updatedAt: dt(pl.updatedAt)!,
        salesRepId: pl.salesRepId,
        reviewedById: str(pl.reviewedById),
      })),
    });
    console.log("  ✓ PayLedger");
  }

  // ─── 28. PayAuditLog ─────────────────────────────────────────────
  const payAuditLogs = readAll<any>("PayAuditLog");
  if (payAuditLogs.length > 0) {
    console.log(`Migrating PayAuditLog (${payAuditLogs.length})...`);
    await prisma.payAuditLog.createMany({
      data: payAuditLogs.map((pal: any) => ({
        id: pal.id,
        action: pal.action,
        description: pal.description,
        metadata: str(pal.metadata),
        createdAt: dt(pal.createdAt)!,
        userId: pal.userId,
      })),
    });
    console.log("  ✓ PayAuditLog");
  }

  // ─── 29. PasswordResetToken ───────────────────────────────────────
  const tokens = readAll<any>("PasswordResetToken");
  if (tokens.length > 0) {
    console.log(`Migrating PasswordResetToken (${tokens.length})...`);
    await prisma.passwordResetToken.createMany({
      data: tokens.map((t: any) => ({
        id: t.id,
        token: t.token,
        expiresAt: dt(t.expiresAt)!,
        createdAt: dt(t.createdAt)!,
        userId: t.userId,
      })),
    });
    console.log("  ✓ PasswordResetToken");
  }

  // ─── Verify counts ────────────────────────────────────────────────
  console.log("\n=== Verification ===");
  const counts: Record<string, { sqlite: number; pg: number }> = {};
  const tablesToCheck = [
    { name: "Role", prisma: () => prisma.role.count() },
    { name: "Permission", prisma: () => prisma.permission.count() },
    { name: "RolePermission", prisma: () => prisma.rolePermission.count() },
    { name: "OrderStage", prisma: () => prisma.orderStage.count() },
    { name: "User", prisma: () => prisma.user.count() },
    { name: "Order", prisma: () => prisma.order.count() },
    { name: "OrderStageHistory", prisma: () => prisma.orderStageHistory.count() },
    { name: "OrderActivity", prisma: () => prisma.orderActivity.count() },
    { name: "Revision", prisma: () => prisma.revision.count() },
    { name: "OrderChange", prisma: () => prisma.orderChange.count() },
    { name: "Ticket", prisma: () => prisma.ticket.count() },
    { name: "TicketActivity", prisma: () => prisma.ticketActivity.count() },
    { name: "PayPlan", prisma: () => prisma.payPlan.count() },
    { name: "PayLedger", prisma: () => prisma.payLedger.count() },
    { name: "PayAuditLog", prisma: () => prisma.payAuditLog.count() },
    { name: "OfficePayPlan", prisma: () => prisma.officePayPlan.count() },
    { name: "OfficePayPlanTier", prisma: () => prisma.officePayPlanTier.count() },
  ];

  let allMatch = true;
  for (const t of tablesToCheck) {
    const sqliteCount = (sqlite.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get() as { c: number }).c;
    const pgCount = await t.prisma();
    const match = sqliteCount === pgCount ? "✓" : "✗ MISMATCH";
    if (sqliteCount !== pgCount) allMatch = false;
    console.log(`  ${t.name}: SQLite=${sqliteCount}  Supabase=${pgCount}  ${match}`);
  }

  console.log(allMatch ? "\n✓ All counts match! Migration complete." : "\n✗ Some counts do not match — review above.");

  sqlite.close();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Migration failed:", e);
  sqlite.close();
  await prisma.$disconnect();
  process.exit(1);
});
