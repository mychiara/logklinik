// Helper: get local date string in YYYY-MM-DD format (timezone-safe)
const getLocalTodayService = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// Helper: get local time string in HH:mm format (PostgreSQL-safe, uses colon)
const getLocalTimeService = () => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
};

window.supabaseFetchAPI = async (action, payload) => {
  if (!supabaseClient) {
    await new Promise((r) => setTimeout(r, 600));
    if (action === "login") return MOCK_DATA.login(payload);
    if (MOCK_DATA[action]) return MOCK_DATA[action];
    return { success: false, message: "Endpoint ditiadakan pada mode demo." };
  }

  try {
    switch (action) {
      case "login": {
        const { data: user, error } = await supabaseClient
          .from("users")
          .select("*")
          .eq("username", payload.username)
          .single();

        if (error || !user)
          throw new Error("User/pass salah atau tidak ditemukan");

        // Periksa password (cek hash dulu, lalu cek raw untuk migrasi)
        if (
          user.password === payload.password ||
          user.password === payload.raw_password
        ) {
          // Jika masih plain text (sama dengan raw), update ke hash demi keamanan masa depan
          if (user.password === payload.raw_password) {
            await supabaseClient
              .from("users")
              .update({ password: payload.password })
              .eq("id", user.id);
          }
          return { success: true, user };
        }

        throw new Error("Password yang Anda masukkan salah");
      }

      case "getDashboardStats": {
        if (payload.role === "admin") {
          const [mhs, kel, preK, preA, tmp, komp, rated] = await Promise.all([
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
            supabaseClient
              .from("penilaian_akhir")
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
              mhsDinilai: rated.count || 0,
              mhsBelumDinilai: Math.max(
                0,
                (mhs.count || 0) - (rated.count || 0),
              ),
            },
          };
        }

        if (payload.role === "mahasiswa") {
          const today = getLocalTodayService();
          const [logs, pres, sched] = await Promise.all([
            supabaseClient
              .from("logbook")
              .select("*", { count: "exact", head: true })
              .eq("user_id", payload.user_id),
            supabaseClient
              .from("presensi")
              .select("*", { count: "exact", head: true })
              .eq("user_id", payload.user_id),
            supabaseClient
              .from("jadwal")
              .select("*", { count: "exact", head: true })
              .eq("user_id", payload.user_id)
              .lte("tanggal", today),
          ]);

          const hadir = pres.count || 0;
          const totalSched = sched.count || 0;
          const absen = Math.max(0, totalSched - hadir);

          const { data: presToday } = await supabaseClient
            .from("presensi")
            .select("*")
            .eq("user_id", payload.user_id)
            .eq("tanggal", today)
            .limit(1);

          return {
            success: true,
            data: {
              logbookDiisi: logs.count || 0,
              presensiHariIni: presToday && presToday.length > 0,
              jumlahHadir: hadir,
              jumlahAbsen: absen,
            },
          };
        }

        if (payload.role && payload.role.includes("preseptor")) {
          // 1. Get Assigned Student IDs for this preceptor's location
          const assRes = await window.supabaseFetchAPI(
            "getAssignedStudents",
            payload,
          );
          const studentIds = (assRes.data || []).map((u) => u.id);

          if (studentIds.length === 0) {
            return {
              success: true,
              data: { mhsDinilai: 0, mhsBelumDinilai: 0, logbookPending: 0 },
            };
          }

          // 2. Count graded students (those who have scores in their category)
          const { data: grades } = await supabaseClient
            .from("penilaian_akhir")
            .select("id, klinik_total, akademik_total")
            .in("id", studentIds);

          const scoredCount = (grades || []).filter((g) => {
            return payload.role === "preseptor_akademik"
              ? (g.akademik_total || 0) > 0
              : (g.klinik_total || 0) > 0;
          }).length;

          // 3. Count pending logbooks strictly for these students/locations
          const pendingRes = await window.supabaseFetchAPI(
            "getPendingLogs",
            payload,
          );
          const pendingCount = (pendingRes.data || []).length;

          return {
            success: true,
            data: {
              mhsDinilai: scoredCount,
              mhsBelumDinilai: Math.max(0, studentIds.length - scoredCount),
              logbookPending: pendingCount,
            },
          };
        }

        return {
          success: true,
          data: {
            logbookPending: 0,
            mhsDinilai: 0,
            mhsBelumDinilai: 0,
          },
        };
      }

      case "getAllPresensi": {
        const { data, error } = await supabaseClient
          .from("presensi")
          .select("*, users!inner(nama, prodi)")
          .range(0, 49999);
        if (error) throw error;
        return {
          success: true,
          data: (data || []).map((p) => ({
            ...p,
            nama: p.users.nama,
            prodi: p.users.prodi,
          })),
        };
      }

      case "getLiveAttendance": {
        const today = getLocalTodayService();
        const tIds = payload.tempat_id ? payload.tempat_id.split(",") : [];

        let query = supabaseClient
          .from("presensi")
          .select("*, users!inner(nama, nim:username)")
          .eq("tanggal", today);

        if (tIds.length > 0) {
          query = query.in("lahan", tIds);
        }

        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data: data };
      }

      case "getMendesakLogs": {
        const yesterday = new Date(Date.now() - 86400000).toISOString();
        let query = supabaseClient
          .from("logbook")
          .select("*, users!inner(nama)")
          .eq("status", "Menunggu Validasi")
          .lt("created_at", yesterday);

        if (payload.tempat_id && payload.tempat_id !== "-") {
          const tIds = payload.tempat_id.split(",");
          query = query.in("lahan", tIds); // Use record-specific 'lahan' column
        }

        const { data, error } = await query
          .order("tanggal", { ascending: true })
          .range(0, 49999);
        if (error) throw error;
        return {
          success: true,
          data: (data || []).map((l) => ({
            ...l,
            nama_mahasiswa: l.users.nama,
          })),
        };
      }

      case "getCompetencyGap": {
        const tIds = payload.tempat_id ? payload.tempat_id.split(",") : [];
        const { data: logs, error: e1 } = await supabaseClient
          .from("logbook")
          .select("kompetensi")
          .in("lahan", tIds)
          .eq("status", "Disetujui");
        const { data: allKomp, error: e2 } = await supabaseClient
          .from("kompetensi")
          .select("nama_skill");

        if (e1 || e2) throw e1 || e2;

        const counts = {};
        logs.forEach(
          (l) => (counts[l.kompetensi] = (counts[l.kompetensi] || 0) + 1),
        );

        // Return competencies with 0 or low counts
        const gaps = allKomp
          .map((k) => ({
            nama: k.nama_skill,
            count: counts[k.nama_skill] || 0,
          }))
          .sort((a, b) => a.count - b.count);

        return { success: true, data: gaps.slice(0, 10) };
      }

      case "getSkillLeaderboard": {
        const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();
        const { data, error } = await supabaseClient
          .from("logbook")
          .select("user_id, users!inner(nama)")
          .eq("status", "Disetujui")
          .gt("created_at", lastWeek)
          .range(0, 49999);
        if (error) throw error;

        const board = {};
        data.forEach((l) => {
          if (!board[l.user_id])
            board[l.user_id] = { nama: l.users.nama, count: 0 };
          board[l.user_id].count++;
        });

        const sorted = Object.values(board).sort((a, b) => b.count - a.count);
        return { success: true, data: sorted.slice(0, 5) };
      }

      case "getPreceptorNotes": {
        const { data, error } = await supabaseClient
          .from("laporan")
          .select("*")
          .eq("student_id", payload.student_id)
          .eq("tipe_kejadian", "Preceptor Note")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return { success: true, data };
      }

      case "getStudentMiniProfile": {
        const { data, error } = await supabaseClient
          .from("users")
          .select("id, nama, username, prodi, kelompok_id")
          .or(`id.eq.${payload.identifier},username.eq.${payload.identifier}`)
          .single();
        if (error) throw error;
        return { success: true, data };
      }

      case "getOfficialLogbook": {
        const { data, error } = await supabaseClient
          .from("logbook")
          .select("tanggal, lahan, kompetensi, level, nilai, feedback")
          .eq("user_id", payload.user_id)
          .eq("status", "Disetujui")
          .order("tanggal", { ascending: true });
        if (error) throw error;
        return { success: true, data };
      }

      case "getAdminAnalytics": {
        const today = getLocalTodayService();
        const [mhs, logs, pres, scores, prodis] = await Promise.all([
          supabaseClient
            .from("users")
            .select("id", { count: "exact", head: true })
            .eq("role", "mahasiswa"),
          supabaseClient
            .from("logbook")
            .select("*", { count: "exact", head: true })
            .eq("status", "Disetujui"),
          supabaseClient
            .from("presensi")
            .select("*", { count: "exact", head: true })
            .eq("tanggal", today),
          supabaseClient
            .from("penilaian_akhir")
            .select("total, users!inner(prodi)"),
          supabaseClient.from("prodi").select("nama_prodi"),
        ]);

        // Calculate Average Performance per Prodi (Still fetch records for this, but only scoring ones)
        // Note: Supabase limit is 1000 by default. If we have >1000 student final scores,
        // we might need to handle this differently, but for 500 students it's safe.
        const prodiStats = (prodis.data || []).map((p) => {
          const prodiScores = (scores.data || []).filter(
            (s) => s.users.prodi === p.nama_prodi,
          );
          const avg =
            prodiScores.length > 0
              ? (
                  prodiScores.reduce((acc, s) => acc + (s.total || 0), 0) /
                  prodiScores.length
                ).toFixed(1)
              : 0;
          return { nama: p.nama_prodi, avg };
        });

        return {
          success: true,
          data: {
            totalMhs: mhs.count || 0,
            activeToday: pres.count || 0,
            totalLogs: logs.count || 0,
            avgLogs: mhs.count > 0 ? (logs.count / mhs.count).toFixed(1) : 0,
            prodiStats: prodiStats,
          },
        };
      }

      case "getUsers": {
        let allData = [];
        let from = 0;
        const step = 2000;
        let finished = false;

        while (!finished) {
          const { data, error } = await supabaseClient
            .from("users")
            .select(
              "id, username, nama, role, prodi, kelompok_id, tempat_id, angkatan, no_telp",
            )
            .order("nama", { ascending: true })
            .range(from, from + step - 1);

          if (error) throw error;
          if (data && data.length > 0) {
            allData = allData.concat(data);
          }
          if (!data || data.length < step) {
            finished = true;
          } else {
            from += step;
          }
        }
        return {
          success: true,
          data: allData.map((u) => ({
            ...u,
            kelompok: u.kelompok_id,
            tempat_id: u.tempat_id || "-",
          })),
        };
      }

      case "getRekapLogbook": {
        let mCol = supabaseClient
          .from("users")
          .select("id, nama, prodi")
          .eq("role", "mahasiswa");

        if (payload.ids && Array.isArray(payload.ids)) {
          mCol = mCol.in("id", payload.ids);
        } else {
          mCol = mCol.range(0, 499); // Safe default for 500 students
        }

        let lCol = supabaseClient
          .from("logbook")
          .select("user_id, kompetensi")
          .eq("status", "Disetujui");

        if (payload.ids && Array.isArray(payload.ids)) {
          lCol = lCol.in("user_id", payload.ids);
        } else {
          lCol = lCol.range(0, 49999);
        }

        const [{ data: mhs }, { data: logs }, { data: komp }] =
          await Promise.all([
            mCol,
            lCol,
            supabaseClient
              .from("kompetensi")
              .select("nama_skill, target_minimal, kategori"),
          ]);

        const logIndex = {};
        (logs || []).forEach((l) => {
          const key = `${l.user_id}|${l.kompetensi}`;
          logIndex[key] = (logIndex[key] || 0) + 1;
        });

        const rekap = (mhs || []).map((u) => ({
          user_id: u.id,
          nama: u.nama,
          prodi: u.prodi,
          rekap: (komp || []).map((k) => {
            const achieved = logIndex[`${u.id}|${k.nama_skill}`] || 0;
            return {
              nama_skill: k.nama_skill,
              kategori: k.kategori,
              target: k.target_minimal,
              capaian: achieved,
              status: achieved >= k.target_minimal ? "Tercapai" : "Belum",
            };
          }),
        }));
        return { success: true, data: rekap };
      }

      case "getPenilaianAkhir": {
        let query = supabaseClient
          .from("penilaian_akhir")
          .select("*, users!inner(nama, prodi, angkatan)");

        if (payload.ids && Array.isArray(payload.ids)) {
          query = query.in("id", payload.ids);
        } else if (payload.user_id) {
          query = query.eq("id", payload.user_id);
        }

        const [qRes, sRes] = await Promise.all([
          query,
          supabaseClient.from("settings").select("*"),
        ]);

        if (qRes.error) throw qRes.error;

        const sets = {};
        (sRes.data || []).forEach((x) => (sets[x.key] = parseFloat(x.value)));

        return {
          success: true,
          threshold: sets.batas_lulus || 75,
          weights: {
            prak: sets.w_prak || 40,
            askep: sets.w_askep || 40,
            sikap: sets.w_sikap || 20,
            klinik: sets.w_klinik || 50,
            akademik: sets.w_akademik || 50,
          },
          data: (qRes.data || []).map((p) => ({
            ...p,
            nama: p.users.nama,
            prodi: p.users.prodi,
            angkatan: p.users.angkatan,
          })),
        };
      }

      case "getAssignedStudents": {
        const { tempat_id, role } = payload;
        // Step 1: Get unique student IDs from ALL schedules at these locations using pagination
        let allJadwal = [];
        let from = 0;
        const step = 2000;
        let finished = false;

        while (!finished) {
          let jQ = supabaseClient.from("jadwal").select("user_id");
          if (tempat_id && tempat_id !== "-") {
            const tIds = tempat_id.split(",");
            jQ = jQ.in("tempat_id", tIds);
          }
          const { data, error } = await jQ.range(from, from + step - 1);
          if (error) throw error;
          if (data && data.length > 0) allJadwal = allJadwal.concat(data);
          if (!data || data.length < step) finished = true;
          else from += step;
        }

        const studentIds = [
          ...new Set((allJadwal || []).map((j) => j.user_id)),
        ];
        if (studentIds.length === 0) return { success: true, data: [] };

        // Step 2: Fetch user details for these students (already paginated in getUsers but we reuse logic here)
        const { data: users, error: uErr } = await supabaseClient
          .from("users")
          .select("id, username, nama, role, prodi, kelompok_id")
          .in("id", studentIds)
          .eq("role", "mahasiswa");

        if (uErr) throw uErr;
        return { success: true, data: users || [] };
      }

      case "getJadwal": {
        let allData = [];
        let from = 0;
        const step = 2000;
        let finished = false;

        while (!finished) {
          let query = supabaseClient
            .from("jadwal")
            .select("*, users(nama, kelompok_id), tempat_praktik(nama_tempat)");

          if (payload.user_id) {
            if (Array.isArray(payload.user_id)) {
              query = query.in("user_id", payload.user_id);
            } else {
              query = query.eq("user_id", payload.user_id);
            }
          } else if (payload.kelompok_id) {
            query = query.eq("users.kelompok_id", payload.kelompok_id);
          }

          const { data, error } = await query.range(from, from + step - 1);
          if (error) throw error;

          if (data && data.length > 0) {
            allData = allData.concat(data);
          }

          if (!data || data.length < step) {
            finished = true;
          } else {
            from += step;
          }
        }

        return {
          success: true,
          data: allData.map((j) => ({
            ...j,
            nama: j.users?.nama || "-",
            kelompok_id: j.users?.kelompok_id || null,
            nama_tempat: j.tempat_praktik?.nama_tempat || "-",
          })),
        };
      }

      case "getPresensi": {
        let query = supabaseClient.from("presensi").select("*");
        if (payload.user_id) query = query.eq("user_id", payload.user_id);
        if (payload.tanggal) query = query.eq("tanggal", payload.tanggal);
        const { data, error } = await query
          .order("tanggal", { ascending: false })
          .range(0, 49999);
        if (error) throw error;
        return { success: true, data: data || [] };
      }

      case "getLogbook": {
        let query = supabaseClient.from("logbook").select("*");
        if (payload.user_id) query = query.eq("user_id", payload.user_id);
        const { data, error } = await query
          .order("tanggal", { ascending: false })
          .range(0, 49999);
        if (error) throw error;
        return { success: true, data: data || [] };
      }

      case "getPendingLogs": {
        const { tempat_id } = payload;
        let allLogs = [];
        let from = 0;
        const step = 2000;
        let finished = false;

        while (!finished) {
          let query = supabaseClient
            .from("logbook")
            .select("*, users!inner(nama)")
            .eq("status", "Menunggu Validasi");

          const { data, error } = await query
            .order("tanggal", { ascending: true })
            .range(from, from + step - 1);

          if (error) throw error;
          if (data && data.length > 0) allLogs = allLogs.concat(data);
          if (!data || data.length < step) finished = true;
          else from += step;
        }

        if (tempat_id && tempat_id !== "-") {
          const tIds = tempat_id.split(",");
          // Fetch schedules for these locations to ensure they are actually assigned there on that date
          // Reuse pre-existing data or logic: for simplicity we can't easily pagination double loop here
          // without complexity, but usually schedules per hospital is manageable under certain limits.
          // Let's use the allJadwal logic if needed, but for now we follow the existing pattern with a safe fetch.

          const { data: schedules, error: sErr } = await supabaseClient
            .from("jadwal")
            .select("user_id, tanggal")
            .in("tempat_id", tIds)
            .range(0, 10000); // Higher safety range for schedule check

          if (sErr) throw sErr;

          const validLogs = allLogs.filter((log) =>
            schedules.some(
              (s) => s.user_id === log.user_id && s.tanggal === log.tanggal,
            ),
          );

          return {
            success: true,
            data: validLogs.map((l) => ({
              ...l,
              nama_mahasiswa: l.users.nama,
            })),
          };
        }

        return {
          success: true,
          data: (allLogs || []).map((l) => ({
            ...l,
            nama_mahasiswa: l.users.nama,
          })),
        };
      }

      case "getKelompok": {
        const [{ data: groups }, { data: users }] = await Promise.all([
          supabaseClient
            .from("kelompok")
            .select("id, nama_kelompok, pembimbing_id"),
          supabaseClient
            .from("users")
            .select("kelompok_id")
            .eq("role", "mahasiswa"),
        ]);
        return {
          success: true,
          data: (groups || []).map((g) => ({
            ...g,
            jumlah_anggota: (users || []).filter((u) => u.kelompok_id == g.id)
              .length,
          })),
        };
      }

      case "getPreviewSwap": {
        const [{ data: jadwalA }, { data: jadwalB }] = await Promise.all([
          supabaseClient
            .from("jadwal")
            .select("id")
            .eq("user_id", payload.user_a_id),
          supabaseClient
            .from("jadwal")
            .select("id")
            .eq("user_id", payload.user_b_id),
        ]);
        return {
          success: true,
          data: {
            jadwal_a_count: (jadwalA || []).length,
            jadwal_b_count: (jadwalB || []).length,
          },
        };
      }

      case "getSwapLog": {
        const { data, error } = await supabaseClient
          .from("swap_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        return { success: true, data: data || [] };
      }

      case "backupData": {
        const tables = [
          "users",
          "presensi",
          "logbook",
          "kompetensi",
          "tempat_praktik",
          "prodi",
          "jadwal",
          "settings",
          "kelompok",
          "penilaian_akhir",
          "penilaian_komponen",
          "bimb_praktikum",
          "bimb_askep",
          "sikap_perilaku",
          "swap_log",
        ];
        const backup = {};
        await Promise.all(
          tables.map(async (tbl) => {
            const { data } = await supabaseClient.from(tbl).select("*");
            backup[tbl] = data || [];
          }),
        );
        return { success: true, data: backup };
      }

      case "getNotif": {
        let query;
        if (payload.role === "admin") {
          query = supabaseClient
            .from("laporan")
            .select("id, tipe_kejadian, nama_pelapor, created_at")
            .eq("status", "Baru")
            .order("created_at", { ascending: false })
            .limit(20);
        } else if (payload.role && payload.role.includes("preseptor")) {
          // Optimization: restrict notifs to preceptor's hospital logs if possible
          let logQuery = supabaseClient
            .from("logbook")
            .select(
              "id, kompetensi, user_id, created_at, users!inner(tempat_id)",
            )
            .eq("status", "Menunggu Validasi");

          if (payload.tempat_id && payload.tempat_id !== "-") {
            const tIds = payload.tempat_id.split(",");
            logQuery = logQuery.in("lahan", tIds);
          }

          query = logQuery.order("created_at", { ascending: false }).limit(20);
        } else {
          query = supabaseClient
            .from("logbook")
            .select("id, kompetensi, status, feedback, created_at")
            .eq("user_id", payload.user_id)
            .neq("status", "Menunggu Validasi")
            .order("created_at", { ascending: false })
            .limit(10);
        }
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data: data || [] };
      }

      case "getStudentGrades": {
        const { student_id, grader_role } = payload;
        const { data, error } = await supabaseClient
          .from("penilaian_komponen")
          .select("*")
          .eq("student_id", student_id)
          .eq("role_pemberi", grader_role);
        if (error) throw error;

        // Group by type
        const grouped = {
          praktikum: (data || []).filter((g) => g.type === "praktikum"),
          askep: (data || []).filter((g) => g.type === "askep"),
          sikap: (data || []).filter((g) => g.type === "sikap"),
        };
        return { success: true, data: grouped };
      }

      default: {
        const tableMap = {
          tempat: "tempat_praktik",
          prodi: "prodi",
          kompetensi: "kompetensi",
          kompetensiall: "kompetensi",
          kelompok: "kelompok",
          laporan: "laporan",
          presensi: "presensi",
          logbook: "logbook",
          bimb_praktikum: "bimb_praktikum",
          bimbpraktikum: "bimb_praktikum",
          bimb_askep: "bimb_askep",
          bimbaskep: "bimb_askep",
          sikap_perilaku: "sikap_perilaku",
          sikapperilaku: "sikap_perilaku",
          allpresensi: "presensi",
          getallpresensi: "presensi",
        };
        const actionTable = action.replace("get", "").toLowerCase();
        const tbl =
          tableMap[actionTable] ||
          tableMap[action.toLowerCase()] ||
          actionTable;

        let query = supabaseClient.from(tbl).select("*");

        // Basic default filtering if user_id is provided in payload for unknown actions
        if (
          payload.user_id &&
          ["presensi", "logbook", "laporan"].includes(tbl)
        ) {
          query = query.eq("user_id", payload.user_id);
        }

        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data: data || [] };
      }
    }
  } catch (err) {
    console.error(`Supabase Fetch Error [${action}]:`, err);
    return { success: false, message: err.message };
  }
};

window.supabasePostAPI = async (action, payload) => {
  if (!supabaseClient) {
    await new Promise((r) => setTimeout(r, 600));
    return { success: true, message: "Berhasil (Demo Mode)" };
  }

  try {
    switch (action) {
      case "updateBroadcast": {
        const { message } = payload;
        const { error } = await supabaseClient
          .from("settings")
          .upsert(
            { key: "broadcast_message", value: message },
            { onConflict: "key" },
          );
        if (error) throw error;
        return { success: true };
      }

      case "checkIn": {
        const row = {
          user_id: payload.user_id,
          tanggal: getLocalTodayService(),
          jam_masuk: getLocalTimeService(),
          lahan: payload.lahan,
          foto: payload.foto || null,
        };
        const { error } = await supabaseClient.from("presensi").insert([row]);
        if (error) throw error;
        return { success: true, message: "Berhasil Check-In" };
      }

      case "checkOut": {
        const today = getLocalTodayService();
        const now = getLocalTimeService();
        const { data, error: errF } = await supabaseClient
          .from("presensi")
          .select("*")
          .eq("user_id", payload.user_id)
          .eq("tanggal", today)
          .is("jam_keluar", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (errF || !data) throw new Error("Tidak menemukan presensi aktif");
        const t1 = new Date(`${today}T${data.jam_masuk}`);
        const t2 = new Date(`${today}T${now}`);
        const durasi = Math.abs(t2 - t1) / 36e5;
        const { error } = await supabaseClient
          .from("presensi")
          .update({ jam_keluar: now, durasi })
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
            feedback: payload.catatan || payload.feedback,
            validated_at: new Date().toISOString(),
          })
          .eq("id", payload.log_id || payload.id);
        if (error) throw error;
        return { success: true };
      }

      case "validasiLogBulk": {
        const { ids, status, nilai, feedback } = payload;
        const { error } = await supabaseClient
          .from("logbook")
          .update({
            status: status,
            nilai: nilai || 100,
            feedback: feedback || "Validasi Massal",
            validated_at: new Date().toISOString(),
          })
          .in("id", ids);
        if (error) throw error;
        return {
          success: true,
          message: `Berhasil memvalidasi ${ids.length} data`,
        };
      }

      case "addLaporan": {
        const { error } = await supabaseClient.from("laporan").insert([
          {
            user_id_pelapor: payload.user_id,
            nama_pelapor: payload.nama_pelapor,
            role_pelapor: payload.role_pelapor,
            tipe_kejadian: payload.tipe_kejadian,
            nama_terlapor: payload.nama_terlapor,
            deskripsi: payload.deskripsi,
            student_id: payload.student_id,
            tanggal: new Date().toISOString(),
            status: "Baru",
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

      case "deleteLaporan": {
        const { error } = await supabaseClient
          .from("laporan")
          .delete()
          .eq("id", payload.id);
        if (error) throw error;
        return { success: true };
      }

      case "saveSettings": {
        const updates = Object.entries(payload).map(([k, v]) => ({
          key: k,
          value: v.toString(),
        }));
        const { error } = await supabaseClient
          .from("settings")
          .upsert(updates, { onConflict: "key" });
        if (error) throw error;
        return { success: true };
      }

      case "addUser": {
        if (!payload.id && payload.username) payload.id = payload.username;
        const { error } = await supabaseClient.from("users").insert([payload]);
        if (error) throw error;
        return { success: true, message: "Berhasil ditambahkan" };
      }

      case "editUser":
      case "updateUser": {
        const { error } = await supabaseClient
          .from("users")
          .update(payload)
          .eq("id", payload.id);
        if (error) throw error;
        return { success: true, message: "Berhasil diperbarui" };
      }

      case "deleteUser": {
        const { error } = await supabaseClient
          .from("users")
          .delete()
          .eq("id", payload.id);
        if (error) throw error;
        return { success: true };
      }

      case "clearUsersByRole": {
        const { error } = await supabaseClient
          .from("users")
          .delete()
          .eq("role", payload.role);
        if (error) throw error;
        return {
          success: true,
          message: `Berhasil menghapus data ${payload.role}`,
        };
      }

      case "setKelompokBulk": {
        const { error } = await supabaseClient
          .from("users")
          .update({ kelompok_id: payload.kelompok_id })
          .in("id", payload.member_ids);
        if (error) throw error;
        return { success: true };
      }

      case "swapKelompokMember": {
        const { user_a_id, user_b_id, kelompok_a_id, kelompok_b_id, admin_id } =
          payload;

        // 1. Get user names for logging
        const [{ data: userA }, { data: userB }] = await Promise.all([
          supabaseClient
            .from("users")
            .select("id, nama, kelompok_id")
            .eq("id", user_a_id)
            .single(),
          supabaseClient
            .from("users")
            .select("id, nama, kelompok_id")
            .eq("id", user_b_id)
            .single(),
        ]);
        if (!userA || !userB) throw new Error("Data mahasiswa tidak ditemukan");

        // 2. Get kelompok names for logging
        const [{ data: kelA }, { data: kelB }] = await Promise.all([
          supabaseClient
            .from("kelompok")
            .select("nama_kelompok")
            .eq("id", kelompok_a_id)
            .single(),
          supabaseClient
            .from("kelompok")
            .select("nama_kelompok")
            .eq("id", kelompok_b_id)
            .single(),
        ]);

        // 3. Swap kelompok_id on users
        await Promise.all([
          supabaseClient
            .from("users")
            .update({ kelompok_id: kelompok_b_id })
            .eq("id", user_a_id),
          supabaseClient
            .from("users")
            .update({ kelompok_id: kelompok_a_id })
            .eq("id", user_b_id),
        ]);

        // 4. Swap jadwal: use a temporary placeholder to avoid conflicts
        //    Step A: Get all jadwal IDs for both users
        const [{ data: jadwalA }, { data: jadwalB }] = await Promise.all([
          supabaseClient.from("jadwal").select("id").eq("user_id", user_a_id),
          supabaseClient.from("jadwal").select("id").eq("user_id", user_b_id),
        ]);

        const idsA = (jadwalA || []).map((j) => j.id);
        const idsB = (jadwalB || []).map((j) => j.id);
        const totalSwapped = idsA.length + idsB.length;

        //    Step B: Move all schedules originally belonging to A into B
        if (idsA.length > 0) {
          await supabaseClient
            .from("jadwal")
            .update({ user_id: user_b_id })
            .in("id", idsA);
        }
        //    Step C: Move all schedules originally belonging to B into A
        if (idsB.length > 0) {
          await supabaseClient
            .from("jadwal")
            .update({ user_id: user_a_id })
            .in("id", idsB);
        }

        // 5. Log the swap
        await supabaseClient.from("swap_log").insert([
          {
            user_a_id,
            user_b_id,
            nama_a: userA.nama,
            nama_b: userB.nama,
            kelompok_a_id,
            kelompok_b_id,
            kelompok_a_nama: kelA ? kelA.nama_kelompok : "",
            kelompok_b_nama: kelB ? kelB.nama_kelompok : "",
            jadwal_swapped: totalSwapped,
            admin_id: admin_id || "system",
          },
        ]);

        return {
          success: true,
          message: `Berhasil menukar ${userA.nama} ↔ ${userB.nama} (${totalSwapped} jadwal ditukar)`,
        };
      }

      case "addMaster":
      case "editMaster": {
        const allowedTypes = [
          "tempat",
          "prodi",
          "kompetensi",
          "kelompok",
          "bimb_praktikum",
          "bimb_askep",
          "sikap_perilaku",
        ];
        if (!allowedTypes.includes(payload.type)) {
          throw new Error(`Tipe master '${payload.type}' tidak diizinkan`);
        }
        const tableMap = {
          tempat: "tempat_praktik",
          prodi: "prodi",
          kompetensi: "kompetensi",
          kelompok: "kelompok",
          bimb_praktikum: "bimb_praktikum",
          bimb_askep: "bimb_askep",
          sikap_perilaku: "sikap_perilaku",
        };
        let tbl = tableMap[payload.type];
        let data = { id: payload.id || undefined };
        if (payload.type === "tempat") data.nama_tempat = payload.nama;
        else if (payload.type === "prodi") data.nama_prodi = payload.nama;
        else if (payload.type === "kompetensi") {
          data.nama_skill = payload.nama;
          data.target_minimal = payload.target;
          data.kategori = payload.kategori;
          data.angkatan = payload.angkatan;
        } else if (payload.type === "kelompok") {
          data.nama_kelompok = payload.nama;
          data.pembimbing_id = payload.pembimbing_id || null;
        } else if (
          payload.type === "bimb_praktikum" ||
          payload.type === "sikap_perilaku"
        ) {
          data.nama_komponen = payload.nama;
          data.nilai_maksimal = payload.nilai_maksimal;
        } else if (payload.type === "bimb_askep") {
          data.nama_komponen = payload.nama;
          data.bobot = payload.bobot;
          data.skor_maks = payload.skor_maks || 100;
        }
        const { error } = await supabaseClient.from(tbl).upsert(data);
        if (error) throw error;
        return { success: true, message: "Berhasil disimpan" };
      }

      case "deleteMaster": {
        const tableMap = {
          tempat: "tempat_praktik",
          prodi: "prodi",
          kompetensi: "kompetensi",
          kelompok: "kelompok",
          bimb_praktikum: "bimb_praktikum",
          bimb_askep: "bimb_askep",
          sikap_perilaku: "sikap_perilaku",
        };
        const tbl = tableMap[payload.type] || payload.type;
        const { error } = await supabaseClient
          .from(tbl)
          .delete()
          .eq("id", payload.id);
        if (error) throw error;
        return { success: true };
      }

      case "clearMaster": {
        const tableMap = {
          tempat: "tempat_praktik",
          prodi: "prodi",
          kompetensi: "kompetensi",
          kelompok: "kelompok",
          bimb_praktikum: "bimb_praktikum",
          bimb_askep: "bimb_askep",
          sikap_perilaku: "sikap_perilaku",
        };
        const tbl = tableMap[payload.type] || payload.type;
        const { error } = await supabaseClient
          .from(tbl)
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
        return {
          success: true,
          message: `Berhasil hapus data ${payload.type}`,
        };
      }

      case "importKelompokAssignment": {
        for (const item of payload.assignments) {
          const { data: g } = await supabaseClient
            .from("kelompok")
            .select("id")
            .eq("nama_kelompok", item.kelompok)
            .single();
          if (g)
            await supabaseClient
              .from("users")
              .update({ kelompok_id: g.id })
              .eq("username", item.username);
        }
        return { success: true, message: "Import assignment selesai" };
      }

      case "generateJadwalKelompok": {
        if (payload.clearExisting) {
          if (payload.kelompokIds && payload.kelompokIds.length > 0) {
            const { data: uC } = await supabaseClient
              .from("users")
              .select("id")
              .in("kelompok_id", payload.kelompokIds);
            const uids = (uC || []).map((u) => u.id);
            if (uids.length > 0)
              await supabaseClient.from("jadwal").delete().in("user_id", uids);
          } else {
            await supabaseClient
              .from("jadwal")
              .delete()
              .neq("id", "00000000-0000-0000-0000-000000000000");
          }
        }
        const { data: users } = await supabaseClient
          .from("users")
          .select("id, kelompok_id");
        const rows = [];
        (payload.assignments || []).forEach((a) => {
          const members = (users || []).filter(
            (u) => u.kelompok_id === a.kelompok_id,
          );
          members.forEach((m) => {
            let curr = new Date(a.tgl_mulai);
            let end = new Date(a.tgl_selesai);
            while (curr <= end) {
              for (let s = 1; s <= (payload.shiftCount || 3); s++) {
                rows.push({
                  user_id: m.id,
                  tempat_id: a.tempat_id,
                  tanggal: curr.toISOString().split("T")[0],
                  shift: s,
                });
              }
              curr.setDate(curr.getDate() + 1);
            }
          });
        });
        if (rows.length > 0) await supabaseClient.from("jadwal").insert(rows);
        return { success: true, message: "Jadwal kelompok berhasil disusun" };
      }

      case "generateJadwal": {
        if (payload.clearExisting)
          await supabaseClient
            .from("jadwal")
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000");
        const { data: mhs } = await supabaseClient
          .from("users")
          .select("id")
          .eq("role", "mahasiswa");
        const rows = [];
        let curr = new Date(payload.startDate);
        let end = new Date(payload.endDate);
        let locIdx = 0;
        while (curr <= end) {
          (mhs || []).forEach((m) => {
            const locId =
              payload.locationIds[locIdx % payload.locationIds.length];
            for (let s = 1; s <= (payload.shiftCount || 3); s++) {
              rows.push({
                user_id: m.id,
                tempat_id: locId,
                tanggal: curr.toISOString().split("T")[0],
                shift: s,
              });
            }
            locIdx++;
          });
          curr.setDate(curr.getDate() + 1);
        }
        if (rows.length > 0) await supabaseClient.from("jadwal").insert(rows);
        return { success: true, message: "Jadwal massal berhasil disusun" };
      }

      case "saveGrades": {
        const {
          student_id: payload_sid,
          role,
          p_id,
          grader_role,
          results,
        } = payload;
        const student_id = payload_sid || (results && results[0]?.student_id);

        // Verify if preceptor has permission to grade this student (assigned in jadwal)
        const { data: pUser } = await supabaseClient
          .from("users")
          .select("tempat_id")
          .eq("id", p_id)
          .single();

        if (pUser && pUser.tempat_id && pUser.tempat_id !== "-") {
          const tIds = pUser.tempat_id.split(",");
          const { data: hasSched } = await supabaseClient
            .from("jadwal")
            .select("id")
            .eq("user_id", student_id)
            .in("tempat_id", tIds)
            .limit(1);

          if (!hasSched || hasSched.length === 0) {
            throw new Error(
              "Anda tidak memiliki otoritas untuk menilai mahasiswa ini (Tidak ditemukan jadwal di lahan Anda).",
            );
          }
        }
        const preseptor_id =
          p_id || (results && results[0]?.preseptor_id) || "System";

        if (!student_id) throw new Error("ID Mahasiswa tidak ditemukan.");

        // 1. Ambil data existing penilaian komponen untuk student ini agar di-update, bukan duplikat
        const { data: existingG } = await supabaseClient
          .from("penilaian_komponen")
          .select("*")
          .eq("student_id", student_id)
          .eq("role_pemberi", grader_role);

        // 2. Map payload, sertakan ID jika sudah ada
        const upsertRows = results.map((r) => {
          const matched = (existingG || []).find(
            (ex) => ex.component_id === r.component_id && ex.type === r.type,
          );
          return {
            id: matched ? matched.id : undefined,
            student_id,
            preseptor_id,
            role_pemberi: grader_role,
            type: r.type,
            component_id: r.component_id,
            nilai: r.nilai,
          };
        });

        // Simpan komponen penilaian (Update jika sudah ada ID)
        await supabaseClient.from("penilaian_komponen").upsert(upsertRows);

        // Ambil SEMUA grades dari student tsb untuk hitung summary
        const { data: allG } = await supabaseClient
          .from("penilaian_komponen")
          .select("*")
          .eq("student_id", student_id);

        const { data: s } = await supabaseClient.from("settings").select("*");
        const sets = {};
        (s || []).forEach((x) => (sets[x.key] = parseFloat(x.value)));

        // Ambil data summary lama agar tidak overwrite kolom yang tidak diubah
        const { data: qSummary } = await supabaseClient
          .from("penilaian_akhir")
          .select("*")
          .eq("id", student_id);

        const oldSummary = qSummary && qSummary.length > 0 ? qSummary[0] : null;

        const summary = { ...(oldSummary || {}), id: student_id };
        let final = 0;

        ["preseptor", "preseptor_akademik"].forEach((role) => {
          let roleScore = 0;
          ["praktikum", "askep", "sikap"].forEach((type) => {
            const g = (allG || []).filter(
              (x) => x.role_pemberi === role && x.type === type,
            );
            if (g.length) {
              const avg =
                g.reduce((a, b) => a + parseFloat(b.nilai), 0) / g.length;
              const weight =
                type === "praktikum"
                  ? sets.w_prak || 40
                  : type === "askep"
                    ? sets.w_askep || 40
                    : sets.w_sikap || 20;
              roleScore += (avg * weight) / 100;
              summary[
                `${role === "preseptor" ? "klinik" : "akademik"}_${type === "praktikum" ? "prak" : type}`
              ] = avg;
            }
          });
          summary[`${role === "preseptor" ? "klinik" : "akademik"}_total`] =
            roleScore;

          const roleWeight =
            role === "preseptor" ? sets.w_klinik || 50 : sets.w_akademik || 50;
          final += (roleScore * roleWeight) / 100;
        });

        summary.total = final;
        summary.status = final >= (sets.batas_lulus || 75) ? "LULUS" : "REMIDI";
        summary.updated_at = new Date().toISOString();

        await supabaseClient.from("penilaian_akhir").upsert(summary);
        return { success: true };
      }

      case "importMaster": {
        const tableMap = {
          tempat: "tempat_praktik",
          prodi: "prodi",
          kompetensi: "kompetensi",
        };
        const tbl = tableMap[payload.type] || payload.type;

        // Try batch upsert first
        const { error: batchErr } = await supabaseClient
          .from(tbl)
          .upsert(payload.data);

        if (batchErr) {
          console.warn(
            "Batch master import failed, falling back to one-by-one",
            batchErr,
          );
          for (const item of payload.data) {
            await supabaseClient.from(tbl).upsert(item);
          }
        }

        return {
          success: true,
          message: `Berhasil impor ${payload.data.length} data`,
        };
      }

      case "importUsers": {
        const results = {
          successCount: 0,
          failCount: 0,
          failedRows: [],
        };

        try {
          // 1. Dapatkan daftar user yang sudah ada untuk memisahkan INSERT vs UPDATE
          const { data: existingUsers } = await supabaseClient
            .from("users")
            .select("id");
          const existingIds = new Set(
            (existingUsers || []).map((u) => String(u.id)),
          );

          // 2. Berikan default password untuk user yang benar-benar baru jika kosong
          const processedUsers = payload.users.map((u) => {
            const isNew = !existingIds.has(String(u.id));
            if (isNew && !u.password) {
              return { ...u, password: hashPassword("123456") };
            }
            return u;
          });

          // 3. Eksekusi Batch Upsert (Upsert menangani id yang ada dengan update, id baru dengan insert)
          // Jika ada kolom non-nullable yang hilang di baris BARU (Insert), ini akan gagal satu batch.
          const { error: batchErr } = await supabaseClient
            .from("users")
            .upsert(processedUsers, { onConflict: "id" });

          if (!batchErr) {
            results.successCount = processedUsers.length;
          } else {
            // Fallback one-by-one jika batch gagal total
            for (const u of processedUsers) {
              const { error: singleErr } = await supabaseClient
                .from("users")
                .upsert(u, { onConflict: "id" });

              if (singleErr) {
                results.failCount++;
                results.failedRows.push({
                  row: "Import",
                  data: u,
                  reason: singleErr.message,
                });
              } else {
                results.successCount++;
              }
            }
          }
        } catch (e) {
          throw e;
        }

        return {
          success: true,
          summary: results,
        };
      }

      case "updatePassword": {
        const { data: user } = await supabaseClient
          .from("users")
          .select("password")
          .eq("id", payload.user_id)
          .single();
        if (!user || user.password !== payload.oldPassword)
          throw new Error("Password lama salah");
        const { error } = await supabaseClient
          .from("users")
          .update({ password: payload.newPassword })
          .eq("id", payload.user_id);
        if (error) throw error;
        return { success: true };
      }

      case "repairUsers": {
        const { data } = await supabaseClient.from("users").select("*");
        for (const u of data || []) {
          if (!u.id || !u.nama) continue; // Skip null entries
          const cleaned = {
            id: u.id.toString().trim(),
            nama: u.nama.toString().trim(),
            prodi: u.prodi ? u.prodi.toString().trim() : "-",
            angkatan: u.angkatan ? u.angkatan.toString().trim() : "-",
          };
          await supabaseClient.from("users").update(cleaned).eq("id", u.id);
        }
        return { success: true, message: "Database user berhasil dirapikan" };
      }

      case "restoreData": {
        const tables = Object.keys(payload.backup);
        for (const tbl of tables) {
          if (payload.backup[tbl] && payload.backup[tbl].length > 0) {
            await supabaseClient.from(tbl).upsert(payload.backup[tbl]);
          }
        }
        return { success: true, message: "Restorasi data berhasil dilakukan" };
      }

      case "clearAllGrades": {
        await Promise.all([
          supabaseClient.from("penilaian_akhir").delete().neq("id", "00-00"),
          supabaseClient
            .from("penilaian_komponen")
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000"),
        ]);
        return {
          success: true,
          message: "Seluruh data penilaian berhasil dibersihkan",
        };
      }

      default:
        return { success: false, message: `Aksi ${action} tidak dikenali` };
    }
  } catch (err) {
    console.error(`Supabase Post Error [${action}]:`, err);
    return { success: false, message: err.message };
  }
};
