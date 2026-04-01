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
          const today = new Date().toISOString().split("T")[0];
          const [logs, pres] = await Promise.all([
            supabaseClient
              .from("logbook")
              .select("*", { count: "exact", head: true })
              .eq("user_id", payload.user_id),
            supabaseClient
              .from("presensi")
              .select("*")
              .eq("user_id", payload.user_id)
              .eq("tanggal", today)
              .limit(1),
          ]);
          return {
            success: true,
            data: {
              logbookDiisi: logs.count || 0,
              logbookBelumDiisi: 0,
              presensiHariIni: pres.data && pres.data.length > 0,
            },
          };
        }

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

      case "getUsers": {
        const { data, error } = await supabaseClient
          .from("users")
          .select(
            "id, username, nama, role, prodi, kelompok_id, tempat_id, angkatan, no_telp",
          )
          .order("nama", { ascending: true });
        if (error) throw error;
        return {
          success: true,
          data: (data || []).map((u) => ({
            ...u,
            kelompok: u.kelompok_id,
            tempat_id: u.tempat_id || "-",
          })),
        };
      }

      case "getPendingLogs": {
        const { data, error } = await supabaseClient
          .from("logbook")
          .select("*, users!inner(nama)")
          .eq("status", "Menunggu Validasi")
          .order("tanggal", { ascending: true });
        if (error) throw error;
        return {
          success: true,
          data: data.map((l) => ({ ...l, nama_mahasiswa: l.users.nama })),
        };
      }

      case "getAllPresensi": {
        const { data, error } = await supabaseClient
          .from("presensi")
          .select("*, users!inner(nama, prodi)");
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

      case "getRekapLogbook": {
        const [{ data: mhs }, { data: logs }, { data: komp }] =
          await Promise.all([
            supabaseClient
              .from("users")
              .select("id, nama, prodi")
              .eq("role", "mahasiswa"),
            supabaseClient
              .from("logbook")
              .select("user_id, kompetensi")
              .eq("status", "Disetujui"),
            supabaseClient
              .from("kompetensi")
              .select("nama_skill, target_minimal, kategori"),
          ]);

        // Pre-index logs by user_id+kompetensi for O(1) lookup
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
        const { data, error } = await supabaseClient
          .from("penilaian_akhir")
          .select("*, users!inner(nama, prodi, angkatan)");
        if (error) throw error;
        return {
          success: true,
          data: data.map((p) => ({
            ...p,
            nama: p.users.nama,
            prodi: p.users.prodi,
            angkatan: p.users.angkatan,
          })),
        };
      }

      case "getJadwal": {
        const { data, error } = await supabaseClient
          .from("jadwal")
          .select(
            "*, users!inner(nama, kelompok_id), tempat_praktik!inner(nama_tempat)",
          );
        if (error) throw error;
        return {
          success: true,
          data: data.map((j) => ({
            ...j,
            nama: j.users.nama,
            kelompok_id: j.users.kelompok_id,
            nama_tempat: j.tempat_praktik.nama_tempat,
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
          query = supabaseClient
            .from("logbook")
            .select("id, kompetensi, user_id, created_at")
            .eq("status", "Menunggu Validasi")
            .order("created_at", { ascending: false })
            .limit(20);
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
        const { data, error } = await supabaseClient.from(tbl).select("*");
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
      case "checkIn": {
        const row = {
          user_id: payload.user_id,
          tanggal: new Date().toISOString().split("T")[0],
          jam_masuk: new Date().toLocaleTimeString("id-id", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
          }),
          lahan: payload.lahan,
          foto: payload.foto || null,
        };
        const { error } = await supabaseClient.from("presensi").insert([row]);
        if (error) throw error;
        return { success: true, message: "Berhasil Check-In" };
      }

      case "checkOut": {
        const today = new Date().toISOString().split("T")[0];
        const now = new Date().toLocaleTimeString("id-id", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        });
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
          })
          .eq("id", payload.log_id || payload.id);
        if (error) throw error;
        return { success: true };
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

      case "addUser":
      case "editUser":
      case "updateUser": {
        if (!payload.id && payload.username) payload.id = payload.username;
        const { error } = await supabaseClient
          .from("users")
          .upsert(payload, { onConflict: "id" });
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
        } else if (payload.type === "kelompok")
          data.nama_kelompok = payload.nama;
        else if (
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
        if (payload.clearExisting)
          await supabaseClient
            .from("jadwal")
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000");
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
        const { grader_role, results } = payload;
        const student_id = payload.student_id || results[0]?.student_id;
        const preseptor_id = results[0]?.preseptor_id || "System";

        if (!student_id) throw new Error("ID Mahasiswa tidak ditemukan.");

        // Simpan komponen penilaian
        await supabaseClient.from("penilaian_komponen").upsert(
          results.map((r) => ({
            student_id,
            preseptor_id,
            role_pemberi: grader_role,
            type: r.type,
            component_id: r.component_id,
            nilai: r.nilai,
          })),
        );

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
        const { error } = await supabaseClient.from(tbl).upsert(payload.data);
        if (error) throw error;
        return {
          success: true,
          message: `Berhasil impor ${payload.data.length} data`,
        };
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
