import {createClient} from "@supabase/supabase-js";

const url=import.meta.env.VITE_SUPABASE_URL;
const publishableKey=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured=Boolean(url&&publishableKey);
export const supabase=createClient(
  url||"https://example.supabase.co",
  publishableKey||"missing-publishable-key",
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
);
