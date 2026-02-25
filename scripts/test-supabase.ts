/**
 * Test Supabase connectivity — verifies Prisma (PostgreSQL) and Supabase Storage.
 */

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

let passed = 0;
let failed = 0;

function ok(label: string) {
  passed++;
  console.log(`  ✓ ${label}`);
}
function fail(label: string, err: unknown) {
  failed++;
  console.log(`  ✗ ${label}: ${err}`);
}

async function main() {
  console.log("=== Supabase Communication Tests ===\n");

  // ── 1. Prisma → PostgreSQL ──────────────────────────────────────
  console.log("1. Prisma → PostgreSQL connection");
  try {
    await prisma.$queryRaw`SELECT 1`;
    ok("Raw query works");
  } catch (e) { fail("Raw query", e); }

  // ── 2. Read users ───────────────────────────────────────────────
  console.log("2. Read users from Supabase");
  try {
    const count = await prisma.user.count();
    if (count === 124) ok(`User count = ${count}`);
    else fail(`User count`, `expected 124, got ${count}`);
  } catch (e) { fail("User count", e); }

  try {
    const admin = await prisma.user.findUnique({
      where: { email: "admin@bigbuildingsdirect.com" },
      include: { role: true },
    });
    if (admin && admin.role.name === "Admin") ok(`Admin user found (${admin.firstName} ${admin.lastName}, role=${admin.role.name})`);
    else fail("Admin user", "not found or wrong role");
  } catch (e) { fail("Admin user lookup", e); }

  // ── 3. Read orders ─────────────────────────────────────────────
  console.log("3. Read orders from Supabase");
  try {
    const count = await prisma.order.count();
    if (count === 13756) ok(`Order count = ${count}`);
    else fail("Order count", `expected 13756, got ${count}`);
  } catch (e) { fail("Order count", e); }

  try {
    const first = await prisma.order.findFirst({
      orderBy: { createdAt: "asc" },
      select: { orderNumber: true, customerName: true, totalPrice: true, status: true },
    });
    if (first) ok(`Oldest order: ${first.orderNumber} — ${first.customerName}, $${first.totalPrice}, ${first.status}`);
    else fail("First order", "none found");
  } catch (e) { fail("First order query", e); }

  // ── 4. Aggregation (Decimal precision) ─────────────────────────
  console.log("4. Decimal aggregation");
  try {
    const agg = await prisma.order.aggregate({ _sum: { totalPrice: true }, _avg: { totalPrice: true } });
    ok(`Total revenue: $${agg._sum.totalPrice}  |  Avg order: $${Number(agg._avg.totalPrice).toFixed(2)}`);
  } catch (e) { fail("Aggregation", e); }

  // ── 5. Relational query ────────────────────────────────────────
  console.log("5. Relational queries");
  try {
    const count = await prisma.revision.count();
    if (count === 5720) ok(`Revision count = ${count}`);
    else fail("Revision count", `expected 5720, got ${count}`);
  } catch (e) { fail("Revision count", e); }

  try {
    const count = await prisma.ticket.count();
    if (count === 4801) ok(`Ticket count = ${count}`);
    else fail("Ticket count", `expected 4801, got ${count}`);
  } catch (e) { fail("Ticket count", e); }

  try {
    const orderWithRels = await prisma.order.findFirst({
      where: { revisions: { some: {} } },
      include: { revisions: { take: 1 }, salesRep: { select: { firstName: true, lastName: true } } },
    });
    if (orderWithRels) ok(`Order ${orderWithRels.orderNumber} has ${orderWithRels.revisions.length}+ revisions, salesRep: ${orderWithRels.salesRep?.firstName ?? "N/A"} ${orderWithRels.salesRep?.lastName ?? ""}`);
    else fail("Relational query", "no order with revisions found");
  } catch (e) { fail("Relational query", e); }

  // ── 6. Supabase Storage connectivity ───────────────────────────
  console.log("6. Supabase Storage");
  try {
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
    if (error) throw error;
    const bucketNames = buckets.map((b: any) => b.name);
    console.log(`  Buckets found: [${bucketNames.join(", ")}]`);

    if (bucketNames.includes("uploads")) {
      ok("'uploads' bucket exists");

      // Test write/read/delete cycle
      const testKey = `_migration-test-${Date.now()}.txt`;
      const testData = Buffer.from("supabase storage test");

      const { error: uploadErr } = await supabaseAdmin.storage.from("uploads").upload(testKey, testData, { contentType: "text/plain" });
      if (uploadErr) throw new Error(`upload: ${uploadErr.message}`);
      ok(`Upload test file: ${testKey}`);

      const { data: dlData, error: dlErr } = await supabaseAdmin.storage.from("uploads").download(testKey);
      if (dlErr || !dlData) throw new Error(`download: ${dlErr?.message ?? "no data"}`);
      const text = await dlData.text();
      if (text === "supabase storage test") ok("Download and verify content");
      else fail("Download verify", `content mismatch: "${text}"`);

      const { data: signedData, error: signErr } = await supabaseAdmin.storage.from("uploads").createSignedUrl(testKey, 60);
      if (signErr || !signedData?.signedUrl) throw new Error(`signedUrl: ${signErr?.message}`);
      ok(`Signed URL generated (${signedData.signedUrl.substring(0, 60)}...)`);

      const { error: delErr } = await supabaseAdmin.storage.from("uploads").remove([testKey]);
      if (delErr) throw new Error(`delete: ${delErr.message}`);
      ok("Delete test file");
    } else {
      fail("'uploads' bucket", "NOT FOUND — create it in Supabase dashboard (Storage > New bucket > 'uploads', private)");
    }
  } catch (e) { fail("Storage", e); }

  // ── Summary ────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed === 0) console.log("All tests passed! Supabase is fully connected.");
  else console.log("Some tests failed — review above.");

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
