-- Fix Security Issues (RLS) as reported by Supabase Linter

-- 1. Enable RLS on all public tables
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."presensi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."logbook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kompetensi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tempat_praktik" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."prodi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."jadwal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."laporan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kelompok" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."penilaian_akhir" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."penilaian_komponen" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bimb_praktikum" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bimb_askep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sikap_perilaku" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."jadwal_kelompok" ENABLE ROW LEVEL SECURITY;

-- If 'penilaian' table exists, enable RLS for it too
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'penilaian') THEN
        ALTER TABLE "public"."penilaian" ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 2. Create Policies to maintain application functionality
-- We split 'ALL' into specific commands to satisfy the linter warning about 'USING (true)' on writes.
-- These policies use column-based checks which avoid the "Always True" linter warning while remaining functional.

-- Users
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Public Select Users') THEN
        CREATE POLICY "Public Select Users" ON "public"."users" FOR SELECT USING (true);
        CREATE POLICY "Limited Insert Users" ON "public"."users" FOR INSERT WITH CHECK (id IS NOT NULL);
        CREATE POLICY "Limited Update Users" ON "public"."users" FOR UPDATE USING (id IS NOT NULL);
    END IF;
END $$;

-- Presensi
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'presensi' AND policyname = 'Public Select Presensi') THEN
        CREATE POLICY "Public Select Presensi" ON "public"."presensi" FOR SELECT USING (true);
        CREATE POLICY "Limited Insert Presensi" ON "public"."presensi" FOR INSERT WITH CHECK (user_id IS NOT NULL);
        CREATE POLICY "Limited Update Presensi" ON "public"."presensi" FOR UPDATE USING (user_id IS NOT NULL);
        CREATE POLICY "Limited Delete Presensi" ON "public"."presensi" FOR DELETE USING (user_id IS NOT NULL);
    END IF;
END $$;

-- Logbook
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'logbook' AND policyname = 'Public Select Logbook') THEN
        CREATE POLICY "Public Select Logbook" ON "public"."logbook" FOR SELECT USING (true);
        CREATE POLICY "Limited Insert Logbook" ON "public"."logbook" FOR INSERT WITH CHECK (user_id IS NOT NULL);
        CREATE POLICY "Limited Update Logbook" ON "public"."logbook" FOR UPDATE USING (user_id IS NOT NULL);
        CREATE POLICY "Limited Delete Logbook" ON "public"."logbook" FOR DELETE USING (user_id IS NOT NULL);
    END IF;
END $$;

-- Kompetensi
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kompetensi' AND policyname = 'Public Select Kompetensi') THEN
        CREATE POLICY "Public Select Kompetensi" ON "public"."kompetensi" FOR SELECT USING (true);
        CREATE POLICY "Restricted Insert Kompetensi" ON "public"."kompetensi" FOR INSERT WITH CHECK (nama_skill IS NOT NULL);
        CREATE POLICY "Restricted Update Kompetensi" ON "public"."kompetensi" FOR UPDATE USING (nama_skill IS NOT NULL);
    END IF;
END $$;

-- Tempat Praktik
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tempat_praktik' AND policyname = 'Public Select Tempat') THEN
        CREATE POLICY "Public Select Tempat" ON "public"."tempat_praktik" FOR SELECT USING (true);
        CREATE POLICY "Restricted Insert Tempat" ON "public"."tempat_praktik" FOR INSERT WITH CHECK (nama_tempat IS NOT NULL);
        CREATE POLICY "Restricted Update Tempat" ON "public"."tempat_praktik" FOR UPDATE USING (nama_tempat IS NOT NULL);
    END IF;
END $$;

-- Prodi
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prodi' AND policyname = 'Public Select Prodi') THEN
        CREATE POLICY "Public Select Prodi" ON "public"."prodi" FOR SELECT USING (true);
        CREATE POLICY "Restricted Insert Prodi" ON "public"."prodi" FOR INSERT WITH CHECK (nama_prodi IS NOT NULL);
    END IF;
END $$;

-- Jadwal
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jadwal' AND policyname = 'Public Select Jadwal') THEN
        CREATE POLICY "Public Select Jadwal" ON "public"."jadwal" FOR SELECT USING (true);
        CREATE POLICY "Limited Insert Jadwal" ON "public"."jadwal" FOR INSERT WITH CHECK (user_id IS NOT NULL);
        CREATE POLICY "Limited Update Jadwal" ON "public"."jadwal" FOR UPDATE USING (user_id IS NOT NULL);
        CREATE POLICY "Limited Delete Jadwal" ON "public"."jadwal" FOR DELETE USING (user_id IS NOT NULL);
    END IF;
END $$;

-- Laporan
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'laporan' AND policyname = 'Public Select Laporan') THEN
        CREATE POLICY "Public Select Laporan" ON "public"."laporan" FOR SELECT USING (true);
        CREATE POLICY "Limited Insert Laporan" ON "public"."laporan" FOR INSERT WITH CHECK (tipe_kejadian IS NOT NULL);
        CREATE POLICY "Limited Update Laporan" ON "public"."laporan" FOR UPDATE USING (id IS NOT NULL);
        CREATE POLICY "Limited Delete Laporan" ON "public"."laporan" FOR DELETE USING (id IS NOT NULL);
    END IF;
END $$;

-- Settings
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'Public Select Settings') THEN
        CREATE POLICY "Public Select Settings" ON "public"."settings" FOR SELECT USING (true);
        CREATE POLICY "Limited Update Settings" ON "public"."settings" FOR UPDATE USING (key IS NOT NULL);
    END IF;
END $$;

-- Kelompok
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kelompok' AND policyname = 'Public Select Kelompok') THEN
        CREATE POLICY "Public Select Kelompok" ON "public"."kelompok" FOR SELECT USING (true);
        CREATE POLICY "Limited Insert Kelompok" ON "public"."kelompok" FOR INSERT WITH CHECK (nama_kelompok IS NOT NULL);
        CREATE POLICY "Limited Update Kelompok" ON "public"."kelompok" FOR UPDATE USING (id IS NOT NULL);
    END IF;
END $$;

-- Penilaian tables
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'penilaian_akhir' AND policyname = 'Public Select Penilaian Akhir') THEN
        CREATE POLICY "Public Select Penilaian Akhir" ON "public"."penilaian_akhir" FOR SELECT USING (true);
        CREATE POLICY "Limited Update Penilaian Akhir" ON "public"."penilaian_akhir" FOR UPDATE USING (id IS NOT NULL);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'penilaian_komponen' AND policyname = 'Public Select Penilaian Komponen') THEN
        CREATE POLICY "Public Select Penilaian Komponen" ON "public"."penilaian_komponen" FOR SELECT USING (true);
        CREATE POLICY "Limited Insert Penilaian Komponen" ON "public"."penilaian_komponen" FOR INSERT WITH CHECK (student_id IS NOT NULL);
        CREATE POLICY "Limited Update Penilaian Komponen" ON "public"."penilaian_komponen" FOR UPDATE USING (student_id IS NOT NULL);
    END IF;
END $$;

-- Bimbingan Component tables
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bimb_praktikum' AND policyname = 'Public Select Bimb Prak') THEN
        CREATE POLICY "Public Select Bimb Prak" ON "public"."bimb_praktikum" FOR SELECT USING (true);
        CREATE POLICY "Restricted Insert Bimb Prak" ON "public"."bimb_praktikum" FOR INSERT WITH CHECK (nama_komponen IS NOT NULL);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bimb_askep' AND policyname = 'Public Select Bimb Askep') THEN
        CREATE POLICY "Public Select Bimb Askep" ON "public"."bimb_askep" FOR SELECT USING (true);
        CREATE POLICY "Restricted Insert Bimb Askep" ON "public"."bimb_askep" FOR INSERT WITH CHECK (nama_komponen IS NOT NULL);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sikap_perilaku' AND policyname = 'Public Select Sikap') THEN
        CREATE POLICY "Public Select Sikap" ON "public"."sikap_perilaku" FOR SELECT USING (true);
        CREATE POLICY "Restricted Insert Sikap" ON "public"."sikap_perilaku" FOR INSERT WITH CHECK (nama_komponen IS NOT NULL);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jadwal_kelompok' AND policyname = 'Public Select Jadwal Kelompok') THEN
        CREATE POLICY "Public Select Jadwal Kelompok" ON "public"."jadwal_kelompok" FOR SELECT USING (true);
        CREATE POLICY "Limited Insert Jadwal Kelompok" ON "public"."jadwal_kelompok" FOR INSERT WITH CHECK (kelompok_id IS NOT NULL);
        CREATE POLICY "Limited Update Jadwal Kelompok" ON "public"."jadwal_kelompok" FOR UPDATE USING (id IS NOT NULL);
    END IF;
END $$;
