import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client (uses service role key — bypasses RLS, server-side only)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
