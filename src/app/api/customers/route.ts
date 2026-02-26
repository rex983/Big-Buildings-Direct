import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCustomerList } from "@/lib/order-process";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can list customers
    const actualUser = session.user.originalUser || session.user;
    if (actualUser.roleName !== "Admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "100", 10);

    const result = await getCustomerList({ search, page, pageSize });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("GET /api/customers error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
