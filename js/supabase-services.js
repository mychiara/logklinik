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
          .select(
            "id, username, password, nama, role, prodi, tempat_id, angkatan, kelompok_id",
          )
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
              .select("id", { count: "exact", head: true })
              .eq("role", "mahasiswa"),
            supabaseClient
              .from("kelompok")
              .select("id", { count: "exact", head: true }),
            supabaseClient
              .from("users")
              .select("id", { count: "exact", head: true })
              .eq("role", "preseptor"),
            supabaseClient
              .from("users")
              .select("id", { count: "exact", head: true })
              .eq("role", "preseptor_akademik"),
            supabaseClient
              .from("tempat_praktik")
              .select("id", { count: "exact", head: true }),
            supabaseClient
              .from("kompetensi")
              .select("id", { count: "exact", head: true }),
            supabaseClient
              .from("penilaian_akhir")
              .select("id", { count: "exact", head: true }),
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
          const [logs, pres, schedRes] = await Promise.all([
            supabaseClient
              .from("logbook")
              .select("id", { count: "exact", head: true })
              .eq("user_id", payload.user_id),
            supabaseClient
              .from("presensi")
              .select("id", { count: "exact", head: true })
              .eq("user_id", payload.user_id),
            supabaseClient
              .from("jadwal")
              .select("tanggal")
              .eq("user_id", payload.user_id)
              .lte("tanggal", today),
          ]);

          // Filter out Sundays from schedule count to correctly calculate absences
          const validSchedules = (schedRes.data || []).filter((s) => {
            const d = new Date(s.tanggal);
            return d.getDay() !== 0; // Skip Sunday
          });

          const hadir = pres.count || 0;
          const totalSched = validSchedules.length || 0;
          const absen = Math.max(0, totalSched - hadir);

          const { data: presToday } = await supabaseClient
            .from("presensi")
            .select("id")
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
        let query = supabaseClient
          .from("presensi")
          .select(
            "id, user_id, tanggal, jam_masuk, jam_keluar, durasi, lahan, users(nama, prodi, username)",
          )
          .order("tanggal", { ascending: false });

        if (payload.user_ids) {
          query = query.in("user_id", payload.user_ids);
        } else if (payload.user_id) {
          query = query.eq("user_id", payload.user_id);
        }

        let allData = [];
        let from = 0;
        const step = 1000;
        let finished = false;

        while (!finished) {
          const { data, error } = await query.range(from, from + step - 1);
          if (error) throw error;
          if (data && data.length > 0) allData = allData.concat(data);
          if (!data || data.length < step) finished = true;
          else from += step;
        }

        return {
          success: true,
          data: (allData || []).map((p) => ({
            ...p,
            nama: p.users ? p.users.nama : "Luar Sistem",
            prodi: p.users ? p.users.prodi : "-",
            username: p.users ? p.users.username : "-",
          })),
        };
      }

      case "getLiveAttendance": {
        const today = getLocalTodayService();
        const tIds = payload.tempat_id ? payload.tempat_id.split(",") : [];

        let query = supabaseClient
          .from("presensi")
          .select(
            "id, user_id, tanggal, jam_masuk, jam_keluar, durasi, lahan, users(nama, nim:username)",
          )
          .eq("tanggal", today);

        if (tIds.length > 0) {
          const { data: sites } = await supabaseClient
            .from("tempat_praktik")
            .select("nama_tempat")
            .in("id", tIds);
          const names = (sites || []).map((s) => s.nama_tempat);
          query = query.in("lahan", names);
        }

        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data: data };
      }

      case "getMendesakLogs": {
        const yesterday = new Date(Date.now() - 86400000).toISOString();
        let query = supabaseClient
          .from("logbook")
          .select(
            "id, user_id, tanggal, kompetensi, users!logbook_user_id_fkey(nama)",
          )
          .eq("status", "Menunggu Validasi")
          .lt("created_at", yesterday);

        if (payload.tempat_id && payload.tempat_id !== "-") {
          const tIds = payload.tempat_id.split(",");
          const { data: sites } = await supabaseClient
            .from("tempat_praktik")
            .select("nama_tempat")
            .in("id", tIds);
          const names = (sites || []).map((s) => s.nama_tempat);
          query = query.in("lahan", names);
        }

        let allData = [];
        let from = 0;
        const step = 1000;
        let finished = false;

        while (!finished) {
          const { data, error } = await query
            .order("tanggal", { ascending: true })
            .range(from, from + step - 1);
          if (error) throw error;
          if (data && data.length > 0) allData = allData.concat(data);
          if (!data || data.length < step) finished = true;
          else from += step;
        }

        return {
          success: true,
          data: (allData || []).map((l) => ({
            ...l,
            nama_mahasiswa: l.users.nama,
          })),
        };
      }

      case "getCompetencyGap": {
        const tIds = payload.tempat_id
          ? payload.tempat_id.split(",").filter((id) => id.trim() !== "")
          : [];
        let lahanNames = [];

        if (tIds.length > 0) {
          const { data: sites } = await supabaseClient
            .from("tempat_praktik")
            .select("nama_tempat")
            .in("id", tIds);
          lahanNames = (sites || []).map((s) => s.nama_tempat);
        }

        if (lahanNames.length === 0) {
          // Fallback: if no specific lahan is assigned, maybe return based on all activity or empty
          // For now, let's treat as empty to be lahan-specific
          return { success: true, data: { rare: [], frequent: [] } };
        }

        const { data: logs, error: e1 } = await supabaseClient
          .from("logbook")
          .select("kompetensi")
          .in("lahan", lahanNames)
          .eq("status", "Disetujui");
        const { data: allKomp, error: e2 } = await supabaseClient
          .from("kompetensi")
          .select("nama_skill");

        if (e1 || e2) throw e1 || e2;

        const counts = {};
        logs.forEach(
          (l) => (counts[l.kompetensi] = (counts[l.kompetensi] || 0) + 1),
        );

        const gaps = allKomp.map((k) => ({
          nama: k.nama_skill,
          count: counts[k.nama_skill] || 0,
        }));

        const rare = [...gaps].sort((a, b) => a.count - b.count).slice(0, 5);
        const frequent = [...gaps]
          .filter((g) => g.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        return { success: true, data: { rare, frequent } };
      }

      case "getSkillLeaderboard": {
        const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();
        let allData = [];
        let from = 0;
        const step = 1000;
        let finished = false;

        while (!finished) {
          const { data, error } = await supabaseClient
            .from("logbook")
            .select("user_id, users!logbook_user_id_fkey(nama)")
            .eq("status", "Disetujui")
            .gt("created_at", lastWeek)
            .range(from, from + step - 1);
          if (error) throw error;
          if (data && data.length > 0) allData = allData.concat(data);
          if (!data || data.length < step) finished = true;
          else from += step;
        }

        const board = {};
        allData.forEach((l) => {
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
            .select("id", { count: "exact", head: true })
            .eq("status", "Disetujui"),
          supabaseClient
            .from("presensi")
            .select("id", { count: "exact", head: true })
            .eq("tanggal", today),
          supabaseClient.from("penilaian_akhir").select("total, users(prodi)"),
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
        const step = 1000;
        let finished = false;

        while (!finished) {
          const { data, error } = await supabaseClient
            .from("users")
            .select(
              "id, username, nama, role, prodi, kelompok_id, tempat_id, angkatan, no_telp",
            )
            .order("nama", { ascending: true })
            .order("id", { ascending: true })
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
          mCol = mCol.range(0, 999); // Increased limit for student batch
        }

        let lCol = supabaseClient
          .from("logbook")
          .select("user_id, kompetensi")
          .eq("status", "Disetujui");

        if (payload.ids && Array.isArray(payload.ids)) {
          lCol = lCol.in("user_id", payload.ids);
        }

        let allLogs = [];
        let fromLogs = 0;
        const stepLogs = 1000;
        let finishedLogs = false;

        while (!finishedLogs) {
          const { data, error } = await lCol.range(
            fromLogs,
            fromLogs + stepLogs - 1,
          );
          if (error) throw error;
          if (data && data.length > 0) allLogs = allLogs.concat(data);
          if (!data || data.length < stepLogs) finishedLogs = true;
          else fromLogs += stepLogs;
        }

        const [{ data: mhs }, { data: komp }] = await Promise.all([
          mCol,
          supabaseClient
            .from("kompetensi")
            .select("nama_skill, target_minimal, kategori"),
        ]);

        const logIndex = {};
        (allLogs || []).forEach((l) => {
          const key = `${l.user_id}|${l.kompetensi}`;
          logIndex[key] = (logIndex[key] || 0) + 1;
        });

        const rekap = (mhs || []).map((u) => {
          const categoryActions = {};
          const categorySkills = {};

          (komp || []).forEach((k) => {
            const kat = k.kategori || "Umum";
            if (!categoryActions[kat]) categoryActions[kat] = 0;
            if (!categorySkills[kat]) categorySkills[kat] = [];

            const achieved = logIndex[`${u.id}|${k.nama_skill}`] || 0;
            categoryActions[kat] += achieved;
            categorySkills[kat].push({
              nama_skill: k.nama_skill,
              capaian: achieved,
              target: k.target_minimal,
            });
          });

          // User requested: Target is 5 per category
          const categoryTarget = 5;

          const kategoriRekap = Object.keys(categoryActions).map((kat) => ({
            kategori: kat,
            capaian: categoryActions[kat],
            target: categoryTarget,
            status:
              categoryActions[kat] >= categoryTarget ? "Tercapai" : "Belum",
            skills: categorySkills[kat],
          }));

          return {
            user_id: u.id,
            nama: u.nama,
            prodi: u.prodi,
            rekap: kategoriRekap,
          };
        });
        return { success: true, data: rekap };
      }

      case "getPenilaianAkhir": {
        let query = supabaseClient
          .from("penilaian_akhir")
          .select("*, users(nama, username, prodi, angkatan)");

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

        // Fetch iteration details if requested
        let details = [];
        if (payload.withDetails && qRes.data && qRes.data.length > 0) {
          const sIds = qRes.data.map((p) => p.id);
          const { data: dRes } = await supabaseClient
            .from("penilaian_komponen")
            .select("*")
            .in("student_id", sIds);
          details = dRes || [];
        }

        return {
          success: true,
          threshold: sets.batas_lulus || 75,
          limit_input: sets.limit_input_penilaian || 1,
          weights: {
            prak: sets.w_prak || 40,
            askep: sets.w_askep || 40,
            sikap: sets.w_sikap || 20,
            logbook: sets.w_logbook || 0,
            klinik: sets.w_klinik || 50,
            akademik: sets.w_akademik || 50,
          },
          data: (qRes.data || []).map((p) => ({
            ...p,
            nama: p.users?.nama || "-",
            username: p.users?.username || "-",
            prodi: p.users?.prodi || "-",
            angkatan: p.users?.angkatan || "-",
          })),
          details: details,
        };
      }

      case "getAssignedStudents": {
        const { tempat_id, role } = payload;
        // Step 1: Get unique student IDs from ALL schedules at these locations using pagination
        let allJadwal = [];
        let from = 0;
        const step = 1000;
        let finished = false;

        while (!finished) {
          let jQ = supabaseClient.from("jadwal").select("user_id");
          if (tempat_id && tempat_id !== "-" && typeof tempat_id === "string") {
            const tIds = tempat_id.split(",");
            jQ = jQ.in("tempat_id", tIds);
          }
          const { data, error } = await jQ
            .order("id", { ascending: true })
            .range(from, from + step - 1);
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
        const step = 1000;
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
          } else if (payload.tanggal) {
            query = query.eq("tanggal", payload.tanggal);
          }

          const { data, error } = await query
            .order("id", { ascending: true })
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

        let allData = [];
        let from = 0;
        const step = 1000;
        let finished = false;

        while (!finished) {
          const { data, error } = await query
            .select(
              "id, user_id, tanggal, jam_masuk, jam_keluar, durasi, lahan",
            )
            .order("tanggal", { ascending: false })
            .range(from, from + step - 1);
          if (error) throw error;
          if (data && data.length > 0) allData = allData.concat(data);
          if (!data || data.length < step) finished = true;
          else from += step;
        }
        return { success: true, data: allData || [] };
      }

      case "getAntrianLogbook": {
        let allLogs = [];
        let from = 0;
        const step = 1000;
        let finished = false;

        // AGGRESSIVE FETCH: Increase fetch step and ensure total data coverage
        const maxLimit = 100000;
        while (!finished && allLogs.length < maxLimit) {
          const { data, error } = await supabaseClient
            .from("logbook")
            .select(
              "id, user_id, tanggal, lahan, kompetensi, level, status, nilai_klinik, nilai_akademik, nilai, feedback, preseptor_klinik_id, preseptor_akademik_id",
            )
            .order("tanggal", { ascending: false })
            .order("id", { ascending: false })
            .range(from, from + step - 1);

          if (error) {
            console.error("Critical Fetch Error:", error);
            throw error;
          }

          if (data && data.length > 0) {
            allLogs = allLogs.concat(data);
          }

          if (!data || data.length < step) {
            finished = true;
          } else {
            from += step;
          }
        }

        // Fetch user metadata to join in JS (avoids relationship cache issues)
        const userIds = [
          ...new Set([
            ...allLogs.map((l) => l.user_id),
            ...allLogs.map((l) => l.preseptor_klinik_id).filter(Boolean),
            ...allLogs.map((l) => l.preseptor_akademik_id).filter(Boolean),
          ]),
        ];

        const userMap = {};
        const fetchUserChunks = async (ids) => {
          const chunkSize = 500;
          for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const { data: usersData, error: uErr } = await supabaseClient
              .from("users")
              .select("id, nama, prodi, role, username")
              .in("id", chunk);
            if (uErr) console.error("User Chunk Fetch Error:", uErr);
            (usersData || []).forEach((u) => {
              if (u && u.id) userMap[u.id] = u;
            });
          }
        };

        await fetchUserChunks(userIds);

        const mappedData = (allLogs || []).map((l) => {
          const mhs = userMap[l.user_id] || {};
          const preK = userMap[l.preseptor_klinik_id] || {};
          const preA = userMap[l.preseptor_akademik_id] || {};

          return {
            ...l,
            nama_mahasiswa: mhs.nama || "Siswa Tidak Ditemukan",
            prodi_mahasiswa: mhs.prodi || "-",
            nim_mahasiswa: mhs.username || "-",
            nama_preseptor_klinik: preK.nama || "-",
            nama_preseptor_akademik: preA.nama || "-",
            nama_preseptor: preK.nama || preA.nama || "-",
            role_preseptor: preK.role || preA.role || "-",
          };
        });

        return {
          success: true,
          data: mappedData,
        };
      }

      case "getLogbook": {
        let query = supabaseClient
          .from("logbook")
          .select(
            "id, user_id, tanggal, lahan, kompetensi, level, preseptor_klinik_id, preseptor_akademik_id, status, nilai_klinik, nilai_akademik, nilai, feedback",
          );
        if (payload.user_id) query = query.eq("user_id", payload.user_id);

        let allData = [];
        let from = 0;
        const step = 1000;
        let finished = false;

        while (!finished) {
          const { data, error } = await query
            .order("tanggal", { ascending: false })
            .range(from, from + step - 1);
          if (error) throw error;
          if (data && data.length > 0) allData = allData.concat(data);
          if (!data || data.length < step) finished = true;
          else from += step;
        }

        // Fetch preceptor metadata
        const preseptorIds = [
          ...new Set([
            ...allData.map((l) => l.preseptor_klinik_id).filter(Boolean),
            ...allData.map((l) => l.preseptor_akademik_id).filter(Boolean),
          ]),
        ];
        let pMap = {};
        if (preseptorIds.length > 0) {
          const { data: pData } = await supabaseClient
            .from("users")
            .select("id, nama, role")
            .in("id", preseptorIds);
          (pData || []).forEach((u) => (pMap[u.id] = u));
        }

        const mapped = (allData || []).map((l) => {
          const preK = pMap[l.preseptor_klinik_id] || {};
          const preA = pMap[l.preseptor_akademik_id] || {};
          return {
            ...l,
            nama_preseptor_klinik: preK.nama || "-",
            nama_preseptor_akademik: preA.nama || "-",
            nama_preseptor: preK.nama || preA.nama || "-",
            role_preseptor: preK.role || preA.role || "-",
          };
        });

        return { success: true, data: mapped };
      }

      case "getPendingLogs": {
        const { tempat_id, user_id } = payload;

        // Fetch Settings & Current User Role
        const [{ data: sMode }, { data: pUser }] = await Promise.all([
          supabaseClient
            .from("settings")
            .select("value")
            .eq("key", "logbook_validation_mode")
            .single(),
          supabaseClient
            .from("users")
            .select("role")
            .eq(
              "id",
              user_id || (window.currentUser ? window.currentUser.id : null),
            )
            .single(),
        ]);

        const mode = sMode?.value || "1";
        const pRole = pUser?.role || "preseptor";

        let allLogs = [];
        let from = 0;
        const step = 1000;
        let finished = false;

        while (!finished) {
          let query = supabaseClient
            .from("logbook")
            .select("*, users!logbook_user_id_fkey(nama)");

          if (mode === "2") {
            const allowedStatuses = ["Menunggu Validasi"];
            if (pRole === "preseptor_akademik") {
              allowedStatuses.push("Disetujui (Klinik)");
            } else {
              allowedStatuses.push("Disetujui (Akademik)");
            }
            query = query.in("status", allowedStatuses);
          } else {
            query = query.eq("status", "Menunggu Validasi");
          }

          const { data, error } = await query
            .order("tanggal", { ascending: true })
            .order("id", { ascending: true })
            .range(from, from + step - 1);

          if (error) throw error;
          if (data && data.length > 0) allLogs = allLogs.concat(data);
          if (!data || data.length < step) finished = true;
          else from += step;
        }

        if (tempat_id && tempat_id !== "-") {
          const tIds = tempat_id.split(",");
          const { data: sites, error: sErr } = await supabaseClient
            .from("tempat_praktik")
            .select("nama_tempat")
            .in("id", tIds);

          if (sErr) throw sErr;

          const names = (sites || []).map((s) => s.nama_tempat);
          const validLogs = allLogs.filter((log) => names.includes(log.lahan));

          // Fetch competency categories to map
          const { data: kompData } = await supabaseClient
            .from("kompetensi")
            .select("nama_skill, kategori");
          const kompMap = {};
          (kompData || []).forEach((k) => (kompMap[k.nama_skill] = k.kategori));

          return {
            success: true,
            data: validLogs.map((l) => ({
              ...l,
              nama_mahasiswa: l.users.nama,
              kategori: kompMap[l.kompetensi] || "Umum",
            })),
          };
        }

        // Fetch competency categories to map
        const { data: kompData } = await supabaseClient
          .from("kompetensi")
          .select("nama_skill, kategori");
        const kompMap = {};
        (kompData || []).forEach((k) => (kompMap[k.nama_skill] = k.kategori));

        return {
          success: true,
          data: (allLogs || []).map((l) => ({
            ...l,
            nama_mahasiswa: l.users.nama,
            kategori: kompMap[l.kompetensi] || "Umum",
          })),
        };
      }

      case "getValidatedLogs": {
        const { tempat_id, user_id } = payload;

        // Fetch Settings & Current User Role
        const [{ data: sMode }, { data: pUser }] = await Promise.all([
          supabaseClient
            .from("settings")
            .select("value")
            .eq("key", "logbook_validation_mode")
            .single(),
          supabaseClient
            .from("users")
            .select("role")
            .eq(
              "id",
              user_id || (window.currentUser ? window.currentUser.id : null),
            )
            .single(),
        ]);

        const mode = sMode?.value || "1";
        const pRole = pUser?.role || "preseptor";

        let allLogs = [];
        let from = 0;
        const step = 1000;
        let finished = false;

        while (!finished) {
          let query = supabaseClient
            .from("logbook")
            .select("*, users!logbook_user_id_fkey(nama)");

          // In validated view, we show approved ones
          if (mode === "2") {
            const approvedStatuses = ["Disetujui"];
            if (pRole === "preseptor_akademik") {
              approvedStatuses.push("Disetujui (Akademik)");
            } else {
              approvedStatuses.push("Disetujui (Klinik)");
            }
            query = query.in("status", approvedStatuses);
          } else {
            query = query.eq("status", "Disetujui");
          }

          const { data, error } = await query
            .order("tanggal", { ascending: false })
            .order("id", { ascending: false })
            .range(from, from + step - 1);

          if (error) throw error;
          if (data && data.length > 0) allLogs = allLogs.concat(data);
          if (!data || data.length < step) finished = true;
          else from += step;
        }

        if (tempat_id && tempat_id !== "-") {
          const tIds = tempat_id.split(",");
          const { data: sites, error: sErr } = await supabaseClient
            .from("tempat_praktik")
            .select("nama_tempat")
            .in("id", tIds);

          if (sErr) throw sErr;

          const names = (sites || []).map((s) => s.nama_tempat);
          const validLogs = allLogs.filter((log) => names.includes(log.lahan));

          // Fetch competency categories to map
          const { data: kompData } = await supabaseClient
            .from("kompetensi")
            .select("nama_skill, kategori");
          const kompMap = {};
          (kompData || []).forEach((k) => (kompMap[k.nama_skill] = k.kategori));

          return {
            success: true,
            data: validLogs.map((l) => ({
              ...l,
              nama_mahasiswa: l.users.nama,
              kategori: kompMap[l.kompetensi] || "Umum",
            })),
          };
        }

        // Fetch competency categories to map
        const { data: kompData } = await supabaseClient
          .from("kompetensi")
          .select("nama_skill, kategori");
        const kompMap = {};
        (kompData || []).forEach((k) => (kompMap[k.nama_skill] = k.kategori));

        return {
          success: true,
          data: (allLogs || []).map((l) => ({
            ...l,
            nama_mahasiswa: l.users.nama,
            kategori: kompMap[l.kompetensi] || "Umum",
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
              "id, kompetensi, user_id, created_at, users!logbook_user_id_fkey(tempat_id)",
            )
            .eq("status", "Menunggu Validasi");

          if (payload.tempat_id && payload.tempat_id !== "-") {
            const tIds = payload.tempat_id.split(",");
            const { data: sites } = await supabaseClient
              .from("tempat_praktik")
              .select("nama_tempat")
              .in("id", tIds);
            const names = (sites || []).map((s) => s.nama_tempat);
            logQuery = logQuery.in("lahan", names);
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
    console.error(
      `Supabase Fetch Error [${action}]:`,
      JSON.stringify(err, null, 2) || err,
    );
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
        const today = getLocalTodayService();
        // Cegah double check-in hari yang sama
        const { data: existing } = await supabaseClient
          .from("presensi")
          .select("id")
          .eq("user_id", payload.user_id)
          .eq("tanggal", today)
          .limit(1);

        if (existing && existing.length > 0) {
          return {
            success: false,
            message:
              "Anda sudah melakukan presensi hari ini. Tidak dapat mengulang Check-In.",
          };
        }

        const row = {
          user_id: payload.user_id,
          tanggal: today,
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
        const { data: existing } = await supabaseClient
          .from("presensi")
          .select("*")
          .eq("user_id", payload.user_id)
          .eq("tanggal", today)
          .order("id", { ascending: false })
          .limit(1);

        if (!existing || existing.length === 0) {
          throw new Error("Anda belum melakukan Check-In hari ini.");
        }

        const data = existing[0];
        if (data.jam_keluar) {
          throw new Error("Anda sudah melakukan Check-Out hari ini.");
        }

        // Validasi Lokasi Check-Out (Harus sama dengan lokasi Check-In)
        if (
          payload.lahan &&
          data.lahan.toLowerCase().trim() !== payload.lahan.toLowerCase().trim()
        ) {
          throw new Error(
            `Lokasi Check-Out salah. Anda telah melakukan Check-In di ${data.lahan}, silakan Check-Out di lokasi tersebut.`,
          );
        }

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
        let { log_id, status, nilai, feedback, preseptor_id } = payload;

        // Clamp nilai to 0-100 for safety
        if (nilai !== undefined && nilai !== null) {
          nilai = Math.min(100, Math.max(0, parseFloat(nilai) || 0));
        }

        // Fetch Settings & Current Log Status & Values
        const [{ data: sMode }, { data: currLog }, { data: pUser }] =
          await Promise.all([
            supabaseClient
              .from("settings")
              .select("value")
              .eq("key", "logbook_validation_mode")
              .single(),
            supabaseClient
              .from("logbook")
              .select("status, nilai_klinik, nilai_akademik")
              .eq("id", log_id || payload.id)
              .single(),
            supabaseClient
              .from("users")
              .select("role")
              .eq("id", preseptor_id)
              .single(),
          ]);

        const mode = sMode?.value || "1";
        const currentStatus = currLog?.status || "Menunggu Validasi";
        const pRole = pUser?.role || "preseptor";

        let finalStatus = status;
        let updateData = {
          feedback: feedback || payload.catatan,
        };

        if (mode === "2" && status === "Disetujui") {
          let nk = currLog?.nilai_klinik;
          let na = currLog?.nilai_akademik;

          if (pRole === "preseptor_akademik") {
            na = nilai;
            updateData.nilai_akademik = na;
            updateData.preseptor_akademik_id = preseptor_id;
          } else {
            nk = nilai;
            updateData.nilai_klinik = nk;
            updateData.preseptor_klinik_id = preseptor_id;
          }

          // Determine Status
          if (currentStatus === "Menunggu Validasi") {
            finalStatus =
              pRole === "preseptor_akademik"
                ? "Disetujui (Akademik)"
                : "Disetujui (Klinik)";
          } else if (
            (currentStatus === "Disetujui (Klinik)" &&
              pRole === "preseptor_akademik") ||
            (currentStatus === "Disetujui (Akademik)" && pRole === "preseptor")
          ) {
            finalStatus = "Disetujui";
          } else {
            finalStatus = currentStatus;
          }

          // Combined score logic
          if (
            nk !== undefined &&
            nk !== null &&
            na !== undefined &&
            na !== null
          ) {
            updateData.nilai = (parseFloat(nk) + parseFloat(na)) / 2;
          } else {
            updateData.nilai = nilai; // temporary single score
          }
        } else {
          // Mode 1 or Rejection
          updateData.nilai = nilai;
          if (pRole === "preseptor_akademik") {
            updateData.nilai_akademik = nilai;
            updateData.preseptor_akademik_id = preseptor_id;
          } else {
            updateData.nilai_klinik = nilai;
            updateData.preseptor_klinik_id = preseptor_id;
          }
        }

        updateData.status = finalStatus;

        const { error } = await supabaseClient
          .from("logbook")
          .update(updateData)
          .eq("id", log_id || payload.id);
        if (error) throw error;
        return { success: true };
      }

      case "validasiLogBulk": {
        let { ids, status, nilai, feedback, preseptor_id } = payload;

        // Clamp nilai to 0-100 for safety
        if (nilai !== undefined && nilai !== null) {
          nilai = Math.min(100, Math.max(0, parseFloat(nilai) || 0));
        }

        // Fetch Settings & Current User Role
        const [{ data: sMode }, { data: pUser }, { data: currentLogs }] =
          await Promise.all([
            supabaseClient
              .from("settings")
              .select("value")
              .eq("key", "logbook_validation_mode")
              .single(),
            supabaseClient
              .from("users")
              .select("role")
              .eq("id", preseptor_id)
              .single(),
            supabaseClient
              .from("logbook")
              .select(
                "id, status, nilai_klinik, nilai_akademik, preseptor_klinik_id, preseptor_akademik_id",
              )
              .in("id", ids),
          ]);

        const mode = sMode?.value || "1";
        const pRole = pUser?.role || "preseptor";

        if (mode === "1" || status !== "Disetujui") {
          // Simple update for all
          let updateData = {
            status: status,
            nilai: nilai ?? 100,
            feedback: feedback || "Validasi Massal",
          };
          if (pRole === "preseptor_akademik")
            updateData.nilai_akademik = nilai ?? 100;
          else updateData.nilai_klinik = nilai ?? 100;

          const { error } = await supabaseClient
            .from("logbook")
            .update(updateData)
            .in("id", ids);
          if (error) throw error;
        } else {
          // 2-Stage Bulk: update individually based on current status
          const updates = currentLogs.map((l) => {
            let finalStatus = status;
            let nk = l.nilai_klinik;
            let na = l.nilai_akademik;

            if (pRole === "preseptor_akademik") {
              na = Math.min(100, Math.max(0, parseFloat(nilai || 100)));
            } else {
              nk = Math.min(100, Math.max(0, parseFloat(nilai || 100)));
            }

            if (l.status === "Menunggu Validasi") {
              finalStatus =
                pRole === "preseptor_akademik"
                  ? "Disetujui (Akademik)"
                  : "Disetujui (Klinik)";
            } else if (
              (l.status === "Disetujui (Klinik)" &&
                pRole === "preseptor_akademik") ||
              (l.status === "Disetujui (Akademik)" && pRole === "preseptor")
            ) {
              finalStatus = "Disetujui";
            } else {
              finalStatus = l.status;
            }

            let finalNilai = nilai ?? 100;
            if (nk && na) finalNilai = (parseFloat(nk) + parseFloat(na)) / 2;

            return supabaseClient
              .from("logbook")
              .update({
                status: finalStatus,
                nilai: finalNilai,
                nilai_klinik: nk,
                nilai_akademik: na,
                feedback: feedback || "Validasi Massal",
                [pRole === "preseptor_akademik"
                  ? "preseptor_akademik_id"
                  : "preseptor_klinik_id"]: preseptor_id,
              })
              .eq("id", l.id);
          });
          await Promise.all(updates);
        }

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

      case "bulkUpdateLaporanStatus": {
        const { error } = await supabaseClient
          .from("laporan")
          .update({ status: payload.status })
          .in("id", payload.ids);
        if (error) throw error;
        return { success: true };
      }

      case "bulkDeleteLaporan": {
        const { error } = await supabaseClient
          .from("laporan")
          .delete()
          .in("id", payload.ids);
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

      case "editPresensi": {
        const { id, jam_masuk, jam_keluar } = payload;

        // Fetch existing record to get tanggal (to recalculate durasi)
        const { data: record, error: errF } = await supabaseClient
          .from("presensi")
          .select("tanggal")
          .eq("id", id)
          .single();
        if (errF) throw errF;

        let durasi = null;
        if (jam_masuk && jam_keluar) {
          const t1 = new Date(`${record.tanggal}T${jam_masuk}`);
          const t2 = new Date(`${record.tanggal}T${jam_keluar}`);
          durasi = Math.abs(t2 - t1) / 36e5;
        }

        const { error } = await supabaseClient
          .from("presensi")
          .update({
            jam_masuk,
            jam_keluar: jam_keluar || null,
            durasi,
          })
          .eq("id", id);
        if (error) throw error;
        return { success: true };
      }

      case "deletePresensi": {
        const { error } = await supabaseClient
          .from("presensi")
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
          message: `Berhasil menukar ${userA.nama} â†” ${userB.nama} (${totalSwapped} jadwal ditukar)`,
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
          iteration = 1,
        } = payload;
        const student_id = payload_sid || (results && results[0]?.student_id);

        if (!student_id) throw new Error("ID Mahasiswa tidak ditemukan.");

        // Verify if preceptor has permission to grade this student (assigned in jadwal)
        const { data: pUser } = p_id
          ? await supabaseClient
              .from("users")
              .select("tempat_id")
              .eq("id", p_id)
              .single()
          : { data: null };

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

        // 1. Ambil data existing untuk iterasi ini
        const { data: existingG } = await supabaseClient
          .from("penilaian_komponen")
          .select("id, type, component_id")
          .eq("student_id", student_id)
          .eq("role_pemberi", grader_role)
          .eq("periode_ke", iteration);

        // 2. Map payload, tentukan mana yang update dan mana yang insert
        const rows = results.map((r) => {
          const matched = (existingG || []).find(
            (ex) => ex.component_id == r.component_id && ex.type === r.type,
          );
          return {
            id: matched ? matched.id : undefined,
            student_id,
            preseptor_id,
            role_pemberi: grader_role,
            type: r.type,
            periode_ke: iteration,
            component_id: isNaN(r.component_id)
              ? r.component_id
              : parseInt(r.component_id),
            nilai: parseFloat(r.nilai) || 0,
          };
        });

        const toUpdate = rows.filter((r) => r.id);
        const toInsert = rows
          .filter((r) => !r.id)
          .map(({ id, ...rest }) => rest);

        // 3. Eksekusi
        if (toUpdate.length > 0) {
          const { error: errU } = await supabaseClient
            .from("penilaian_komponen")
            .upsert(toUpdate);
          if (errU) throw errU;
        }

        if (toInsert.length > 0) {
          const { error: errI } = await supabaseClient
            .from("penilaian_komponen")
            .insert(toInsert);
          if (errI) throw errI;
        }

        // 4. Rekalkulasi Summary
        const [resAllG, resSets, resLogs] = await Promise.all([
          supabaseClient
            .from("penilaian_komponen")
            .select("*")
            .eq("student_id", student_id),
          supabaseClient.from("settings").select("*"),
          supabaseClient
            .from("logbook")
            .select("nilai, nilai_klinik, nilai_akademik")
            .eq("user_id", student_id)
            .eq("status", "Disetujui"),
        ]);

        const sets = {};
        (resSets.data || []).forEach(
          (x) => (sets[x.key] = parseFloat(x.value)),
        );

        const allG = resAllG.data || [];
        const logs = resLogs.data || [];

        // Hitung Nilai Rata-rata Logbook
        let avgLogbook = 0;
        if (logs.length > 0) {
          const targetMin = parseFloat(sets.target_logbook_minimal || 20);
          const totalVal = logs.reduce((acc, curr) => {
            const nk = parseFloat(curr.nilai_klinik);
            const na = parseFloat(curr.nilai_akademik);
            const nBase = parseFloat(curr.nilai);

            let v = 0;
            if (!isNaN(nk) && !isNaN(na)) v = (nk + na) / 2;
            else if (!isNaN(nk)) v = nk;
            else if (!isNaN(na)) v = na;
            else if (!isNaN(nBase)) v = nBase;

            return acc + v;
          }, 0);

          const qualityAvg = totalVal / logs.length;
          const quantityScore = Math.min(100, (logs.length / targetMin) * 100);
          // Rumus Bonus Frekuensi: 80% Kualitas + 20% Kuantitas
          avgLogbook = 0.8 * qualityAvg + 0.2 * quantityScore;
        }

        // Ambil data summary lama
        const { data: qSummary } = await supabaseClient
          .from("penilaian_akhir")
          .select("*")
          .eq("id", student_id);

        const oldSummary = qSummary && qSummary.length > 0 ? qSummary[0] : null;

        const summary = { ...(oldSummary || {}), id: student_id };
        let final = 0;

        const limitInput = parseInt(sets.limit_input_penilaian || 1);
        const wLogbook = parseFloat(sets.w_logbook || 0);
        const wForms = 100 - wLogbook;

        ["preseptor", "preseptor_akademik"].forEach((role) => {
          let roleScore = 0;
          ["praktikum", "askep", "sikap"].forEach((type) => {
            const items = allG.filter(
              (x) => x.role_pemberi === role && x.type === type,
            );
            if (items.length > 0) {
              // Rata-rata dari semua periode yang diisi (1..N)
              const periods = [...new Set(items.map((it) => it.periode_ke))];
              let sumOfAvg = 0;
              periods.forEach((p) => {
                const pItems = items.filter((it) => it.periode_ke === p);
                sumOfAvg +=
                  pItems.reduce((a, b) => a + parseFloat(b.nilai), 0) /
                  pItems.length;
              });
              const avg = sumOfAvg / periods.length;

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

        // Terapkan Bobot Logbook
        if (wLogbook > 0) {
          final = (final * wForms) / 100 + (avgLogbook * wLogbook) / 100;
        }

        summary.total = final;
        summary.logbook_avg = avgLogbook;
        summary.status = final >= (sets.batas_lulus || 75) ? "LULUS" : "REMIDI";
        summary.updated_at = new Date().toISOString();

        await supabaseClient.from("penilaian_akhir").upsert(summary);
        return { success: true };
      }

      case "recalculateAllFinalGrades": {
        // 1. Ambil semua mahasiswa yang punya nilai komponen
        const { data: allComps } = await supabaseClient
          .from("penilaian_komponen")
          .select("student_id");
        const uniqueSids = [
          ...new Set((allComps || []).map((c) => c.student_id)),
        ];
        if (uniqueSids.length === 0)
          return { success: true, message: "Tidak ada data untuk diproses" };

        // 2. Ambil Settings & Logbook yang disetujui (semuanya)
        const [resSets, resAllLogs] = await Promise.all([
          supabaseClient.from("settings").select("*"),
          supabaseClient
            .from("logbook")
            .select("user_id, nilai, nilai_klinik, nilai_akademik")
            .eq("status", "Disetujui"),
        ]);

        const sets = {};
        (resSets.data || []).forEach(
          (x) => (sets[x.key] = parseFloat(x.value)),
        );
        const wPrak = sets.w_prak || 40;
        const wAskep = sets.w_askep || 40;
        const wSikap = sets.w_sikap || 20;
        const wLogbook = sets.w_logbook || 0;
        const realWForms = 100 - wLogbook;
        const wKlinik = sets.w_klinik || 50;
        const wAkademik = sets.w_akademik || 50;
        const threshold = sets.batas_lulus || 75;
        const targetMinGlobal = parseFloat(sets.target_logbook_minimal || 20);

        // 3. Loop per Mahasiswa
        const summaries = [];
        for (const sid of uniqueSids) {
          const { data: myComps } = await supabaseClient
            .from("penilaian_komponen")
            .select("*")
            .eq("student_id", sid);
          const myLogs = (resAllLogs.data || []).filter(
            (l) => l.user_id === sid,
          );

          // Hitung Avg Logbook (80% Kualitas + 20% Kuantitas)
          let avgLog = 0;
          if (myLogs.length > 0) {
            const totalVal = myLogs.reduce((acc, curr) => {
              const nk = parseFloat(curr.nilai_klinik);
              const na = parseFloat(curr.nilai_akademik);
              const nb = parseFloat(curr.nilai);
              let v = 0;
              if (!isNaN(nk) && !isNaN(na)) v = (nk + na) / 2;
              else if (!isNaN(nk)) v = nk;
              else if (!isNaN(na)) v = na;
              else if (!isNaN(nb)) v = nb;
              return acc + v;
            }, 0);
            const qualityAvg = totalVal / myLogs.length;
            const quantityScore = Math.min(
              100,
              (myLogs.length / targetMinGlobal) * 100,
            );
            avgLog = 0.8 * qualityAvg + 0.2 * quantityScore;
          }

          const row = {
            id: sid,
            logbook_avg: avgLog,
            updated_at: new Date().toISOString(),
          };
          let final = 0;

          ["preseptor", "preseptor_akademik"].forEach((role) => {
            let roleScore = 0;
            ["praktikum", "askep", "sikap"].forEach((type) => {
              const items = (myComps || []).filter(
                (x) => x.role_pemberi === role && x.type === type,
              );
              if (items.length > 0) {
                const periods = [...new Set(items.map((it) => it.periode_ke))];
                let sumOfAvg = 0;
                periods.forEach((p) => {
                  const pItems = items.filter((it) => it.periode_ke === p);
                  sumOfAvg +=
                    pItems.reduce((a, b) => a + parseFloat(b.nilai), 0) /
                    pItems.length;
                });
                const avg = sumOfAvg / periods.length;
                const weight =
                  type === "praktikum"
                    ? wPrak
                    : type === "askep"
                      ? wAskep
                      : wSikap;
                roleScore += (avg * weight) / 100;
                row[
                  `${role === "preseptor" ? "klinik" : "akademik"}_${type === "praktikum" ? "prak" : type}`
                ] = avg;
              }
            });
            row[`${role === "preseptor" ? "klinik" : "akademik"}_total`] =
              roleScore;
            const roleWeight = role === "preseptor" ? wKlinik : wAkademik;
            final += (roleScore * roleWeight) / 100;
          });

          const totalFinal =
            (final * realWForms) / 100 + (avgLog * wLogbook) / 100;
          row.total = totalFinal;
          row.status = totalFinal >= threshold ? "LULUS" : "REMIDI";
          summaries.push(row);
        }

        if (summaries.length > 0) {
          const { error } = await supabaseClient
            .from("penilaian_akhir")
            .upsert(summaries);
          if (error) throw error;
        }

        return {
          success: true,
          message: `Berhasil sinkronisasi ${summaries.length} data mahasiswa.`,
        };
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
