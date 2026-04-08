-- ============================================
-- FIX JADWAL RLS - Perbaikan Kebijakan Jadwal
-- ============================================
-- Jalankan script ini di Supabase SQL Editor
-- untuk memperbaiki masalah jadwal yang hilang/berubah
-- setelah penerapan RLS.
-- ============================================

-- LANGKAH 1: Cek policies yang ada pada tabel jadwal (diagnostik)
-- Jalankan query ini dulu untuk melihat kondisi saat ini:
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'jadwal';

-- LANGKAH 2: Hapus SEMUA policy lama di tabel jadwal
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'jadwal'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.jadwal', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- LANGKAH 3: Pastikan RLS aktif
ALTER TABLE "public"."jadwal" ENABLE ROW LEVEL SECURITY;

-- LANGKAH 4: Buat policies baru yang PERMISSIF (aman untuk anon key)
CREATE POLICY "Allow Select Jadwal" ON "public"."jadwal" 
    FOR SELECT USING (true);

CREATE POLICY "Allow Insert Jadwal" ON "public"."jadwal" 
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow Update Jadwal" ON "public"."jadwal" 
    FOR UPDATE USING (true);

CREATE POLICY "Allow Delete Jadwal" ON "public"."jadwal" 
    FOR DELETE USING (true);

-- LANGKAH 5: Lakukan hal yang sama untuk jadwal_kelompok
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'jadwal_kelompok'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.jadwal_kelompok', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

ALTER TABLE "public"."jadwal_kelompok" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow Select Jadwal Kelompok" ON "public"."jadwal_kelompok" 
    FOR SELECT USING (true);

CREATE POLICY "Allow Insert Jadwal Kelompok" ON "public"."jadwal_kelompok" 
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow Update Jadwal Kelompok" ON "public"."jadwal_kelompok" 
    FOR UPDATE USING (true);

CREATE POLICY "Allow Delete Jadwal Kelompok" ON "public"."jadwal_kelompok" 
    FOR DELETE USING (true);

-- VERIFIKASI: Cek hasilnya
SELECT tablename, policyname, cmd, qual FROM pg_policies 
WHERE tablename IN ('jadwal', 'jadwal_kelompok') 
ORDER BY tablename, policyname;
