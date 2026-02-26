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

    // The action_link points to Supabase's verify endpoint.
    // We need to rewrite it so the token is consumed by the Order Processing app,
    // not by Supabase's default site URL.
    const actionUrl = new URL(data.properties.action_link);
    const token_hash = actionUrl.searchParams.get("token") || actionUrl.searchParams.get("token_hash");
    const type = actionUrl.searchParams.get("type") || "magiclink";

    // Build the redirect through Order Processing's auth callback
    const redirectUrl = `${ORDER_PROCESSING_URL}/auth/confirm?token_hash=${token_hash}&type=${type}`;

    return NextResponse.json({ url: redirectUrl });
  } catch (err) {
    console.error("Magic link error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
