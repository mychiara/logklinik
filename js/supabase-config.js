// KONFIGURASI SUPABASE DATABASE
// Ganti dengan URL dan Anon Key dari Project Supabase Anda
const SUPABASE_URL = "https://fgfobajdemxtgtowapms.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_a4niKEdhAf_beD_CQ6jHaQ_B6-v3XSH";

let supabaseClient = null;

if (
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes("PROJECT_URL")
) {
  // Initialize standard Supabase client
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.warn("DEMO DRIVER ACTIVE. Supabase credentials not set.");
}
