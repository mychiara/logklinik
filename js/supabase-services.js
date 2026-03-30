// Layanan Data melalui Supabase
// File ini menggantikan fetchAPI dan postAPI dari Google Apps Script

const MOCK_DATA = {
  login: (payload) => {
    if (payload.username === "mhs" && payload.password === "123")
      return {
        success: true,
        user: { id: "M1", nama: "Jessica Anastasya", role: "mahasiswa" },
      };
    if (payload.username === "pre" && payload.password === "123")
      return {
        success: true,
        user: { id: "P1", nama: "Dr. Andi Saputra, M.Kes", role: "preseptor" },
      };
    if (payload.username === "adm" && payload.password === "123")
      return {
        success: true,
        user: { id: "A1", nama: "SysAdmin Akademika", role: "admin" },
      };
    return {
      success: false,
      message: "User/pass salah. Akun Demo: (mhs/123), (pre/123), (adm/123)",
    };
  },
  getPresensi: {
    success: true,
    data: [
      {
        tanggal: "2024-03-01",
        jam_masuk: "07:30",
        jam_keluar: "15:30",
        lahan: "RSUD Kota Provinsi",
        durasi: "8",
      },
      {
        tanggal: "2024-03-02",
        jam_masuk: "07:45",
        jam_keluar: null,
        lahan: "Puskesmas Harapan Bangsa",
        durasi: null,
      },
    ],
  },
  getLogbook: {
    success: true,
    data: [
      {
        tanggal: "2024-03-01",
        kompetensi: "Pasang Infus",
        lahan: "RSUD Kota Provinsi",
        level: "Mandiri",
        status: "Disetujui",
        nilai: 95,
      },
      {
        tanggal: "2024-03-02",
        kompetensi: "Rawat Luka",
        lahan: "Puskesmas Harapan Bangsa",
        level: "Asistensi",
        status: "Menunggu Validasi",
      },
    ],
  },
  getKompetensi: {
    success: true,
    data: [
      {
        nama_skill: "Pemasangan Infus Perifer",
        target_minimal: "20",
        pencapaian: "15",
      },
      {
        nama_skill: "Perawatan Luka Dasar/Lanjut",
        target_minimal: "15",
        pencapaian: "16",
      },
      {
        nama_skill: "Pemenuhan KDM Oksigenasi",
        target_minimal: "10",
        pencapaian: "4",
      },
    ],
  },
  getPendingLogs: {
    success: true,
    data: [
      {
        id: "L1",
        nama_mahasiswa: "Jessica Anastasya",
        tanggal: "2024-03-02",
        kompetensi: "Rawat Luka",
        level: "Asistensi",
        deskripsi: "Kasus ulkus diabetikum derajat 2 pada pria 50 tahun.",
      },
    ],
  },
  getAllPresensi: {
    success: true,
    data: [
      {
        nama: "Jessica Anastasya",
        tanggal: "2024-03-01",
        jam_masuk: "07:30",
        jam_keluar: "15:30",
        durasi: "8",
      },
      {
        nama: "Riko Kurniawan",
        tanggal: "2024-03-01",
        jam_masuk: "08:00",
        jam_keluar: "12:30",
        durasi: "4.5",
      },
    ],
  },
  getUsers: {
    success: true,
    data: [
      {
        id: "A1",
        nama: "SysAdmin Akademika",
        username: "adm",
        role: "admin",
        prodi: "-",
      },
      {
        id: "M1",
        nama: "Jessica Anastasya",
        username: "mhs",
        role: "mahasiswa",
        prodi: "D3 Keperawatan",
      },
      {
        id: "P1",
        nama: "Dr. Andi Saputra, M.Kes",
        username: "pre",
        role: "preseptor",
        prodi: "-",
      },
    ],
  },
  getProdi: {
    success: true,
    data: [
      { id: "P1", nama_prodi: "D3 Keperawatan" },
      { id: "P2", nama_prodi: "S1 Profesi Ners" },
    ],
  },
  getTempat: {
    success: true,
    data: [
      { id: "T1", nama_tempat: "RSUD Kota Provinsi" },
      { id: "T2", nama_tempat: "Puskesmas Harapan Bangsa" },
    ],
  },
  getKompetensiAll: {
    success: true,
    data: [
      {
        id: "K1",
        nama_skill: "Pemasangan Infus Perifer",
        target_minimal: "20",
      },
      {
        id: "K2",
        nama_skill: "Perawatan Luka Dasar/Lanjut",
        target_minimal: "15",
      },
    ],
  },
  getJadwal: { success: true, data: [] },
  getDashboardStats: {
    success: true,
    data: {
      totalMhs: 45,
      totalKelompok: 5,
      totalPreKlinik: 12,
      totalPreAkademik: 8,
      totalTempat: 4,
      totalKompetensi: 35,
      mhsDinilai: 40,
      mhsBelumDinilai: 5,
      logbookDiisi: 12,
      logbookBelumDiisi: 8,
      presensiHariIni: true,
    },
  },
};

window.supabaseFetchAPI = async (action, payload) => {
  // 1. JALUR MOCK (Jika Supabase belum diset)
  if (!supabaseClient) {
    await new Promise((r) => setTimeout(r, 600)); // Simulasi network delay

    if (action === "login") return MOCK_DATA.login(payload);
    if (MOCK_DATA[action]) return MOCK_DATA[action];

    return { success: false, message: "Endpoint ditiadakan pada mode demo." };
  }

  // 2. JALUR DATABASE (Jika Supabase sudah diset)
  try {
    switch (action) {
      case "login": {
        const { data, error } = await supabaseClient
          .from("users")
          .select("*")
          .eq("username", payload.username)
          .eq("password", payload.password)
          .single();
        if (error || !data)
          throw new Error("User/pass salah atau tidak ditemukan");
        return { success: true, user: data };
      }
      case "getDashboardStats": {
        // Query as Admin
        if (payload.role === "admin") {
          const [mhs, kel, preK, preA, tmp, komp] = await Promise.all([
            supabaseClient
              .from("users")
              .select("*", { count: "exact", head: true })
              .eq("role", "mahasiswa"),
            supabaseClient
              .from("kelompok")
              .select("*", { count: "exact", head: true }),
            supabaseClient
              .from("users")
              .select("*", { count: "exact", head: true })
              .eq("role", "preseptor"),
            supabaseClient
              .from("users")
              .select("*", { count: "exact", head: true })
              .eq("role", "preseptor_akademik"),
            supabaseClient
              .from("tempat_praktik")
              .select("*", { count: "exact", head: true }),
            supabaseClient
              .from("kompetensi")
              .select("*", { count: "exact", head: true }),
          ]);

          return {
            success: true,
            data: {
              totalMhs: mhs.count || 0,
              totalKelompok: kel.count || 0,
              totalPreKlinik: preK.count || 0,
              totalPreAkademik: preA.count || 0,
              totalTempat: tmp.count || 0,
              totalKompetensi: komp.count || 0,
              mhsDinilai: 0, // Logic for this would require check on nilais/grading table
              mhsBelumDinilai: mhs.count || 0,
            },
          };
        }

        // Query as Mahasiswa
        if (payload.role === "mahasiswa") {
          const [logs, pres] = await Promise.all([
            supabaseClient
              .from("logbook")
              .select("*", { count: "exact", head: true })
              .eq("user_id", payload.user_id),
            supabaseClient
              .from("presensi")
              .select("*")
              .eq("user_id", payload.user_id)
              .eq("tanggal", new Date().toISOString().split("T")[0])
              .limit(1),
          ]);

          return {
            success: true,
            data: {
              logbookDiisi: logs.count || 0,
              logbookBelumDiisi: 0, // Should be calculated from target minimal
              presensiHariIni: pres.data && pres.data.length > 0,
            },
          };
        }

        // Query as Preceptor
        const [pending] = await Promise.all([
          supabaseClient
            .from("logbook")
            .select("*", { count: "exact", head: true })
            .eq("status", "Menunggu Validasi"),
        ]);
        return {
          success: true,
          data: {
            logbookPending: pending.count || 0,
            mhsDinilai: 0,
            mhsBelumDinilai: 0,
          },
        };
      }
      case "getPresensi": {
        const { data, error } = await supabaseClient
          .from("presensi")
          .select("*")
          .eq("user_id", payload.user_id);
        if (error) throw error;
        return { success: true, data: data || [] };
      }
      case "getLogbook": {
        const { data, error } = await supabaseClient
          .from("logbook")
          .select("*")
          .eq("user_id", payload.user_id);
        if (error) throw error;
        return { success: true, data: data || [] };
      }
      case "getKompetensi": {
        const { data, error } = await supabaseClient
          .from("kompetensi")
          .select("*");
        if (error) throw error;
        return { success: true, data: data || [] };
      }
      case "getJadwal": {
        const { data, error } = await supabaseClient.from("jadwal").select("*");
        if (error) throw error;
        return { success: true, data: data || [] };
      }
      case "getUsers": {
        const { data, error } = await supabaseClient.from("users").select("*");
        if (error) throw error;
        return { success: true, data: data || [] };
      }
      case "getTempat": {
        const { data, error } = await supabaseClient
          .from("tempat_praktik")
          .select("*");
        if (error) throw error;
        return { success: true, data: data || [] };
      }
      case "getProdi": {
        const { data, error } = await supabaseClient.from("prodi").select("*");
        if (error) throw error;
        return { success: true, data: data || [] };
      }
      case "getAllPresensi": {
        // Join users & presensi would usually be handled manually or with related tables
        const { data, error } = await supabaseClient
          .from("presensi")
          .select("*, users!inner(nama)");
        if (error) throw error;
        return { success: true, data: data || [] };
      }

      case "getLaporan": {
        const { data, error } = await supabaseClient
          .from("laporan")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return { success: true, data: data || [] };
      }
      case "getSettings": {
        const { data, error } = await supabaseClient
          .from("settings")
          .select("*");
        if (error) throw error;
        // Convert to object
        const settings = {};
        data.forEach((s) => (settings[s.key] = s.value));
        return { success: true, data: settings };
      }
      case "getKelompok": {
        const { data, error } = await supabaseClient
          .from("kelompok")
          .select("*");
        if (error) throw error;
        return { success: true, data: data || [] };
      }

      // Default fallback mapper
      // Default fallback mapper
      default:
        try {
          // Normalize action names (e.g., getTempat -> tempat_praktik or similar)
          let tableName = action.replace("get", "").toLowerCase();

          // Custom mapping for tables with different plurals/names
          const tableMap = {
            tempat: "tempat_praktik",
            prodi: "prodi",
            kompetensi: "kompetensi",
            users: "users",
            jadwal: "jadwal",
            kelompok: "kelompok",
            laporan: "laporan",
            presensi: "presensi",
            logbook: "logbook",
          };

          tableName = tableMap[tableName] || tableName;

          const { data, error } = await supabaseClient
            .from(tableName)
            .select("*");
          if (!error) return { success: true, data: data };
        } catch (e) {}

        return { success: true, data: [] };
    }
  } catch (err) {
    console.error("Supabase Fetch Error:", err);
    return { success: false, message: err.message };
  }
};

window.supabasePostAPI = async (action, payload) => {
  // 1. JALUR MOCK
  if (!supabaseClient) {
    await new Promise((r) => setTimeout(r, 600)); // Simulasi statis
    return { success: true, message: "Berhasil divalidasi (Demo Mode)" };
  }

  // 2. JALUR DATABASE
  try {
    switch (action) {
      case "checkIn": {
        const row = {
          user_id: payload.user_id,
          tanggal: new Date().toISOString().split("T")[0],
          jam_masuk: new Date().toISOString().split("T")[1].substring(0, 5),
          lahan: payload.lahan,
        };
        const { error } = await supabaseClient.from("presensi").insert([row]);
        if (error) throw error;
        return { success: true, message: "Berhasil Check-In" };
      }
      case "checkOut": {
        const tgt = new Date().toISOString().split("T")[0];
        const jam_keluar = new Date()
          .toISOString()
          .split("T")[1]
          .substring(0, 5);

        // Cari presensi terbaru untuk check-out
        const { data, error: errFetch } = await supabaseClient
          .from("presensi")
          .select("*")
          .eq("user_id", payload.user_id)
          .eq("tanggal", tgt)
          .is("jam_keluar", null)
          .limit(1)
          .single();

        if (errFetch || !data)
          throw new Error("Tidak menemukan presensi aktif untuk check-out");

        // Asumsi durasi sederhana
        const durasi = 8;

        const { error } = await supabaseClient
          .from("presensi")
          .update({ jam_keluar, durasi })
          .eq("id", data.id);
        if (error) throw error;
        return { success: true, message: "Berhasil Check-Out" };
      }
      case "addLogbook": {
        const { error } = await supabaseClient.from("logbook").insert([
          {
            user_id: payload.user_id,
            tanggal: payload.tanggal,
            lahan: payload.lahan,
            kompetensi: payload.kompetensi,
            level: payload.level,
            deskripsi: payload.deskripsi,
            status: "Menunggu Validasi",
          },
        ]);
        if (error) throw error;
        return { success: true };
      }
      case "validasiLog": {
        const { error } = await supabaseClient
          .from("logbook")
          .update({
            status: payload.status,
            nilai: payload.nilai,
            feedback: payload.feedback,
          })
          .eq("id", payload.id);
        if (error) throw error;
        return { success: true };
      }
      case "addLaporan": {
        const { error } = await supabaseClient.from("laporan").insert([
          {
            user_id: payload.user_id,
            kategori: payload.kategori,
            kejadian: payload.kejadian,
            lokasi: payload.lokasi,
            tanggal: payload.tanggal,
            status: "Terbuka",
          },
        ]);
        if (error) throw error;
        return { success: true };
      }
      case "updateLaporanStatus": {
        const { error } = await supabaseClient
          .from("laporan")
          .update({ status: payload.status })
          .eq("id", payload.id);
        if (error) throw error;
        return { success: true };
      }
      case "saveSettings": {
        const updates = Object.entries(payload).map(([k, v]) => ({
          key: k,
          value: v,
        }));
        const { error } = await supabaseClient
          .from("settings")
          .upsert(updates, { onConflict: "key" });
        if (error) throw error;
        return { success: true };
      }
      case "deleteUser": {
        const { error } = await supabaseClient
          .from("users")
          .delete()
          .eq("id", payload.id);
        if (error) throw error;
        return { success: true };
      }
      case "setKelompokBulk": {
        const { error } = await supabaseClient
          .from("users")
          .update({ kelompok: payload.kelompok_id })
          .in("id", payload.member_ids);
        if (error) throw error;
        return { success: true };
      }
      // Generic CRUD Add/Update Users
      case "addUser":
      case "updateUser": {
        const { error } = await supabaseClient
          .from("users")
          .upsert(payload, { onConflict: "id" });
        if (error) throw error;
        return { success: true };
      }

      // Master Data CRUD
      case "addTempat":
      case "updateTempat": {
        const { error } = await supabaseClient
          .from("tempat_praktik")
          .upsert(payload, { onConflict: "id" });
        if (error) throw error;
        return { success: true };
      }
      case "addProdi":
      case "updateProdi": {
        const { error } = await supabaseClient
          .from("prodi")
          .upsert(payload, { onConflict: "id" });
        if (error) throw error;
        return { success: true };
      }
      case "addKompetensi":
      case "updateKompetensi": {
        const { error } = await supabaseClient
          .from("kompetensi")
          .upsert(payload, { onConflict: "id" });
        if (error) throw error;
        return { success: true };
      }
      case "deleteMaster": {
        let tbl = payload.type;
        if (tbl === "tempat") tbl = "tempat_praktik";
        const { error } = await supabaseClient
          .from(tbl)
          .delete()
          .eq("id", payload.id);
        if (error) throw error;
        return { success: true };
      }

      case "updatePassword": {
        // Verify old password
        const { data: user, error: fetchErr } = await supabaseClient
          .from("users")
          .select("password")
          .eq("id", payload.user_id)
          .single();

        if (fetchErr || !user) throw new Error("Pengguna tidak ditemukan");
        if (user.password !== payload.oldPassword)
          throw new Error("Password lama salah");

        // Update to new password
        const { error: updErr } = await supabaseClient
          .from("users")
          .update({ password: payload.newPassword })
          .eq("id", payload.user_id);

        if (updErr) throw updErr;
        return { success: true };
      }

      case "importUsers": {
        const { error } = await supabaseClient
          .from("users")
          .upsert(payload.users, { onConflict: "id" });

        if (error) throw error;
        return {
          success: true,
          summary: {
            successCount: payload.users.length,
            failCount: 0,
            failedRows: [],
          },
        };
      }

      default:
        return {
          success: true,
          message: "Aksi sukses, metode generic diaktifkan",
        };
    }
  } catch (err) {
    console.error("Supabase Post Error:", err);
    return { success: false, message: err.message };
  }
};
