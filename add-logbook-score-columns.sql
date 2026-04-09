
-- Jalankan di SQL Editor Supabase Anda untuk mendukung nilai perpaduan Klinik & Akademik pada Logbook
ALTER TABLE public.logbook ADD COLUMN IF NOT EXISTS nilai_klinik NUMERIC;
ALTER TABLE public.logbook ADD COLUMN IF NOT EXISTS nilai_akademik NUMERIC;
ALTER TABLE public.logbook ADD COLUMN IF NOT EXISTS preseptor_klinik_id TEXT REFERENCES public.users(id);
ALTER TABLE public.logbook ADD COLUMN IF NOT EXISTS preseptor_akademik_id TEXT REFERENCES public.users(id);

-- Tambahkan komentar
COMMENT ON COLUMN public.logbook.nilai_klinik IS 'Nilai dari Preseptor Klinik';
COMMENT ON COLUMN public.logbook.nilai_akademik IS 'Nilai dari Preseptor Akademik';
COMMENT ON COLUMN public.logbook.preseptor_klinik_id IS 'ID Preseptor Klinik yang memvalidasi';
COMMENT ON COLUMN public.logbook.preseptor_akademik_id IS 'ID Preseptor Akademik yang memvalidasi';
