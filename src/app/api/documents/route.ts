import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, isAdmin } from "@/lib/auth";

const createDocumentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  fileId: z.string().min(1, "File is required"),
  orderId: z.string().min(1, "Order is required"),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("documents.view");
    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get("orderId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50", 10), 100);

    const canViewAll = isAdmin(user.roleName) || user.permissions.includes("orders.view_all");

    const where = orderId
      ? { orderId }
      : canViewAll
        ? {}
        : {
            order: {
              OR: [{ salesRepId: user.id }, { customerId: user.id }],
            },
          };

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          sentAt: true,
          viewedAt: true,
          signedAt: true,
          signingToken: true,
          createdAt: true,
          file: { select: { id: true, filename: true, mimeType: true, size: true } },
          order: { select: { id: true, orderNumber: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.document.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: documents,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/documents error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("documents.create");
    const body = await request.json();

    const validation = createDocumentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { title, fileId, orderId } = validation.data;

    // Verify file exists and is a PDF
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json(
        { success: false, error: "File not found" },
        { status: 404 }
      );
    }

    if (file.mimeType !== "application/pdf") {
      return NextResponse.json(
        { success: false, error: "Only PDF files can be used as documents" },
        { status: 400 }
      );
    }

    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    const document = await prisma.document.create({
      data: {
        title,
        fileId,
        orderId,
        createdById: user.id,
      },
      include: {
        file: true,
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({ success: true, data: document }, { status: 201 });
  } catch (error) {
    console.error("POST /api/documents error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create document" },
      { status: 500 }
    );
  }
}
