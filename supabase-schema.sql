-- Schema Tabel Dasar untuk E-Klinik Supabase

-- 1. Table: users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    prodi TEXT,
    kelompok TEXT,
    no_telp TEXT,
    lokasi_aktif TEXT
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
    foto TEXT
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
    feedback TEXT
);

-- 4. Table: kompetensi
CREATE TABLE IF NOT EXISTS kompetensi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kategori TEXT,
    nama_skill TEXT NOT NULL,
    target_minimal INTEGER DEFAULT 0,
    prodi TEXT
);

-- 5. Table: tempat_praktik
CREATE TABLE IF NOT EXISTS tempat_praktik (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama_tempat TEXT NOT NULL,
    alamat TEXT,
    kuota INTEGER
);

-- 6. Table: prodi
CREATE TABLE IF NOT EXISTS prodi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama_prodi TEXT NOT NULL
);

-- 7. Table: jadwal
CREATE TABLE IF NOT EXISTS jadwal (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    tempat_id UUID REFERENCES tempat_praktik(id) ON DELETE SET NULL,
    tanggal DATE,
    jam_mulai TIME,
    jam_selesai TIME,
    shift TEXT
);

-- 8. Table: laporan
CREATE TABLE IF NOT EXISTS laporan (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    kategori TEXT,
    kejadian TEXT,
    lokasi TEXT,
    tanggal DATE,
    status TEXT DEFAULT 'Terbuka',
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
    prodi_id UUID REFERENCES prodi(id)
);

-- INSERT DEMO DATA (Admin, Mahasiswa, Preseptor)
INSERT INTO users (id, nama, username, password, role, prodi) VALUES 
('A1', 'SysAdmin Akademika', 'adm', '123', 'admin', '-'),
('M1', 'Jessica Anastasya', 'mhs', '123', 'mahasiswa', 'D3 Keperawatan'),
('P1', 'Dr. Andi Saputra, M.Kes', 'pre', '123', 'preseptor', '-')
ON CONFLICT (id) DO NOTHING;
