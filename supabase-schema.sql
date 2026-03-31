-- Schema Tabel Dasar untuk E-Klinik Supabase

-- 1. Table: users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    prodi TEXT,
    kelompok_id TEXT, -- Diubah dari kelompok
    angkatan TEXT,
    no_telp TEXT,
    tempat_id TEXT, -- Diubah dari lokasi_aktif
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table: presensi
CREATE TABLE IF NOT EXISTS presensi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    jam_masuk TIME NOT NULL,
    jam_keluar TIME,
    lahan TEXT,
    durasi NUMERIC,
    foto TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Table: logbook
CREATE TABLE IF NOT EXISTS logbook (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    lahan TEXT NOT NULL,
    kompetensi TEXT NOT NULL,
    level TEXT NOT NULL,
    deskripsi TEXT,
    status TEXT DEFAULT 'Menunggu Validasi',
    nilai NUMERIC,
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Table: kompetensi
CREATE TABLE IF NOT EXISTS kompetensi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kategori TEXT,
    nama_skill TEXT NOT NULL,
    target_minimal INTEGER DEFAULT 0,
    prodi TEXT,
    angkatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Table: tempat_praktik
CREATE TABLE IF NOT EXISTS tempat_praktik (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama_tempat TEXT NOT NULL,
    alamat TEXT,
    kuota INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Table: prodi
CREATE TABLE IF NOT EXISTS prodi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama_prodi TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Table: jadwal
CREATE TABLE IF NOT EXISTS jadwal (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    tempat_id UUID REFERENCES tempat_praktik(id) ON DELETE SET NULL,
    tanggal DATE,
    jam_mulai TIME,
    jam_selesai TIME,
    shift TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Table: laporan
CREATE TABLE IF NOT EXISTS laporan (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id_pelapor TEXT REFERENCES users(id),
    nama_pelapor TEXT,
    role_pelapor TEXT,
    tipe_kejadian TEXT,
    nama_terlapor TEXT,
    student_id TEXT,
    deskripsi TEXT,
    tanggal TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'Baru',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Table: settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- 10. Table: kelompok
CREATE TABLE IF NOT EXISTS kelompok (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama_kelompok TEXT NOT NULL,
    pembimbing_id TEXT REFERENCES users(id),
    prodi_id UUID REFERENCES prodi(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Table: penilaian_akhir
CREATE TABLE IF NOT EXISTS penilaian_akhir (
    id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    klinik_prak NUMERIC DEFAULT 0,
    klinik_askep NUMERIC DEFAULT 0,
    klinik_sikap NUMERIC DEFAULT 0,
    klinik_total NUMERIC DEFAULT 0,
    akademik_prak NUMERIC DEFAULT 0,
    akademik_askep NUMERIC DEFAULT 0,
    akademik_sikap NUMERIC DEFAULT 0,
    akademik_total NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    status TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Table: penilaian_komponen
CREATE TABLE IF NOT EXISTS penilaian_komponen (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    preseptor_id TEXT REFERENCES users(id),
    role_pemberi TEXT,
    type TEXT, -- praktikum, askep, sikap
    component_id UUID,
    nilai NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, preseptor_id, component_id)
);

-- 13. Table: bimb_praktikum
CREATE TABLE IF NOT EXISTS bimb_praktikum (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama_komponen TEXT NOT NULL,
    nilai_maksimal NUMERIC DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Table: bimb_askep
CREATE TABLE IF NOT EXISTS bimb_askep (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama_komponen TEXT NOT NULL,
    bobot NUMERIC DEFAULT 0,
    skor_maks NUMERIC DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Table: sikap_perilaku
CREATE TABLE IF NOT EXISTS sikap_perilaku (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama_komponen TEXT NOT NULL,
    nilai_maksimal NUMERIC DEFAULT 4,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. Table: jadwal_kelompok
CREATE TABLE IF NOT EXISTS jadwal_kelompok (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kelompok_id UUID REFERENCES kelompok(id) ON DELETE CASCADE,
    tempat_id UUID REFERENCES tempat_praktik(id),
    tanggal_mulai DATE,
    tanggal_selesai DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INSERT DEMO DATA
INSERT INTO users (id, nama, username, password, role) VALUES 
('A1', 'SysAdmin Akademika', 'hironimus', 'admin123', 'admin'),
('M1', 'Jessica Anastasya', 'mhs', '123', 'mahasiswa'),
('P1', 'Dr. Andi Saputra, M.Kes', 'pre', '123', 'preseptor')
ON CONFLICT (id) DO NOTHING;

