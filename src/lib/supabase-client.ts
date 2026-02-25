import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-safe Supabase instance (uses anon key, respects RLS)
// Safe to import from client components and hooks
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
