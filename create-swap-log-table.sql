-- ============================================
-- Create swap_log table for tracking group member swaps
-- Run this SQL in your Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.swap_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_a_id TEXT NOT NULL,
    user_b_id TEXT NOT NULL,
    nama_a TEXT,
    nama_b TEXT,
    kelompok_a_id TEXT,
    kelompok_b_id TEXT,
    kelompok_a_nama TEXT,
    kelompok_b_nama TEXT,
    jadwal_swapped INTEGER DEFAULT 0,
    admin_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.swap_log ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated/anon users (matching existing app pattern)
CREATE POLICY "Allow all access to swap_log" ON public.swap_log
    FOR ALL USING (true) WITH CHECK (true);

-- Add index for faster queries
CREATE INDEX idx_swap_log_created_at ON public.swap_log (created_at DESC);

-- Add comment
COMMENT ON TABLE public.swap_log IS 'Log history pertukaran anggota kelompok';
