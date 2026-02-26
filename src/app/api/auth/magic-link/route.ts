import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const ORDER_PROCESSING_URL =
  process.env.NEXT_PUBLIC_ORDER_PROCESSING_URL ||
  "https://big-buildings-direct-mj5l.vercel.app";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;

  try {
    // 1. Generate a magic link token
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (error || !data?.properties?.hashed_token) {
      console.error("Magic link generation failed:", error);
      return NextResponse.json(
        { error: "Failed to generate login link" },
        { status: 500 }
      );
    }

    // 2. Verify the token server-side to get session tokens
    const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        token_hash: data.properties.hashed_token,
        type: "magiclink",
      }),
    });

    const sessionData = await verifyRes.json();

    if (!sessionData.access_token || !sessionData.refresh_token) {
      console.error("Token verification failed:", sessionData);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    // 3. Build URL with session tokens in hash fragment.
    // Supabase client-side auth automatically picks up these params
    // from the URL hash and sets the session.
    const url =
      `${ORDER_PROCESSING_URL}#access_token=${sessionData.access_token}` +
      `&refresh_token=${sessionData.refresh_token}` +
      `&token_type=bearer` +
      `&type=magiclink`;

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Magic link error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
