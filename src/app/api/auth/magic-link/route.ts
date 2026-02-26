import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const ORDER_PROCESSING_URL =
  process.env.NEXT_PUBLIC_ORDER_PROCESSING_URL ||
  "https://big-buildings-direct-mj5l.vercel.app";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;

  try {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: ORDER_PROCESSING_URL,
      },
    });

    if (error || !data?.properties?.action_link) {
      console.error("Magic link generation failed:", error);
      return NextResponse.json(
        { error: "Failed to generate login link" },
        { status: 500 }
      );
    }

    // action_link points to Supabase's /auth/v1/verify endpoint which
    // verifies the token and redirects the user to the Order Processing app.
    return NextResponse.json({ url: data.properties.action_link });
  } catch (err) {
    console.error("Magic link error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
