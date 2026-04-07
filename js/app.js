// XSS Prevention Utility
function escapeHTML(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// STANDARD CSV EXPORT UTILITY
function downloadCSV(headers, rows, filename, extraText = "") {
  const quote = (val) => {
    let s = String(val === null || val === undefined ? "" : val).trim();
    // Escape quotes and wrap in quotes
    return `"${s.replace(/"/g, '""')}"`;
  };
  const headerLine = headers.map(quote).join(",");
  const rowLines = rows.map((row) => row.map(quote).join(",")).join("\n");
  const content = "\uFEFF" + headerLine + "\n" + rowLines + extraText;

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// SHA-256 Hash Utility for Password Security
async function hashPassword(pwd) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pwd);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

let currentUser = null;
let html5QrcodeScanner = null;
window.EKLINIK_CACHE = {};

// Cache Helper with Session Storage Persistence
async function fetchCachedAPI(action, payload = {}) {
  const cacheKey = `EKLINIK_CACHE_${action}`;

  if (
    Object.keys(payload).length === 0 &&
    ["getProdi", "getTempat", "getKelompok", "getKompetensi"].includes(action)
  ) {
    // Check in-memory first
    if (window.EKLINIK_CACHE[action]) {
      return { success: true, data: window.EKLINIK_CACHE[action] };
    }
    // Check session storage
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      window.EKLINIK_CACHE[action] = data;
      return { success: true, data };
    }
  }

  // Fallback to normal fetch
  const res = await fetchAPI(action, payload);

  if (
    res.success &&
    Object.keys(payload).length === 0 &&
    ["getProdi", "getTempat", "getKelompok", "getKompetensi"].includes(action)
  ) {
    window.EKLINIK_CACHE[action] = res.data;
    sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
  }

  return res;
}

function clearCache(action) {
  delete window.EKLINIK_CACHE[action];
  sessionStorage.removeItem(`EKLINIK_CACHE_${action}`);
}

// API Helper
async function fetchAPI(action, payload = {}) {
  if (typeof supabaseFetchAPI === "undefined") {
    showToast("Error Konfigurasi", "Supabase Config belum dimuat!", "error");
    return { success: false, message: "Supabase belum diatur" };
  }

  showLoader(true);
  try {
    const data = await supabaseFetchAPI(action, payload);
    showLoader(false);
    return data;
  } catch (error) {
    showLoader(false);
    showToast("Koneksi Gagal", error.message, "error");
    return { success: false, message: error.message };
  }
}

async function postAPI(action, payload = {}) {
  if (typeof supabasePostAPI === "undefined") {
    showToast("Error Konfigurasi", "Supabase Config belum dimuat!", "error");
    return { success: false, message: "Supabase belum diatur" };
  }

  showLoader(true);
  try {
    const data = await supabasePostAPI(action, payload);
    showLoader(false);
    return data;
  } catch (error) {
    showLoader(false);
    showToast(
      "Penyimpanan Gagal",
      "Terjadi kesalahan koneksi: " + error.message,
      "error",
    );
    return { success: false, message: error.message };
  }
}

// UI State
function checkAuth() {
  const user = localStorage.getItem("eblogbook_user");
  if (user) {
    currentUser = JSON.parse(user);
    document.getElementById("login-section").classList.add("hidden");
    document.getElementById("dashboard-section").classList.remove("hidden");
    initDashboard();
  } else {
    document.getElementById("login-section").classList.remove("hidden");
    document.getElementById("dashboard-section").classList.add("hidden");
  }
}

function initDashboard() {
  document.getElementById("user-name-display").textContent = currentUser.nama;

  const displayRoles = {
    mahasiswa: "Mahasiswa",
    preseptor: "Preseptor Klinik",
    preseptor_akademik: "Preseptor Akademik",
    admin: "Administrator",
  };
  const roleName = displayRoles[currentUser.role] || currentUser.role;

  let roleText = `<i class="fa-solid fa-shield-halved fa-sm"></i> ${roleName}`;
  if (currentUser.tempat_id && currentUser.tempat_id !== "-") {
    roleText += ` <span class="badge bg-primary-soft text-primary" style="margin-left:5px; font-size:0.7rem; text-transform:none;"><i class="fa-solid fa-hospital"></i> Lahan Aktif</span>`;
  }
  document.getElementById("user-role-display").innerHTML = roleText;
  document.getElementById("user-avatar-img").src =
    `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.nama)}&background=8b5cf6&color=fff&bold=true`;

  // Setup Sidebar Nav based on Role
  const nav = document.getElementById("sidebar-nav");
  nav.innerHTML = "";

  const menus = {
    mahasiswa: [
      {
        id: "nav-dashboard",
        icon: "fa-chart-pie",
        text: "Dashboard",
        view: "dashboardView",
      },
      {
        id: "nav-presensi",
        icon: "fa-clock",
        text: "Presensi Harian",
        view: "presensiView",
      },
      {
        id: "nav-jadwal-mhs",
        icon: "fa-calendar-alt",
        text: "Jadwal Saya",
        view: "jadwalMahasiswaView",
      },
      {
        id: "nav-logbook",
        icon: "fa-book-open",
        text: "Logbook Tindakan",
        view: "logbookView",
      },
      {
        id: "nav-nilai-mhs",
        icon: "fa-graduation-cap",
        text: "Nilai Saya",
        view: "nilaiMahasiswaView",
      },
      {
        id: "nav-info-praktik",
        icon: "fa-circle-info",
        text: "Informasi Praktik",
        view: "informasiPraktikView",
      },
    ],
    preseptor: [
      {
        id: "nav-dashboard",
        icon: "fa-chart-pie",
        text: "Dashboard",
        view: "dashboardView",
      },
      {
        id: "nav-validasi",
        icon: "fa-check-double",
        text: "Validasi Logbook",
        view: "validasiView",
      },
      {
        id: "nav-mhs",
        icon: "fa-users",
        text: "Mahasiswa Bimbingan",
        view: "mahasiswaView",
      },
    ],
    preseptor_akademik: [
      {
        id: "nav-dashboard",
        icon: "fa-chart-pie",
        text: "Dashboard",
        view: "dashboardView",
      },
      {
        id: "nav-validasi",
        icon: "fa-check-double",
        text: "Validasi Logbook",
        view: "validasiView",
      },
      {
        id: "nav-mhs",
        icon: "fa-users",
        text: "Mahasiswa Bimbingan",
        view: "mahasiswaView",
      },
    ],
    admin: [
      {
        id: "nav-dashboard",
        icon: "fa-chart-pie",
        text: "Dashboard",
        view: "dashboardView",
      },
      {
        id: "nav-prodi",
        icon: "fa-graduation-cap",
        text: "Data Prodi",
        view: "prodiAdminView",
      },
      {
        id: "nav-tempat",
        icon: "fa-hospital",
        text: "Tempat Praktik",
        view: "tempatAdminView",
      },
      {
        id: "nav-semua",
        icon: "fa-database",
        text: "Semua Data QR",
        view: "adminView",
      },
      {
        id: "nav-mhs",
        icon: "fa-user-graduate",
        text: "Manajemen Mahasiswa",
        view: "mahasiswaAdminView",
      },
      {
        id: "nav-kelompok",
        icon: "fa-users-rectangle",
        text: "Kelompok Mahasiswa",
        view: "kelompokAdminView",
      },
      {
        id: "nav-pre",
        icon: "fa-user-doctor",
        text: "Preseptor Klinik",
        view: "preseptorAdminView",
      },
      {
        id: "nav-pre-akd",
        icon: "fa-chalkboard-teacher",
        text: "Preseptor Akademik",
        view: "preseptorAkademikAdminView",
      },
      {
        id: "nav-komp",
        icon: "fa-list-check",
        text: "Kompetensi / Skill",
        view: "kompetensiAdminView",
      },
      {
        id: "nav-bpr",
        icon: "fa-chalkboard-user",
        text: "Setup Bimb. Praktikum",
        view: "bimbPraktikumAdminView",
      },
      {
        id: "nav-bas",
        icon: "fa-notes-medical",
        text: "Setup Bimb. ASKEP",
        view: "bimbAskepAdminView",
      },
      {
        id: "nav-sik",
        icon: "fa-user-check",
        text: "Setup Sikap & Perilaku",
        view: "sikapPerilakuAdminView",
      },
      {
        id: "nav-final",
        icon: "fa-file-signature",
        text: "Penilaian Akhir",
        view: "penilaianAkhirView",
      },
      {
        id: "nav-gen-kelompok-1",
        icon: "fa-calendar-days",
        text: "Generate Per Kelompok 1",
        view: "generatorKelompok1View",
      },
      {
        id: "nav-jadwal-1",
        icon: "fa-table",
        text: "Daftar Jadwal Praktik 1",
        view: "jadwalAdmin1View",
      },
      {
        id: "nav-gen-kelompok-2",
        icon: "fa-calendar-days",
        text: "Generate Per Kelompok 2",
        view: "generatorKelompok2View",
      },
      {
        id: "nav-jadwal-2",
        icon: "fa-table",
        text: "Daftar Jadwal Praktik 2",
        view: "jadwalAdmin2View",
      },
      {
        id: "nav-gen-kelompok-3",
        icon: "fa-calendar-days",
        text: "Generate Per Kelompok 3",
        view: "generatorKelompok3View",
      },
      {
        id: "nav-jadwal-3",
        icon: "fa-table",
        text: "Daftar Jadwal Praktik 3",
        view: "jadwalAdmin3View",
      },
      {
        id: "nav-laporan-admin",
        icon: "fa-triangle-exclamation",
        text: "Laporan Kejadian",
        view: "adminLaporanView",
      },
      {
        id: "nav-rekap-log",
        icon: "fa-chart-pie",
        text: "Rekapan Logbook",
        view: "rekapLogbookAdminView",
      },
      {
        id: "nav-settings",
        icon: "fa-gears",
        text: "Pengaturan",
        view: "settingsAdminView",
      },
      {
        id: "nav-password",
        icon: "fa-key",
        text: "Ubah Password",
        view: "changePasswordView",
      },
    ],
  };

  // Add Laporan menu to other roles
  menus.mahasiswa.push({
    id: "nav-laporan-mhs",
    icon: "fa-triangle-exclamation",
    text: "Laporan Kejadian",
    view: "laporanView",
  });
  menus.preseptor.push({
    id: "nav-laporan-pre",
    icon: "fa-triangle-exclamation",
    text: "Laporan Kejadian",
    view: "laporanView",
  });
  menus.preseptor_akademik.push({
    id: "nav-laporan-akd",
    icon: "fa-triangle-exclamation",
    text: "Laporan Kejadian",
    view: "adminLaporanView",
  });

  // Add Change Password to all roles (except already added in Admin above)
  if (currentUser.role !== "admin") {
    menus[currentUser.role].push({
      id: "nav-password",
      icon: "fa-key",
      text: "Ubah Password",
      view: "changePasswordView",
    });
  }

  const roleMenus = menus[currentUser.role] || [];

  // Check localStorage for last active view
  const lastActiveView = localStorage.getItem("activeView");
  const lastMenuText = localStorage.getItem("activeMenuText");

  let activeNavFound = false;

  roleMenus.forEach((menu, index) => {
    const a = document.createElement("a");
    a.href = "#";

    const isActive =
      lastActiveView === menu.view || (!lastActiveView && index === 0);
    if (isActive) activeNavFound = true;

    a.className = `nav-item ${isActive ? "active" : ""} animate-fade-in delay-${(index + 1) * 100}`;
    a.id = `nav-${menu.view}`;
    a.innerHTML = `<i class="fa-solid ${menu.icon}"></i> <span>${menu.text}</span>`;

    a.onclick = (e) => {
      e.preventDefault();
      document
        .querySelectorAll(".nav-item")
        .forEach((el) => el.classList.remove("active"));
      a.classList.add("active");
      document.getElementById("topbar-title-text").textContent = menu.text;

      // Save to localStorage
      localStorage.setItem("activeView", menu.view);
      localStorage.setItem("activeMenuText", menu.text);

      loadView(menu.view);
      if (window.innerWidth <= 992)
        document.getElementById("sidebar").classList.remove("open");
    };
    nav.appendChild(a);
  });

  if (roleMenus.length > 0) {
    if (lastActiveView && activeNavFound) {
      document.getElementById("topbar-title-text").textContent =
        lastMenuText || "Dashboard";
      loadView(lastActiveView);
    } else {
      // Default to first menu if no saved state or saved state invalid for current role
      localStorage.setItem("activeView", roleMenus[0].view);
      localStorage.setItem("activeMenuText", roleMenus[0].text);
      document.getElementById("topbar-title-text").textContent =
        roleMenus[0].text;
      loadView(roleMenus[0].view);
    }
  }
}

// MAHASISWA: INFORMASI PRAKTIK (Lahan & Preseptor)
async function informasiPraktikView(area) {
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card">
                  <div class="card-header">
                      <h3 class="m-0"><i class="fa-solid fa-circle-info text-primary"></i> Detail Lokasi & Pembimbing Praktik</h3>
                      <p class="text-sm text-muted mt-1">Gunakan halaman ini untuk melihat detail lahan praktik dan preseptor yang bertanggung jawab atas penilaian Anda.</p>
                  </div>
                  <div class="card-body">
                      <div class="table-responsive">
                          <table id="table-info-praktik" class="table-compact">
                              <thead>
                                  <tr>
                                      <th>Tempat Praktik</th>
                                      <th>Periode Rotasi</th>
                                      <th>Preseptor Klinik (Lahan)</th>
                                      <th>Preseptor Akademik (Kampus)</th>
                                  </tr>
                              </thead>
                              <tbody><tr><td colspan="4" class="empty-table"><i class="fa-solid fa-spinner fa-spin"></i> Memuat informasi jadwal bimbingan...</td></tr></tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      `;

  const [resJadwal, resUsers, resTempat, resKelompok] = await Promise.all([
    fetchAPI("getJadwal", { user_id: currentUser.id }),
    fetchCachedAPI("getUsers"),
    fetchCachedAPI("getTempat"),
    fetchCachedAPI("getKelompok"),
  ]);

  const tableBody = document.querySelector("#table-info-praktik tbody");
  if (!tableBody) return;

  if (
    resJadwal.success &&
    resUsers.success &&
    resTempat.success &&
    resKelompok.success
  ) {
    // 2. Kelompokkan Jadwal berdasarkan tempat_id
    const gJadwal = {};
    resJadwal.data.forEach((j) => {
      const tid = String(j.tempat_id);
      if (!gJadwal[tid]) gJadwal[tid] = [];
      gJadwal[tid].push(j);
    });

    const rows = Object.keys(gJadwal).map((tId) => {
      const list = gJadwal[tId];
      const tempat = resTempat.data.find((t) => t.id == tId);
      const namaTempat = tempat ? tempat.nama_tempat : "-";

      // Hitung start & end date
      const datesInMs = list.map((l) => new Date(l.tanggal).getTime());
      const minD = new Date(Math.min(...datesInMs));
      const maxD = new Date(Math.max(...datesInMs));

      const tglRange =
        minD.getTime() === maxD.getTime()
          ? formatDateIndo(list[0].tanggal)
          : `${formatDateIndo(minD.toISOString().split("T")[0])} s/d ${formatDateIndo(maxD.toISOString().split("T")[0])}`;

      // Cari Preseptor Klinik & Akademik di lahan ini
      const klinikPreseptors = resUsers.data.filter(
        (u) =>
          u.role === "preseptor" &&
          u.tempat_id &&
          u.tempat_id.split(",").includes(String(tId)),
      );

      const akademikPreseptors = resUsers.data.filter(
        (u) =>
          u.role === "preseptor_akademik" &&
          u.tempat_id &&
          u.tempat_id.split(",").includes(String(tId)),
      );

      return `
                  <tr>
                      <td>
                          <div class="d-flex align-center gap-2">
                              <div style="background:var(--primary-light); color:var(--primary); width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                                  <i class="fa-solid fa-hospital"></i>
                              </div>
                              <strong>${namaTempat}</strong>
                          </div>
                      </td>
                      <td><div class="badge bg-light text-dark border" style="font-weight:normal;">${tglRange}</div></td>
                      <td>
                          <div class="d-flex flex-column gap-1">
                              ${
                                klinikPreseptors.length > 0
                                  ? klinikPreseptors
                                      .map(
                                        (p) => `
                                  <div class="d-flex align-center gap-2 text-sm" style="background:#f1f5f9; padding:4px 10px; border-radius:15px; border-left:3px solid var(--primary);">
                                      <i class="fa-solid fa-user-doctor text-primary" style="font-size:0.8rem"></i> 
                                      <span class="font-bold">${p.nama}</span>
                                  </div>
                              `,
                                      )
                                      .join("")
                                  : '<span class="text-muted text-xs italic">Belum tersedia</span>'
                              }
                          </div>
                      </td>
                      <td>
                          <div class="d-flex flex-column gap-1">
                          ${
                            akademikPreseptors.length > 0
                              ? akademikPreseptors
                                  .map(
                                    (p) => `
                              <div class="d-flex align-center gap-2 text-sm" style="background:var(--success-light); padding:4px 10px; border-radius:15px; border-left:3px solid var(--success);">
                                  <i class="fa-solid fa-chalkboard-user text-success" style="font-size:0.8rem"></i> 
                                  <span class="font-bold text-success-dark">${p.nama}</span>
                              </div>
                          `,
                                  )
                                  .join("")
                              : '<span class="text-muted text-xs italic">Belum ada pembimbing</span>'
                          }
                          </div>
                      </td>
                  </tr>
              `;
    });

    if (rows.length > 0) {
      tableBody.innerHTML = rows.join("");
    } else {
      tableBody.innerHTML = `<tr><td colspan="4" class="empty-table">Belum ada rotasi tempat praktik yang terjadwal.</td></tr>`;
    }
  } else {
    tableBody.innerHTML = `<tr><td colspan="4" class="empty-table text-danger">Gagal menyinkronkan data praktik.</td></tr>`;
  }
}

// Router Simple
window.togglePublishNilai = async (batch, status) => {
  const val = status ? "1" : "0";
  showLoader(true);
  const res = await postAPI("saveSettings", {
    [`publish_nilai_${batch}`]: val,
  });
  showLoader(false);
  if (res.success) {
    showToast(
      "Berhasil",
      `Pengumuman Nilai Batch ${batch} ${status ? "diaktifkan" : "dinonaktifkan"}.`,
      "success",
    );
    loadView("settingsAdminView");
  } else {
    showToast("Gagal", res.message, "error");
  }
};

function loadView(viewName) {
  const area = document.getElementById("content-area");
  area.innerHTML = ""; // clear
  if (typeof window[viewName] === "function") {
    window[viewName](area);
  } else {
    area.innerHTML = `
              <div class="animate-fade-up text-center mt-3 text-muted">
                  <i class="fa-solid fa-triangle-exclamation fa-3x mb-2"></i>
                  <h3>View ${escapeHTML(viewName)} belum tersedia</h3>
              </div>
          `;
  }
}

// ---------------- VIEWS ---------------- //

// DASHBOARD VIEW (ALL ROLES)
async function dashboardView(area) {
  area.innerHTML = `
          <div class="animate-fade">
              <div class="d-flex justify-between align-center mb-3">
                  <div>
                    <h2 style="color: var(--primary-dark); font-weight: 800; font-size: 1.8rem; letter-spacing: -0.5px;">Dashboard</h2>
                    <p class="text-muted">Selamat datang kembali, <span class="text-primary" style="font-weight: 600;">${escapeHTML(currentUser.nama)}</span></p>
                  </div>
                  <div class="d-flex align-center gap-2">
                      ${currentUser.role.includes("preseptor") ? `<button class="btn btn-primary btn-sm" onclick="bukaModalScanMhs()"><i class="fa-solid fa-qrcode"></i> Scan Mahasiswa</button>` : ""}
                      <div class="pulse-dot" title="Sistem Aktif"></div>
                  </div>
              </div>
              
              <div id="urgent-notif-container"></div>

              <div id="dashboard-widgets" class="grid-cards">
                  <!-- Skeleton Loading -->
                  ${Array(4)
                    .fill(0)
                    .map(
                      () => `
                      <div class="card animate-pulse" style="height: 120px; background: #fff; border-radius: 16px;"></div>
                  `,
                    )
                    .join("")}
              </div>

              <div id="preseptor-extra-area" class="mt-4"></div>
              <div id="preseptor-live-area" class="mt-4"></div>
          </div>
      `;

  const [resStats, resMendesak, resLive, resGap, resBoard, resAdminAn, resS] =
    await Promise.all([
      fetchAPI("getDashboardStats", {
        user_id: currentUser.id,
        role: currentUser.role,
      }),
      currentUser.role.includes("preseptor")
        ? fetchAPI("getMendesakLogs", { tempat_id: currentUser.tempat_id })
        : Promise.resolve({ success: false }),
      currentUser.role.includes("preseptor")
        ? fetchAPI("getLiveAttendance", { tempat_id: currentUser.tempat_id })
        : Promise.resolve({ success: false }),
      currentUser.role.includes("preseptor")
        ? fetchAPI("getCompetencyGap", { tempat_id: currentUser.tempat_id })
        : Promise.resolve({ success: false }),
      currentUser.role.includes("preseptor")
        ? fetchAPI("getSkillLeaderboard")
        : Promise.resolve({ success: false }),
      currentUser.role === "admin"
        ? fetchAPI("getAdminAnalytics")
        : Promise.resolve({ success: false }),
      fetchAPI("getSettings"),
    ]);

  updateNotifBadge();
  const container = document.getElementById("dashboard-widgets");
  const urgentContainer = document.getElementById("urgent-notif-container");
  const liveArea = document.getElementById("preseptor-live-area");
  const extraArea = document.getElementById("preseptor-extra-area");

  // Broadcast Message
  const bMsg =
    resS.success && resS.data
      ? resS.data.find((s) => s.key === "broadcast_message")?.value || ""
      : "";
  if (bMsg) {
    urgentContainer.innerHTML =
      `
          <div class="alert bg-primary text-white animate-fade-in mb-4 d-flex align-center gap-3" style="border-radius:12px; border:none; box-shadow:0 10px 15px -3px rgba(37,99,235,0.2);">
              <div style="background:rgba(255,255,255,0.2); width:35px; height:35px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  <i class="fa-solid fa-bullhorn fa-sm"></i>
              </div>
              <div style="flex:1; font-size:0.9rem; font-weight:500;">
                  <span style="opacity:0.8; font-size:0.75rem; display:block; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;">Pengumuman Sistem</span>
                  ${escapeHTML(bMsg)}
              </div>
          </div>
        ` + urgentContainer.innerHTML;
  }

  if (!resStats.success || !resStats.data) {
    container.innerHTML = `<div class="alert alert-danger">Gagal memuat statistik.</div>`;
    return;
  }

  // Handle Urgent Notifications
  if (resMendesak.success && resMendesak.data.length > 0) {
    urgentContainer.innerHTML = `
              <div class="alert bg-danger-soft animate-bounce-subtle" style="border-radius:12px; border:1px solid #fee2e2; margin-bottom:1.5rem; display:flex; align-items:center; gap:12px;">
                  <div style="background:#ef4444; color:white; width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                      <i class="fa-solid fa-bell-exclamation fa-lg"></i>
                  </div>
                  <div style="flex:1">
                      <strong style="color:#991b1b">Peringatan Validasi!</strong>
                      <div style="font-size:0.85rem; color:#b91c1c">Terdapat <strong>${resMendesak.data.length} logbook</strong> yang telah menunggu lebih dari 24 jam. Mohon segera divalidasi.</div>
                  </div>
                  <button class="btn btn-danger btn-sm" onclick="loadView('validasiView')">Lihat Antrean</button>
              </div>
          `;
  }

  // Handle Gap Analysis & Leaderboard
  if (currentUser.role.includes("preseptor")) {
    let gapHtml = "";
    if (resGap.success && resGap.data) {
      gapHtml = `
                  <div class="card shadow-sm border-0" style="border-radius:16px;">
                      <div class="card-header bg-white">
                          <h4 class="mb-0 font-bold"><i class="fa-solid fa-chart-line text-primary"></i> Gap Analysis Kompetensi</h4>
                          <p class="text-xs text-muted mb-0">Kompetensi yang paling jarang dilakukan di lahan ini</p>
                      </div>
                      <div class="card-body" style="padding:1rem;">
                          ${resGap.data
                            .map(
                              (g) => `
                              <div class="mb-2">
                                  <div class="d-flex justify-between text-xs mb-1">
                                      <span class="text-truncate" style="max-width:180px">${g.nama}</span>
                                      <span class="font-bold">${g.count}x</span>
                                  </div>
                                  <div style="height:4px; background:#f1f5f9; border-radius:10px; overflow:hidden;">
                                      <div style="width:${Math.min(100, g.count * 10)}%; height:100%; background:var(--primary); opacity:0.6"></div>
                                  </div>
                              </div>
                          `,
                            )
                            .join("")}
                      </div>
                  </div>
              `;
    }

    let boardHtml = "";
    if (resBoard.success && resBoard.data) {
      boardHtml = `
                  <div class="card shadow-sm border-0" style="border-radius:16px; background: linear-gradient(135deg, #4f46e5, #3b82f6); color:white;">
                      <div class="card-header border-0" style="background:transparent; color:white;">
                          <h4 class="mb-0 font-bold"><i class="fa-solid fa-crown text-warning"></i> Skill of The Week</h4>
                          <p class="text-xs mb-0" style="opacity:0.8">Mahasiswa paling aktif (Logbook Disetujui 7 Hari Terakhir)</p>
                      </div>
                      <div class="card-body" style="padding:1rem;">
                          ${resBoard.data
                            .map(
                              (b, idx) => `
                              <div class="d-flex align-center gap-3 mb-3">
                                  <div style="width:24px; height:24px; background:rgba(255,255,255,0.2); border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.7rem">
                                      ${idx + 1}
                                  </div>
                                  <div style="flex:1">
                                      <div class="font-bold" style="font-size:0.85rem">${b.nama}</div>
                                      <div style="font-size:0.7rem; opacity:0.8">${b.count} Tindakan</div>
                                  </div>
                                  ${idx === 0 ? '<i class="fa-solid fa-trophy text-warning"></i>' : ""}
                              </div>
                          `,
                            )
                            .join("")}
                      </div>
                  </div>
              `;
    }

    extraArea.innerHTML = `
              <div class="grid-cards" style="grid-template-columns: 2fr 1fr">
                  ${gapHtml}
                  ${boardHtml}
              </div>
          `;
  }

  // Handle Live Attendance
  if (resLive.success && resLive.data) {
    liveArea.innerHTML = `
              <div class="card shadow-sm border-0" style="border-radius:16px; overflow:hidden;">
                  <div class="card-header bg-white d-flex align-center justify-between" style="padding:1.2rem 1.5rem;">
                      <div class="d-flex align-center gap-3">
                          <div style="background:var(--success-light); color:var(--success); width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center;">
                              <i class="fa-solid fa-users-viewfinder fa-lg"></i>
                          </div>
                          <div>
                              <h4 class="mb-0 font-bold" style="color:var(--text-strong)">Live: Kehadiran Hari Ini</h4>
                              <p class="text-xs text-muted mb-0">Mahasiswa yang sedang berada di lahan bimbingan Anda</p>
                          </div>
                      </div>
                      <span class="badge bg-success-soft text-success"><i class="fa-solid fa-circle fa-2xs animate-pulse"></i> LIVE MONITOR</span>
                  </div>
                  <div class="card-body" style="background:#f8fafc; padding:1.5rem;">
                      <div class="table-responsive" style="background:white; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                          <table class="table mb-0" style="font-size:0.9rem;">
                              <thead style="background:#f1f5f9;">
                                  <tr>
                                      <th>Mahasiswa</th>
                                      <th>C-In (WITA)</th>
                                      <th>C-Out (WITA)</th>
                                      <th>Status</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  ${
                                    resLive.data.length > 0
                                      ? resLive.data
                                          .map(
                                            (p) => `
                                      <tr>
                                          <td>
                                              <div class="d-flex align-center gap-2">
                                                  <div style="width:30px; height:30px; border-radius:50%; background:var(--primary-light); color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.75rem">
                                                      ${p.users.nama.charAt(0)}
                                                  </div>
                                                  <div>
                                                      <div class="font-bold">${p.users.nama}</div>
                                                      <div class="text-xs text-muted">${p.users.nim}</div>
                                                  </div>
                                              </div>
                                          </td>
                                          <td><span class="badge bg-light text-dark">${p.jam_masuk}</span></td>
                                          <td><span class="badge bg-light text-dark">${p.jam_pulang || "-"}</span></td>
                                          <td>
                                              ${p.jam_pulang ? '<span class="badge bg-info-soft text-info">Selesai</span>' : '<span class="badge bg-success">ON SITE</span>'}
                                          </td>
                                      </tr>
                                  `,
                                          )
                                          .join("")
                                      : '<tr><td colspan="4" class="text-center p-4 text-muted">Belum ada mahasiswa yang check-in hari ini</td></tr>'
                                  }
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          `;
  }

  const d = resStats.data;
  let html = "";

  const createWidget = (icon, title, value, color, viewLink = null) => {
    const lightBg = color + "0a";
    return `
          <div class="stat-card stat-card-premium" style="background: ${lightBg}; border-top: 3px solid ${color};">
              <div class="stat-icon-box" style="background: ${color}; color: white; box-shadow: 0 8px 16px -4px ${color}60;">
                  <i class="${icon}"></i>
              </div>
              <div class="stat-info">
                  <h5>${title}</h5>
                  <h2>${value}</h2>
                  ${viewLink ? `<button class="btn-kelola" style="color:${color}; background:${color}15" onclick="loadView('${viewLink}')">Kelola <i class="fa-solid fa-arrow-right"></i></button>` : ""}
              </div>
          </div>
      `;
  };

  if (currentUser.role === "admin") {
    html += createWidget(
      "fa-solid fa-user-graduate",
      "Total Mahasiswa",
      d.totalMhs,
      "#6366f1",
      "mahasiswaAdminView",
    );
    html += createWidget(
      "fa-solid fa-users-rectangle",
      "Kelompok",
      d.totalKelompok,
      "#10b981",
      "kelompokAdminView",
    );
    html += createWidget(
      "fa-solid fa-user-doctor",
      "Preseptor Klinik",
      d.totalPreKlinik,
      "#0ea5e9",
      "preseptorAdminView",
    );
    html += createWidget(
      "fa-solid fa-chalkboard-teacher",
      "Preseptor Akademik",
      d.totalPreAkademik,
      "#f59e0b",
      "preseptorAkademikAdminView",
    );
    html += createWidget(
      "fa-solid fa-hospital",
      "Lahan Praktik",
      d.totalTempat,
      "#8b5cf6",
      "tempatAdminView",
    );
    html += createWidget(
      "fa-solid fa-list-check",
      "Target Skill",
      d.totalKompetensi,
      "#475569",
      "kompetensiAdminView",
    );
    html += createWidget(
      "fa-solid fa-clipboard-check",
      "Sudah Dinilai",
      d.mhsDinilai,
      "#22c55e",
      "penilaianAkhirView",
    );
    html += createWidget(
      "fa-solid fa-clipboard-question",
      "Belum Dinilai",
      d.mhsBelumDinilai,
      "#ef4444",
      "penilaianAkhirView",
    );

    // ADMIN EXTRA: ANALYTICS & TOOLS (PREMIUM DESIGN)
    if (resAdminAn.success && resAdminAn.data) {
      const an = resAdminAn.data;
      const attRate = Math.round((an.activeToday / an.totalMhs) * 100) || 0;

      html += `
              <div class="card border-0 mt-5 animate-fade-up" style="grid-column: 1 / -1; border-radius:24px; background:white; box-shadow:0 20px 40px -10px rgba(79, 70, 229, 0.1); overflow:hidden;">
                  <div class="card-header border-0 py-4 px-5 d-flex justify-between align-center" style="background: linear-gradient(90deg, #4f46e5, #7c3aed); color:white;">
                      <div class="d-flex align-center gap-3">
                          <div style="background:rgba(255,255,255,0.2); backdrop-filter:blur(8px); width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center;">
                              <i class="fa-solid fa-chart-line fa-lg"></i>
                          </div>
                          <div>
                              <h4 class="mb-0 font-bold" style="letter-spacing:-0.5px; font-size:1.2rem;">Executive Dashboard Analitik</h4>
                              <p class="text-xs mb-0" style="opacity:0.8">Institutional Monitoring & Clinical Quality Analytics</p>
                          </div>
                      </div>
                      <div style="background:rgba(255,255,255,0.15); font-size:0.75rem; padding:4px 12px; border-radius:20px; font-weight:600; border:1px solid rgba(255,255,255,0.2);">
                          <i class="fa-solid fa-clock-rotate-left mr-1"></i> Real-time Update
                      </div>
                  </div>
                  <div class="card-body p-4" style="background:#fafafa;">
                      <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.25rem;">
                          
                          <!-- Attendance Stats (EMERALD VIBRANT) -->
                          <div class="p-4 d-flex flex-column align-center" style="background:linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius:24px; border:1px solid #10b98133; box-shadow:0 10px 15px -3px rgba(16, 185, 129, 0.1); min-height:180px; text-align:center;">
                              <div class="d-flex justify-between align-center mb-3 w-100">
                                  <div style="flex:1"></div>
                                  <div class="text-xs font-black" style="color:#065f46; text-transform:uppercase; letter-spacing:1px; opacity:0.8;">Presensi Real-Time</div>
                                  <div style="flex:1; display:flex; justify-content:flex-end">
                                      <div class="badge bg-success text-white px-2" style="font-size:0.6rem; border-radius:30px; box-shadow:0 4px 6px -1px rgba(16, 185, 129, 0.4); font-weight:800;">LIVE</div>
                                  </div>
                              </div>
                              <div class="mb-3">
                                  <div class="d-flex align-end justify-center gap-2 mb-1">
                                      <span class="h1 font-black m-0" style="color:#064e3b; letter-spacing:-2px; line-height:1;">${an.activeToday}</span>
                                      <span class="font-black mb-1" style="font-size:1.2rem; color:#059669">/ ${an.totalMhs}</span>
                                  </div>
                                  <div class="text-xs font-extrabold" style="color:#059669; text-transform:uppercase;">Mahasiswa Terdaftar</div>
                              </div>
                              <div class="mt-auto w-100">
                                  <div style="height:12px; background:rgba(6, 78, 59, 0.08); border-radius:10px; overflow:hidden; position:relative; border:1px solid rgba(16, 185, 129, 0.15); margin-bottom:12px;">
                                      <div style="width:${attRate}%; height:100%; background:linear-gradient(90deg, #10b981, #34d399); border-radius:10px; box-shadow:0 0 15px rgba(16,185,129,0.4)"></div>
                                  </div>
                                  <div class="d-flex justify-center align-center gap-3">
                                      <span class="text-xs font-black" style="color:#065f46; opacity:0.8; text-transform:uppercase;">Institutional Presence:</span>
                                      <span class="text-sm font-black" style="color:#059669">${attRate}% <i class="fa-solid fa-arrow-trend-up ml-1"></i></span>
                                  </div>
                              </div>
                          </div>

                          <!-- Activity Stats (AZURE BLUE) -->
                          <div class="p-4 d-flex flex-column align-center" style="background:linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius:24px; border:1px solid #3b82f633; box-shadow:0 10px 15px -3px rgba(59, 130, 246, 0.1); min-height:180px; text-align:center;">
                              <div class="d-flex justify-between align-center mb-3 w-100">
                                  <div style="flex:1"></div>
                                  <div class="text-xs font-black" style="color:#1e40af; text-transform:uppercase; letter-spacing:1px; opacity:0.8;">Kedisiplinan Logbook</div>
                                  <div style="flex:1; display:flex; justify-content:flex-end">
                                      <div class="badge bg-primary text-white px-2" style="font-size:0.6rem; border-radius:30px; font-weight:800;">AKTIVITAS</div>
                                  </div>
                              </div>
                              <div class="mb-3">
                                  <div class="d-flex align-end justify-center gap-2 mb-1">
                                      <span class="h1 font-black m-0" style="color:#1e3a8a; letter-spacing:-2px; line-height:1;">${an.avgLogs}</span>
                                      <span class="font-black mb-1" style="font-size:1.2rem; color:#2563eb">Log</span>
                                  </div>
                                  <div class="text-xs font-extrabold" style="color:#2563eb; text-transform:uppercase;">Avg Logbook Akhir</div>
                              </div>
                              <div class="d-flex gap-2 mt-auto w-100">
                                  <div style="flex:1; background:rgba(255,255,255,0.65); padding:10px; border-radius:16px; border:1px solid rgba(59, 130, 246, 0.15); backdrop-filter:blur(4px); display:flex; flex-direction: column; align-items:center; justify-content:center;">
                                      <div class="text-xs font-black mb-1" style="color:#1e40af; font-size:0.65rem;">TOTAL DISIPLIN</div>
                                      <div class="h4 m-0 font-black" style="color:var(--primary); line-height:1;">${an.totalLogs}</div>
                                  </div>
                                  <div style="flex:1; background:rgba(255,255,255,0.65); padding:10px; border-radius:16px; border:1px solid rgba(59, 130, 246, 0.15); backdrop-filter:blur(4px); display:flex; flex-direction: column; align-items:center; justify-content:center;">
                                      <div class="text-xs font-black mb-1" style="color:#5b21b6; font-size:0.65rem;">PRODUKTIVITAS</div>
                                      <div class="h5 m-0 font-black" style="color:#7c3aed; line-height:1; letter-spacing:0.5px;">TINGGI</div>
                                  </div>
                              </div>
                          </div>

                          <!-- Prodi Performance List (LAVENDER PINK) -->
                          <div class="p-4 d-flex flex-column align-center" style="background:linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%); border-radius:24px; border:1px solid #d946ef33; box-shadow:0 10px 15px -3px rgba(217, 70, 239, 0.1); grid-column: span 2; text-align:center;">
                              <div class="text-xs font-black mb-4" style="color:#701a75; text-transform:uppercase; letter-spacing:1px; opacity:0.8;">Clinical Average Scoring per Prodi</div>
                              <div class="d-flex gap-3 wrap justify-center">
                                  ${an.prodiStats
                                    .map(
                                      (p) => `
                                      <div style="background:rgba(255,255,255,0.75); border:1px solid rgba(217, 70, 239, 0.2); border-radius:20px; padding:18px 24px; box-shadow:0 10px 15px -3px rgba(0,0,0,0.03); min-width:220px; backdrop-filter:blur(10px); transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor:pointer;" onmouseover="this.style.transform='translateY(-6px)'; this.style.boxShadow='0 20px 25px -5px rgba(217, 70, 239, 0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 10px 15px -3px rgba(0,0,0,0.03)';">
                                          <div class="text-xs font-extrabold mb-3" style="color:#a21caf; letter-spacing:0.3px; text-transform:uppercase;">${p.nama}</div>
                                          <div class="d-flex align-center justify-center gap-3">
                                              <span class="h2 font-black m-0" style="color:#4a044e; letter-spacing:-1.5px; line-height:1;">${p.avg}</span>
                                              <div style="width:42px; height:42px; border-radius:14px; background:linear-gradient(135deg, #d946ef, #a21caf); color:white; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 15px rgba(162, 28, 175, 0.3); transform: rotate(-5deg);">
                                                  <i class="fa-solid fa-trophy fa-sm"></i>
                                              </div>
                                          </div>
                                      </div>
                                  `,
                                    )
                                    .join("")}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              <!-- Broadcast Hub (Premium Glassy Design) -->
              <div class="card border-0 mt-4 animate-fade-up" style="grid-column: 1 / -1; border-radius:24px; background:linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color:white; overflow:hidden; position:relative;">
                  <div style="position:absolute; top:-50px; right:-50px; width:200px; height:200px; background:rgba(124, 58, 237, 0.2); border-radius:50%; filter:blur(60px);"></div>
                  <div style="position:absolute; bottom:-40px; left:-40px; width:150px; height:150px; background:rgba(79, 70, 229, 0.3); border-radius:50%; filter:blur(50px);"></div>
                  
                  <div class="card-body d-flex align-center gap-1 py-5 px-5" style="position:relative; z-index:1;">
                      <div style="flex:1">
                          <div class="d-flex align-center gap-3 mb-2">
                              <div style="width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.15); display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,0.3)">
                                  <i class="fa-solid fa-bullhorn fa-sm text-white"></i>
                              </div>
                              <h4 class="m-0 font-bold" style="letter-spacing:-0.5px;">Broadcast Hub Central</h4>
                          </div>
                          <p class="text-sm mb-0" style="opacity:0.8; max-width:480px;">Kirim pengumuman vital ke layar Utama seluruh entitas (Mahasiswa & Preseptor) dalam satu klik.</p>
                      </div>
                      
                      <div class="d-flex gap-3 align-center" style="background:rgba(255,255,255,0.1); padding:10px; border-radius:20px; border:1px solid rgba(255,255,255,0.2); backdrop-filter:blur(10px);">
                          <input type="text" id="bc-message" class="form-control" style="width:340px; height:46px; border:none; border-radius:14px; background:rgba(255,255,255,0.1); color:white; padding-left:20px; font-size:0.95rem;" placeholder="Ketik pengumuman penting di sini...">
                          <button class="btn" style="height:46px; width:100px; background:white; color:#1e1b4b; border-radius:14px; font-weight:800; border:none; box-shadow:0 10px 20px -5px rgba(255,255,255,0.3); transition:all 0.3s;" onclick="eksekusiBroadcast()">
                              <i class="fa-solid fa-paper-plane mr-2"></i> KIRIM
                          </button>
                      </div>
                  </div>
              </div>
              <style>
                  #bc-message::placeholder { color: rgba(255,255,255,0.5); }
                  #bc-message:focus { outline:none; background:rgba(255,255,255,0.15); }
                  .btn:active { transform: scale(0.95); }
              </style>
          `;
    }
  } else if (currentUser.role.includes("preseptor")) {
    html += createWidget(
      "fa-solid fa-user-check",
      "Sudah Dinilai",
      d.mhsDinilai,
      "#22c55e",
      "mahasiswaView",
    );
    html += createWidget(
      "fa-solid fa-user-clock",
      "Belum Dinilai",
      d.mhsBelumDinilai,
      "#ef4444",
      "mahasiswaView",
    );
    html += createWidget(
      "fa-solid fa-file-circle-exclamation",
      "Antrian Validasi",
      d.logbookPending,
      "#f59e0b",
      "validasiView",
    );
  } else if (currentUser.role === "mahasiswa") {
    const resRekap = await fetchAPI("getRekapLogbook", {
      ids: [currentUser.id],
    });
    let trackerHtml = "";
    if (resRekap.success && resRekap.data && Array.isArray(resRekap.data)) {
      const myData = resRekap.data.find((x) => x.user_id === currentUser.id);
      if (myData) {
        const myRekap = myData.rekap || [];
        const completed = myRekap.filter((r) => r.status === "Tercapai").length;
        const total = myRekap.length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

        trackerHtml = `
                      <div class="card animate-fade-up border-0 shadow-sm" style="grid-column: 1 / -1; border-radius:16px; background:white; overflow:hidden;">
                          <div class="card-body d-flex align-center gap-4 py-4 px-5">
                              <div style="flex-shrink:0;">
                                  <div style="width:70px; height:70px; border-radius:50%; background:var(--primary-light); color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1.4rem; position:relative;">
                                      ${pct}%
                                      <svg style="position:absolute; width:100%; height:100%; transform:rotate(-90deg);">
                                          <circle cx="35" cy="35" r="32" stroke="var(--primary)" stroke-width="4" fill="none" stroke-dasharray="201" stroke-dashoffset="${201 - (201 * pct) / 100}" />
                                      </svg>
                                  </div>
                              </div>
                              <div style="flex:1">
                                  <h4 class="mb-1 font-bold"><i class="fa-solid fa-bullseye text-primary"></i> Target Kompetensi</h4>
                                  <p class="text-sm text-muted mb-0">Anda telah mencapai <strong>${completed} dari ${total}</strong> target keterampilan di stase ini.</p>
                              </div>
                              <div class="d-flex align-center gap-3">
                                  <button class="btn btn-outline btn-sm" onclick="bukaModalMyQR()"><i class="fa-solid fa-address-card"></i> QR Saya</button>
                                  <button class="btn btn-primary btn-sm" onclick="loadView('logbookView')">Lihat Semua Target</button>
                              </div>
                          </div>
                      </div>
              `;
      }
    }

    html += trackerHtml;
    html += createWidget(
      "fa-solid fa-book-medical",
      "Tindakan Terisi",
      d.logbookDiisi,
      "#6366f1",
      "logbookView",
    );
    html += createWidget(
      "fa-solid fa-calendar-alt",
      "Status Presensi",
      d.presensiHariIni ? "HADIR" : "BELUM",
      d.presensiHariIni ? "#22c55e" : "#ef4444",
      "presensiView",
    );
    html += createWidget(
      "fa-solid fa-check-double",
      "Jumlah Hadir",
      d.jumlahHadir || 0,
      "#10b981",
      "presensiView",
    );
    html += createWidget(
      "fa-solid fa-calendar-minus",
      "Tidak Hadir",
      d.jumlahAbsen || 0,
      "#f43f5e",
      "jadwalMahasiswaView",
    );
  }

  container.innerHTML = html;
}

const formatDateIndo = (dateStr, includeTime = false) => {
  if (!dateStr) return "-";

  // Jika input adalah format jam saja (HH:mm)
  if (
    typeof dateStr === "string" &&
    dateStr.includes(":") &&
    !dateStr.includes("-")
  ) {
    return dateStr.replace(":", ".") + " WITA";
  }

  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;

  // Deteksi jika ini adalah "Tanggal Jam" dari Google Sheet yang tahunnya 1899 (hanya jam)
  const isTimeOnly = d.getFullYear() === 1899 || d.getFullYear() === 1900;

  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const tgl = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;

  const jam = d.getHours().toString().padStart(2, "0");
  const menit = d.getMinutes().toString().padStart(2, "0");

  if (isTimeOnly) {
    return `${jam}.${menit} WITA`;
  }

  if (includeTime) {
    return `${tgl}, ${jam}.${menit} WITA`;
  }
  return tgl;
};

// MAHASISWA: JADWAL SAYA
async function jadwalMahasiswaView(area) {
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card">
                  <div class="card-header">
                      <h3><i class="fa-solid fa-calendar-alt text-primary"></i> Jadwal Praktik Saya</h3>
                  </div>
                  <div class="card-body">
                      <div class="alert bg-primary-soft p-3 rounded mb-4" style="border-radius:12px;">
                          <i class="fa-solid fa-circle-info text-primary"></i> Berikut adalah seluruh jadwal rotasi Anda. Pastikan hadir tepat waktu sesuai shift.
                      </div>
                      <div id="list-jadwal-mhs">
                          <div class="text-center p-4"><i class="fa-solid fa-spinner fa-spin"></i> Memuat jadwal...</div>
                      </div>
                  </div>
              </div>
          </div>
      `;

  const res = await fetchAPI("getJadwal", { user_id: currentUser.id });
  const container = document.getElementById("list-jadwal-mhs");
  if (res.success && res.data) {
    const myData = res.data.filter((j) => j.user_id == currentUser.id);
    if (myData.length > 0) {
      // Urutkan berdasarkan tanggal
      myData.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

      container.innerHTML = myData
        .map(
          (j, idx) => `
                  <div class="jadwal-item animate-fade-up" style="animation-delay: ${idx * 50}ms; display:flex; gap:1.5rem; margin-bottom:1.5rem; border-left: 3px solid var(--primary); padding: 0.5rem 0 0.5rem 1.5rem; position:relative;">
                      <div style="min-width: 80px;">
                          <div style="font-weight:700; font-size:1.4rem; color:var(--primary); line-height:1;">${new Date(j.tanggal).getDate()}</div>
                          <div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">${formatDateIndo(j.tanggal).split(" ")[1]}</div>
                      </div>
                      <div>
                          <h4 class="m-0" style="font-weight:600; color:var(--text-strong)">${j.nama_tempat}</h4>
                          <div class="d-flex align-center gap-3 mt-1 wrap">
                              <span class="badge" style="background:var(--bg-main); color:var(--text-strong)">Shift ${j.shift}</span>
                              <span class="text-muted" style="font-size:0.85rem"><i class="fa-regular fa-clock"></i> ${formatDateIndo(j.jam_mulai)} - ${formatDateIndo(j.jam_selesai)}</span>
                          </div>
                      </div>
                  </div>
              `,
        )
        .join("");
    } else {
      container.innerHTML = `<div class="empty-table p-4"><i class="fa-solid fa-calendar-day fa-2x mb-2" style="color:#cbd5e1;display:block"></i>Belum ada jadwal rotasi yang ditetapkan untuk Anda.</div>`;
    }
  } else {
    container.innerHTML = `<div class="empty-table p-4">Gagal memuat data jadwal.</div>`;
  }
}

// MAHASISWA: PRESENSI
async function presensiView(area) {
  area.innerHTML = `
          <div class="animate-fade-up">
              <div id="today-schedule-banner"></div>
              <div class="grid-cards">
                  <div class="stat-card">
                      <div class="stat-info">
                          <h5>Jam Praktik Hari Ini</h5>
                          <h2 id="jam-hari-ini">0 <span style="font-size:0.5em;color:var(--text-muted)">Jam</span></h2>
                      </div>
                      <div class="stat-icon"><i class="fa-solid fa-business-time"></i></div>
                  </div>
                  <div class="stat-card success-border">
                      <div class="stat-info">
                          <h5>Total Kehadiran</h5>
                          <h2 id="total-hadir">0 <span style="font-size:0.5em;color:var(--text-muted)">Hari</span></h2>
                      </div>
                      <div class="stat-icon success-icon"><i class="fa-solid fa-calendar-check"></i></div>
                  </div>
              </div>
              
              <div class="card animate-fade-up delay-100">
                  <div class="card-header">
                      <h3><i class="fa-solid fa-clipboard-user text-primary"></i> Presensi Klinik</h3>
                      <div class="d-flex gap-2">
                          <button class="btn btn-primary btn-sm" id="btn-checkin"><i class="fa-solid fa-qrcode"></i> Check-In</button>
                          <button class="btn btn-warning btn-sm" id="btn-checkout"><i class="fa-solid fa-qrcode"></i> Check-Out</button>
                      </div>
                  </div>
                  <div class="card-body">
                      <div id="scanner-container" class="mb-3 hidden text-center animate-zoom-in">
                          <h4 class="mb-2">Arahkan Kamera ke QR Code</h4>
                          <div id="reader"></div>
                          <button class="btn btn-danger-soft mt-3" id="stop-scan"><i class="fa-solid fa-stop"></i> Batalkan Scan QR</button>
                      </div>

                      <div class="alert bg-primary rounded p-3 mb-3" style="border-radius:12px; font-size: 0.9rem;">
                          <i class="fa-solid fa-circle-info"></i> Minimal durasi praktik sehari penuh adalah <b>6 jam</b>. Pastikan Check-Out sebelum kembali.
                      </div>

                      <div class="table-responsive">
                          <table id="table-presensi">
                              <thead>
                                  <tr>
                                      <th>Tanggal</th>
                                      <th>Masuk</th>
                                      <th>Keluar</th>
                                      <th>Lahan Praktik</th>
                                      <th>Estimasi Durasi</th>
                                  </tr>
                              </thead>
                              <tbody><tr><td colspan="5" class="empty-table"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data...</td></tr></tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      `;

  const [res, resJadwal] = await Promise.all([
    fetchAPI("getPresensi", { user_id: currentUser.id }),
    fetchAPI("getJadwal"),
  ]);

  // Safety check: is current view still presensi?
  if (!document.getElementById("table-presensi")) return;

  // Render Today's Schedule Banner
  const today = new Date().toISOString().split("T")[0];
  const mySchedule =
    resJadwal.success && resJadwal.data
      ? resJadwal.data.find(
          (j) => j.user_id == currentUser.id && j.tanggal == today,
        )
      : null;

  const banner = document.getElementById("today-schedule-banner");
  if (mySchedule && banner) {
    banner.innerHTML = `
              <div class="card bg-primary-soft mb-3 border-primary animate-fade-in" style="border:1px solid var(--primary);">
                  <div class="card-body d-flex align-center justify-between">
                      <div>
                          <div style="font-size:0.8rem; color:var(--primary-dark); font-weight:600; text-transform:uppercase;">Jadwal Praktik Hari Ini</div>
                          <h3 class="m-0 text-primary"><i class="fa-solid fa-location-dot"></i> ${mySchedule.nama_tempat}</h3>
                          <p class="m-0" style="font-size:0.9rem; color:var(--text-muted);">Shift ${mySchedule.shift} (${formatDateIndo(mySchedule.jam_mulai)} - ${formatDateIndo(mySchedule.jam_selesai)})</p>
                      </div>
                      <div class="text-primary" style="font-size:2rem; opacity:0.3"><i class="fa-solid fa-calendar-check"></i></div>
                  </div>
              </div>
          `;
  }

  const tableBody = document.querySelector("#table-presensi tbody");
  if (!tableBody) return;

  if (res.success && res.data.length > 0) {
    tableBody.innerHTML = res.data
      .map((p) => {
        const dur = p.durasi ? parseFloat(p.durasi) : 0;
        let durHtml = p.durasi
          ? `<span class="badge bg-success">${dur.toFixed(2)} Jam</span>`
          : '<span class="badge bg-warning">Aktif (Belum CO)</span>';

        if (dur > 0 && dur < 6)
          durHtml +=
            ' <span class="badge bg-danger ml-1" title="Kurang dari 6 jam!"><i class="fa-solid fa-triangle-exclamation"></i> Kurang</span>';

        return `
              <tr>
                  <td><strong>${formatDateIndo(p.tanggal)}</strong></td>
                  <td><span class="badge" style="background:#f1f5f9;color:var(--text-strong)">${formatDateIndo(p.jam_masuk)}</span></td>
                  <td>${p.jam_keluar ? `<span class="badge" style="background:#f1f5f9;color:var(--text-strong)">${formatDateIndo(p.jam_keluar)}</span>` : "-"}</td>
                  <td>${p.lahan}</td>
                  <td>${durHtml}</td>
              </tr>
          `;
      })
      .join("");

    const totalHadirEl = document.getElementById("total-hadir");
    if (totalHadirEl)
      totalHadirEl.innerHTML = `${res.data.length} <span style="font-size:0.5em;color:var(--text-muted)">Hari</span>`;
  } else {
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-table"><i class="fa-solid fa-folder-open fa-2x mb-2" style="color:#cbd5e1;display:block"></i>Belum ada histori presensi ditemukan</td></tr>`;
  }

  const startScanner = (type) => {
    document.getElementById("scanner-container").classList.remove("hidden");
    html5QrcodeScanner = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrcodeScanner
      .start(
        { facingMode: "environment" },
        config,
        async (decodedText) => {
          html5QrcodeScanner.stop();
          document.getElementById("scanner-container").classList.add("hidden");
          document
            .getElementById("beep-sound")
            .play()
            .catch((e) => console.log(e));

          // VALIDASI JADWAL UNTUK CHECK-IN
          if (type === "in") {
            const today = new Date().toISOString().split("T")[0];
            const scRes = await fetchAPI("getJadwal", {
              user_id: currentUser.id,
            });
            const todaySched = (scRes.data || []).find(
              (j) => j.tanggal === today,
            );

            if (!todaySched) {
              return showToast(
                "Gagal Check-In",
                "Anda tidak memiliki jadwal praktik hari ini.",
                "error",
              );
            }

            // Periksa apakah QR Code cocok dengan nama tempat di jadwal
            // decodedText biasanya nama tempat dari QR Code
            if (
              decodedText.toLowerCase().trim() !==
              todaySched.nama_tempat.toLowerCase().trim()
            ) {
              return showToast(
                "Lokasi Salah",
                `Anda terjadwal di ${todaySched.nama_tempat}, bukan di ${decodedText}.`,
                "error",
              );
            }
          }

          showLoader(true);
          const actionTarget = type === "in" ? "checkIn" : "checkOut";
          const logRes = await postAPI(actionTarget, {
            user_id: currentUser.id,
            lahan: decodedText,
          });
          showLoader(false);

          if (logRes.success) {
            showToast(
              "Berhasil",
              `Berhasil Check-${type.toUpperCase()}`,
              "success",
            );
            presensiView(area); // Reload view
          } else {
            showToast("Gagal Disimpan", logRes.message, "error");
          }
        },
        (err) => {},
      )
      .catch((err) => {
        showToast(
          "Error Kamera",
          "Gagal mengakses kamera di perangkat Anda.",
          "error",
        );
      });
  };

  document.getElementById("btn-checkin").onclick = () => startScanner("in");
  document.getElementById("btn-checkout").onclick = () => startScanner("out");
  document.getElementById("stop-scan").onclick = () => {
    if (html5QrcodeScanner) html5QrcodeScanner.stop();
    document.getElementById("scanner-container").classList.add("hidden");
  };
}

// MAHASISWA: LOGBOOK
async function logbookView(area) {
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card">
                  <div class="card-header d-flex justify-between align-center">
                      <h3><i class="fa-solid fa-book-medical text-primary"></i> Data Logbook Tindakan</h3>
                      <div class="d-flex gap-2">
                          <button class="btn btn-outline btn-sm" onclick="exportLogbookPDF()"><i class="fa-solid fa-file-pdf"></i> Ekspor PDF</button>
                          <button class="btn btn-primary btn-sm" id="btn-add-log"><i class="fa-solid fa-plus"></i> Tambah Tindakan</button>
                      </div>
                  </div>
                  <div class="card-body">
                      <div class="table-responsive">
                          <table id="table-logbook">
                              <thead>
                                  <tr>
                                      <th>Tanggal</th>
                                      <th>Kompetensi / Kasus</th>
                                      <th>Lahan</th>
                                      <th>Level</th>
                                      <th>Status</th>
                                      <th>Nilai</th>
                                  </tr>
                              </thead>
                              <tbody><tr><td colspan="6" class="empty-table"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</td></tr></tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      `;

  document.getElementById("btn-add-log").onclick = async () => {
    showLoader(true);
    const [resKomp, resTemp, resJadw] = await Promise.all([
      fetchAPI("getKompetensi", { user_id: currentUser.id }),
      fetchAPI("getTempat"),
      fetchAPI("getJadwal", { user_id: currentUser.id }),
    ]);
    showLoader(false);

    let optKomp =
      '<option value="">-- Pilih Kompetensi Berdasarkan SK --</option>';
    if (resKomp.success && resKomp.data) {
      // Kelompokkan kompetensi berdasarkan kategori
      const grouped = {};
      resKomp.data.forEach((k) => {
        const kat = k.kategori && k.kategori !== "-" ? k.kategori : "Lainnya";
        if (!grouped[kat]) grouped[kat] = [];
        grouped[kat].push(k);
      });
      const katKeys = Object.keys(grouped);
      if (
        katKeys.length > 1 ||
        (katKeys.length === 1 && katKeys[0] !== "Lainnya")
      ) {
        // Tampilkan dengan optgroup
        optKomp += katKeys
          .map((kat) => {
            const opts = grouped[kat]
              .map(
                (k) =>
                  `<option value="${k.nama_skill}">${k.nama_skill}</option>`,
              )
              .join("");
            return `<optgroup label="${kat}">${opts}</optgroup>`;
          })
          .join("");
      } else {
        // Flat list jika hanya 1 kategori / tanpa kategori
        optKomp += resKomp.data
          .map(
            (k) => `<option value="${k.nama_skill}">${k.nama_skill}</option>`,
          )
          .join("");
      }
    }
    let optTemp = '<option value="">-- Pilih Lahan Praktik --</option>';
    if (resTemp.success && resTemp.data) {
      optTemp += resTemp.data
        .map(
          (t) => `<option value="${t.nama_tempat}">${t.nama_tempat}</option>`,
        )
        .join("");
    }

    const todayDate = new Date().toISOString().split("T")[0];
    const userSchedules = resJadw && resJadw.data ? resJadw.data : [];

    openModal(
      "Tambah Logbook Tindakan",
      `
              <form id="form-logbook" class="animate-fade-in">
                  <div class="form-group">
                      <label>Tanggal Pelaksanaan</label>
                      <div class="input-with-icon">
                          <i class="fa-regular fa-calendar"></i>
                          <input type="date" id="log-tanggal" required class="form-control" value="${todayDate}" onchange="autoFillLahan(this.value)">
                      </div>
                  </div>
                  <div class="form-group">
                      <label>Lahan Praktik</label>
                      <select id="log-lahan" required class="form-control">
                          ${optTemp}
                      </select>
                      <small id="lahan-helper" class="text-muted"></small>
                  </div>
                  <div class="form-group">
                      <label>Jenis Kompetensi</label>
                      <select id="log-kompetensi" required class="form-control">
                          ${optKomp}
                      </select>
                  </div>
                  <div class="form-group">
                      <label>Tingkat Keterlibatan (Level)</label>
                      <select id="log-level" required class="form-control">
                          <option value="Observasi">Observasi (Melihat)</option>
                          <option value="Asistensi">Asistensi (Membantu Prseptor)</option>
                          <option value="Mandiri">Mandiri (Melakukan Sendiri)</option>
                      </select>
                  </div>
                  <div class="form-group">
                      <label>Refleksi & Deskripsi Kasus</label>
                      <textarea id="log-deskripsi" rows="3" required class="form-control" placeholder="Tuliskan pengalaman tindakan (SOAP singkat / identifikasi etiologi)..."></textarea>
                  </div>
                  <button type="submit" class="btn btn-primary btn-block mt-2"><i class="fa-solid fa-paper-plane"></i> Submit Logbook</button>
              </form>
          `,
    );

    window.autoFillLahan = (dateStr) => {
      const found = userSchedules.find((j) => j.tanggal === dateStr);
      const sel = document.getElementById("log-lahan");
      const helper = document.getElementById("lahan-helper");
      if (!sel || !helper) return;
      if (found) {
        sel.value = found.nama_tempat;
        helper.innerHTML = `<i class="fa-solid fa-check-circle text-success"></i> Sesuai Jadwal: <strong>${found.nama_tempat}</strong>`;
        sel.style.background = "#f0fdf4";
      } else {
        helper.innerHTML = `<i class="fa-solid fa-circle-exclamation text-warning"></i> Tidak ditemukan jadwal pada tanggal ini.`;
        sel.style.background = "";
      }
    };

    window.autoFillLahan(todayDate);

    document.getElementById("form-logbook").onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        user_id: currentUser.id,
        tanggal: document.getElementById("log-tanggal").value,
        lahan: document.getElementById("log-lahan").value,
        kompetensi: document.getElementById("log-kompetensi").value,
        level: document.getElementById("log-level").value,
        deskripsi: document.getElementById("log-deskripsi").value,
      };

      const res = await postAPI("addLogbook", payload);
      if (res.success) {
        closeModal();
        showToast(
          "Berhasil Menyimpan",
          "Logbook Anda telah berhasil direkam.",
          "success",
        );
        logbookView(document.getElementById("content-area"));
      }
    };
  };

  const res = await fetchAPI("getLogbook", { user_id: currentUser.id });
  const tableBody = document.querySelector("#table-logbook tbody");
  if (!tableBody) return;
  if (res.success && res.data.length > 0) {
    tableBody.innerHTML = res.data
      .map((p) => {
        let statusBadge =
          p.status === "Disetujui"
            ? "bg-success"
            : p.status === "Ditolak"
              ? "bg-danger"
              : "bg-warning";
        let statusIcon =
          p.status === "Disetujui"
            ? "fa-check"
            : p.status === "Ditolak"
              ? "fa-xmark"
              : "fa-clock Rotate";
        return `
              <tr>
                  <td><strong>${formatDateIndo(p.tanggal)}</strong></td>
                  <td><span style="color:var(--primary-dark); font-weight:500;">${p.kompetensi}</span></td>
                  <td>${p.lahan}</td>
                  <td><span class="badge" style="background:#f1f5f9;color:var(--text-strong)">${p.level}</span></td>
                  <td><span class="badge ${statusBadge}"><i class="fa-solid ${statusIcon}"></i> ${p.status}</span></td>
                  <td><strong>${p.nilai || '<span class="text-muted">-</span>'}</strong></td>
              </tr>
          `;
      })
      .join("");
  } else {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-table"><i class="fa-solid fa-folder-open fa-2x mb-2" style="color:#cbd5e1;display:block"></i>Belum ada logbook tindakan yang dimasukkan</td></tr>`;
  }
}

// MAHASISWA: KOMPETENSI (CHART)
async function kompetensiView(area) {
  area.innerHTML = `
          <div class="animate-fade-up" id="kompetensi-charts-container">
              <div class="card">
                  <div class="card-header">
                      <h3><i class="fa-solid fa-chart-line text-primary"></i> Progress Acuan Kompetensi</h3>
                  </div>
                  <div class="card-body" id="kompetensi-charts-body">
                      <p class="empty-table"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data...</p>
                  </div>
              </div>
          </div>
      `;

  const res = await fetchAPI("getKompetensi", { user_id: currentUser.id });
  const chartsBody = document.getElementById("kompetensi-charts-body");
  if (!chartsBody) return;

  if (res.success && res.data.length > 0) {
    // Kelompokkan berdasarkan kategori
    const grouped = {};
    res.data.forEach((d) => {
      const kat = d.kategori && d.kategori !== "-" ? d.kategori : "Umum";
      if (!grouped[kat]) grouped[kat] = [];
      grouped[kat].push(d);
    });

    const katKeys = Object.keys(grouped);
    Chart.defaults.font.family = "Outfit";
    Chart.defaults.color = "#64748b";

    // Buat chart per kategori
    chartsBody.innerHTML = katKeys
      .map(
        (kat, i) => `
              <div style="margin-bottom:2rem;">
                  <h4 style="color:var(--primary-dark); margin-bottom:0.75rem; font-size:1rem;"><i class="fa-solid fa-folder-open text-primary"></i> ${kat}</h4>
                  <canvas id="kompetensiChart-${i}" style="max-height: 350px; width:100%;"></canvas>
              </div>
          `,
      )
      .join('<hr style="opacity:0.1; margin: 1.5rem 0;">');

    const colors = [
      "#8b5cf6",
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#6366f1",
    ];
    katKeys.forEach((kat, i) => {
      const items = grouped[kat];
      const labels = items.map((d) => d.nama_skill);
      const target = items.map((d) => parseInt(d.target_minimal));
      const pencapaian = items.map((d) => parseInt(d.pencapaian));

      const ctx = document
        .getElementById(`kompetensiChart-${i}`)
        .getContext("2d");
      new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Pencapaian Valid",
              data: pencapaian,
              backgroundColor: colors[i % colors.length],
              borderRadius: 6,
            },
            {
              label: "Target Minimal Kampus",
              data: target,
              backgroundColor: "rgba(203, 213, 225, 0.5)",
              borderWidth: 0,
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { usePointStyle: true } },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { borderDash: [5, 5], color: "#f1f5f9" },
            },
            x: {
              grid: { display: false },
            },
          },
        },
      });
    });
  } else {
    chartsBody.innerHTML = `<p class="empty-table"><i class="fa-solid fa-chart-bar fa-2x mb-2" style="display:block;color:#cbd5e1;"></i>Data kompetensi kurikulum belum tersedia.</p>`;
  }
}

// MAHASISWA: NILAI SAYA
async function nilaiMahasiswaView(area) {
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card">
                  <div class="card-header">
                      <h3><i class="fa-solid fa-graduation-cap text-primary"></i> Progress Nilai Saya</h3>
                  </div>
                  <div class="card-body">
                      <div class="alert alert-info">
                          <strong>Informasi Penilaian:</strong> Nilai akhir Anda adalah gabungan dari nilai Preseptor Klinik dan Preseptor Akademik.
                          Rentang nilai 0-100. Nilai akan muncul setelah preseptor menginput data.
                      </div>
                      
                      <div id="nilai-mhs-content" style="margin-top:20px; text-align:center;">
                          <i class="fa-solid fa-spinner fa-spin fa-2x text-muted"></i>
                          <p class="mt-2 text-muted">Memuat data nilai...</p>
                      </div>
                  </div>
              </div>
          </div>
      `;

  // Kita gunakan endpoint getPenilaianAkhir yang sudah ada, lalu filter by user id
  const [res, resSets] = await Promise.all([
    fetchAPI("getPenilaianAkhir"),
    fetchAPI("getSettings"),
  ]);
  const container = document.getElementById("nilai-mhs-content");

  if (res.success && res.data && resSets.success) {
    const myData = res.data.find((d) => d.id === currentUser.id);
    const wKlinik = res.weights?.w_klinik || 50;
    const wAkademik = res.weights?.w_akademik || 50;

    // Determine my batch
    let myBatch = null;
    if (currentUser.kelompok_id) {
      [1, 2, 3].forEach((b) => {
        const batchKey = `batch_kelompok_${b}`;
        const kelIds = (
          resSets.data.find((s) => s.key === batchKey)?.value || ""
        )
          .split(",")
          .map((id) => id.trim());
        if (kelIds.includes(String(currentUser.kelompok_id))) {
          myBatch = b;
        }
      });
    }

    const publishKey = myBatch ? `publish_nilai_${myBatch}` : null;
    const isPublished = publishKey
      ? resSets.data.find((s) => s.key === publishKey)?.value === "1"
      : false;

    if (!isPublished) {
      container.innerHTML = `
              <div class="animate-pulse" style="padding: 40px; text-align:center;">
                  <div class="icon-box" style="width:80px; height:80px; margin: 0 auto 20px; background:#fef3c7; color:#b45309; font-size: 2rem;">
                      <i class="fa-solid fa-lock"></i>
                  </div>
                  <h3 style="color:#1e293b; margin-bottom:10px">Nilai Belum Diumumkan</h3>
                  <p class="text-muted" style="max-width:400px; margin:0 auto">Mohon Maaf, nilai Anda untuk Batch ${myBatch || ""} saat ini sedang dalam proses verifikasi oleh Admin dan belum diumumkan.</p>
                  <div class="badge bg-warning-soft text-warning mt-4" style="padding: 10px 20px; font-size:0.9rem">
                      <i class="fa-solid fa-clock-rotate-left"></i> Hubungi Admin untuk info lebih lanjut
                  </div>
              </div>
          `;
      return;
    }

    if (myData) {
      const statusClass =
        myData.total >= (res.threshold || 75) ? "text-success" : "text-danger";
      container.innerHTML = `
                  <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; text-align:left;">
                      <div style="border: 1px solid #e0f2fe; border-radius: 12px; padding: 15px; background: #f0f9ff;">
                          <h4 style="color: #0369a1; border-bottom: 1px solid #bae6fd; padding-bottom: 8px; margin-bottom: 12px; font-size: 1.1rem;">
                              <i class="fa-solid fa-user-doctor"></i> Preseptor Klinik
                              <span class="badge bg-primary float-right" style="font-size:0.7em">Bobot: ${wKlinik}%</span>
                          </h4>
                          <div class="d-flex justify-between mb-1"><span>Bimb. Praktikum:</span> <strong>${myData.klinik_prak || 0}</strong></div>
                          <div class="d-flex justify-between mb-1"><span>Bimb. ASKEP:</span> <strong>${myData.klinik_askep || 0}</strong></div>
                          <div class="d-flex justify-between mb-2"><span>Sikap & Perilaku:</span> <strong>${myData.klinik_sikap || 0}</strong></div>
                          <div class="d-flex justify-between" style="border-top:1px dashed #bae6fd; padding-top:8px;">
                              <span>Total Skor Klinik:</span> 
                              <span style="font-size:1.1em; color:#0369a1; font-weight:bold">${myData.klinik_total || 0}</span>
                          </div>
                      </div>
                      
                      <div style="border: 1px solid #fef3c7; border-radius: 12px; padding: 15px; background: #fffcf2;">
                          <h4 style="color: #b45309; border-bottom: 1px solid #fde68a; padding-bottom: 8px; margin-bottom: 12px; font-size: 1.1rem;">
                              <i class="fa-solid fa-chalkboard-teacher"></i> Preseptor Akademik
                              <span class="badge bg-warning float-right" style="font-size:0.7em">Bobot: ${wAkademik}%</span>
                          </h4>
                          <div class="d-flex justify-between mb-1"><span>Bimb. Praktikum:</span> <strong>${myData.akademik_prak || 0}</strong></div>
                          <div class="d-flex justify-between mb-1"><span>Bimb. ASKEP:</span> <strong>${myData.akademik_askep || 0}</strong></div>
                          <div class="d-flex justify-between mb-2"><span>Sikap & Perilaku:</span> <strong>${myData.akademik_sikap || 0}</strong></div>
                          <div class="d-flex justify-between" style="border-top:1px dashed #fde68a; padding-top:8px;">
                              <span>Total Skor Akademik:</span> 
                              <span style="font-size:1.1em; color:#b45309; font-weight:bold">${myData.akademik_total || 0}</span>
                          </div>
                      </div>
                  </div>

                  <div style="margin-top: 25px; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; text-align:center;">
                      <h5 class="text-muted" style="margin-bottom: 5px; font-size:0.9rem; text-transform:uppercase; letter-spacing:1px;">Nilai Akhir Sementara</h5>
                      <div style="font-size: 3rem; font-weight: 800; line-height: 1.2;" class="${statusClass}">
                          ${myData.total ? parseFloat(myData.total).toFixed(1) : "0"}
                      </div>
                      <div style="margin-top:10px; font-size: 0.9rem;">
                          <i class="fa-solid fa-circle-info text-primary"></i> Batas Lulus: <strong>${res.threshold || 75}</strong>
                      </div>
                  </div>
              `;
    } else {
      container.innerHTML = `
                  <div class="py-4">
                      <i class="fa-solid fa-folder-open fa-3x mb-3" style="color:#cbd5e1;display:block"></i>
                      <p class="text-muted" style="font-size:1.1rem;">Belum ada data nilai untuk Anda.</p>
                  </div>
              `;
    }
  } else {
    container.innerHTML = `<span class="text-danger"><i class="fa-solid fa-circle-exclamation"></i> Gagal memuat data nilai.</span>`;
  }
}

// PRESEPTOR: VALIDASI
async function validasiView(area) {
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card">
                  <div class="card-header d-flex justify-between align-center">
                      <h3><i class="fa-solid fa-check-double text-primary"></i> Antrean Validasi Logbook</h3>
                      <div id="bulk-action-area" style="display:none">
                          <button class="btn btn-success btn-sm" onclick="validasiBulk()"><i class="fa-solid fa-list-check"></i> Setujui Masal (<span id="bulk-count">0</span>)</button>
                      </div>
                  </div>
                  <div class="card-body">
                      <div class="table-responsive">
                          <table id="table-validasi">
                              <thead>
                                  <tr>
                                      <th width="40"><input type="checkbox" id="chk-all-log" onclick="toggleAllLog(this)"></th>
                                      <th>Mahasiswa</th>
                                      <th>Tgl</th>
                                      <th>Kompetensi</th>
                                      <th>Lahan</th>
                                      <th>Level</th>
                                      <th style="text-align:right">Tindakan Validasi</th>
                                  </tr>
                              </thead>
                              <tbody><tr><td colspan="7" class="empty-table"><i class="fa-solid fa-spinner fa-spin"></i> Mengecek antrean...</td></tr></tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      `;

  const res = await fetchAPI("getPendingLogs", {
    tempat_id: currentUser.tempat_id,
  });
  const tableBody = document.querySelector("#table-validasi tbody");
  if (!tableBody) return;
  if (res.success && res.data.length > 0) {
    tableBody.innerHTML = res.data
      .map((p, idx) => {
        const isUrgent =
          new Date(p.created_at) < new Date(Date.now() - 86400000);
        return `
              <tr class="animate-fade-up delay-${((idx % 5) + 1) * 100}">
                  <td style="vertical-align:middle"><input type="checkbox" class="chk-log" value="${p.id}" onclick="updateBulkUI()"></td>
                  <td>
                      <div class="d-flex align-center gap-2">
                          <div style="width:35px;height:35px;border-radius:50%;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem">
                              ${p.nama_mahasiswa.charAt(0)}
                          </div>
                          <div>
                              <strong>${p.nama_mahasiswa}</strong>
                              ${isUrgent ? ' <span class="badge bg-danger" style="font-size:0.6rem">MENDESAK</span>' : ""}
                          </div>
                      </div>
                  </td>
                  <td>${p.tanggal}</td>
                  <td><span style="color:var(--primary-dark); font-weight:500;">${p.kompetensi}</span></td>
                  <td><span class="badge bg-primary-soft text-primary"><i class="fa-solid fa-hospital"></i> ${p.nama_lahan || p.lahan}</span></td>
                  <td><span class="badge bg-primary">${p.level}</span></td>
                  <td style="text-align:right">
                      <button class="btn btn-outline btn-sm" onclick="bukaModalValidasi('${p.id}', '${p.nama_mahasiswa}', '${p.deskripsi.replace(/'/g, "\\'")}')">
                          Nilai & Cek
                      </button>
                  </td>
              </tr>
          `;
      })
      .join("");
  } else {
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-table"><i class="fa-solid fa-check-circle fa-2x mb-2" style="color:var(--success);display:block"></i>Semua logbook telah divalidasi.<br>Tidak ada antrean logbook pending.</td></tr>`;
  }
}

window.toggleAllLog = (el) => {
  document
    .querySelectorAll(".chk-log")
    .forEach((chk) => (chk.checked = el.checked));
  updateBulkUI();
};

window.updateBulkUI = () => {
  const checked = document.querySelectorAll(".chk-log:checked");
  const area = document.getElementById("bulk-action-area");
  if (checked.length > 0) {
    area.style.display = "block";
    document.getElementById("bulk-count").textContent = checked.length;
  } else {
    area.style.display = "none";
  }
};

window.validasiBulk = async () => {
  const checked = Array.from(document.querySelectorAll(".chk-log:checked")).map(
    (c) => c.value,
  );
  if (
    !confirm(
      `Apakah Anda yakin ingin menyetujui ${checked.length} logbook sekaligus dengan nilai default (100)?`,
    )
  )
    return;

  showLoader(true);
  const res = await postAPI("validasiLogBulk", {
    ids: checked,
    status: "Disetujui",
    nilai: 100,
  });
  showLoader(false);

  if (res.success) {
    showToast("Berhasil", res.message, "success");
    loadView("validasiView");
  }
};

window.bukaModalValidasi = (id, nama, deskripsi) => {
  openModal(
    "Sesi Validasi Tindakan Mahasiswa",
    `
          <div class="animate-fade-in">
              <div class="alert bg-primary rounded p-3 mb-3 border" style="border-radius:12px; background:var(--primary-light);">
                  <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.2rem">Pengirim Logbook</div>
                  <strong>${nama}</strong>
              </div>
              
              <div class="form-group">
                  <label>Deskripsi/Refleksi Kasus Oleh Mahasiswa</label>
                  <div style="padding: 1rem; background: var(--bg-main); border-radius: 8px; border: 1px dashed #cbd5e1; font-size: 0.95rem;">
                      ${deskripsi}
                  </div>
              </div>

              <hr style="border:none; border-top:1px solid #e2e8f0; margin: 1.5rem 0;">

              <form id="form-validasi">
                  <div class="form-group">
                      <label>Keputusan Evaluasi</label>
                      <select id="val-status" class="form-control" required style="padding-left:1rem; font-weight:600; color:var(--text-strong)">
                          <option value="Disetujui">Beri Approve (Disetujui Target)</option>
                          <option value="Ditolak">Reject (Menolak Tindakan)</option>
                      </select>
                  </div>
                  <div class="form-group">
                      <label>Nilai Objektif (Scale: 0-100)</label>
                      <div class="input-with-icon">
                          <i class="fa-solid fa-star-half-stroke"></i>
                          <input type="number" id="val-nilai" required class="form-control" min="0" max="100" placeholder="Skor Kualitas Tindakan">
                      </div>
                  </div>
                  <div class="form-group">
                      <label><i class="fa-solid fa-comment-medical text-primary"></i> Catatan Coaching / Feedback Reflektif</label>
                      <textarea id="val-catatan" rows="3" class="form-control" required placeholder="Berikan feedback sebagai Coaching Log Anda untuk pengembangan skill mahasiswa ini..."></textarea>
                      <small class="text-muted">Feedback ini akan tersimpan sebagai riwayat bimbingan (Coaching Log).</small>
                  </div>
                  <button type="submit" class="btn btn-primary btn-block mt-2"><i class="fa-solid fa-clipboard-check"></i> Eksekusi & Simpan Evaluasi</button>
              </form>
          </div>
      `,
  );

  document.getElementById("form-validasi").onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      log_id: id,
      nilai: document.getElementById("val-nilai").value,
      catatan: document.getElementById("val-catatan").value,
      status: document.getElementById("val-status").value,
      preseptor_id: currentUser.id,
    };
    const res = await postAPI("validasiLog", payload);
    if (res.success) {
      closeModal();
      showToast(
        "Evaluasi Sukses",
        "Pembaruan logbook validasi berhasil disimpan",
        "success",
      );
      loadView("validasiView"); // refresh
    }
  };
};

// PRESEPTOR: MAHASISWA BIMBINGAN & INPUT NILAI
async function mahasiswaView(area) {
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card">
                  <div class="card-header d-flex justify-between align-center wrap gap-2">
                      <h3><i class="fa-solid fa-users text-primary"></i> Daftar Mahasiswa Bimbingan</h3>
                      <div class="filter-group d-flex align-center gap-2">
                          <select id="filter-status-nilai" class="form-control" style="width:200px; padding:0.4rem;">
                              <option value="all">Tampilkan Semua Status</option>
                              <option value="belum">Pilih: Belum Dinilai</option>
                              <option value="sudah">Pilih: Sudah Dinilai</option>
                          </select>
                      </div>
                  </div>
                  <div class="card-body">
                      <div class="table-responsive">
                          <table id="table-mhs-bimb">
                              <thead>
                                  <tr>
                                      <th>Nama Mahasiswa</th>
                                      <th>NIM / Username</th>
                                      <th>Prodi & Lokasi</th>
                                      <th>Tanggal Praktik</th>
                                      <th style="text-align:right">Aksi Penilaian</th>
                                  </tr>
                              </thead>
                              <tbody><tr><td colspan="4" class="empty-table"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data...</td></tr></tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      `;

  const tableBody = document.querySelector("#table-mhs-bimb tbody");
  if (!tableBody) return;

  const [resAssigned, resTempat, resGroups] = await Promise.all([
    fetchAPI("getAssignedStudents", { tempat_id: currentUser.tempat_id }),
    fetchCachedAPI("getTempat"),
    fetchAPI("getKelompok"),
  ]);

  if (!resAssigned.success) {
    tableBody.innerHTML = `<tr><td colspan="4" class="empty-table text-danger">Gagal memuat data bimbingan</td></tr>`;
    return;
  }

  const studentIds = resAssigned.data.map((u) => u.id);
  const [resJadwal, resNilai] = await Promise.all([
    fetchAPI("getJadwal", { user_id: studentIds }),
    fetchAPI("getPenilaianAkhir", { ids: studentIds }),
  ]);

  if (resJadwal.success && resTempat.success) {
    let mhs = resAssigned.data;
    const roleKeyArray =
      currentUser.role === "preseptor_akademik"
        ? "akd_components_count"
        : "klinik_components_count"; // Helper to check if any components have scores from this preceptor type

    // Map data tambahan
    mhs = mhs.map((u) => {
      // Lahan mapping
      const userJadwal = resJadwal.data.filter((j) => j.user_id == u.id);
      let relevantJadwal = userJadwal;

      // if preceptor is assigned to specific locations, only get schedules for those locations
      if (currentUser.tempat_id && currentUser.tempat_id !== "-") {
        const preseptorTempat = currentUser.tempat_id.split(",");
        relevantJadwal = userJadwal.filter((j) =>
          preseptorTempat.includes(String(j.tempat_id)),
        );
      }

      if (relevantJadwal.length > 0) {
        const lahanNames = [
          ...new Set(
            relevantJadwal.map((j) => {
              const t = resTempat.data.find((x) => x.id == j.tempat_id);
              return t ? t.nama_tempat : "-";
            }),
          ),
        ];
        u.nama_lahan = lahanNames.join(", ");

        // Sort by date before joining
        relevantJadwal.sort(
          (a, b) => new Date(a.tanggal) - new Date(b.tanggal),
        );
        const dates = relevantJadwal.map((j) => j.tanggal);
        const minDate = new Date(Math.min(...dates.map((d) => new Date(d))));
        const maxDate = new Date(Math.max(...dates.map((d) => new Date(d))));

        if (minDate.getTime() === maxDate.getTime()) {
          u.tanggal_praktik = formatDateIndo(dates[0]);
        } else {
          u.tanggal_praktik = `${formatDateIndo(minDate.toISOString().split("T")[0])} <br>s/d<br> ${formatDateIndo(maxDate.toISOString().split("T")[0])}`;
        }

        u.firstDate = minDate.toISOString().split("T")[0];
        u.isAssignedToPreceptor = true;
      } else {
        u.nama_lahan = "-";
        u.tanggal_praktik = "-";
        u.isAssignedToPreceptor = false;
      }
      // Nilai mapping
      u.sudahDinilai = false;
      if (resNilai.success && resNilai.data) {
        const nilaiMhs = resNilai.data.find((n) => n.id == u.id);
        if (nilaiMhs) {
          // We consider 'sudah dinilai' if they have a total score > 0 in their respective category
          // OR if we just want a simple check: if any of prak/askep/sikap in their category > 0
          const prakScore =
            currentUser.role === "preseptor_akademik"
              ? nilaiMhs.akademik_prak
              : nilaiMhs.klinik_prak;
          const askepScore =
            currentUser.role === "preseptor_akademik"
              ? nilaiMhs.akademik_askep
              : nilaiMhs.klinik_askep;
          const sikapScore =
            currentUser.role === "preseptor_akademik"
              ? nilaiMhs.akademik_sikap
              : nilaiMhs.klinik_sikap;

          if (prakScore > 0 || askepScore > 0 || sikapScore > 0) {
            u.sudahDinilai = true;
          }
        }
      }
      return u;
    });

    // Setup filter dropdown
    document.getElementById("filter-status-nilai").onchange = (e) => {
      renderTabelBimbingan(mhs, e.target.value);
    };

    // Initial render
    const renderTabelBimbingan = async (dataList, filterStr) => {
      let displayData = dataList;
      if (currentUser.tempat_id && currentUser.tempat_id !== "-") {
        displayData = displayData.filter((u) => u.isAssignedToPreceptor);
      }

      if (filterStr === "belum") {
        displayData = displayData.filter((u) => !u.sudahDinilai);
      } else if (filterStr === "sudah") {
        displayData = displayData.filter((u) => u.sudahDinilai);
      }

      // Fetch Rekap for Progress Tracker
      const sIds = displayData.map((x) => x.id);
      const resRekap = await fetchAPI("getRekapLogbook", { ids: sIds });
      const rekap = resRekap.success ? resRekap.data : {};

      // Sort by earliest date
      displayData.sort((a, b) => {
        const dateA = a.firstDate
          ? new Date(a.firstDate)
          : new Date(8640000000000000);
        const dateB = b.firstDate
          ? new Date(b.firstDate)
          : new Date(8640000000000000);
        return dateA - dateB;
      });

      if (displayData.length > 0) {
        tableBody.innerHTML = displayData
          .map((u, idx) => {
            const myData = (resRekap.data || []).find(
              (x) => x.user_id === u.id,
            );
            const myRekap = myData ? myData.rekap || [] : [];
            const completed = myRekap.filter(
              (r) => r.status === "Tercapai",
            ).length;
            const targets = myRekap.length;
            const pct =
              targets > 0 ? Math.round((completed / targets) * 100) : 0;
            const progressColor =
              pct >= 100 ? "var(--success)" : "var(--primary)";

            const myKel = (resGroups.data || []).find(
              (g) => g.id === u.kelompok_id,
            );
            const kelNama = myKel ? myKel.nama_kelompok : "Tanpa Kelompok";

            return `
                      <tr class="animate-fade-up delay-${((idx % 5) + 1) * 100}">
                          <td>
                              <div class="d-flex align-center gap-3">
                                  <div style="width:35px;height:35px;border-radius:50%;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem">
                                      ${u.nama.charAt(0)}
                                  </div>
                                  <div style="flex:1">
                                      <div class="font-bold" style="color:var(--text-strong)">${u.nama}</div>
                                      <div class="text-xs text-muted mb-1"><i class="fa-solid fa-users"></i> ${kelNama}</div>
                                      <div class="text-xs font-medium" style="color:var(--primary)">${u.username || u.id}</div>
                                  </div>
                                  ${u.sudahDinilai ? '<i class="fa-solid fa-circle-check text-success" title="Sudah memiliki nilai final"></i>' : ""}
                              </div>
                          </td>
                          <td>
                              <div style="width:100px;">
                                  <div class="d-flex justify-between text-xs mb-1">
                                      <span class="font-bold">${pct}%</span>
                                      <span class="text-muted">${completed}/${targets} Skill</span>
                                  </div>
                                  <div style="height:6px; background:#e2e8f0; border-radius:10px; overflow:hidden;">
                                      <div style="width:${pct}%; height:100%; background:${progressColor}; transition:width 0.5s ease;"></div>
                                  </div>
                              </div>
                          </td>
                          <td>
                              <span class="badge bg-primary-soft text-primary-dark" style="font-size:0.75rem">${u.prodi}</span><br>
                              <small class="text-muted"><i class="fa-solid fa-hospital-user"></i> ${u.nama_lahan}</small>
                          </td>
                          <td>
                              <div style="font-size:0.8rem; line-height:1.4;">
                                  ${u.tanggal_praktik}
                              </div>
                          </td>
                          <td style="text-align:right">
                              <div class="d-flex gap-1 justify-end">
                                  <button class="btn btn-icon-ghost" onclick="bukaModalPreceptorNotes('${u.id}', '${u.nama}')" title="Catatan Preseptor (Antar-Dosen)"><i class="fa-solid fa-comments"></i></button>
                                  ${u.sudahDinilai ? `<button class="btn btn-warning btn-sm" style="border-radius:20px; font-size:0.75rem" onclick="bukaModalInputNilai('${u.id}', '${u.nama}')"><i class="fa-solid fa-pen-to-square"></i></button>` : `<button class="btn btn-primary btn-sm" style="border-radius:20px; font-size:0.75rem" onclick="bukaModalInputNilai('${u.id}', '${u.nama}')"><i class="fa-solid fa-pen-nib"></i></button>`}
                              </div>
                          </td>
                      </tr>
                  `;
          })
          .join("");
      } else {
        tableBody.innerHTML = `<tr><td colspan="5" class="empty-table"><i class="fa-solid fa-user-slash fa-2x mb-2" style="display:block;color:#cbd5e1;"></i>Tidak ada mahasiswa bimbingan ditemukan.</td></tr>`;
      }
    };

    // Initial render
    renderTabelBimbingan(mhs, "all");
  }
}

window.bukaModalInputNilai = async (mhsId, mhsNama) => {
  showLoader(true);
  const [m1, m2, m3, currentGrades] = await Promise.all([
    fetchAPI("getBimbPraktikum"),
    fetchAPI("getBimbAskep"),
    fetchAPI("getSikapPerilaku"),
    fetchAPI("getStudentGrades", {
      student_id: mhsId,
      grader_role: currentUser.role,
    }),
  ]);
  showLoader(false);

  const findVal = (type, compId) => {
    const list = currentGrades.data[type] || [];
    const found = list.find((r) => r.component_id == compId);
    return found ? found.nilai : "";
  };

  const renderRows = (title, type, master, current) => {
    if (!master.data || master.data.length === 0)
      return `<p class="text-muted">Master ${title} belum diatur.</p>`;
    return `
              <div class="assessment-group mb-4">
                  <h4 class="mb-3 text-primary" style="font-weight:700; border-left:4px solid var(--primary); padding-left:10px; font-size:1rem">${title}</h4>
                  <div class="table-responsive" style="border-radius:12px; border:1px solid #e2e8f0; overflow:hidden;">
                      <table class="table" style="font-size:0.85rem; margin-bottom:0">
                          <thead style="background:#f8fafc">
                              <tr>
                                  <th style="border-bottom:none">Komponen / Aspek Penilaian</th>
                                  <th width="80" class="text-center" style="border-bottom:none">Maks</th>
                                  <th width="100" class="text-center" style="border-bottom:none">Nilai</th>
                              </tr>
                          </thead>
                          <tbody>
                              ${master.data
                                .map((m) => {
                                  const maxVal = parseFloat(
                                    type === "askep"
                                      ? m.skor_maks || 100
                                      : m.nilai_maksimal || 100,
                                  );
                                  return `
                                  <tr>
                                      <td style="vertical-align:middle; line-height:1.4">${m.nama_komponen}</td>
                                      <td class="text-center" style="vertical-align:middle"><strong>${maxVal}</strong></td>
                                      <td style="vertical-align:middle">
                                          <input type="number" step="0.1" class="form-control input-score" 
                                              data-type="${type}" data-comp="${m.id}" data-max="${maxVal}"
                                              value="${findVal(type, m.id)}" 
                                              oninput="validateInputScore(this)"
                                              placeholder="0" style="text-align:center; font-weight:700; padding:0.4rem;">
                                          <div class="invalid-feedback text-danger" style="font-size:0.65rem; display:none; margin-top:4px; text-align:center">Melebihi ${maxVal}!</div>
                                      </td>
                                  </tr>
                              `;
                                })
                                .join("")}
                          </tbody>
                      </table>
                  </div>
              </div>
          `;
  };

  openModal(
    `Input Nilai: ${mhsNama}`,
    `
          <div id="container-nilai">
              ${renderRows("Bimbingan Praktikum", "praktikum", m1)}
              ${renderRows("Bimbingan ASKEP", "askep", m2)}
              ${renderRows("Sikap & Perilaku", "sikap", m3)}
              <button class="btn btn-primary btn-block mt-3" onclick="prosesSimpanNilai('${mhsId}')">
                  <i class="fa-solid fa-save"></i> Simpan Penilaian
              </button>
          </div>
      `,
  );
};

window.prosesSimpanNilai = async (mhsId) => {
  const inputs = document.querySelectorAll(".input-score");
  let hasError = false;
  const results = [];

  inputs.forEach((input) => {
    const val = parseFloat(input.value);
    const max = parseFloat(input.dataset.max);

    if (input.value !== "") {
      if (val > max) {
        hasError = true;
        input.style.borderColor = "#ef4444";
      }
      results.push({
        type: input.dataset.type,
        student_id: mhsId,
        component_id: input.dataset.comp,
        nilai: input.value,
        preseptor_id: currentUser.id,
      });
    }
  });

  if (hasError)
    return showToast(
      "Gagal Simpan",
      "Terdapat nilai yang melebihi batas maksimal yang diizinkan!",
      "error",
    );
  if (results.length === 0)
    return showToast("Peringatan", "Belum ada nilai yang diinput", "warning");

  showToast("Menyimpan", "Sedang memproses data...", "info");
  const res = await postAPI("saveGrades", {
    results,
    grader_role: currentUser.role,
    student_id: mhsId,
  });
  if (res.success) {
    closeModal();
    showToast(
      "Tersimpan",
      "Seluruh nilai mahasiswa berhasil diperbarui",
      "success",
    );
  }
};

window.validateInputScore = (el) => {
  const maxVal = parseFloat(el.dataset.max);
  const val = parseFloat(el.value);
  const feedback = el.nextElementSibling;
  if (val > maxVal) {
    el.style.borderColor = "#ef4444";
    if (feedback) feedback.style.display = "block";
  } else {
    el.style.borderColor = "";
    if (feedback) feedback.style.display = "none";
  }
};

// ADMIN: PENILAIAN AKHIR (RINGKASAN)
async function penilaianAkhirView(area) {
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card">
                  <div class="card-header d-flex align-center justify-between wrap gap-3">
                      <div>
                          <h3><i class="fa-solid fa-file-signature text-primary"></i> Ringkasan Penilaian Akhir Mahasiswa</h3>
                          <div class="text-muted" style="font-size:0.8rem" id="status-threshold-info">
                              Rumus: (Prak 40%) + (ASKEP 40%) + (Sikap 20%). Batas Lulus: ...
                          </div>
                      </div>
                      <div class="d-flex align-center gap-2 wrap">
                          <div class="filter-group d-flex align-center gap-2">
                              <select id="filter-prodi-assessment" class="form-control" style="width:180px; padding:0.4rem;">
                                  <option value="all">Semua Prodi</option>
                              </select>
                          </div>
                          <div class="btn-group d-flex gap-2">
                              <button class="btn btn-outline btn-sm" onclick="exportAssessmentCSV()"><i class="fa-solid fa-file-csv"></i> CSV</button>
                              <button class="btn btn-danger-soft btn-sm" onclick="exportAssessmentPDF()"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                              <button class="btn btn-danger btn-sm" onclick="hapusSemuaNilai()"><i class="fa-solid fa-trash-can"></i> Hapus Semua Nilai</button>
                          </div>
                      </div>
                  </div>
                  <div class="card-body">
                      <div class="table-responsive">
                          <table id="table-final-scores" style="font-size:0.9rem">
                              <thead>
                                  <tr>
                                      <th>Nama Mahasiswa</th>
                                      <th>Prodi</th>
                                      <th>Praktikum (40%)</th>
                                      <th>ASKEP (40%)</th>
                                      <th>Sikap (20%)</th>
                                      <th>NILAI AKHIR</th>
                                      <th>STATUS</th>
                                  </tr>
                              </thead>
                              <tbody><tr><td colspan="7" class="empty-table"><i class="fa-solid fa-spinner fa-spin"></i> Menghitung skor...</td></tr></tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      `;

  showLoader(true);
  const [allRes, prodiRes] = await Promise.all([
    fetchAPI("getPenilaianAkhir"),
    fetchAPI("getProdi"),
  ]);
  showLoader(false);

  if (!allRes.success)
    return showToast("Gagal", "Gagal memuat data penilaian", "error");

  const tableBody = document.querySelector("#table-final-scores tbody");
  const prodiSelect = document.getElementById("filter-prodi-assessment");
  const thresholdInfo = document.getElementById("status-threshold-info");

  const activeThreshold = allRes.threshold || 75;
  const w = allRes.weights || { prak: 40, askep: 40, sikap: 20 };
  const wKlinik = w.klinik || 50;
  const wAkademik = w.akademik || 50;
  window.lastWKlinik = wKlinik;
  window.lastWAkademik = wAkademik;

  thresholdInfo.innerHTML = `Rumus: (Prak ${w.prak}%) + (ASKEP ${w.askep}%) + (Sikap ${w.sikap}%). <strong>Nilai = ${wKlinik}% Klinik + ${wAkademik}% Akademik</strong>. Batas Lulus: <strong>${activeThreshold}</strong>`;

  // Update Table Headers
  const tableHeader = document.querySelector("#table-final-scores thead tr");
  tableHeader.innerHTML = `
          <th rowspan="2">Nama Mahasiswa</th>
          <th rowspan="2">Prodi</th>
          <th colspan="2" class="text-center" style="background:#e0f2fe; border-bottom:1px solid #bae6fd;">Preseptor Klinik (${wKlinik}%)</th>
          <th colspan="2" class="text-center" style="background:#fef3c7; border-bottom:1px solid #fde68a;">Preseptor Akademik (${wAkademik}%)</th>
          <th rowspan="2">NILAI AKHIR</th>
          <th rowspan="2">STATUS</th>
      `;
  // Add sub-header row
  const subHeaderRow = document.createElement("tr");
  subHeaderRow.innerHTML = `
          <th style="background:#e0f2fe; font-size:0.75rem">Skor</th>
          <th style="background:#e0f2fe; font-size:0.75rem">Kontrib.</th>
          <th style="background:#fef3c7; font-size:0.75rem">Skor</th>
          <th style="background:#fef3c7; font-size:0.75rem">Kontrib.</th>
      `;
  tableHeader.parentElement.appendChild(subHeaderRow);

  if (prodiRes.success && prodiRes.data) {
    prodiRes.data.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.nama_prodi;
      opt.textContent = p.nama_prodi;
      prodiSelect.appendChild(opt);
    });
  }

  const renderAssessmentTable = (data) => {
    window.dtAssessmentView = data;
    if (!data || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" class="empty-table">Tidak ada data penilaian.</td></tr>`;
      return;
    }

    // Sort data by nama alphabetically
    data.sort((a, b) => {
      const nameA = a.nama || "";
      const nameB = b.nama || "";
      return nameA.localeCompare(nameB);
    });

    tableBody.innerHTML = data
      .map((row, idx) => {
        const statusClass =
          row.total >= activeThreshold ? "bg-success" : "bg-danger";
        const statusText =
          row.total >= activeThreshold ? "LULUS" : "TIDAK LULUS";
        return `
                  <tr class="animate-fade-up delay-${((idx % 5) + 1) * 100}">
                      <td><strong>${row.nama}</strong><br><small class="text-muted">${row.username}</small></td>
                      <td><span class="badge bg-primary-soft text-primary" style="font-weight:600">${row.prodi || "-"}</span></td>
                      <td style="background:#f0f9ff">${row.klinik_total.toFixed(2)}</td>
                      <td style="background:#f0f9ff"><strong>${((row.klinik_total * wKlinik) / 100).toFixed(2)}</strong></td>
                      <td style="background:#fffbeb">${row.akademik_total.toFixed(2)}</td>
                      <td style="background:#fffbeb"><strong>${((row.akademik_total * wAkademik) / 100).toFixed(2)}</strong></td>
                      <td><span class="badge" style="font-size:1.1em; background:var(--primary); color:white">${row.total.toFixed(2)}</span></td>
                      <td><span class="badge ${statusClass}">${statusText}</span></td>
                  </tr>
              `;
      })
      .join("");
  };

  if (allRes.success) {
    window.rawAssessmentData = allRes.data;
    renderAssessmentTable(window.rawAssessmentData);
  }

  prodiSelect.onchange = (e) => {
    const val = e.target.value;
    if (val === "all") {
      renderAssessmentTable(window.rawAssessmentData);
    } else {
      const filtered = window.rawAssessmentData.filter((d) => d.prodi === val);
      renderAssessmentTable(filtered);
    }
  };
}

window.exportAssessmentCSV = () => {
  if (!window.dtAssessmentView) return;
  const wK = window.lastWKlinik || 50;
  const wA = window.lastWAkademik || 50;
  const headers = [
    "Nama",
    "NIM",
    "Prodi",
    "Skor Klinik",
    `Kontrib. Klinik (${wK}%)`,
    "Skor Akademik",
    `Kontrib. Akademik (${wA}%)`,
    "Total",
    "Status",
  ];
  const rows = window.dtAssessmentView.map((r) => [
    r.nama,
    r.username,
    r.prodi || "-",
    r.klinik_total.toFixed(2),
    ((r.klinik_total * wK) / 100).toFixed(2),
    r.akademik_total.toFixed(2),
    ((r.akademik_total * wA) / 100).toFixed(2),
    r.total.toFixed(2),
    r.total >= window.lastAssessmentThreshold ? "LULUS" : "TIDAK LULUS",
  ]);

  downloadCSV(
    headers,
    rows,
    `Penilaian_Akhir_eKlinik_${new Date().toLocaleDateString()}.csv`,
  );
};

window.exportAssessmentPDF = () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFont("helvetica", "bold");
  doc.text("Laporan Ringkasan Penilaian Akhir", 14, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Waktu Cetak: ${new Date().toLocaleString()}`, 14, 28);
  doc.text(
    `Nilai = ${window.lastWKlinik || 50}% Preseptor Klinik + ${window.lastWAkademik || 50}% Preseptor Akademik`,
    14,
    34,
  );
  const wK2 = window.lastWKlinik || 50;
  const wA2 = window.lastWAkademik || 50;

  const tableData = window.dtAssessmentView.map((r) => [
    r.nama,
    r.prodi || "-",
    r.klinik_total.toFixed(2),
    ((r.klinik_total * wK2) / 100).toFixed(2),
    r.akademik_total.toFixed(2),
    ((r.akademik_total * wA2) / 100).toFixed(2),
    r.total.toFixed(2),
    r.total >= window.lastAssessmentThreshold ? "LULUS" : "TIDAK LULUS",
  ]);

  doc.autoTable({
    startY: 40,
    head: [
      [
        "Nama",
        "Prodi",
        "Skor Klinik",
        `Kontrib. ${wK2}%`,
        "Skor Akademik",
        `Kontrib. ${wA2}%`,
        "Total",
        "Status",
      ],
    ],
    body: tableData,
  });
  doc.save(`Assessment_Report_${new Date().getTime()}.pdf`);
};

window.hapusSemuaNilai = async () => {
  if (
    confirm(
      `⚠️ PERINGATAN KRUSIAL!\n\nAnda akan menghapus SELURUH data penilaian (Klinik & Akademik).\nSemua nilai dari kedua jenis preseptor akan dihapus.\n\nApakah Anda benar-benar yakin?`,
    )
  ) {
    if (confirm(`Konfirmasi terakhir: Hapus semua data penilaian?`)) {
      showLoader(true);
      const res = await postAPI("clearAllGrades", {});
      showLoader(false);
      if (res.success) {
        showToast("Berhasil", res.message, "success");
        loadView("penilaianAkhirView");
      }
    }
  }
};

window.eksekusiGenerateJadwal = async (batchNum = null) => {
  const kelIds = Array.from(
    document.querySelectorAll('input[name="sel-kelompok"]:checked'),
  ).map((cb) => cb.value);

  const selects = document.querySelectorAll(".select-tempat-preview");
  const assignments = [];

  selects.forEach((sel) => {
    const kelId = sel.getAttribute("data-kelompok");
    const staseNo = parseInt(sel.getAttribute("data-stase"));
    const tempatId = sel.value;
    const staseInfo = window.currentStaseConfig.find(
      (s) => s.stase === staseNo,
    );

    if (tempatId) {
      assignments.push({
        kelompok_id: kelId,
        tempat_id: tempatId,
        tgl_mulai: staseInfo.start,
        tgl_selesai: staseInfo.end,
      });
    }
  });

  if (assignments.length === 0)
    return showToast(
      "Warning",
      "Tidak ada pemetaan tempat yang dipilih",
      "warning",
    );

  const clearExisting = document.getElementById("check-clear-jadwal").checked;
  const shiftCount = document.getElementById(
    "input-jumlah-shift-kelompok",
  ).value;
  const startTime = document.getElementById("input-jam-mulai-kelompok").value;

  if (
    confirm("Simpan jadwal ini ke database? Perubahan tidak dapat dibatalkan.")
  ) {
    showLoader(true);
    if (batchNum) {
      // ENSURE EXCLUSIVITY: Remove these kelIds from other batches first
      const currentSets = await fetchAPI("getSettings");
      const updates = {};
      if (currentSets.success) {
        [1, 2, 3].forEach((b) => {
          const key = `batch_kelompok_${b}`;
          let val = (currentSets.data.find((s) => s.key === key)?.value || "")
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id !== "" && !kelIds.includes(id));
          updates[key] = val.join(",");
        });
      }
      // Now set for this batch
      updates[`batch_kelompok_${batchNum}`] = kelIds.join(",");
      await postAPI("saveSettings", updates);
    }
    const res = await postAPI("generateJadwalKelompok", {
      assignments,
      clearExisting,
      shiftCount,
      startTime,
      batch: batchNum,
      kelompokIds: kelIds,
    });
    showLoader(false);
    if (res.success) {
      showToast("Berhasil", res.message, "success");
      loadView(batchNum ? `jadwalAdmin${batchNum}View` : "jadwalAdminView");
    } else {
      showToast("Gagal", res.message, "error");
    }
  }
};

window.selectAllKelompok = (state) => {
  document
    .querySelectorAll('input[name="sel-kelompok"]')
    .forEach((cb) => (cb.checked = state));
};

// BATCH VIEW FACTORIES
[1, 2, 3].forEach((n) => {
  window[`generatorKelompok${n}View`] = (area) =>
    generatorKelompokView(area, n);
  window[`jadwalAdmin${n}View`] = (area) => jadwalAdminView(area, n);
});

window.backupDataJSON = async () => {
  showLoader(true);
  showToast("Memproses", "Mengekspor seluruh data...", "info");
  const res = await fetchAPI("backupData");
  showLoader(false);
  if (res.success && res.data) {
    const json = JSON.stringify(res.data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eKlinik_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Berhasil", "Backup berhasil diunduh", "success");
  } else {
    showToast("Gagal", "Gagal membuat backup", "error");
  }
};

window.restoreDataJSON = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = "";

  if (
    !confirm(
      `⚠️ PERINGATAN!\n\nRestore akan MENIMPA seluruh data yang ada dengan data dari file backup.\nPastikan Anda sudah mem-backup data saat ini terlebih dahulu.\n\nLanjutkan?`,
    )
  )
    return;
  if (!confirm(`Konfirmasi terakhir: Restore data dari file "${file.name}"?`))
    return;

  try {
    const text = await file.text();
    const backup = JSON.parse(text);
    showLoader(true);
    showToast("Memproses", "Sedang me-restore data...", "info");
    const res = await postAPI("restoreData", { backup });
    showLoader(false);
    if (res.success) {
      showToast("Berhasil", res.message, "success");
      loadView("settingsAdminView");
    } else {
      showToast("Gagal", res.message || "Gagal me-restore data", "error");
    }
  } catch (err) {
    showLoader(false);
    showToast("Error", "File JSON tidak valid: " + err.message, "error");
  }
};

// ADMIN: SEMUA DATA / EXPORT
async function adminView(area) {
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card mb-4" id="master-lahan-container">
                  <div class="card-header">
                      <h3><i class="fa-solid fa-qrcode text-primary"></i> Master Lahan & QR Code Presensi</h3>
                      <button class="btn btn-primary btn-sm" onclick="bukaModalSemuaQRCode()">
                          <i class="fa-solid fa-layer-group"></i> Generate Semua QR
                      </button>
                  </div>
                  <div class="card-body">
                      <div id="lahan-list-container" class="grid-cards" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">
                          <div class="text-center w-100 text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Memuat Lahan Praktik...</div>
                      </div>
                  </div>
              </div>

              <div class="card">
                  <div class="card-header">
                      <h3><i class="fa-solid fa-server text-primary"></i> Master Data Presensi Mahasiswa</h3>
                      <div class="d-flex gap-2">
                          <button class="btn btn-outline btn-sm" onclick="exportToCSV()"><i class="fa-solid fa-file-csv"></i> Unduh CSV</button>
                          <button class="btn btn-danger-soft btn-sm" onclick="exportToPDF()"><i class="fa-solid fa-file-pdf"></i> Unduh PDF</button>
                      </div>
                  </div>
                  <div class="card-body">
                      <div class="table-responsive">
                          <table id="table-admin">
                              <thead>
                                  <tr>
                                                                          <th>Mahasiswa & Prodi</th>
                                      <th>Lahan Praktik</th>

                                      <th>Tanggal</th>
                                      <th>Waktu Masuk</th>
                                      <th>Waktu Keluar</th>
                                                                          <th>Durasi</th>

                                  </tr>
                              </thead>
                                                          <tbody><tr><td colspan="6" class="empty-table">
  <i class="fa-solid fa-spinner fa-spin"></i> Sinkronisasi database...</td></tr></tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      `;

  const [resPresensi, resTempat] = await Promise.all([
    fetchAPI("getAllPresensi"),
    fetchAPI("getTempat"),
  ]);

  const lahanContainer = document.getElementById("lahan-list-container");
  if (lahanContainer) {
    if (resTempat.success && resTempat.data && resTempat.data.length > 0) {
      lahanContainer.innerHTML = resTempat.data
        .map(
          (t) => `
                  <div class="stat-card" style="padding: 1rem; align-items: start; flex-direction:column; gap:0.5rem; justify-content:start;">
                      <div class="w-100 d-flex justify-between align-center mb-1">
                          <strong style="font-size:1.1rem; color:var(--primary-dark); line-height:1.2;">${t.nama_tempat}</strong>
                      </div>
                      <span class="badge bg-primary-soft mb-2">ID: ${t.id}</span>
                      <button class="btn btn-outline btn-sm w-100 mt-auto" onclick="bukaModalQRCode('${t.nama_tempat}')">
                          <i class="fa-solid fa-qrcode"></i> Generate QR Code
                      </button>
                  </div>
              `,
        )
        .join("");
    } else {
      lahanContainer.innerHTML = `<div class="text-center w-100 text-muted">Belum ada data lahan praktik.</div>`;
    }
  }

  window.dtAdminPresensi = []; // For export
  const tableBody = document.querySelector("#table-admin tbody");
  if (!tableBody) return; // Defensive check for null

  if (resPresensi.success && resPresensi.data.length > 0) {
    window.dtAdminPresensi = resPresensi.data;
    tableBody.innerHTML = resPresensi.data
      .map((p) => {
        const dur = p.durasi
          ? parseFloat(p.durasi).toFixed(2) + " Jam"
          : '<span class="text-muted"><i class="fa-solid fa-rotate fa-spin"></i> Aktif</span>';
        return `
              <tr>
                  <td>
                      <strong>${p.nama}</strong><br>
                      <small class="text-muted">${p.prodi || "-"}</small>
                  </td>
                  <td><span class="badge bg-primary-soft text-primary"><i class="fa-solid fa-hospital"></i> ${p.nama_lahan}</span></td>
                  <td>${formatDateIndo(p.tanggal)}</td>
                  <td><span class="badge bg-primary">${formatDateIndo(p.jam_masuk)}</span></td>
                  <td>${p.jam_keluar ? `<span class="badge bg-primary">${formatDateIndo(p.jam_keluar)}</span>` : "-"}</td>
                  <td>${dur}</td>
              </tr>
          `;
      })
      .join("");
  } else {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-table"><i class="fa-solid fa-database fa-2x mb-2" style="color:#cbd5e1;display:block"></i>Tidak ada riwayat database presensi.</td></tr>`;
  }
}

// ============ LAPORAN KEJADIAN VIEW (Pelapor) ============
async function laporanView(area) {
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card" style="border-top: 4px solid var(--danger);">
                  <div class="card-header">
                      <h3 class="m-0 text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Buat Laporan Kejadian / Kendala</h3>
                      <p class="text-muted mt-1" style="font-size:0.85rem;">Laporkan kendala atau kejadian luar biasa di tempat praktik untuk ditindaklanjuti.</p>
                  </div>
                  <div class="card-body">
                      <form id="form-laporan">
                          <div class="form-group">
                              <label>Tipe Kejadian / Masalah</label>
                              <select id="lap-tipe" class="form-control" required>
                                  <option value="">-- Pilih Tipe --</option>
                                  <option value="Absensi / Ketidakhadiran">Absensi / Ketidakhadiran</option>
                                  <option value="Pelanggaran Aturan">Pelanggaran Aturan</option>
                                  <option value="Kendala Teknis/Aplikasi">Kendala Teknis / Aplikasi</option>
                                  <option value="Masalah di Lahan Praktik">Masalah di Lahan Praktik</option>
                                  <option value="Lain-lain">Lain-lain</option>
                              </select>
                          </div>

                          ${
                            currentUser.role !== "mahasiswa"
                              ? `
                          <div class="form-group">
                              <label>Mahasiswa Terkait (Opsional)</label>
                              <select id="lap-student" class="form-control">
                                  <option value="-">-- Pilih Mahasiswa (Jika Ada) --</option>
                              </select>
                          </div>
                          `
                              : ""
                          }

                          <div class="form-group">
                              <label>Deskripsi Kejadian</label>
                              <textarea id="lap-deskripsi" class="form-control" rows="5" placeholder="Jelaskan secara detail kronologi kejadian..." required></textarea>
                          </div>

                          <div class="alert alert-warning-soft text-sm">
                              <i class="fa-solid fa-circle-info"></i> Laporan ini akan langsung diteruskan ke Admin & Preseptor Akademik untuk dipelajari.
                          </div>

                          <div class="d-flex justify-end mt-4">
                              <button type="submit" class="btn btn-danger">
                                  <i class="fa-solid fa-paper-plane"></i> Kirim Laporan
                              </button>
                          </div>
                      </form>
                  </div>
              </div>
          </div>
      `;

  if (currentUser.role !== "mahasiswa") {
    const studentSelect = document.getElementById("lap-student");
    const resUsers = await fetchCachedAPI("getUsers");
    if (resUsers.success) {
      const students = resUsers.data.filter((u) => u.role === "mahasiswa");
      students.sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));
      students.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = `${s.nama} (${s.id})`;
        opt.dataset.nama = s.nama;
        studentSelect.appendChild(opt);
      });
    }
  }

  document.getElementById("form-laporan").onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      action: "addLaporan",
      user_id: currentUser.id,
      nama_pelapor: currentUser.nama,
      role_pelapor: currentUser.role,
      tipe_kejadian: document.getElementById("lap-tipe").value,
      deskripsi: document.getElementById("lap-deskripsi").value,
      student_id: document.getElementById("lap-student")
        ? document.getElementById("lap-student").value
        : "-",
      nama_terlapor:
        document.getElementById("lap-student") &&
        document.getElementById("lap-student").value !== "-"
          ? document.getElementById("lap-student").selectedOptions[0].dataset
              .nama
          : "-",
    };

    showLoader(true);
    const res = await postAPI("addLaporan", payload);
    showLoader(false);

    if (res.success) {
      showToast("Sukses", "Laporan berhasil dikirim.", "success");
      laporanView(area);
    } else {
      showToast("Gagal", res.message || "Gagal mengirim laporan.", "error");
    }
  };

  // Render Riwayat
  area.insertAdjacentHTML(
    "beforeend",
    `
          <div class="card mt-4 animate-fade-up delay-200">
              <div class="card-header">
                  <h3 class="m-0"><i class="fa-solid fa-clock-rotate-left text-primary"></i> Riwayat Laporan Saya</h3>
              </div>
              <div class="card-body">
                  <div class="table-responsive">
                      <table class="table-compact" id="table-riwayat-laporan">
                          <thead>
                              <tr>
                                  <th>Tanggal</th>
                                  <th>TiPe</th>
                                  <th>Terlapor</th>
                                  <th>Status</th>
                                  <th>Aksi</th>
                              </tr>
                          </thead>
                          <tbody>
                              <tr><td colspan="5" class="empty-table"><i class="fa-solid fa-spinner fa-spin"></i> Memuat riwayat...</td></tr>
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      `,
  );

  const resLap = await fetchAPI("getLaporan");
  const tbody = document.querySelector("#table-riwayat-laporan tbody");
  if (!tbody) return;

  if (resLap.success && resLap.data.length > 0) {
    const myReports = resLap.data
      .filter((l) => l.user_id_pelapor == currentUser.id)
      .reverse();
    if (myReports.length > 0) {
      tbody.innerHTML = myReports
        .map(
          (l) => `
                  <tr>
                      <td class="text-sm">${formatDateIndo(l.tanggal, true)}</td>
                      <td><span class="badge bg-danger-soft text-danger">${l.tipe_kejadian}</span></td>
                      <td>${l.nama_terlapor !== "-" ? l.nama_terlapor : "-"}</td>
                      <td><span class="badge ${l.status === "Baru" ? "bg-danger" : "bg-success"}">${l.status}</span></td>
                      <td>
                          <button class="btn btn-outline btn-xs" onclick="detailLaporan('${l.id}')">
                              <i class="fa-solid fa-eye"></i> Detail
                          </button>
                      </td>
                  </tr>
              `,
        )
        .join("");
    } else {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-table">Belum ada laporan yang Anda buat.</td></tr>`;
    }
  } else {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-table">Belum ada laporan yang Anda buat.</td></tr>`;
  }

  window.detailLaporan = async (id) => {
    const res = await fetchAPI("getLaporan");
    const lap = res.data.find((x) => x.id === id);
    if (lap) {
      openModal(
        "Detail Laporan Kejadian",
        `
                  <div class="py-2">
                      <div class="mb-3">
                          <label class="d-block text-muted text-xs uppercase font-bold">Tipe Kejadian</label>
                          <div class="font-bold text-danger">${lap.tipe_kejadian}</div>
                      </div>
                      <div class="mb-3">
                          <label class="d-block text-muted text-xs uppercase font-bold">Tanggal</label>
                          <div>${formatDateIndo(lap.tanggal, true)}</div>
                      </div>
                      <div class="mb-3">
                          <label class="d-block text-muted text-xs uppercase font-bold">Terlapor</label>
                          <div>${lap.nama_terlapor !== "-" ? lap.nama_terlapor : "Tidak ada (Masalah Umum)"}</div>
                      </div>
                      <div class="mb-3">
                          <label class="d-block text-muted text-xs uppercase font-bold">Deskripsi</label>
                          <div class="p-3 bg-light rounded text-sm" style="white-space:pre-wrap;">${lap.deskripsi}</div>
                      </div>
                      <div class="mb-0">
                          <label class="d-block text-muted text-xs uppercase font-bold">Status Tindak Lanjut</label>
                          <span class="badge ${lap.status === "Baru" ? "bg-danger" : "bg-success"}">${lap.status}</span>
                      </div>
                  </div>
              `,
      );
    }
  };
}

// ============ ADMIN LAPORAN VIEW (Admin & Preseptor Akademik) ============
async function adminLaporanView(area) {
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card">
                  <div class="card-header">
                      <h3 class="m-0"><i class="fa-solid fa-triangle-exclamation text-danger"></i> Daftar Laporan Kejadian</h3>
                      <p class="text-muted mt-1" style="font-size:0.85rem;">Gunakan halaman ini untuk memantau laporan dari mahasiswa dan preseptor klinik.</p>
                  </div>
                  <div class="card-body">
                      <div class="table-responsive">
                          <table class="table-compact" id="table-laporan">
                              <thead>
                                  <tr>
                                      <th>Tanggal</th>
                                      <th>Pelapor</th>
                                      <th>Masalah</th>
                                      <th>Terlapor</th>
                                      <th>Deskripsi</th>
                                      <th>Status</th>
                                      <th>Aksi</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  <tr><td colspan="7" class="empty-table"><i class="fa-solid fa-spinner fa-spin"></i> Memuat Laporan...</td></tr>
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      `;

  const res = await fetchAPI("getLaporan");
  const tbody = document.querySelector("#table-laporan tbody");
  if (!tbody) return;

  if (res.success && res.data.length > 0) {
    tbody.innerHTML = res.data
      .reverse()
      .map((l) => {
        const statusColor = l.status === "Baru" ? "bg-danger" : "bg-success";
        return `
                  <tr>
                      <td class="text-sm">${formatDateIndo(l.tanggal, true)}</td>
                      <td>
                          <strong>${l.nama_pelapor}</strong><br>
                          <small class="text-muted">${l.role_pelapor}</small>
                      </td>
                      <td><span class="badge bg-danger-soft text-danger">${l.tipe_kejadian}</span></td>
                      <td>${l.nama_terlapor !== "-" ? `<strong>${l.nama_terlapor}</strong>` : "-"}</td>
                      <td style="max-width:300px; white-space:normal;" class="text-sm">${l.deskripsi}</td>
                      <td><span class="badge ${statusColor}">${l.status}</span></td>
                      <td>
                          <div class="d-flex gap-1">
                              ${
                                currentUser.role === "admin"
                                  ? l.status === "Baru"
                                    ? `
                                      <button class="btn btn-outline btn-xs" onclick="updateStatusLaporan('${l.id}', 'Ditindak Lanjuti')">
                                          <i class="fa-solid fa-check"></i> Proses
                                      </button>
                                  `
                                    : '<span class="text-success" style="font-size:0.75rem;"><i class="fa-solid fa-circle-check"></i> Selesai</span>'
                                  : l.status === "Baru"
                                    ? '<span class="text-muted text-xs">Menunggu Proses</span>'
                                    : '<span class="text-success" style="font-size:0.75rem;"><i class="fa-solid fa-circle-check"></i> Selesai</span>'
                              }
                              
                              ${
                                currentUser.role === "admin"
                                  ? `
                                  <button class="btn btn-danger-soft btn-xs" onclick="hapusLaporan('${l.id}')">
                                      <i class="fa-solid fa-trash"></i> Hapus
                                  </button>
                              `
                                  : ""
                              }
                          </div>
                      </td>
                  </tr>
              `;
      })
      .join("");
  } else {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-table">Belum ada laporan kejadian.</td></tr>`;
  }

  window.updateStatusLaporan = async (id, status) => {
    if (!confirm(`Tandai laporan ini sebagai ${status}?`)) return;
    showLoader(true);
    const res = await postAPI("updateLaporanStatus", { id, status });
    showLoader(false);
    if (res.success) {
      showToast("Sukses", "Status laporan diperbarui.", "success");
      adminLaporanView(area);
    } else {
      showToast("Gagal", res.message || "Gagal memperbarui status.", "error");
    }
  };

  window.hapusLaporan = async (id) => {
    if (
      !confirm("Apakah Anda yakin ingin menghapus laporan ini secara permanen?")
    )
      return;
    showLoader(true);
    const res = await postAPI("deleteLaporan", { id });
    showLoader(false);
    if (res.success) {
      showToast("Sukses", "Laporan berhasil dihapus.", "success");
      adminLaporanView(area);
    } else {
      showToast("Gagal", res.message || "Gagal menghapus laporan.", "error");
    }
  };
}

// ============ GENERATE JADWAL VIEW ============
async function generatorKelompokView(area, batchNum = null) {
  window.filterKelompokSelector = (query) => {
    const container = document.getElementById("kelompok-selector-container");
    if (!container) return;
    const items = container.querySelectorAll("label");
    const q = (query || "").toLowerCase();
    items.forEach((item) => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(q) ? "flex" : "none";
    });
  };

  const batchSuffix = batchNum ? ` ${batchNum}` : "";
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card mb-4" style="border-top: 4px solid var(--primary);">
                  <div class="card-header">
                      <h3 class="m-0"><i class="fa-solid fa-calendar-days text-primary"></i> Generator Jadwal Praktik Kelompok${batchSuffix}</h3>
                      <p class="text-muted mt-1" style="font-size:0.85rem;">Buat jadwal penempatan stase secara massal berdasarkan Kelompok${batchSuffix}.</p>
                  </div>
                  <div class="card-body">
                      <form id="form-generate-jadwal">
                          <div class="form-group mb-4">
                              <div class="d-flex justify-between align-center mb-2">
                                  <label class="m-0">Pilih Kelompok untuk Batch ini</label>
                                  <div class="d-flex gap-2 align-center">
                                      <input type="text" id="search-kelompok" class="form-control form-control-sm" style="width: 200px;" placeholder="🔍 Cari Kelompok..." onkeyup="filterKelompokSelector(this.value)">
                                      <button type="button" class="btn btn-xs btn-outline" onclick="selectAllKelompok(true)">Pilih Semua</button>
                                      <button type="button" class="btn btn-xs btn-outline" onclick="selectAllKelompok(false)">Hapus Semua</button>
                                  </div>
                              </div>
                              <div class="table-responsive" style="border-radius:8px">
                                  <div id="kelompok-selector-container" class="grid-cards p-3 bg-light" style="display: grid; grid-template-columns: repeat(10, 1fr); min-width: 1500px; max-height: 350px; overflow-y: auto; gap: 0.5rem;">
                                      <i class="fa-solid fa-spinner fa-spin text-primary"></i> Memuat daftar kelompok...
                                  </div>
                              </div>
                          </div>

                          <div class="grid" style="grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:1rem">
                              <div class="form-group mb-0">
                                  <label>Tanggal Mulai Periode Pertama</label>
                                  <input type="date" id="input-tanggal-mulai" class="form-control" required value="${new Date().toISOString().split("T")[0]}">
                              </div>
                              <div class="form-group mb-0">
                                  <label>Jumlah Putaran / Stase Rotasi</label>
                                  <input type="number" id="input-jumlah-stase" class="form-control" min="1" max="10" value="1" required>
                                  <small class="text-muted">Setiap stase otomatis berdurasi 1 minggu.</small>
                              </div>
                          </div>
                          <div class="grid" style="grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:1rem">
                              <div class="form-group mb-0">
                                  <label>Jam Mulai (Shift 1)</label>
                                  <input type="time" id="input-jam-mulai-kelompok" class="form-control" required value="07:00">
                              </div>
                              <div class="form-group mb-0">
                                  <label>Jumlah Shift per Hari</label>
                                  <select id="input-jumlah-shift-kelompok" class="form-control">
                                      <option value="1">1 Shift (8 jam)</option>
                                      <option value="2">2 Shift (12 jam)</option>
                                      <option value="3" selected>3 Shift (8 jam)</option>
                                  </select>
                              </div>
                          </div>
                          <div id="stase-container" class="mb-4 d-flex flex-column gap-3"></div>
                          <div class="d-flex justify-between align-center mt-4">
                              <label class="d-flex align-center gap-2" style="cursor:pointer; font-weight:600; font-size:0.9rem">
                                  <input type="checkbox" id="check-clear-jadwal" checked> Hapus seluruh jadwal lama sebelum memproses
                              </label>
                              <button type="button" class="btn btn-primary" onclick="generatePreviewJadwal()">
                                  <i class="fa-solid fa-eye"></i> Tampilkan Preview Matriks
                              </button>
                          </div>
                      </form>
                  </div>
              </div>

              <div id="preview-jadwal-container" class="card hidden animate-fade-up">
                  <div class="card-header bg-primary-soft">
                      <h3 class="m-0 text-primary"><i class="fa-solid fa-table"></i> Preview Penempatan Kelompok</h3>
                  </div>
                  <div class="card-body">
                      <div class="table-responsive" style="max-height: 400px; overflow-y:auto">
                          <table id="table-preview-jadwal" class="table-compact text-sm" style="width:100%; min-width:800px">
                              <thead></thead>
                              <tbody></tbody>
                          </table>
                      </div>
                      <div class="d-flex justify-end mt-4">
                          <button class="btn btn-success" onclick="eksekusiGenerateJadwal(${batchNum})">
                              <i class="fa-solid fa-floppy-disk"></i> Simpan ke Database
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      `;

  showLoader(true);
  const [resKelompok, resTempat, resSettings] = await Promise.all([
    fetchAPI("getKelompok"),
    fetchCachedAPI("getTempat"),
    fetchAPI("getSettings"),
  ]);
  showLoader(false);

  if (!resKelompok.success || !resTempat.success) {
    showToast("Error", "Gagal memuat master data (Kelompok/Tempat)", "error");
    return;
  }

  const settingKey = batchNum ? `batch_kelompok_${batchNum}` : null;
  const savedKelompokIds =
    settingKey && resSettings.success
      ? (resSettings.data.find((s) => s.key === settingKey)?.value || "").split(
          ",",
        )
      : [];

  const kelSelector = document.getElementById("kelompok-selector-container");
  if (kelSelector) {
    // Sort Kelompok numerically
    const sortedGroups = resKelompok.data.sort((a, b) =>
      a.nama_kelompok.localeCompare(b.nama_kelompok, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );

    kelSelector.innerHTML = sortedGroups
      .map((k) => {
        const isChecked = savedKelompokIds.includes(String(k.id))
          ? "checked"
          : "";
        return `
                  <label class="d-flex align-center gap-2 p-1 rounded cursor-pointer hover-bg-primary-soft border" style="background:white;">
                      <input type="checkbox" name="sel-kelompok" value="${k.id}" ${isChecked}>
                      <span class="text-xs font-bold" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${k.nama_kelompok}</span>
                  </label>
              `;
      })
      .join("");
  }

  window.masterKelompokForJadwal = resKelompok.data;
  window.masterTempatForJadwal = resTempat.data;

  const renderStaseConfig = () => {
    const count =
      parseInt(document.getElementById("input-jumlah-stase").value) || 1;
    const startDateStr = document.getElementById("input-tanggal-mulai").value;
    const container = document.getElementById("stase-container");
    let html = "";

    let baseDate = new Date();
    if (startDateStr) {
      baseDate = new Date(startDateStr);
    }

    for (let i = 1; i <= count; i++) {
      let startD = new Date(baseDate);
      let endD = new Date(baseDate);
      endD.setDate(baseDate.getDate() + 6);

      const formatD = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const startStr = startDateStr ? formatD(startD) : "";
      const endStr = startDateStr ? formatD(endD) : "";

      html += `
                  <div class="stase-card" style="padding:15px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc;">
                      <h4 style="margin-top:0; color:var(--primary-dark); font-size:1rem; border-bottom:1px solid #cbd5e1; padding-bottom:5px;">Putaran / Stase ${i}</h4>
                      <div class="grid" style="grid-template-columns: 1fr 1fr; gap:15px">
                          <div class="form-group mb-0">
                              <label>Tanggal Mulai</label>
                              <input type="date" class="form-control stase-start" data-stase="${i}" value="${startStr}" required>
                          </div>
                          <div class="form-group mb-0">
                              <label>Tanggal Selesai</label>
                              <input type="date" class="form-control stase-end" data-stase="${i}" value="${endStr}" required>
                          </div>
                      </div>
                  </div>
              `;

      baseDate.setDate(baseDate.getDate() + 7);
    }
    container.innerHTML = html;
    document.getElementById("preview-jadwal-container").classList.add("hidden");
  };

  document
    .getElementById("input-jumlah-stase")
    .addEventListener("input", renderStaseConfig);
  document
    .getElementById("input-tanggal-mulai")
    .addEventListener("input", renderStaseConfig);
  renderStaseConfig();
}

window.generatePreviewJadwal = () => {
  const kelIds = Array.from(
    document.querySelectorAll('input[name="sel-kelompok"]:checked'),
  ).map((cb) => cb.value);
  if (kelIds.length === 0)
    return showToast("Peringatan", "Pilih minimal satu kelompok", "warning");

  const kelompokList = window.masterKelompokForJadwal.filter((k) =>
    kelIds.includes(String(k.id)),
  );
  const tempatList = window.masterTempatForJadwal || [];

  if (kelompokList.length === 0) {
    return showToast("Peringatan", "Kelompok tidak ditemukan", "warning");
  }
  if (tempatList.length === 0)
    return showToast(
      "Peringatan",
      "Belum ada master tempat praktik!",
      "warning",
    );

  const staseCount =
    parseInt(document.getElementById("input-jumlah-stase").value) || 0;
  const staseData = [];
  for (let i = 1; i <= staseCount; i++) {
    const startEl = document.querySelector(`.stase-start[data-stase="${i}"]`);
    const endEl = document.querySelector(`.stase-end[data-stase="${i}"]`);
    if (!startEl || !endEl || !startEl.value || !endEl.value)
      return showToast(
        "Validasi",
        `Harap lengkapi tanggal untuk stase ${i}`,
        "error",
      );
    const start = startEl.value;
    const end = endEl.value;
    if (new Date(start) > new Date(end))
      return showToast(
        "Validasi",
        `Tanggal awal stase ${i} lebih besar dari akhir`,
        "error",
      );
    staseData.push({ stase: i, start, end });
  }

  const tableHead = document.querySelector("#table-preview-jadwal thead");
  const tableBody = document.querySelector("#table-preview-jadwal tbody");

  // Head
  let headHtml = `<tr>
          <th style="min-width:150px">Kelompok</th>
          <th style="width:80px; text-align:center"><i class="fa-solid fa-users"></i> Jml</th>
      `;
  staseData.forEach((s) => {
    headHtml += `<th>Stase ${s.stase}<br><small style="font-weight:normal;color:#64748b">${formatDateIndo(s.start)} - ${formatDateIndo(s.end)}</small></th>`;
  });
  headHtml += `</tr>`;
  tableHead.innerHTML = headHtml;

  // Body
  let bodyHtml = "";
  kelompokList.forEach((k, idx) => {
    let rowHtml = `<tr>
              <td><strong>${k.nama_kelompok}</strong></td>
              <td style="text-align:center"><span class="badge bg-primary-soft text-primary">${k.jumlah_anggota || 0}</span></td>
          `;
    staseData.forEach((s, sIdx) => {
      const defaultTempatIdx = (idx + sIdx) % tempatList.length;
      const t = tempatList[defaultTempatIdx];

      rowHtml += `
                  <td>
                      <select class="form-control select-tempat-preview" data-kelompok="${k.id}" data-stase="${s.stase}" style="padding:0.3rem; font-size:0.85rem">
                          <option value="">- Tidak Tersetting -</option>
                          ${tempatList.map((opt) => `<option value="${opt.id}" ${opt.id === t.id ? "selected" : ""}>${opt.nama_tempat}</option>`).join("")}
                      </select>
                  </td>
              `;
    });
    rowHtml += `</tr>`;
    bodyHtml += rowHtml;
  });

  tableBody.innerHTML = bodyHtml;
  document
    .getElementById("preview-jadwal-container")
    .classList.remove("hidden");

  window.currentStaseConfig = staseData;
};

async function rekapLogbookAdminView(area) {
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card">
                  <div class="card-header d-flex justify-between align-center wrap gap-3">
                      <h3 class="m-0"><i class="fa-solid fa-chart-pie text-primary"></i> Rekapan Logbook Mahasiswa</h3>
                      <div class="d-flex gap-2">
                          <div class="input-with-icon" style="width:250px;">
                              <i class="fa-solid fa-magnifying-glass"></i>
                              <input type="text" id="search-rekap" class="form-control" placeholder="Cari nama mahasiswa...">
                          </div>
                          <button class="btn btn-outline btn-sm" onclick="exportRekapCSV()"><i class="fa-solid fa-file-csv"></i> Unduh Rekap</button>
                      </div>
                  </div>
                  <div class="card-body">
                      <div class="table-responsive">
                          <table id="table-rekap-log" style="font-size:0.9rem">
                              <thead>
                                  <tr>
                                      <th>Mahasiswa & Prodi</th>
                                      <th>Status Kompetensi (Detail)</th>
                                  </tr>
                              </thead>
                              <tbody><tr><td colspan="2" class="empty-table"><i class="fa-solid fa-spinner fa-spin"></i> Menganalisis logbook...</td></tr></tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      `;

  const res = await fetchAPI("getRekapLogbook");
  const tableBody = document.querySelector("#table-rekap-log tbody");
  if (!tableBody) return;

  window.dtRekapLog = [];
  if (res.success && res.data) {
    window.dtRekapLog = res.data;
    const render = (data) => {
      if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="2" class="empty-table">Tidak ada data ditemukan</td></tr>`;
        return;
      }
      tableBody.innerHTML = data
        .map((m, idx) => {
          const totalTercapai = m.rekap.filter(
            (r) => r.status === "Tercapai",
          ).length;
          const totalTarget = m.rekap.length;

          return `
                  <tr class="animate-fade-up">
                      <td style="width:250px; vertical-align:top">
                          <strong>${m.nama}</strong><br>
                          <small class="text-muted">${m.prodi}</small>
                          <div class="mt-2">
                              <span class="badge ${totalTercapai === totalTarget ? "bg-success" : "bg-warning"}" style="font-size:0.75rem">
                                  ${totalTercapai} / ${totalTarget} Kompetensi
                              </span>
                          </div>
                          <button class="btn btn-primary-soft btn-sm mt-3" onclick="toggleRekapDetail('${m.user_id}')" id="btn-toggle-${m.user_id}">
                              <i class="fa-solid fa-eye"></i> Lihat Detail
                          </button>
                      </td>
                      <td>
                          <div id="rekap-detail-${m.user_id}" class="hidden">
                              ${(() => {
                                // Group rekap by kategori
                                const gRekap = {};
                                m.rekap.forEach((r) => {
                                  const kat =
                                    r.kategori && r.kategori !== "-"
                                      ? r.kategori
                                      : "Umum";
                                  if (!gRekap[kat]) gRekap[kat] = [];
                                  gRekap[kat].push(r);
                                });
                                return Object.keys(gRekap)
                                  .map(
                                    (kat) => `
                                      <div style="margin-bottom:1rem;">
                                          <div style="font-weight:700; font-size:0.85rem; color:var(--primary-dark); margin-bottom:8px; padding:4px 0; border-bottom:1px dashed #e2e8f0;">
                                              <i class="fa-solid fa-folder-open text-primary" style="margin-right:6px;"></i>${kat}
                                          </div>
                                          <div class="grid-skills-rekap" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:10px;">
                                              ${gRekap[kat]
                                                .map(
                                                  (r) => `
                                                  <div class="skill-rekap-card" style="padding:10px; border-radius:8px; background:var(--bg-main); border-left: 4px solid ${r.status === "Tercapai" ? "#22c55e" : "#ef4444"};">
                                                      <div style="font-weight:600; font-size:0.8rem; height:2.4rem; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${r.nama_skill}</div>
                                                      <div class="d-flex justify-between align-center mt-2">
                                                          <span class="badge ${r.status === "Tercapai" ? "bg-success" : "bg-danger"}" style="font-size:0.75rem">${r.capaian} / ${r.target}</span>
                                                          <small style="color:${r.status === "Tercapai" ? "#22c55e" : "#ef4444"}; font-weight:700; font-size:0.75rem">${r.status.toUpperCase()}</small>
                                                      </div>
                                                  </div>
                                              `,
                                                )
                                                .join("")}
                                          </div>
                                      </div>
                                  `,
                                  )
                                  .join("");
                              })()}
                          </div>
                          <div id="rekap-summary-text-${m.user_id}" class="text-muted" style="font-size:0.85rem">
                              <i class="fa-solid fa-circle-info"></i> Klik tombol detail untuk melihat rincian setiap kompetensi.
                          </div>
                      </td>
                  </tr>
              `;
        })
        .join("");
    };

    render(res.data);

    document.getElementById("search-rekap").oninput = (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = res.data.filter((m) => m.nama.toLowerCase().includes(q));
      render(filtered);
    };
  } else {
    tableBody.innerHTML = `<tr><td colspan="2" class="empty-table">Gagal memuat rekap data</td></tr>`;
  }
}

window.toggleRekapDetail = (userId) => {
  const el = document.getElementById(`rekap-detail-${userId}`);
  const summary = document.getElementById(`rekap-summary-text-${userId}`);
  const btn = document.getElementById(`btn-toggle-${userId}`);

  if (el.classList.contains("hidden")) {
    el.classList.remove("hidden");
    if (summary) summary.classList.add("hidden");
    btn.innerHTML = `<i class="fa-solid fa-eye-slash"></i> Sembunyikan`;
    btn.classList.replace("btn-primary-soft", "btn-danger-soft");
  } else {
    el.classList.add("hidden");
    if (summary) summary.classList.remove("hidden");
    btn.innerHTML = `<i class="fa-solid fa-eye"></i> Lihat Detail`;
    btn.classList.replace("btn-danger-soft", "btn-primary-soft");
  }
};

window.exportRekapCSV = () => {
  if (!window.dtRekapLog) return;
  const headers = [
    "Nama Mahasiswa",
    "Prodi",
    "Kompetensi",
    "Capaian",
    "Target",
    "Status",
  ];
  const rows = [];
  window.dtRekapLog.forEach((m) => {
    m.rekap.forEach((r) => {
      rows.push([m.nama, m.prodi, r.nama_skill, r.capaian, r.target, r.status]);
    });
  });

  downloadCSV(headers, rows, "Rekap_Logbook_Mahasiswa.csv");
};

window.mahasiswaAdminView = (area) =>
  renderUserManagement(area, "mahasiswa", "Mahasiswa", "fa-user-graduate");
window.preseptorAdminView = (area) =>
  renderUserManagement(area, "preseptor", "Preseptor Klinik", "fa-user-doctor");
window.preseptorAkademikAdminView = (area) =>
  renderUserManagement(
    area,
    "preseptor_akademik",
    "Preseptor Akademik",
    "fa-chalkboard-teacher",
  );

// ============ KELOMPOK ADMIN VIEW ============
async function kelompokAdminView(area) {
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card">
                  <div class="card-header d-flex justify-between align-center wrap gap-2">
                      <h3><i class="fa-solid fa-users-rectangle text-primary"></i> Kelompok Mahasiswa</h3>
                      <div class="d-flex gap-2 wrap">
                          <button class="btn btn-outline btn-sm" onclick="downloadKelompokTemplate()"><i class="fa-solid fa-download"></i> Template</button>
                          <label class="btn btn-warning btn-sm m-0" style="cursor:pointer">
                              <i class="fa-solid fa-upload"></i> Import
                              <input type="file" accept=".csv" class="hidden" onchange="importKelompokCSV(event)">
                          </label>
                          <button class="btn btn-danger-soft btn-sm" onclick="clearMasterData('kelompok', 'Kelompok')"><i class="fa-solid fa-trash-can"></i> Hapus Semua</button>
                          <button class="btn btn-primary btn-sm" onclick="bukaModalKelompok()"><i class="fa-solid fa-plus"></i> Tambah Kelompok</button>
                      </div>
                  </div>
                  <div class="card-body">
                      <div class="table-responsive">
                          <table id="table-kelompok">
                              <thead>
                                  <tr>
                                      <th>Nama Kelompok</th>
                                      <th>Jumlah Anggota</th>
                                      <th style="text-align:right">Aksi</th>
                                  </tr>
                              </thead>
                              <tbody><tr><td colspan="3" class="empty-table"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data...</td></tr></tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      `;

  const res = await fetchAPI("getKelompok");
  const tableBody = document.querySelector("#table-kelompok tbody");
  if (res.success && res.data && res.data.length > 0) {
    tableBody.innerHTML = res.data
      .map(
        (k, idx) => `
              <tr class="animate-fade-up delay-${((idx % 5) + 1) * 100}">
                  <td><strong><i class="fa-solid fa-users-rectangle" style="color:var(--primary)"></i> ${k.nama_kelompok}</strong></td>
                  <td><span class="badge bg-primary" style="font-size:0.95em">${k.jumlah_anggota || 0} mahasiswa</span></td>
                  <td style="text-align:right">
                      <button class="btn btn-icon-ghost" onclick="aturAnggotaKelompok('${k.id}', '${k.nama_kelompok}')"><i class="fa-solid fa-user-plus" title="Atur Anggota"></i></button>
                      <button class="btn btn-icon-ghost" onclick="bukaModalKelompok('${k.id}', '${k.nama_kelompok}')"><i class="fa-solid fa-pen-to-square"></i></button>
                      <button class="btn btn-icon-ghost text-danger" onclick="deleteMaster('kelompok','${k.id}')"><i class="fa-solid fa-trash"></i></button>
                  </td>
              </tr>
          `,
      )
      .join("");
  } else {
    tableBody.innerHTML = `<tr><td colspan="3" class="empty-table">Belum ada kelompok.</td></tr>`;
  }
}

window.bukaModalKelompok = (id = null, currentNama = "") => {
  const isEdit = !!id;
  openModal(
    isEdit ? "Edit Kelompok" : "Tambah Kelompok Baru",
    `
          <form id="form-kelompok" class="animate-fade-in">
              <div class="form-group">
                  <label>Nama Kelompok</label>
                  <div class="input-with-icon">
                      <i class="fa-solid fa-users-rectangle"></i>
                      <input type="text" id="kelompok-nama" required class="form-control" placeholder="Contoh: Kelompok A" value="${currentNama}">
                  </div>
              </div>
              <button type="submit" class="btn btn-primary btn-block mt-3"><i class="fa-solid fa-save"></i> ${isEdit ? "Simpan Perubahan" : "Buat Kelompok"}</button>
          </form>
      `,
  );

  document.getElementById("form-kelompok").onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      type: "kelompok",
      id: id || "",
      nama: document.getElementById("kelompok-nama").value,
    };
    const action = isEdit ? "editMaster" : "addMaster";
    const res = await postAPI(action, payload);
    if (res.success) {
      clearCache("getKelompok");
      closeModal();
      showToast("Berhasil", res.message, "success");
      loadView("kelompokAdminView");
    }
  };
};

window.aturAnggotaKelompok = async (kelompokId, namaKelompok) => {
  showLoader(true);
  const resUsers = await fetchAPI("getUsers");
  showLoader(false);
  if (!resUsers.success) return;

  const mahasiswa = resUsers.data.filter((u) => u.role === "mahasiswa");

  const checkboxes = mahasiswa
    .map((m) => {
      const checked = m.kelompok == kelompokId ? "checked" : "";
      const otherGroup =
        m.kelompok && m.kelompok !== "-" && m.kelompok !== kelompokId
          ? `<span class="badge bg-warning" style="font-size:0.7em; margin-left:6px">di kelompok lain</span>`
          : "";
      return `
              <label style="display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:8px; background:var(--bg-main); cursor:pointer; margin-bottom:4px;">
                  <input type="checkbox" class="chk-anggota" value="${m.id}" ${checked} style="width:18px; height:18px; accent-color:var(--primary);">
                  <span><strong>${m.nama}</strong> <small class="text-muted">(${m.username})</small>${otherGroup}</span>
              </label>
          `;
    })
    .join("");

  openModal(
    `Atur Anggota: ${namaKelompok}`,
    `
          <div class="form-group mb-3">
              <input type="text" id="search-anggota" class="form-control" placeholder="Cari mahasiswa..." style="margin-bottom:8px">
          </div>
          <div id="list-anggota" style="max-height:350px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:10px; padding:8px;">
              ${checkboxes || '<span class="text-muted">Tidak ada mahasiswa</span>'}
          </div>
          <button class="btn btn-primary btn-block mt-3" onclick="simpanAnggotaKelompok('${kelompokId}')"><i class="fa-solid fa-save"></i> Simpan Anggota</button>
      `,
  );

  // Search filter
  document.getElementById("search-anggota").oninput = (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll("#list-anggota label").forEach((label) => {
      label.style.display = label.textContent.toLowerCase().includes(q)
        ? ""
        : "none";
    });
  };
};

window.simpanAnggotaKelompok = async (kelompokId) => {
  const memberIds = Array.from(
    document.querySelectorAll(".chk-anggota:checked"),
  ).map((c) => c.value);

  closeModal();
  showLoader(true);
  showToast("Memproses", "Menyimpan anggota kelompok...", "info");

  const res = await postAPI("setKelompokBulk", {
    kelompok_id: kelompokId,
    member_ids: memberIds,
  });

  showLoader(false);
  if (res.success) {
    showToast("Berhasil", res.message, "success");
  }
  loadView("kelompokAdminView");
};

window.downloadKelompokTemplate = async () => {
  showLoader(true);
  const [resUsers, resKelompok] = await Promise.all([
    fetchAPI("getUsers"),
    fetchAPI("getKelompok"),
  ]);
  showLoader(false);
  if (!resUsers.success) return;

  const mahasiswa = resUsers.data.filter((u) => u.role === "mahasiswa");
  const kelompokMap = {};
  if (resKelompok.success && resKelompok.data) {
    resKelompok.data.forEach((k) => {
      kelompokMap[k.id] = k.nama_kelompok;
    });
  }

  let csv = "nama;username;kelompok\n";
  mahasiswa.forEach((m) => {
    const kNama = kelompokMap[m.kelompok_id] || "";
    csv += `"${m.nama}";"${m.username}";"${kNama}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "Template_Kelompok_Mahasiswa.csv";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Berhasil", "Template berhasil diunduh", "success");
};

window.importKelompokCSV = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = "";

  const text = await file.text();
  const cleanText = text.replace(/^\uFEFF/, ""); // strip BOM
  const lines = cleanText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return showToast("Error", "File CSV kosong", "error");

  // Auto-detect delimiter from header
  const header = lines[0];
  const delimiter = header.includes(";") ? ";" : ",";

  // Parse rows (skip header)
  const assignments = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]
      .split(delimiter)
      .map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length >= 3 && cols[1] && cols[2]) {
      assignments.push({ username: cols[1], kelompok: cols[2] });
    }
  }

  if (assignments.length === 0)
    return showToast("Error", "Tidak ada data valid", "error");

  showLoader(true);
  showToast("Memproses", "Mengimpor data kelompok...", "info");
  const res = await postAPI("importKelompokAssignment", { assignments });
  showLoader(false);

  if (res.success) {
    showToast("Berhasil", res.message, "success");
    loadView("kelompokAdminView");
  } else {
    showToast("Error", res.message || "Gagal import", "error");
  }
};

async function renderUserManagement(area, roleFilter, title, icon) {
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card">
                  <div class="card-header d-flex align-center justify-between wrap gap-3">
                      <div class="d-flex align-center gap-3 wrap">
                          <h3 class="m-0"><i class="fa-solid ${icon} text-primary"></i> Manajemen ${title}</h3>
                          <div class="input-with-icon" style="width:250px;">
                              <i class="fa-solid fa-magnifying-glass"></i>
                              <input type="text" id="search-users" class="form-control" placeholder="Cari nama atau ID..." style="padding-top:0.4rem; padding-bottom:0.4rem;">
                          </div>
                      </div>
                      <div class="d-flex gap-2">
                          <button class="btn btn-outline btn-sm" onclick="downloadUserTemplate('${roleFilter}')"><i class="fa-solid fa-download"></i> Template</button>
                          <label class="btn btn-warning btn-sm m-0" style="cursor:pointer; margin:0;">
                              <i class="fa-solid fa-upload"></i> Import
                              <input type="file" id="import-csv-file" accept=".csv" class="hidden" onchange="handleImportCSV(event, '${roleFilter}')">
                          </label>
                          <button class="btn btn-primary btn-sm" onclick="bukaModalUser('${roleFilter}', null)"><i class="fa-solid fa-plus"></i> Tambah</button>
                          <button class="btn btn-danger btn-sm" onclick="hapusSemuaUsers('${roleFilter}', '${title}')"><i class="fa-solid fa-trash-can"></i> Hapus Semua</button>
                      </div>
                  </div>
                  <div class="card-body">
                      <div class="table-responsive">
                          <table id="table-users-${roleFilter}">
                              <thead>
                                  <tr>
                                      <th>Nama Pengguna</th>
                                      <th>Username / ID</th>
                                      ${roleFilter === "mahasiswa" ? "<th>Prodi</th><th>Angkatan</th>" : "<th>Tempat Tugas</th>"}
                                      <th style="text-align:right">Aksi</th>
                                  </tr>
                              </thead>
                              <tbody><tr><td colspan="${roleFilter === "mahasiswa" ? 5 : 4}" class="empty-table"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data...</td></tr></tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      `;

  showLoader(true);
  const [resUsers, resTempat] = await Promise.all([
    fetchAPI("getUsers"),
    roleFilter !== "mahasiswa"
      ? fetchCachedAPI("getTempat")
      : Promise.resolve({ success: false }),
  ]);
  showLoader(false);

  const tableBody = document.querySelector(`#table-users-${roleFilter} tbody`);
  if (!tableBody) return;
  window["adminUsersData_" + roleFilter] = [];

  const renderUsers = (data) => {
    if (data.length > 0) {
      tableBody.innerHTML = data
        .map((u, idx) => {
          let infoLahan = "-";
          if (
            (roleFilter === "preseptor" ||
              roleFilter === "preseptor_akademik") &&
            resTempat.success
          ) {
            const tids = (u.tempat_id || "-").split(",");
            const names = tids
              .map((tid) => {
                const t = resTempat.data.find((x) => x.id == tid);
                return t ? t.nama_tempat : "";
              })
              .filter((n) => n);
            infoLahan = names.length > 0 ? names.join(", ") : "-";
          }
          return `
                  <tr class="animate-fade-up delay-${((idx % 5) + 1) * 100}">
                      <td><strong>${u.nama}</strong></td>
                      <td><span class="badge" style="background:#f1f5f9;color:var(--text-strong)">${u.username}</span></td>
                      ${roleFilter === "mahasiswa" ? `<td><span class="badge bg-primary">${u.prodi}</span></td><td><span class="badge bg-primary-soft text-primary">${u.angkatan && u.angkatan !== "-" ? u.angkatan : "-"}</span></td>` : `<td><span class="badge bg-primary-soft text-primary"><i class="fa-solid fa-hospital"></i> ${infoLahan}</span></td>`}
                      <td style="text-align:right">
                          <button class="btn btn-icon-ghost" onclick="bukaModalUser('${roleFilter}', '${u.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                          <button class="btn btn-icon-ghost text-danger" onclick="deleteUser('${u.id}', '${roleFilter}')" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                      </td>
                  </tr>
              `;
        })
        .join("");
    } else {
      tableBody.innerHTML = `<tr><td colspan="${roleFilter === "mahasiswa" ? 5 : 4}" class="empty-table"><i class="fa-solid fa-users-slash fa-2x mb-2" style="color:#cbd5e1;display:block"></i>Tidak ditemukan data matching</td></tr>`;
    }
  };

  if (resUsers.success && resUsers.data && resUsers.data.length > 0) {
    const filteredByRole = resUsers.data.filter((u) => u.role === roleFilter);
    window["adminUsersData_" + roleFilter] = filteredByRole;
    renderUsers(filteredByRole);
  } else {
    tableBody.innerHTML = `<tr><td colspan="${roleFilter === "mahasiswa" ? 5 : 4}" class="empty-table"><i class="fa-solid fa-users-slash fa-2x mb-2" style="color:#cbd5e1;display:block"></i>Belum ada data ${title}</td></tr>`;
  }

  document.getElementById("search-users").oninput = (e) => {
    const q = e.target.value.toLowerCase();
    const results = window["adminUsersData_" + roleFilter].filter(
      (u) =>
        u.nama.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q),
    );
    renderUsers(results);
  };
}

window.bukaModalUser = async (roleFilter, id = null) => {
  let user = {
    id: "",
    nama: "",
    username: "",
    password: "",
    role: roleFilter,
    prodi: "",
  };
  let isEdit = false;

  if (id && window["adminUsersData_" + roleFilter]) {
    user =
      window["adminUsersData_" + roleFilter].find((u) => u.id === id) || user;
    isEdit = true;
  }

  let prodiOptions = '<option value="">-- Kosong / Tidak Ada --</option>';
  if (roleFilter === "mahasiswa") {
    const pRes = await fetchAPI("getProdi");
    if (pRes.success && pRes.data) {
      prodiOptions += pRes.data
        .map(
          (p) =>
            `<option value="${p.nama_prodi}" ${user.prodi === p.nama_prodi ? "selected" : ""}>${p.nama_prodi}</option>`,
        )
        .join("");
    }
  }

  let prodiHtml = "";
  let tempatHtml = "";
  if (roleFilter === "mahasiswa") {
    prodiHtml = `
              <div class="form-group">
                  <label>Program Studi / Spesialisasi</label>
                  <select id="user-prodi" class="form-control">
                      ${prodiOptions}
                  </select>
              </div>
              <div class="form-group">
                  <label>Angkatan</label>
                  <div class="input-with-icon">
                      <i class="fa-solid fa-calendar-days"></i>
                      <input type="number" id="user-angkatan" class="form-control" min="2000" max="2099" placeholder="Cth: 2024" value="${user.angkatan && user.angkatan !== "-" ? user.angkatan : ""}">
                  </div>
              </div>
          `;
  } else if (
    roleFilter === "preseptor" ||
    roleFilter === "preseptor_akademik"
  ) {
    const tRes = await fetchAPI("getTempat");
    let tempatCheckboxes = "";
    const currentTempatIds = (user.tempat_id || "-").split(",");
    if (tRes.success && tRes.data) {
      tempatCheckboxes = tRes.data
        .map(
          (t) => `
                  <label style="display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:8px; background:var(--bg-main); cursor:pointer; margin-bottom:4px;">
                      <input type="checkbox" class="chk-tempat" value="${t.id}" ${currentTempatIds.includes(t.id) ? "checked" : ""} style="width:18px; height:18px; accent-color:var(--primary);">
                      <span><i class="fa-solid fa-hospital" style="color:var(--primary)"></i> ${t.nama_tempat}</span>
                  </label>
              `,
        )
        .join("");
    }
    tempatHtml = `
              <div class="form-group">
                  <label>Tempat Tugas (Lahan Praktik) — bisa pilih lebih dari 1</label>
                  <div style="max-height:200px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:10px; padding:8px;">
                      ${tempatCheckboxes || '<span class="text-muted">Belum ada data tempat</span>'}
                  </div>
              </div>
          `;
  }

  openModal(
    isEdit
      ? "Edit Profil " +
          (roleFilter === "mahasiswa" ? "Mahasiswa" : "Preseptor")
      : "Pendaftaran Pengguna Baru",
    `
          <form id="form-user" class="animate-fade-in">
              <input type="hidden" id="user-id" value="${user.id}">
              <input type="hidden" id="user-role" value="${roleFilter}">
              <div class="form-group">
                  <label>Nama Lengkap</label>
                  <div class="input-with-icon">
                      <i class="fa-regular fa-user"></i>
                      <input type="text" id="user-nama" required class="form-control" value="${user.nama}">
                  </div>
              </div>
              <div class="form-group">
                  <label>Username / NIM / NIP</label>
                  <div class="input-with-icon">
                      <i class="fa-solid fa-id-badge"></i>
                      <input type="text" id="user-username" required class="form-control" value="${user.username}" ${isEdit ? 'readonly style="background:#f1f5f9; cursor:not-allowed;" title="Username Tidak Bisa Diubah"' : ""}>
                  </div>
              </div>
              <div class="form-group">
                  <label>Kata Sandi ${isEdit ? '<span class="text-muted" style="font-weight:400">(Kosongkan jika tak diubah)</span>' : ""}</label>
                  <div class="input-with-icon">
                      <i class="fa-solid fa-key"></i>
                      <input type="password" id="user-password" ${isEdit ? "" : "required"} class="form-control" placeholder="••••••••">
                  </div>
              </div>
              ${prodiHtml}
              ${tempatHtml}
              <button type="submit" class="btn btn-primary btn-block mt-3"><i class="fa-solid fa-save"></i> ${isEdit ? "Simpan Perubahan" : "Daftarkan Akun"}</button>
          </form>
      `,
  );

  document.getElementById("form-user").onsubmit = async (e) => {
    e.preventDefault();
    const pwdRaw = document.getElementById("user-password").value;
    const payload = {
      id: document.getElementById("user-id").value,
      nama: document.getElementById("user-nama").value,
      username: document.getElementById("user-username").value,
      role: document.getElementById("user-role").value,
      prodi: document.getElementById("user-prodi")
        ? document.getElementById("user-prodi").value
        : "-",
      tempat_id:
        document.querySelectorAll(".chk-tempat:checked").length > 0
          ? Array.from(document.querySelectorAll(".chk-tempat:checked"))
              .map((c) => c.value)
              .join(",")
          : "-",
      angkatan: document.getElementById("user-angkatan")
        ? document.getElementById("user-angkatan").value || "-"
        : "-",
      kelompok_id:
        isEdit && window.adminUsersData_mahasiswa
          ? window.adminUsersData_mahasiswa.find(
              (u) => u.id === document.getElementById("user-id").value,
            )?.kelompok_id || "-"
          : "-",
    };

    if (pwdRaw) {
      payload.password = await hashPassword(pwdRaw);
    } else if (!isEdit) {
      payload.password = await hashPassword("123456"); // Default Password if not filled for new user
    }

    // FIX: Set ID ke Username jika ini adalah user baru untuk mencegah duplikasi ID kosong
    if (!payload.id && payload.username) {
      payload.id = payload.username;
    }
    const action = isEdit ? "editUser" : "addUser";
    showToast("Memproses", "Sedang menyimpan...", "info");
    const res = await postAPI(action, payload);
    if (res.success) {
      closeModal();
      showToast("Sukses", res.message, "success");
      if (roleFilter === "mahasiswa") loadView("mahasiswaAdminView");
      else if (roleFilter === "preseptor_akademik")
        loadView("preseptorAkademikAdminView");
      else loadView("preseptorAdminView");
    }
  };
};

window.hapusSemuaUsers = async (role, title) => {
  if (
    confirm(
      `⚠️ PERINGATAN KRUSIAL!\n\nAnda akan menghapus SELURUH data ${title}.\nData yang sudah dihapus tidak dapat dikembalikan.\n\nApakah Anda benar-benar yakin?`,
    )
  ) {
    if (confirm(`Konfirmasi terakhir: Hapus semua data ${title}?`)) {
      showLoader(true);
      const res = await postAPI("clearUsersByRole", { role: role });
      showLoader(false);
      if (res.success) {
        showToast("Berhasil", res.message, "success");
        if (role === "preseptor_akademik")
          loadView("preseptorAkademikAdminView");
        else if (role === "mahasiswa") loadView("mahasiswaAdminView");
        else loadView("preseptorAdminView");
      }
    }
  }
};

window.deleteUser = async (id, roleFilter) => {
  if (
    confirm("PERINGATAN ⚠️\\n\\nAnda yakin ingin menghapus akun ini permanen?")
  ) {
    const res = await postAPI("deleteUser", { id });
    if (res.success) {
      showToast("Terhapus", "Pengguna berhasil dicabut dari sistem", "success");
      if (roleFilter === "mahasiswa") loadView("mahasiswaAdminView");
      else loadView("preseptorAdminView");
    }
  }
};

window.downloadUserTemplate = async (roleFilter) => {
  let headers = ["nama", "username", "password", "prodi", "angkatan"];
  let rows = [];

  if (roleFilter === "mahasiswa") {
    rows = [
      ["Ibrahim Wicaksono", "12345678", "Pass123", "D3 Keperawatan", "2024"],
      ["Siti Aisyah", "87654321", "Pass456", "S1 Profesi Ners", "2023"],
    ];
  } else {
    headers.push("tempat_id");
    // Ambil data tempat asli untuk contoh
    const tRes = await fetchAPI("getTempat");
    let exampleId = "T123";
    let refText =
      "\n\n# REFERENSI TEMPAT TUGAS (Gunakan ID di bawah untuk kolom tempat_id):\n# ID ; Nama Tempat\n";

    if (tRes.success && tRes.data && tRes.data.length > 0) {
      exampleId = tRes.data[0].id;
      tRes.data.forEach((t) => {
        refText += `# ${t.id} ; ${t.nama_tempat}\n`;
      });
    }

    rows = [
      [
        "Dr. Haryanto, Sp.PD",
        "haryanto.md",
        "PassHaryanto",
        "-",
        "-",
        exampleId,
      ],
      ["Ners. Rinawati, S.Kep", "rina.kep", "RinaPassx", "-", "-", exampleId],
    ];

    downloadCSV(
      headers,
      rows,
      `Template_Import_${roleFilter}.csv`,
      "\n" + refText,
    );

    showToast(
      "Template Diunduh",
      "Cek referensi tempat tugas di bagian bawah file CSV",
      "info",
    );
    return;
  }

  downloadCSV(headers, rows, `Template_Import_${roleFilter}.csv`);
  showToast(
    "Template Diunduh",
    "Silakan isi data mengikuti baris header (Koma-Separated)",
    "info",
  );
};

window.handleImportCSV = (e, roleFilter) => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = "";
  const reader = new FileReader();
  reader.onload = async (event) => {
    let text = event.target.result;
    // STRIP BOM if exists
    if (text.startsWith("\uFEFF")) {
      text = text.substring(1);
    }

    const rows = text
      .split(/\r?\n/)
      .map((row) => row.trim())
      .filter((row) => row !== "");
    if (rows.length < 2)
      return showToast(
        "Gagal",
        "Format CSV kosong atau tidak ada data.",
        "error",
      );

    let delimiter = ",";
    if (rows[0].includes(";")) delimiter = ";";
    else if (rows[0].includes("\t")) delimiter = "\t";

    const headersRaw = parseCSVLine(rows[0], delimiter);
    const headers = headersRaw.map((h) =>
      h
        .trim()
        .toLowerCase()
        .replace(/(^"|"$)/g, ""),
    );
    const mappedUsers = [];

    for (let i = 1; i < rows.length; i++) {
      const cols = parseCSVLine(rows[i], delimiter);
      let u = { role: roleFilter };
      for (let j = 0; j < headers.length; j++) {
        if (cols[j] !== undefined && headers[j]) {
          let val = cols[j].replace(/(^"|"$)/g, "").trim();
          let h = headers[j];

          // Mapping alias header
          if (h.includes("username") || h.includes("id") || h === "nim") {
            u.username = val;
            u.id = val; // Gunakan ini sebagai ID primer
          } else {
            u[h] = val;
          }
        }
      }

      // Final Check logic
      if (!u.id && u.username) u.id = u.username;
      if (!u.username && u.id) u.username = u.id;

      if (u.id) {
        if (u.password) {
          u.password = await hashPassword(u.password);
        } else {
          // Jika kosong, hapus property password agar tidak menimpa password lama (upsert)
          delete u.password;
        }
        mappedUsers.push(u);
      }
    }

    // DEDUPLICATION: Remove duplicates from same CSV batch (Postgres error fix)
    const uniqueMap = new Map();
    mappedUsers.forEach((user) => uniqueMap.set(user.id, user));
    const finalUsers = Array.from(uniqueMap.values());

    if (
      confirm(
        `🔎 Ditemukan ${finalUsers.length} data unik untuk di-import (Role: ${roleFilter}).\nLanjut proses?`,
      )
    ) {
      const res = await postAPI("importUsers", { users: finalUsers });
      if (res.success && res.summary) {
        const s = res.summary;
        const statusType =
          s.failCount > 0
            ? s.successCount > 0
              ? "warning"
              : "error"
            : "success";

        showToast(
          "Import Selesai",
          `${s.successCount} Berhasil, ${s.failCount} Gagal.`,
          statusType,
        );

        if (s.failCount > 0) {
          const failDetails = s.failedRows
            .map((f) => `Baris ${f.row}: ${f.reason}`)
            .join("\n");

          openModal(
            "Laporan Import Gagal",
            `
                          <div class="animate-fade-in">
                              <div class="alert bg-danger rounded p-3 mb-3" style="border-radius:12px; background:var(--danger-light); color:var(--danger); border:1px solid var(--danger);">
                                  <strong>Peringatan!</strong><br>
                                  Ditemukan <b>${s.failCount}</b> baris yang gagal di-upload karena kesalahan data atau duplikasi.
                              </div>
                              <div style="max-height: 200px; overflow-y: auto; background:#f8fafc; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 0.85rem; margin-bottom: 1.5rem;">
                                  ${failDetails.replace(/\n/g, "<br>")}
                              </div>
                              <button class="btn btn-danger btn-block" onclick="downloadFailedCSV('${roleFilter}', ${JSON.stringify(s.failedRows).replace(/"/g, "&quot;")})">
                                  <i class="fa-solid fa-file-export"></i> Unduh Data Baris Gagal (CSV)
                              </button>
                              <p class="text-muted text-center mt-2" style="font-size:0.8rem">Gunakan file ini untuk memperbaiki data lalu upload kembali.</p>
                          </div>
                      `,
          );
        }

        if (roleFilter === "mahasiswa") loadView("mahasiswaAdminView");
        else loadView("preseptorAdminView");
      }
    }
  };
  reader.readAsText(file);
};

window.downloadFailedCSV = (roleFilter, failedRows) => {
  if (!failedRows || failedRows.length === 0) return;

  const headers = [
    "Baris",
    "Alasan_Gagal",
    "nama",
    "username",
    "password",
    "prodi",
  ];
  const csvData = failedRows.map((f) => {
    const d = f.data;
    return [
      f.row,
      f.reason,
      d.nama || "",
      d.username || "",
      d.password || "",
      d.prodi || "-",
    ].join(";");
  });

  let csvContent =
    "data:text/csv;charset=utf-8," +
    headers.join(";") +
    "\n" +
    csvData.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `GAGAL_IMPORT_${roleFilter.toUpperCase()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ADMIN: PENGATURAN SISTEM
async function settingsAdminView(area) {
  // Fetch settings first to avoid ReferenceError
  const resSets = await fetchAPI("getSettings");
  const settingsData = resSets.success && resSets.data ? resSets.data : [];

  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card">
                  <div class="card-header">
                      <h3><i class="fa-solid fa-gears text-primary"></i> Pengaturan Sistem</h3>
                  </div>
                  <div class="card-body">
                      <form id="form-settings" style="max-width:600px">
                          <div class="alert bg-primary-soft p-3 rounded mb-4" style="border-radius:12px; font-size:0.9rem">
                              <i class="fa-solid fa-circle-info text-primary"></i> 
                              Pengaturan di bawah ini akan mengatur parameter perhitungan nilai akhir & kelulusan secara global.
                          </div>

                          <div class="form-group">
                              <label>Batas Lulus Mahasiswa (0-100)</label>
                              <div class="input-with-icon">
                                  <i class="fa-solid fa-flag-checkered"></i>
                                  <input type="number" id="set-batas-lulus" class="form-control" step="1" min="0" max="100" required>
                              </div>
                          </div>

                          <hr class="my-4" style="opacity:0.1">
                          <h4 class="mb-3"><i class="fa-solid fa-calculator text-primary"></i> Konfigurasi Bobot Nilai Akhir</h4>
                          <p class="text-muted mb-4" style="font-size:0.85rem">Pastikan total penjumlahan seluruh bobot adalah <strong>100%</strong>.</p>

                          <div class="grid-cards" style="grid-template-columns: 1fr 1fr 1fr; gap:1rem; margin-bottom:1rem;">
                              <div class="form-group">
                                  <label>Praktikum (%)</label>
                                  <input type="number" id="set-w-prak" class="form-control" min="0" max="100" required>
                              </div>
                              <div class="form-group">
                                  <label>ASKEP (%)</label>
                                  <input type="number" id="set-w-askep" class="form-control" min="0" max="100" required>
                              </div>
                              <div class="form-group">
                                  <label>Sikap (%)</label>
                                  <input type="number" id="set-w-sikap" class="form-control" min="0" max="100" required>
                              </div>
                          </div>
                          
                          <div id="weight-error" class="hidden alert bg-danger-soft text-danger p-2 mb-3" style="font-size:0.8rem">
                              <i class="fa-solid fa-triangle-exclamation"></i> Total bobot saat ini <span id="current-weight-total">0</span>%. Harus 100%.
                          </div>

                          <hr class="my-4" style="opacity:0.1">
                          <h4 class="mb-3"><i class="fa-solid fa-scale-balanced text-primary"></i> Proporsi Preseptor Klinik & Akademik</h4>
                          <p class="text-muted mb-4" style="font-size:0.85rem">Tentukan persentase kontribusi masing-masing preseptor terhadap nilai akhir. Total harus <strong>100%</strong>.</p>
                          <div class="grid-cards" style="grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
                              <div class="form-group">
                                  <label>Preseptor Klinik (%)</label>
                                  <input type="number" id="set-w-klinik" class="form-control" min="0" max="100" required>
                              </div>
                              <div class="form-group">
                                  <label>Preseptor Akademik (%)</label>
                                  <input type="number" id="set-w-akademik" class="form-control" min="0" max="100" required>
                              </div>
                          </div>
                          <div id="weight-preseptor-error" class="hidden alert bg-danger-soft text-danger p-2 mb-3" style="font-size:0.8rem">
                              <i class="fa-solid fa-triangle-exclamation"></i> Total Klinik + Akademik saat ini <span id="current-preseptor-total">0</span>%. Harus 100%.
                          </div>

                          <hr class="my-4" style="opacity:0.1">
                          <h4 class="mb-3"><i class="fa-solid fa-bullhorn text-primary"></i> Kontrol Pengumuman Nilai</h4>
                          <p class="text-sm text-muted mb-3">Tentukan batch mana yang sudah diizinkan melihat nilai akhir mereka.</p>
                          <div class="grid-cards mb-4" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
                              ${[1, 2, 3]
                                .map((b) => {
                                  const isPublished =
                                    settingsData.find(
                                      (s) => s.key === `publish_nilai_${b}`,
                                    )?.value === "1";
                                  return `
                                      <div class="p-3 border rounded d-flex flex-column gap-2 align-center text-center ${isPublished ? "bg-success-soft" : "bg-light"}" style="border-radius:12px; border:1px solid ${isPublished ? "#bbf7d0" : "#e2e8f0"} !important;">
                                          <span class="font-bold text-sm">BATCH ${b}</span>
                                          <label class="switch">
                                              <input type="checkbox" onchange="togglePublishNilai(${b}, this.checked)" ${isPublished ? "checked" : ""}>
                                              <span class="slider round"></span>
                                          </label>
                                          <span class="text-xs ${isPublished ? "text-success font-bold" : "text-muted"}">${isPublished ? "DIUMUMKAN" : "DISEMBUNYIKAN"}</span>
                                      </div>
                                  `;
                                })
                                .join("")}
                          </div>

                          <hr class="my-4" style="opacity:0.1">
                          <h4 class="mb-3 text-danger"><i class="fa-solid fa-broom"></i> Pemeliharaan Database</h4>
                          <div class="alert bg-danger-soft p-3 rounded mb-4" style="border-radius:12px; font-size:0.85rem">
                              <i class="fa-solid fa-triangle-exclamation"></i> 
                              Gunakan tombol di bawah jika data tabel User terlihat berantakan (nama/id bergeser kolom).
                          </div>
                          <button type="button" class="btn btn-outline-danger btn-block mb-3" onclick="repairUserDatabase()">
                              <i class="fa-solid fa-wand-magic-sparkles"></i> Bersihkan Baris Berantakan (Auto Alignment)
                          </button>

                          <hr class="my-4" style="opacity:0.1">
                          <h4 class="mb-3" style="color:var(--primary)"><i class="fa-solid fa-cloud-arrow-down"></i> Backup & Restore Data</h4>
                          <div class="alert bg-primary-soft p-3 rounded mb-4" style="border-radius:12px; font-size:0.85rem">
                              <i class="fa-solid fa-circle-info text-primary"></i>
                              Backup akan mengekspor SELURUH data (semua sheet) dalam format JSON. Restore akan menimpa data yang ada.
                          </div>
                          <div class="d-flex gap-2 mb-3 wrap">
                              <button type="button" class="btn btn-primary" onclick="backupDataJSON()">
                                  <i class="fa-solid fa-download"></i> Backup Data (JSON)
                              </button>
                              <label class="btn btn-warning m-0" style="cursor:pointer">
                                  <i class="fa-solid fa-upload"></i> Restore Data (JSON)
                                  <input type="file" accept=".json" class="hidden" onchange="restoreDataJSON(event)">
                              </label>
                          </div>

                          <hr class="my-4" style="opacity:0.1">
                          <button type="submit" class="btn btn-primary" id="btn-save-settings">
                              <i class="fa-solid fa-save"></i> Simpan Seluruh Pengaturan
                          </button>
                      </form>
                  </div>
              </div>
          </div>
      `;

  if (resSets.success && resSets.data) {
    const getVal = (key) => {
      const f = resSets.data.find((s) => s.key === key);
      return f ? f.value : "";
    };
    document.getElementById("set-batas-lulus").value =
      getVal("batas_lulus") || 75;
    document.getElementById("set-w-prak").value = getVal("w_prak") || 40;
    document.getElementById("set-w-askep").value = getVal("w_askep") || 40;
    document.getElementById("set-w-sikap").value = getVal("w_sikap") || 20;
    document.getElementById("set-w-klinik").value = getVal("w_klinik") || 50;
    document.getElementById("set-w-akademik").value =
      getVal("w_akademik") || 50;
  }

  const validateWeights = () => {
    const w1 = parseFloat(document.getElementById("set-w-prak").value) || 0;
    const w2 = parseFloat(document.getElementById("set-w-askep").value) || 0;
    const w3 = parseFloat(document.getElementById("set-w-sikap").value) || 0;
    const total = w1 + w2 + w3;
    document.getElementById("current-weight-total").textContent = total;
    if (total !== 100) {
      document.getElementById("weight-error").classList.remove("hidden");
      document.getElementById("btn-save-settings").disabled = true;
    } else {
      document.getElementById("weight-error").classList.add("hidden");
      document.getElementById("btn-save-settings").disabled = false;
    }
  };

  ["set-w-prak", "set-w-askep", "set-w-sikap"].forEach((id) => {
    document.getElementById(id).oninput = validateWeights;
  });

  const validatePreseptorWeights = () => {
    const wk = parseFloat(document.getElementById("set-w-klinik").value) || 0;
    const wa = parseFloat(document.getElementById("set-w-akademik").value) || 0;
    const total = wk + wa;
    document.getElementById("current-preseptor-total").textContent = total;
    if (total !== 100) {
      document
        .getElementById("weight-preseptor-error")
        .classList.remove("hidden");
      document.getElementById("btn-save-settings").disabled = true;
    } else {
      document.getElementById("weight-preseptor-error").classList.add("hidden");
      // Only enable if component weights are also valid
      validateWeights();
    }
  };
  ["set-w-klinik", "set-w-akademik"].forEach((id) => {
    document.getElementById(id).oninput = validatePreseptorWeights;
  });

  document.getElementById("form-settings").onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      batas_lulus: document.getElementById("set-batas-lulus").value,
      w_prak: document.getElementById("set-w-prak").value,
      w_askep: document.getElementById("set-w-askep").value,
      w_sikap: document.getElementById("set-w-sikap").value,
      w_klinik: document.getElementById("set-w-klinik").value,
      w_akademik: document.getElementById("set-w-akademik").value,
    };
    const saveRes = await postAPI("saveSettings", payload);
    if (saveRes.success) {
      showToast("Berhasil", "Pengaturan sistem telah diperbarui", "success");
    }
  };
}

window.repairUserDatabase = async () => {
  if (
    confirm(
      "⚠️ PERINGATAN REPARASI\n\nSistem akan mencoba memperbaiki baris yang berantakan (nama/id bergeser) secara otomatis.\nProses ini mungkin memakan waktu beberapa saat.\n\nLanjutkan?",
    )
  ) {
    showLoader(true);
    const res = await postAPI("repairUsers");
    showLoader(false);
    if (res.success) {
      clearCache("getKelompok");
      showToast(
        "Berhasil",
        `Berhasil mengimpor ${finalGroups.length} kelompok`,
        "success",
      );
      loadView("kelompokAdminView");
    }
  }
};

window.tempatAdminView = (area) =>
  renderMasterData(
    area,
    "tempat",
    "Tempat Praktik",
    "fa-hospital",
    ["Nama Tempat Praktik"],
    ["nama_tempat"],
    "getTempat",
  );
window.prodiAdminView = (area) =>
  renderMasterData(
    area,
    "prodi",
    "Program Studi",
    "fa-graduation-cap",
    ["Nama Program Studi"],
    ["nama_prodi"],
    "getProdi",
  );
window.kompetensiAdminView = (area) =>
  renderMasterData(
    area,
    "kompetensi",
    "Kompetensi / Skill",
    "fa-list-check",
    ["Nama Kompetensi", "Target Minimal", "Kategori", "Angkatan"],
    ["nama_skill", "target_minimal", "kategori", "angkatan"],
    "getKompetensiAll",
  );
window.bimbPraktikumAdminView = (area) =>
  renderMasterData(
    area,
    "bimb_praktikum",
    "Bimbingan Praktikum",
    "fa-chalkboard-user",
    ["Komponen Penilaian", "Nilai Maksimal"],
    ["nama_komponen", "nilai_maksimal"],
    "getBimbPraktikum",
  );
window.bimbAskepAdminView = (area) =>
  renderMasterData(
    area,
    "bimb_askep",
    "Bimbingan ASKEP",
    "fa-notes-medical",
    ["Komponen Penilaian", "Bobot", "Skor Maks (100)"],
    ["nama_komponen", "bobot", "skor_maks"],
    "getBimbAskep",
  );
window.sikapPerilakuAdminView = (area) =>
  renderMasterData(
    area,
    "sikap_perilaku",
    "Sikap & Perilaku",
    "fa-user-check",
    ["Aspek Penilaian", "Nilai Maksimal"],
    ["nama_komponen", "nilai_maksimal"],
    "getSikapPerilaku",
  );

async function renderMasterData(
  area,
  type,
  title,
  icon,
  colsHeader,
  colsKey,
  fetchAction,
) {
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card">
                  <div class="card-header d-flex justify-between align-center wrap gap-2">
                      <h3><i class="fa-solid ${icon} text-primary"></i> Master ${title}</h3>
                      <div class="d-flex gap-2 wrap">
                          ${
                            type === "kompetensi" || type === "tempat"
                              ? `
                              <button class="btn btn-outline btn-sm" onclick="downloadMasterTemplate('${type}')"><i class="fa-solid fa-file-csv"></i> Template CSV</button>
                              <label class="btn btn-outline btn-sm m-0" style="cursor:pointer">
                                  <i class="fa-solid fa-file-import"></i> Import CSV
                                  <input type="file" accept=".csv" class="hidden" onchange="handleImportMasterCSV(event, '${type}')">
                              </label>
                          `
                              : ""
                          }
                          <button class="btn btn-danger-soft btn-sm" onclick="clearMasterData('${type}', '${title}')"><i class="fa-solid fa-trash-can"></i> Hapus Semua</button>
                          <button class="btn btn-primary btn-sm" onclick="bukaModalMaster('${type}', '${title}')"><i class="fa-solid fa-plus"></i> Tambah Baru</button>
                      </div>
                  </div>
                  <div class="card-body">
                      <div class="table-responsive">
                          <table id="table-master-${type}">
                              <thead>
                                  <tr>
                                      ${colsHeader.map((c) => `<th>${c}</th>`).join("")}
                                      <th style="text-align:right">Aksi</th>
                                  </tr>
                              </thead>
                              <tbody><tr><td colspan="${colsHeader.length + 1}" class="empty-table"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data...</td></tr></tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      `;

  const res = await fetchAPI(fetchAction);
  const tableBody = document.querySelector(`#table-master-${type} tbody`);
  if (res.success && res.data && res.data.length > 0) {
    window["adminMasterData_" + type] = res.data;
    let htmlRows = res.data.map((row, idx) => {
      let tds = colsKey
        .map((k) => {
          if (
            k === "nama_tempat" ||
            k === "nama_prodi" ||
            k === "nama_skill" ||
            k === "nama_komponen"
          ) {
            let text = escapeHTML(row[k]) || "";
            // Temukan titik pertama yang didahului angka untuk memisahkan Title dan List
            let firstNumIdx = text.search(/[0-9]+\./);
            let titlePart = text;
            let listPart = "";

            if (firstNumIdx !== -1) {
              titlePart = text.substring(0, firstNumIdx).trim();
              listPart = text.substring(firstNumIdx);
            }

            // Rapikan penomoran di listPart
            let formattedList = listPart.replace(
              /([0-9]+\.)/g,
              '<br><span style="color:var(--primary); font-weight:700; margin-right:8px; display:inline-block; width:20px;">$1</span>',
            );

            return `<td>
                          <div style="margin-bottom:4px;"><strong style="color:var(--primary-dark); font-size:1.05em; border-bottom:1px dashed #cbd5e1">${titlePart}</strong></div>
                          <div style="line-height:1.7; color:var(--text-strong); padding-left:5px;">${formattedList}</div>
                      </td>`;
          }

          // Hitung Skor Maksimal secara otomatis untuk ASKEP (Bobot % * 100)
          if (k === "skor_maks" && type === "bimb_askep") {
            let bobot = parseFloat(row["bobot"]) || 0;
            let skorMaks = ((bobot * 100) / 100).toFixed(1);
            return `<td><span class="badge bg-secondary" style="font-size:0.9em; background:#f1f5f9; color:var(--primary-dark); border:1px solid #e2e8f0">${skorMaks}</span></td>`;
          }

          // Gunakan check null/undefined agar angka 0 tetap muncul
          let val =
            row[k] !== undefined && row[k] !== null && row[k] !== ""
              ? escapeHTML(row[k])
              : "-";
          return `<td><span class="badge bg-primary" style="font-size:0.9em; padding: 0.4rem 0.8rem;">${val}${k === "bobot" ? "%" : ""}</span></td>`;
        })
        .join("");
      return `
              <tr class="animate-fade-up delay-${((idx % 5) + 1) * 100}">
                  ${tds}
                  <td style="text-align:right">
                      <button class="btn btn-icon-ghost" onclick="bukaModalMaster('${type}', '${title}', '${row.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                      <button class="btn btn-icon-ghost text-danger" onclick="deleteMaster('${type}', '${row.id}')" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                  </td>
              </tr>
          `;
    });

    // Tambahkan Total Skor jika tipe Bimbingan Praktikum
    if (type === "bimb_praktikum") {
      const totalSkor = res.data.reduce(
        (acc, curr) => acc + (parseFloat(curr.nilai_maksimal) || 0),
        0,
      );
      htmlRows.push(`
                  <tr style="background:var(--bg-light); font-weight:bold; border-top:2px solid #e2e8f0">
                      <td><strong class="text-primary">TOTAL SKOR MAKSIMAL</strong></td>
                      <td><span class="badge bg-danger" style="font-size:1.1em; padding:0.5rem 1rem;">${totalSkor}</span></td>
                      <td></td>
                  </tr>
              `);
    }

    // Tambahkan Total Bobot jika tipe Bimbingan ASKEP
    if (type === "bimb_askep") {
      const totalBobot = res.data.reduce(
        (acc, curr) => acc + (parseFloat(curr.bobot) || 0),
        0,
      );
      const totalSkorMaks = ((totalBobot * 100) / 100).toFixed(0);
      htmlRows.push(`
                  <tr style="background:var(--bg-light); font-weight:bold; border-top:2px solid #e2e8f0; vertical-align:middle;">
                      <td><strong class="text-primary">TOTAL PERHITUNGAN (Jika Nilai = 100)</strong></td>
                      <td><span class="badge ${totalBobot === 100 ? "bg-success" : "bg-warning"}" style="font-size:1.1em; padding:0.5rem 1rem;">${totalBobot}%</span></td>
                      <td><span class="badge bg-danger" style="font-size:1.1em; padding:0.5rem 1rem;">${totalSkorMaks}</span></td>
                      <td></td>
                  </tr>
              `);
    }

    // Tambahkan Total Nilai jika tipe Sikap & Perilaku
    if (type === "sikap_perilaku") {
      const totalNilai = res.data.reduce(
        (acc, curr) => acc + (parseFloat(curr.nilai_maksimal) || 0),
        0,
      );
      htmlRows.push(`
                  <tr style="background:var(--bg-light); font-weight:bold; border-top:2px solid #e2e8f0; vertical-align:middle;">
                      <td>
                          <div class="text-primary">TOTAL SKOR MAKSIMAL</div>
                          <div class="text-muted" style="font-size:0.8em; font-weight:normal; margin-top:4px;">
                              <i class="fa-solid fa-calculator"></i> Nilai Akhir: (Skor Perolehan &times; 100) / ${totalNilai}
                          </div>
                      </td>
                      <td>
                          <span class="badge bg-primary" style="font-size:1.1em; padding:0.5rem 1rem;">${totalNilai}</span>
                      </td>
                      <td></td>
                  </tr>
              `);
    }

    tableBody.innerHTML = htmlRows.join("");
  } else {
    tableBody.innerHTML = `<tr><td colspan="${colsHeader.length + 1}" class="empty-table"><i class="fa-solid fa-folder-open fa-2x mb-2" style="color:#cbd5e1;display:block"></i>Belum ada data</td></tr>`;
  }
}

window.bukaModalMaster = (type, title, id = null) => {
  let doc = { id: "", nama: "", target: "", kategori: "" };
  let isEdit = false;

  const dataArr = window["adminMasterData_" + type];
  if (id && dataArr) {
    let f = dataArr.find((u) => u.id === id);
    if (f) {
      doc.id = f.id;
      if (type === "tempat") doc.nama = f.nama_tempat;
      if (type === "prodi") doc.nama = f.nama_prodi;
      if (type === "kompetensi") {
        doc.nama = f.nama_skill;
        doc.target = f.target_minimal;
        doc.kategori = f.kategori || "";
        doc.angkatan = f.angkatan || "";
      }
      if (type === "bimb_praktikum") {
        doc.nama = f.nama_komponen;
        doc.nilai_maksimal = f.nilai_maksimal;
      }
      if (type === "bimb_askep") {
        doc.nama = f.nama_komponen;
        doc.bobot = f.bobot;
      }
      if (type === "sikap_perilaku") {
        doc.nama = f.nama_komponen;
        doc.nilai_maksimal = f.nilai_maksimal;
      }
      isEdit = true;
    }
  }

  let extraField = "";
  if (type === "kompetensi") {
    // Generate angkatan options
    const currentYear = new Date().getFullYear();
    let angkatanOptions = `<option value="Semua" ${doc.angkatan === "Semua" || doc.angkatan === "-" || !doc.angkatan ? "selected" : ""}>Semua Angkatan</option>`;
    for (let yr = currentYear + 1; yr >= currentYear - 5; yr--) {
      angkatanOptions += `<option value="${yr}" ${doc.angkatan == yr ? "selected" : ""}>${yr}</option>`;
    }

    extraField = `
              <div class="form-group">
                  <label>Kategori Kompetensi</label>
                  <input type="text" id="master-kategori" required class="form-control" value="${doc.kategori}" placeholder="Cth: Kebutuhan Dasar Manusia" list="kategori-list">
                  <datalist id="kategori-list"></datalist>
              </div>
              <div class="form-group">
                  <label>Berlaku untuk Angkatan</label>
                  <div class="input-with-icon">
                      <i class="fa-solid fa-calendar-days"></i>
                      <select id="master-angkatan" class="form-control">
                          ${angkatanOptions}
                      </select>
                  </div>
              </div>
              <div class="form-group">
                  <label>Target Minimal Pencapaian</label>
                  <input type="number" id="master-target" required class="form-control" value="${doc.target || 0}" placeholder="Berapa kali? cth: 20">
              </div>
          `;
  } else if (type === "bimb_praktikum") {
    extraField = `
              <div class="form-group">
                  <label>Nilai Maksimal</label>
                  <input type="number" id="master-extra" required class="form-control" value="${doc.nilai_maksimal || 0}" placeholder="Cth: 100">
              </div>
          `;
  } else if (type === "sikap_perilaku") {
    extraField = `
              <div class="form-group">
                  <label>Nilai Maksimal (Skala Likert)</label>
                  <input type="number" id="master-extra" required class="form-control" value="${doc.nilai_maksimal || 4}" placeholder="Cth: 4">
              </div>
          `;
  } else if (type === "bimb_askep") {
    extraField = `
              <div class="form-group">
                  <label>Bobot Penilaian (%)</label>
                  <input type="number" id="master-extra" required class="form-control" value="${doc.bobot || 0}" placeholder="Cth: 20">
              </div>
          `;
  }

  openModal(
    isEdit ? `Edit ${title}` : `Tambah ${title}`,
    `
          <form id="form-master" class="animate-fade-in">
              <input type="hidden" id="master-id" value="${doc.id}">
              <input type="hidden" id="master-type" value="${type}">
              <div class="form-group">
                  <label>${type === "sikap_perilaku" ? "Aspek Penilaian" : "Komponen Penilaian"}</label>
                  <input type="text" id="master-nama" required class="form-control" value="${doc.nama}" placeholder="Tuliskan nama...">
              </div>
              ${extraField}
              <button type="submit" class="btn btn-primary btn-block mt-3"><i class="fa-solid fa-save"></i> ${isEdit ? "Simpan Data" : "Tambah Baru"}</button>
          </form>
      `,
  );

  // Populate datalist for kategori suggestions from existing data
  if (type === "kompetensi" && dataArr) {
    const uniqueKats = [
      ...new Set(dataArr.map((k) => k.kategori).filter((k) => k && k !== "-")),
    ];
    const dl = document.getElementById("kategori-list");
    if (dl)
      dl.innerHTML = uniqueKats.map((k) => `<option value="${k}">`).join("");
  }

  document.getElementById("form-master").onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      type: document.getElementById("master-type").value,
      id: document.getElementById("master-id").value,
      nama: document.getElementById("master-nama").value,
      target: document.getElementById("master-target")
        ? document.getElementById("master-target").value
        : "",
      kategori: document.getElementById("master-kategori")
        ? document.getElementById("master-kategori").value
        : "",
      angkatan: document.getElementById("master-angkatan")
        ? document.getElementById("master-angkatan").value
        : "",
      nilai_maksimal:
        ["bimb_praktikum", "sikap_perilaku"].includes(
          document.getElementById("master-type").value,
        ) && document.getElementById("master-extra")
          ? document.getElementById("master-extra").value
          : "",
      bobot:
        document.getElementById("master-type").value === "bimb_askep" &&
        document.getElementById("master-extra")
          ? document.getElementById("master-extra").value
          : "",
    };
    const action = isEdit ? "editMaster" : "addMaster";
    showToast("Memproses", "Menyimpan ke Database...", "info");
    const res = await postAPI(action, payload);
    if (res.success) {
      closeModal();
      showToast("Sukses", res.message, "success");
      const views = {
        tempat: "tempatAdminView",
        prodi: "prodiAdminView",
        kompetensi: "kompetensiAdminView",
        bimb_praktikum: "bimbPraktikumAdminView",
        bimb_askep: "bimbAskepAdminView",
        sikap_perilaku: "sikapPerilakuAdminView",
      };
      loadView(views[type]);
    }
  };
};

window.deleteMaster = async (type, id) => {
  if (confirm("Yakin ingin menghapus master data ini secara permanen?")) {
    const res = await postAPI("deleteMaster", { type, id });
    if (res.success) {
      if (type === "kelompok") clearCache("getKelompok");
      if (type === "tempat") clearCache("getTempat");
      if (type === "prodi") clearCache("getProdi");
      if (type === "kompetensi") clearCache("getKompetensi");

      showToast("Terhapus", "Data berhasil dihapus dari sistem", "success");
      const views = {
        kelompok: "kelompokAdminView",
        tempat: "tempatAdminView",
        prodi: "prodiAdminView",
        kompetensi: "kompetensiAdminView",
        bimb_praktikum: "bimbPraktikumAdminView",
        bimb_askep: "bimbAskepAdminView",
        sikap_perilaku: "sikapPerilakuAdminView",
      };
      loadView(views[type]);
    }
  }
};

window.clearMasterData = async (type, title) => {
  if (
    confirm(
      `⚠️ PERINGATAN KRUSIAL!\n\nAnda akan menghapus SELURUH data ${title}.\nData yang sudah dihapus tidak dapat dikembalikan.\n\nApakah Anda benar-benar yakin?`,
    )
  ) {
    if (confirm(`Konfirmasi terakhir: Hapus semua data ${title}?`)) {
      showLoader(true);
      const res = await postAPI("clearMaster", { type: type });
      showLoader(false);
      if (res.success) {
        const cacheMap = {
          kelompok: "getKelompok",
          tempat: "getTempat",
          prodi: "getProdi",
          kompetensi: "getKompetensi",
        };
        if (cacheMap[type]) clearCache(cacheMap[type]);

        showToast(
          "Terhapus",
          `Semua data ${title} telah dibersihkan`,
          "success",
        );
        const views = {
          kelompok: "kelompokAdminView",
          tempat: "tempatAdminView",
          prodi: "prodiAdminView",
          kompetensi: "kompetensiAdminView",
          bimb_praktikum: "bimbPraktikumAdminView",
          bimb_askep: "bimbAskepAdminView",
          sikap_perilaku: "sikapPerilakuAdminView",
        };
        loadView(views[type]);
      }
    }
  }
};

window.downloadMasterTemplate = (type) => {
  let headers = [];
  let rows = [];
  if (type === "kompetensi") {
    headers = ["nama_skill", "target_minimal", "kategori", "angkatan"];
    rows = [
      ["Injeksi Intravena (IV)", "20", "Kebutuhan Dasar Manusia", "Semua"],
      ["Pemasangan Infus", "15", "Kebutuhan Dasar Manusia", "2024"],
      ["Perawatan Luka Post-Op", "10", "Keperawatan Medikal Bedah", "2023"],
    ];
  } else if (type === "tempat") {
    headers = ["nama_tempat"];
    rows = [
      ["RSUD Kota Bandung"],
      ["Puskesmas Sukajadi"],
      ["Stase Keperawatan Anak"],
    ];
  }

  downloadCSV(headers, rows, `Template_Import_${type}.csv`);
  showToast("Template Diunduh", "Gunakan format CSV standar.", "info");
};

const parseCSVLine = (line, delim) => {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === delim && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else current += char;
  }
  result.push(current.trim());
  return result;
};

window.handleImportMasterCSV = (e, type) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    let text = event.target.result;
    if (text.startsWith("\uFEFF")) text = text.substring(1);

    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length < 2) return showToast("Gagal", "File kosong", "error");

    let delimiter = ",";
    if (lines[0].includes(";")) delimiter = ";";
    else if (lines[0].includes("\t")) delimiter = "\t";

    const headers = parseCSVLine(lines[0], delimiter).map((h) =>
      h
        .trim()
        .toLowerCase()
        .replace(/(^"|"$)/g, ""),
    );
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i], delimiter);
      let obj = {};
      headers.forEach((h, idx) => {
        if (cols[idx] !== undefined)
          obj[h] = cols[idx].replace(/(^"|"$)/g, "").trim();
      });
      data.push(obj);
    }

    if (confirm(`Impor ${data.length} data ${type}?`)) {
      showLoader(true);
      const res = await postAPI("importMaster", { type: type, data: data });
      showLoader(false);
      if (res.success) {
        showToast("Impor Berhasil", res.message, "success");
        loadView(
          type === "kompetensi" ? "kompetensiAdminView" : type + "AdminView",
        );
      }
    }
  };
  reader.readAsText(file);
  e.target.value = "";
};

// EXPORT FUNCTIONS
window.exportToCSV = () => {
  if (!window.dtAdminPresensi || window.dtAdminPresensi.length === 0)
    return showToast(
      "Informasi",
      "Tidak ada data presensi yang bisa di-export",
      "warning",
    );

  const headers = [
    "Mahasiswa",
    "Prodi",
    "Lahan Praktik",
    "Tanggal",
    "Jam Masuk",
    "Jam Keluar",
    "Durasi (Jam)",
  ];
  const rows = window.dtAdminPresensi.map((p) => [
    p.nama,
    p.prodi || "-",
    p.nama_lahan,
    p.tanggal,
    p.jam_masuk,
    p.jam_keluar || "",
    p.durasi || 0,
  ]);

  downloadCSV(headers, rows, "Laporan_Master_Presensi.csv");
  showToast("Export Berhasil", "File CSV telah diunduh", "success");
};

window.exportToPDF = () => {
  if (typeof window.jspdf === "undefined")
    return showToast(
      "Error Sistem",
      "Module render PDF (jsPDF) belum ter-load",
      "error",
    );
  if (!window.dtAdminPresensi || window.dtAdminPresensi.length === 0)
    return showToast("Informasi", "Tidak ada data presensi", "warning");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Laporan Resmi Presensi Praktik Klinik Mahasiswa", 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")} | Dicetak oleh Sistem E-Klinik`,
    14,
    28,
  );

  const tableColumn = [
    "Mahasiswa",
    "Prodi",
    "Lahan Praktik",
    "Tanggal",
    "Masuk",
    "Keluar",
    "Durasi",
  ];
  const tableRows = window.dtAdminPresensi.map((p) => [
    p.nama,
    p.prodi || "-",
    p.nama_lahan,
    p.tanggal,
    p.jam_masuk,
    p.jam_keluar || "-",
    p.durasi ? parseFloat(p.durasi).toFixed(2) : "0",
  ]);

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 35,
    theme: "grid",
    styles: { fontSize: 9, font: "helvetica" },
    headStyles: { fillColor: [139, 92, 246] } /* Primary Purple */,
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save("Laporan_Master_Presensi_Klinik.pdf");
  showToast(
    "Penyelesaian Render",
    "Dokumen PDF berhasil diciptakan",
    "success",
  );
};

// ---------------- UTILS & EVENTS ---------------- //

function showToast(title, message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let icon = "fa-circle-info";
  if (type === "success") icon = "fa-circle-check";
  if (type === "error") icon = "fa-circle-exclamation";
  if (type === "warning") icon = "fa-triangle-exclamation";

  toast.innerHTML = `
          <div class="toast-icon">
              <i class="fa-solid ${icon}"></i>
          </div>
          <div class="toast-content">
              <h4>${title}</h4>
              <p>${message}</p>
          </div>
      `;
  container.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add("show"), 50);

  // Auto remove
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400); // 0.4s sync CSS transition
  }, 4500);
}

function showLoader(show) {
  const loader = document.getElementById("loader");
  if (show) loader.classList.remove("hidden");
  else {
    setTimeout(() => {
      loader.classList.add("hidden");
    }, 200); // Small delay to prevent flashing
  }
}

function openModal(title, bodyHtml) {
  document.getElementById("modal-title").innerHTML = title;
  document.getElementById("modal-body").innerHTML = bodyHtml;
  document.getElementById("app-modal").classList.remove("hidden");

  // Restart zoom animation if previously fired
  const content = document.querySelector(".modal-content");
  content.classList.remove("animate-zoom-in");
  void content.offsetWidth;
  content.classList.add("animate-zoom-in");
}

function closeModal() {
  document.getElementById("app-modal").classList.add("hidden");
}

// Listeners
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const u = document.getElementById("username").value;
  const p = document.getElementById("password").value;
  const hp = await hashPassword(p);
  const res = await fetchAPI("login", {
    username: u,
    password: hp,
    raw_password: p,
  });

  if (res.success) {
    // PWA Database/Version Check: Force refresh if needed
    const currentVersion = "2.0-supabase";
    const savedVersion = localStorage.getItem("app_version");

    if (savedVersion !== currentVersion) {
      localStorage.clear(); // Clear old cached data
      localStorage.setItem("app_version", currentVersion);
      localStorage.setItem("eblogbook_user", JSON.stringify(res.user));

      showToast(
        "Sistem Diperbarui",
        "Menyesuaikan database Supabase...",
        "info",
      );
      setTimeout(() => {
        window.location.reload(true); // Force reload from server
      }, 1500);
      return;
    }

    localStorage.setItem("eblogbook_user", JSON.stringify(res.user));
    showToast(
      "Otentikasi Berhasil",
      `Selamat datang kembali, ${res.user.nama}`,
      "success",
    );
    checkAuth();
  } else {
    showToast(
      "Akses Ditolak",
      res.message || "Terdapat kesalahan kredensial User/NIM dan Password",
      "error",
    );
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("eblogbook_user");
  currentUser = null;
  checkAuth();
  showToast("Sesi Diakhiri", "Anda telah di-logout dengan aman", "info");
});

function changePasswordView(area) {
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card" style="max-width: 500px; margin: 0 auto;">
                  <div class="card-header">
                      <h3><i class="fa-solid fa-key text-primary"></i> Ubah Password Akun</h3>
                  </div>
                  <div class="card-body">
                      <form id="form-change-password">
                          <div class="form-group">
                              <label>Password Lama</label>
                              <input type="password" id="old-pass" required class="form-control" placeholder="••••••••">
                          </div>
                          <div class="form-group">
                              <label>Password Baru</label>
                              <input type="password" id="new-pass" required class="form-control" placeholder="••••••••">
                          </div>
                          <div class="form-group">
                              <label>Konfirmasi Password Baru</label>
                              <input type="password" id="confirm-pass" required class="form-control" placeholder="••••••••">
                          </div>
                          <button type="submit" class="btn btn-primary btn-block">
                              <i class="fa-solid fa-save"></i> Perbarui Password
                          </button>
                      </form>
                  </div>
              </div>
          </div>
      `;

  document.getElementById("form-change-password").onsubmit = async (e) => {
    e.preventDefault();
    const oldPass = document.getElementById("old-pass").value;
    const newPass = document.getElementById("new-pass").value;
    const confirmPass = document.getElementById("confirm-pass").value;

    if (newPass !== confirmPass) {
      return showToast(
        "Gagal",
        "Konfirmasi password baru tidak cocok!",
        "error",
      );
    }

    const res = await postAPI("updatePassword", {
      user_id: currentUser.id,
      oldPassword: oldPass,
      newPassword: newPass,
    });

    if (res.success) {
      showToast(
        "Berhasil",
        "Password Anda telah diperbarui. Silakan login kembali.",
        "success",
      );
      setTimeout(() => {
        document.getElementById("logout-btn").click();
      }, 2000);
    } else {
      showToast("Gagal", res.message || "Gagal memperbarui password", "error");
    }
  };
}

// ADMIN: JADWAL MATRIKS
async function jadwalAdminView(area, batchNum = null) {
  const batchSuffix = batchNum ? ` ${batchNum}` : "";
  area.innerHTML = `
          <div class="animate-fade-up">
              <div class="card">
                  <div class="card-header d-flex justify-between align-center wrap gap-2">
                      <h3><i class="fa-solid fa-calendar-days text-primary"></i> Jadwal Praktik Mahasiswa${batchSuffix}</h3>
                      <div class="d-flex gap-2">
                          <button class="btn btn-outline btn-sm" onclick="exportJadwalExcel()">
                              <i class="fa-solid fa-file-excel text-success"></i> Unduh Excel
                          </button>
                          <button class="btn btn-danger-soft btn-sm" onclick="exportJadwalPDF()">
                              <i class="fa-solid fa-file-pdf"></i> Unduh PDF
                          </button>
                      </div>
                  </div>
                  <div class="card-body">
                      <div class="d-flex justify-between align-center mb-3 wrap gap-3" style="background:#f1f5f9; padding:12px; border-radius:8px;">
                          <span class="text-sm" style="color:#475569">
                              <i class="fa-solid fa-circle-info text-primary"></i> Info: <strong>P</strong> = Pagi, <strong>S</strong> = Siang, <strong>M</strong> = Malam, <strong>L</strong> = Libur (Hari Minggu)
                          </span>
                          <div class="d-flex gap-2">
                              <button class="btn btn-sm" style="background:#e2e8f0; color:#475569;" onclick="document.querySelectorAll('.table-responsive').forEach(el=>el.scrollBy({left: -300, behavior: 'smooth'}))">
                                  <i class="fa-solid fa-chevron-left"></i> Geser Tabel Ke Kiri
                              </button>
                              <button class="btn btn-sm" style="background:#e2e8f0; color:#475569;" onclick="document.querySelectorAll('.table-responsive').forEach(el=>el.scrollBy({left: 300, behavior: 'smooth'}))">
                                  Geser Tabel Ke Kanan <i class="fa-solid fa-chevron-right"></i>
                              </button>
                          </div>
                      </div>
                      
                      <div id="jadwal-table-wrapper" class="d-flex flex-column gap-5 mt-4" style="padding-bottom:10px">
                          <div class="table-responsive">
                              <table class="table-compact text-sm table-bordered" style="width:100%">
                                  <tbody><tr><td class="empty-table"><i class="fa-solid fa-spinner fa-spin"></i> Memuat jadwal...</td></tr></tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      `;

  const [resUsers, resSettings] = await Promise.all([
    fetchAPI("getUsers"),
    batchNum ? fetchAPI("getSettings") : Promise.resolve({ success: false }),
  ]);

  let filterUserIds = null;
  if (batchNum && resSettings.success) {
    const settingKey = `batch_kelompok_${batchNum}`;
    const batchKelIds = (
      resSettings.data.find((s) => s.key === settingKey)?.value || ""
    )
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id !== "");

    if (batchKelIds.length > 0) {
      filterUserIds = resUsers.data
        .filter((u) => batchKelIds.includes(String(u.kelompok_id)))
        .map((u) => u.id);
    } else {
      filterUserIds = ["none"]; // Ensure it fetches nothing if no groups assigned
    }
  }

  const [resJadwal] = await Promise.all([
    fetchAPI("getJadwal", { user_id: filterUserIds }),
  ]);

  const wrapper = document.querySelector("#jadwal-table-wrapper");
  window.dtJadwalAdmin = [];

  if (resJadwal.success && resJadwal.data && resUsers.success) {
    let schedules = resJadwal.data;
    const users = resUsers.data;

    if (batchNum && resSettings.success) {
      const settingKey = `batch_kelompok_${batchNum}`;
      const batchKelIds = (
        resSettings.data.find((s) => s.key === settingKey)?.value || ""
      ).split(",");

      if (batchKelIds.length > 0 && batchKelIds[0] !== "") {
        schedules = schedules.filter((s) => {
          const u = users.find((usr) => usr.id == s.user_id);
          return u && batchKelIds.includes(String(u.kelompok_id));
        });
      }
    }

    window.dtJadwalAdmin = schedules;
    if (schedules.length === 0) {
      wrapper.innerHTML = `<div class="empty-table">Tidak ada jadwal untuk batch ini.</div>`;
      return;
    }

    // Group schedules by explicit Kelompok ID
    const groupsTemp = {};
    schedules.forEach((s) => {
      const u = users.find((usr) => usr.id == s.user_id);
      if (u) {
        const kId = parseInt(u.kelompok_id) || u.kelompok_id || "Unassigned";
        if (!groupsTemp[kId]) {
          groupsTemp[kId] = {
            id: kId,
            usersMap: {},
            schedules: [],
          };
        }
        if (!groupsTemp[kId].usersMap[u.id]) groupsTemp[kId].usersMap[u.id] = u;
        groupsTemp[kId].schedules.push(s);
      }
    });

    const groups = Object.values(groupsTemp).map((g) => {
      return {
        ...g,
        users: Object.values(g.usersMap).sort((a, b) =>
          (a.nama || "").localeCompare(b.nama || ""),
        ),
      };
    });

    // Sort groups by earliest schedule date
    groups.sort((a, b) => {
      const aMin = Math.min(
        ...a.schedules.map((s) => new Date(s.tanggal).getTime()),
      );
      const bMin = Math.min(
        ...b.schedules.map((s) => new Date(s.tanggal).getTime()),
      );
      return aMin - bMin;
    });

    let htmlOut = "";

    groups.forEach((group, groupIdx) => {
      // Break group schedules into continuous Stase blocks based on dates & tempat
      const dates = [...new Set(group.schedules.map((s) => s.tanggal))].sort();
      const blocks = [];
      let currentBlockDates = [];
      let currentTempat = null;
      let currentTempatName = null;

      dates.forEach((d) => {
        const schedToday = group.schedules.find((s) => s.tanggal === d);
        if (!schedToday) return;

        const tId = schedToday.tempat_id;
        const tName = schedToday.nama_tempat;

        if (currentBlockDates.length === 0) {
          currentBlockDates.push(d);
          currentTempat = tId;
          currentTempatName = tName;
        } else {
          if (tId === currentTempat) {
            currentBlockDates.push(d);
          } else {
            blocks.push({
              tempat_id: currentTempat,
              nama_tempat: currentTempatName,
              dates: currentBlockDates,
            });
            currentBlockDates = [d];
            currentTempat = tId;
            currentTempatName = tName;
          }
        }
      });
      if (currentBlockDates.length > 0)
        blocks.push({
          tempat_id: currentTempat,
          nama_tempat: currentTempatName,
          dates: currentBlockDates,
        });

      // Build single wide table for this Kelompok
      const headerStyle =
        "background:#f8fafc; color:var(--text-strong); font-weight:700; text-transform:uppercase; font-size:0.75rem; border:1px solid #cbd5e1;";
      let headHtml1 = `<tr style="${headerStyle}">`;
      let headHtml2 = `<tr style="${headerStyle}">`;

      headHtml1 += `
                  <th rowspan="2" style="width:40px; text-align:center; vertical-align:middle; border:1px solid #cbd5e1;">NO</th>
                  <th rowspan="2" style="width:250px; text-align:center; vertical-align:middle; border:1px solid #cbd5e1; white-space:normal">NAMA MAHASISWA</th>
                  <th rowspan="2" style="width:130px; text-align:center; vertical-align:middle; border:1px solid #cbd5e1;">NIM</th>
              `;

      blocks.forEach((block) => {
        headHtml1 += `
                      <th rowspan="2" style="width:180px; text-align:center; vertical-align:middle; border:1px solid #cbd5e1; white-space:normal">TEMPAT PRAKTIK</th>
                      <th colspan="${block.dates.length}" style="text-align:center; border:1px solid #cbd5e1; letter-spacing:1px;">JADWAL</th>
                  `;

        block.dates.forEach((dStr) => {
          const dObj = new Date(dStr);
          const mStr = [
            "JANUARI",
            "FEBRUARI",
            "MARET",
            "APRIL",
            "MEI",
            "JUNI",
            "JULI",
            "AGUSTUS",
            "SEPTEMBER",
            "OKTOBER",
            "NOVEMBER",
            "DESEMBER",
          ][dObj.getMonth()];
          headHtml2 += `<th style="text-align:center; width:65px; border:1px solid #cbd5e1; padding:6px 4px; font-size:0.7rem;">${dObj.getDate()} ${mStr}</th>`;
        });
      });

      headHtml1 += `</tr>`;
      headHtml2 += `</tr>`;

      let bodyHtml = "";
      group.users.forEach((u, index) => {
        bodyHtml += `<tr style="background:#fff;">`;
        bodyHtml += `<td style="text-align:center; border:1px solid #cbd5e1; padding:8px 4px;">${index + 1}</td>`;
        bodyHtml += `<td style="border:1px solid #cbd5e1; padding:8px 12px; white-space:normal; font-weight:500;">${u.nama.toUpperCase()}</td>`;
        bodyHtml += `<td style="border:1px solid #cbd5e1; padding:8px 8px; text-align:center; color:var(--text-body);">${u.username}</td>`;

        blocks.forEach((block, blockIdx) => {
          if (index === 0) {
            // Find Preceptors for this location
            const preceptors = users.filter(
              (usr) =>
                usr.role === "preseptor" || usr.role === "preseptor_akademik",
            );
            const preClinic = preceptors
              .filter(
                (p) =>
                  p.role === "preseptor" &&
                  (p.tempat_id || "")
                    .split(",")
                    .map((id) => id.trim())
                    .includes(String(block.tempat_id)),
              )
              .map((p) => p.nama.toUpperCase());
            const preAkad = preceptors
              .filter(
                (p) =>
                  p.role === "preseptor_akademik" &&
                  (p.tempat_id || "")
                    .split(",")
                    .map((id) => id.trim())
                    .includes(String(block.tempat_id)),
              )
              .map((p) => p.nama.toUpperCase());

            const preceptorHtml = `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 0.65rem; font-weight: normal; color: #64748b; text-align: left;">
                  <div style="margin-bottom:2px"><strong>PRE. KLINIK:</strong><br>${preClinic.length > 0 ? preClinic.join(", ") : "-"}</div>
                  <div><strong>PRE. AKADEMIK:</strong><br>${preAkad.length > 0 ? preAkad.join(", ") : "-"}</div>
                </div>
              `;

            bodyHtml += `<td rowspan="${group.users.length}" style="text-align:center; vertical-align:middle; border:1px solid #cbd5e1; background:#fff; padding: 10px; white-space:normal; font-weight:600; color:var(--primary-dark);">
                  ${block.nama_tempat}
                  ${preceptorHtml}
              </td>`;
          }
          block.dates.forEach((dStr) => {
            const s = group.schedules.find(
              (x) => x.user_id == u.id && x.tanggal === dStr,
            );
            const dObj_cell = new Date(dStr);
            const isSunday = dObj_cell.getDay() === 0;

            let shiftText = "";
            let shiftStyle = "";

            if (isSunday) {
              shiftText = "L";
              shiftStyle =
                "text-align:center; border:1px solid #cbd5e1; background:#fee2e2; color:#ef4444; font-weight:800;";
            } else {
              if (s && s.shift) {
                if (s.shift == 1 || s.shift == "1") {
                  shiftText = "P";
                  shiftStyle =
                    "text-align:center; border:1px solid #cbd5e1; color:var(--text-strong); font-weight:700;";
                } else if (s.shift == 2 || s.shift == "2") {
                  shiftText = "S";
                  shiftStyle =
                    "text-align:center; border:1px solid #cbd5e1; color:var(--text-strong); font-weight:700;";
                } else if (s.shift == 3 || s.shift == "3") {
                  shiftText = "M";
                  shiftStyle =
                    "text-align:center; border:1px solid #cbd5e1; color:var(--text-strong); font-weight:700;";
                } else {
                  shiftText = `<span style="color:#94a3b8; font-size:0.7rem;">-</span>`;
                  shiftStyle = "text-align:center; border:1px solid #cbd5e1;";
                }
              } else {
                shiftText = `<span style="color:#94a3b8; font-size:0.7rem;">-</span>`;
                shiftStyle = "text-align:center; border:1px solid #cbd5e1;";
              }
            }
            bodyHtml += `<td style="${shiftStyle}">${shiftText}</td>`;
          });
        });

        bodyHtml += `</tr>`;
      });

      htmlOut += `
                  <div class="table-responsive animate-fade-up delay-${(groupIdx % 5) * 100}" style="margin-bottom:2.5rem; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; box-shadow: var(--shadow-sm);">
                      <table class="table-compact text-sm" style="width:max-content; border-collapse: collapse; background:white;">
                          <thead style="position: sticky; top: 0; z-index: 10;">
                              ${headHtml1}
                              ${headHtml2}
                          </thead>
                          <tbody>
                              ${bodyHtml}
                          </tbody>
                      </table>
                  </div>
              `;
    });

    wrapper.innerHTML = htmlOut;
  } else {
    wrapper.innerHTML = `
              <div class="table-responsive">
                  <table class="table-compact text-sm" style="width:100%">
                      <tbody><tr><td class="empty-table">Belum ada jadwal yang digenerate.</td></tr></tbody>
                  </table>
              </div>`;
  }
}

window.exportJadwalPDF = async () => {
  if (!window.dtJadwalAdmin || window.dtJadwalAdmin.length === 0)
    return showToast("Gagal", "Tidak ada data jadwal untuk dicetak", "warning");

  showLoader(true);
  const resUsers = await fetchAPI("getUsers");
  showLoader(false);
  if (!resUsers.success)
    return showToast("Gagal", "Gagal memuat referensi mahasiswa.", "error");

  const users = resUsers.data;
  const schedules = window.dtJadwalAdmin;

  // Grouping identical to HTML table logic
  const groupsTemp = {};
  schedules.forEach((s) => {
    const u = users.find((usr) => usr.id == s.user_id);
    if (u) {
      const kId = parseInt(u.kelompok_id) || u.kelompok_id || "Unassigned";
      if (!groupsTemp[kId]) {
        groupsTemp[kId] = {
          id: kId,
          usersMap: {},
          schedules: [],
        };
      }
      if (!groupsTemp[kId].usersMap[u.id]) groupsTemp[kId].usersMap[u.id] = u;
      groupsTemp[kId].schedules.push(s);
    }
  });

  const groups = Object.values(groupsTemp).map((g) => {
    return {
      ...g,
      users: Object.values(g.usersMap).sort((a, b) =>
        (a.nama || "").localeCompare(b.nama || ""),
      ),
    };
  });

  groups.sort((a, b) => {
    const aMin = Math.min(
      ...a.schedules.map((s) => new Date(s.tanggal).getTime()),
    );
    const bMin = Math.min(
      ...b.schedules.map((s) => new Date(s.tanggal).getTime()),
    );
    return aMin - bMin;
  });

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(
    "Jadwal Praktik Klinik Mahasiswa Lengkap (Berdasarkan Kelompok)",
    14,
    20,
  );
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Waktu Cetak: ${new Date().toLocaleString()} | P: Pagi, S: Siang, M: Malam`,
    14,
    26,
  );

  let startY = 32;

  groups.forEach((group, groupIdx) => {
    const dates = [...new Set(group.schedules.map((s) => s.tanggal))].sort();
    const blocks = [];
    let currentBlockDates = [];
    let currentTempat = null;
    let currentTempatName = null;

    dates.forEach((d) => {
      const schedToday = group.schedules.find((s) => s.tanggal === d);
      if (!schedToday) return;
      const tId = schedToday.tempat_id;
      const tName = schedToday.nama_tempat;

      if (currentBlockDates.length === 0) {
        currentBlockDates.push(d);
        currentTempat = tId;
        currentTempatName = tName;
      } else {
        if (tId === currentTempat) {
          currentBlockDates.push(d);
        } else {
          blocks.push({
            tempat_id: currentTempat,
            nama_tempat: currentTempatName,
            dates: currentBlockDates,
          });
          currentBlockDates = [d];
          currentTempat = tId;
          currentTempatName = tName;
        }
      }
    });
    if (currentBlockDates.length > 0)
      blocks.push({
        tempat_id: currentTempat,
        nama_tempat: currentTempatName,
        dates: currentBlockDates,
      });

    // Build headers dynamically
    const headRow1 = ["No", "Nama Mahasiswa", "NIM"];
    const headRow2 = ["", "", ""];

    blocks.forEach((block, bIdx) => {
      headRow1.push("Tempat Praktik");
      headRow2.push(""); // placeholder

      block.dates.forEach((dStr) => {
        const dObj = new Date(dStr);
        const mStr = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "Mei",
          "Jun",
          "Jul",
          "Ags",
          "Sep",
          "Okt",
          "Nov",
          "Des",
        ][dObj.getMonth()];
        headRow1.push(`${dObj.getDate()} ${mStr}`);
        headRow2.push("Jadwal"); // Sub-header
      });
    });

    // Build Body Data
    const bodyData = [];
    group.users.forEach((u, index) => {
      const rowData = [index + 1, u.nama, u.username];

      blocks.forEach((block, bIdx) => {
        // Find Preceptors for PDF
        const preceptors = users.filter(
          (usr) =>
            usr.role === "preseptor" || usr.role === "preseptor_akademik",
        );
        const preClinic = preceptors
          .filter(
            (p) =>
              p.role === "preseptor" &&
              (p.tempat_id || "")
                .split(",")
                .map((id) => id.trim())
                .includes(String(block.tempat_id)),
          )
          .map((p) => p.nama.toUpperCase());
        const preAkad = preceptors
          .filter(
            (p) =>
              p.role === "preseptor_akademik" &&
              (p.tempat_id || "")
                .split(",")
                .map((id) => id.trim())
                .includes(String(block.tempat_id)),
          )
          .map((p) => p.nama.toUpperCase());

        const preceptorText = `\nPre Clinic: ${preClinic.length > 0 ? preClinic.join(", ") : "-"}\nPre Akad: ${preAkad.length > 0 ? preAkad.join(", ") : "-"}`;

        rowData.push(block.nama_tempat + preceptorText); // In AutoTable we might repeat it unless we use rowSpan hooks later, but repeating is safer for PDFs

        block.dates.forEach((dStr) => {
          const s = group.schedules.find(
            (x) => x.user_id == u.id && x.tanggal === dStr,
          );
          let shiftText = "Libur";
          const isSun = new Date(dStr).getDay() === 0;

          if (isSun) {
            shiftText = "L";
          } else if (s && s.shift) {
            if (s.shift == 1 || s.shift == "1") shiftText = "P";
            else if (s.shift == 2 || s.shift == "2") shiftText = "S";
            else if (s.shift == 3 || s.shift == "3") shiftText = "M";
          }
          rowData.push(shiftText);
        });
      });
      bodyData.push(rowData);
    });

    if (groupIdx > 0) {
      doc.addPage();
      startY = 20;
      doc.text(
        `Lanjutan Kelompok: ${group.id} (Disusun otomatis berdasarkan pola stase yang sama)`,
        14,
        startY - 5,
      );
    } else {
      doc.text(`Kelompok: ${group.id}`, 14, startY - 2);
    }

    // Apply autoTable
    doc.autoTable({
      startY: startY,
      head: [headRow1],
      body: bodyData,
      theme: "grid",
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: "bold",
        halign: "center",
        fontSize: 7,
      },
      bodyStyles: { fontSize: 8, halign: "center" },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { halign: "left", cellWidth: 45 },
        2: { halign: "center", cellWidth: 25 },
      },
      styles: { cellPadding: 1, overflow: "linebreak" },
      didParseCell: function (data) {
        // Left align Tempat Praktik columns
        if (data.section === "body" && data.row.raw) {
          // Check mapping for tempat praktik columns
          // In headRow1 they equal "Tempat Praktik"
          if (headRow1[data.column.index] === "Tempat Praktik") {
            data.cell.styles.halign = "left";
            data.cell.styles.fontSize = 7;
          }
        }

        // Colorize Libur
        if (
          data.section === "body" &&
          (data.cell.raw === "Libur" || data.cell.raw === "L")
        ) {
          data.cell.styles.textColor = [239, 68, 68]; // Red for L or Libur
          if (data.cell.raw === "L") {
            data.cell.styles.fillColor = [254, 226, 226]; // Red background for Sunday
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = [37, 99, 235]; // Normal Libur is Blue
          }
        }
      },
    });

    startY = doc.lastAutoTable.finalY + 15;
  });

  doc.save(`Jadwal_Praktik_Matriks_${new Date().getTime()}.pdf`);
};

window.exportJadwalExcel = () => {
  if (!window.dtJadwalAdmin || window.dtJadwalAdmin.length === 0)
    return showToast(
      "Gagal",
      "Tidak ada data jadwal untuk diekspor",
      "warning",
    );

  // Gather all tables generated for the cohorts
  const tables = document.querySelectorAll("#jadwal-table-wrapper table");
  if (tables.length === 0)
    return showToast("Gagal", "Tabel tidak ditemukan", "error");

  let excelContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
          <!--[if gte mso 9]>
          <xml>
              <x:ExcelWorkbook>
                  <x:ExcelWorksheets>
                      <x:ExcelWorksheet>
                          <x:Name>Jadwal_Praktik</x:Name>
                          <x:WorksheetOptions>
                              <x:DisplayGridlines/>
                          </x:WorksheetOptions>
                      </x:ExcelWorksheet>
                  </x:ExcelWorksheets>
              </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <meta charset="utf-8">
          <style>
              table { border-collapse: collapse; margin-bottom: 30px; }
              th, td { border: 1px solid #cbd5e1; padding: 8px; font-family: Arial, sans-serif; font-size: 11px; }
              th { background-color: #f8fafc; text-align: center; vertical-align: middle; font-weight: bold; color: #0f172a; text-transform: uppercase; }
              td { vertical-align: middle; }
              .info-text { font-size: 13px; font-weight: bold; margin-bottom: 10px; font-family: Arial, sans-serif; color: #1e293b; }
          </style>
      </head>
      <body>
          <div class="info-text">Export Jadwal Praktik Klinik Mahasiswa - Generated at ${new Date().toLocaleString()}</div>
          <div class="info-text" style="color:#475569; font-weight:normal; margin-bottom:20px;">Keterangan: P = Pagi, S = Siang, M = Malam, Teks Biru = Libur</div>
      `;

  tables.forEach((table, i) => {
    excelContent += `<div><strong>Kelompok Blok ${i + 1}</strong></div>`;
    excelContent += table.outerHTML;
    excelContent += `<br><br>`;
  });

  excelContent += `</body></html>`;

  // Create Blob and trigger download
  const blob = new Blob([excelContent], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Jadwal_Praktik_Matriks_${new Date().getTime()}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.bukaModalGenerateJadwal = async () => {
  showLoader(true);
  const resTempat = await fetchAPI("getTempat");
  showLoader(false);

  if (!resTempat.success)
    return showToast("Gagal", "Gagal mengambil data tempat praktik", "error");

  const lokasiOptions = resTempat.data
    .map(
      (t) => `
          <label class="d-flex align-center gap-2 mb-2" style="cursor:pointer; background:#f8fafc; padding:0.6rem 1rem; border-radius:8px; border:1px solid #e2e8f0;">
              <input type="checkbox" name="gen-locations" value="${t.id}" checked style="width:18px; height:18px;">
              <span style="font-size:0.9rem; font-weight:500;">${t.nama_tempat}</span>
          </label>
      `,
    )
    .join("");

  openModal(
    "Generate Jadwal Praktik Otomatis",
    `
          <form id="form-generate-jadwal" class="animate-fade-in">
              <div class="grid-cards" style="grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:0;">
                  <div class="form-group">
                      <label>Tanggal Mulai</label>
                      <input type="date" id="gen-start-date" required class="form-control" value="${new Date().toISOString().split("T")[0]}">
                  </div>
                  <div class="form-group">
                      <label>Tanggal Selesai</label>
                      <input type="date" id="gen-end-date" required class="form-control" value="${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}">
                  </div>
              </div>

              <div class="grid-cards" style="grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:0;">
                  <div class="form-group">
                      <label>Jam Mulai (Shift 1)</label>
                      <input type="time" id="gen-start-time" required class="form-control" value="07:00">
                  </div>
                  <div class="form-group">
                      <label>Jumlah Shift per Hari</label>
                      <select id="gen-shift-count" class="form-control">
                          <option value="1">1 Shift (8 jam)</option>
                          <option value="2">2 Shift (12 jam)</option>
                          <option value="3" selected>3 Shift (8 jam)</option>
                      </select>
                  </div>
              </div>

              <div class="form-group">
                  <label>Pilih Lokasi Praktik yang Aktif</label>
                  <div style="max-height: 180px; overflow-y: auto; padding-right:5px;">
                      ${lokasiOptions}
                  </div>
              </div>

              <div class="alert bg-primary-soft p-3 rounded mb-3" style="border-radius:12px;">
                  <i class="fa-solid fa-circle-info text-primary"></i> 
                  Sistem akan membagi seluruh mahasiswa aktif ke lokasi & shift yang dipilih secara merata.
              </div>

              <label class="d-flex align-center gap-2 mb-4" style="cursor:pointer;">
                  <input type="checkbox" id="gen-clear-existing" style="width:18px; height:18px;">
                  <span class="text-danger" style="font-weight:600; font-size:0.9rem;">Hapus/Reset Seluruh Jadwal Lama Sebelum Generate</span>
              </label>

              <button type="submit" class="btn btn-primary btn-block">
                  <i class="fa-solid fa-calendar-check"></i> Eksekusi & Generate Sekarang
              </button>
          </form>
      `,
  );

  document.getElementById("form-generate-jadwal").onsubmit = async (e) => {
    e.preventDefault();

    const locIds = Array.from(
      document.querySelectorAll('input[name="gen-locations"]:checked'),
    ).map((cb) => cb.value);
    if (locIds.length === 0)
      return showToast(
        "Peringatan",
        "Pilih minimal satu lokasi praktik",
        "warning",
      );

    const payload = {
      startDate: document.getElementById("gen-start-date").value,
      endDate: document.getElementById("gen-end-date").value,
      startTime: document.getElementById("gen-start-time").value,
      shiftCount: document.getElementById("gen-shift-count").value,
      locationIds: locIds,
      clearExisting: document.getElementById("gen-clear-existing").checked,
    };

    if (
      confirm(
        "Generate jadwal akan menghapus/menambah data jadwal baru. Lanjutkan?",
      )
    ) {
      const genRes = await postAPI("generateJadwal", payload);
      if (genRes.success) {
        closeModal();
        showToast(
          "Sukses",
          genRes.message || "Jadwal praktik berhasil disusun secara otomatis",
          "success",
        );
        loadView("jadwalAdminView");
      } else {
        showToast(
          "Gagal Generate",
          genRes.message || "Terjadi kesalahan saat membuat jadwal",
          "error",
        );
      }
    }
  };
};

// Toggle Sidebar Mobile
document.getElementById("toggle-sidebar").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});
document.getElementById("close-sidebar").addEventListener("click", () => {
  document.getElementById("sidebar").classList.remove("open");
});
document.querySelector(".close-modal").addEventListener("click", closeModal);
document.querySelector(".modal-backdrop").addEventListener("click", closeModal);

// Init
window.addEventListener("DOMContentLoaded", () => {
  checkAuth();
});

// ============ QR CODE GENERATOR ============
window.bukaModalQRCode = (namaLahan) => {
  openModal(
    "QR Code Lahan Praktik",
    `
          <div class="text-center w-100 d-flex flex-column align-center justify-center py-4">
              <h4 class="mb-4 text-primary" style="font-size:1.3rem;">${namaLahan}</h4>
              <div id="qrcode-render-area" style="background:#fff; padding:1.5rem; border-radius:12px; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); display:inline-block; margin-bottom:1.5rem;"></div>
              <p class="text-muted text-sm px-4 mb-4">Cetak QR Code ini dan tempelkan pada lokasi praktik agar dapat discan oleh mahasiswa saat instruksi Check-In/Check-Out.</p>
              <div class="d-flex gap-2 w-100 justify-center">
                  <button class="btn btn-primary" onclick="downloadQRCode('${namaLahan}')">
                      <i class="fa-solid fa-download"></i> Unduh / Simpan Gambar
                  </button>
                  <button class="btn btn-outline" onclick="printQRCode('${namaLahan}')">
                      <i class="fa-solid fa-print"></i> Cetak Langsung
                  </button>
              </div>
          </div>
      `,
  );

  // Give DOM time to render the modal area before generating QR
  setTimeout(() => {
    const qrArea = document.getElementById("qrcode-render-area");
    if (qrArea) {
      qrArea.innerHTML = "";
      new QRCode(qrArea, {
        text: namaLahan,
        width: 250,
        height: 250,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H,
      });
    }
  }, 150);
};

window.downloadQRCode = (namaLahan) => {
  const canvas = document.querySelector("#qrcode-render-area canvas");
  if (canvas) {
    const link = document.createElement("a");
    link.download = `QRCode_Lahan_${namaLahan.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
};

window.printQRCode = (namaLahan) => {
  const canvas = document.querySelector("#qrcode-render-area canvas");
  if (!canvas) return;
  const dataUrl = canvas.toDataURL();
  const printWindow = window.open("", "", "width=600,height=600");
  // Inline HTML to print the canvas image directly
  printWindow.document.write(`
          <html>
              <head>
                  <title>Print QR Code - ${namaLahan}</title>
                  <style>
                      body { text-align:center; font-family:sans-serif; padding-top:40px; }
                      h2 { margin-bottom:10px; font-size:24px; }
                      h3 { color:#6d28d9; margin-bottom:30px; font-size:20px; }
                      img { width:350px; height:350px; border:2px solid #ccc; padding:20px; border-radius:16px; margin:0 auto; display:block; }
                      p { margin-top:40px; color:#666; font-size:14px; }
                      @media print {
                          img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                      }
                  </style>
              </head>
              <body>
                  <h2>QR CODE PRESENSI</h2>
                  <h3>${namaLahan}</h3>
                  <img src="${dataUrl}" onload="window.print(); window.close();" />
                  <p>Gunakan Aplikasi E-Logbook Klinik untuk memindai kode absensi ini.</p>
              </body>
          </html>
      `);
  printWindow.document.close();
};

window.bukaModalSemuaQRCode = async () => {
  showLoader(true);
  const resTempat = await fetchAPI("getTempat");
  showLoader(false);

  if (!resTempat.success || !resTempat.data || resTempat.data.length === 0) {
    return showToast(
      "Gagal",
      "Tidak ada data lahan praktik untuk di-generate.",
      "warning",
    );
  }

  const daftarLahan = resTempat.data;

  openModal(
    "Generate Semua QR Code Lahan",
    `
          <div class="py-4">
              <div class="card bg-primary-soft mb-4 border-primary">
                  <div class="card-body d-flex justify-between align-center">
                      <div>
                          <h4 class="m-0 text-primary">Cetak Kolektif QR Code</h4>
                          <p class="m-0 text-sm text-muted">Total ${daftarLahan.length} Lahan Praktik terdeteksi.</p>
                      </div>
                      <button class="btn btn-primary" onclick="cetakSemuaQRCode()">
                          <i class="fa-solid fa-print"></i> Cetak Semua QR
                      </button>
                  </div>
              </div>
              
              <div id="bulk-qrcode-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem;">
                  <!-- QR Codes will be rendered here -->
              </div>
          </div>
      `,
  );

  // Delay briefly for DOM rendering
  setTimeout(() => {
    const gridArea = document.getElementById("bulk-qrcode-grid");
    if (!gridArea) return;

    gridArea.innerHTML = daftarLahan
      .map(
        (l) => `
              <div class="stat-card" style="flex-direction:column; padding:1.5rem; text-align:center;">
                  <div id="qr-bulk-${l.id}" style="margin:0 auto 1rem; background:#fff; padding:10px; border-radius:8px; border:1px solid #eee;"></div>
                  <strong style="font-size:0.9rem;">${l.nama_tempat}</strong>
              </div>
          `,
      )
      .join("");

    // Generate QR for each
    daftarLahan.forEach((l) => {
      new QRCode(document.getElementById(`qr-bulk-${l.id}`), {
        text: l.nama_tempat,
        width: 150,
        height: 150,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H,
      });
    });
  }, 200);
};

window.cetakSemuaQRCode = async () => {
  const resTempat = await fetchAPI("getTempat");
  if (!resTempat.success || !resTempat.data) return;

  const daftarLahan = resTempat.data;
  const printWindow = window.open("", "", "width=850,height=900");

  let htmlContent = `
          <html>
              <head>
                  <title>Cetak Semua QR Code Presensi</title>
                  <style>
                      body { font-family: sans-serif; padding: 20px; }
                      .qr-container { 
                          display: inline-block; 
                          width: 45%; 
                          margin: 2%; 
                          padding: 20px; 
                          border: 1px dashed #ccc; 
                          text-align: center; 
                          page-break-inside: avoid;
                          vertical-align: top;
                      }
                      .qr-box { margin: 20px auto; }
                      h2 { font-size: 18px; margin-bottom: 5px; }
                      p { font-size: 12px; color: #666; }
                      @media print {
                          .qr-container { border: 1px solid #eee; }
                      }
                  </style>
                  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
              </head>
              <body>
                  <h1 style="text-align:center;">Daftar QR Code Presensi Lahan</h1>
                  <div id="print-area"></div>
                  <script>
                      const lahan = ${JSON.stringify(daftarLahan)};
                      const area = document.getElementById('print-area');
                      
                      lahan.forEach(l => {
                          const div = document.createElement('div');
                          div.className = 'qr-container';
                          div.innerHTML = '<h2>' + l.nama_tempat + '</h2><div id="qr-' + l.id + '" class="qr-box"></div><p>E-Logbook Klinik - QR Presensi</p>';
                          area.appendChild(div);
                          
                          new QRCode(document.getElementById('qr-' + l.id), {
                              text: l.nama_tempat,
                              width: 250,
                              height: 250
                          });
                      });

                      window.onload = () => {
                          setTimeout(() => {
                              window.print();
                              // window.close();
                          }, 1000);
                      };
                  </script>
              </body>
          </html>
      `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

// NOTIFICATION LOGIC
async function updateNotifBadge() {
  // Direct call without loader to prevent flickering
  try {
    const res = await supabaseFetchAPI("getNotif", {
      user_id: currentUser.id,
      role: currentUser.role,
      tempat_id: currentUser.tempat_id,
    });
    const badge = document.getElementById("notif-count");
    const ping = document.getElementById("notif-ping");
    if (!badge || !ping) return;

    if (res.success && res.data && res.data.length > 0) {
      badge.textContent = res.data.length;
      badge.classList.remove("hidden");
      ping.style.display = "block";
    } else {
      badge.classList.add("hidden");
      ping.style.display = "none";
    }
  } catch (e) {
    console.warn("Notif badge update skipped:", e.message);
  }
}

window.bukaModalNotifikasi = async () => {
  showLoader(true);
  const res = await fetchAPI("getNotif", {
    user_id: currentUser.id,
    role: currentUser.role,
    tempat_id: currentUser.tempat_id,
  });
  showLoader(false);

  let html = `
          <div class="animate-fade-in" style="min-width:350px;">
              <div class="d-flex justify-between align-center mb-3">
                  <h4 class="m-0"><i class="fa-solid fa-bell text-warning"></i> Notifikasi Terbaru</h4>
                  <button class="btn btn-xs btn-outline" onclick="updateNotifBadge(); bukaModalNotifikasi();"><i class="fa-solid fa-rotate"></i> Refresh</button>
              </div>
              <div id="notif-list-modal" style="max-height:400px; overflow-y:auto; border-top:1px solid #eee; padding-top:10px;">
      `;

  if (res.success && res.data && res.data.length > 0) {
    html += res.data
      .map((n) => {
        let title = "",
          desc = "",
          icon = "fa-info-circle";
        if (currentUser.role === "admin") {
          title = `Laporan ${escapeHTML(n.tipe_kejadian)}`;
          desc = `Pelapor: ${escapeHTML(n.nama_pelapor)}`;
          icon = "fa-triangle-exclamation";
        } else if (currentUser.role.includes("preseptor")) {
          title = "Logbook Menunggu Validasi";
          desc = `${escapeHTML(n.kompetensi)} oleh Student ${escapeHTML(n.user_id)}`;
          icon = "fa-file-invoice";
        } else {
          const isApproved = n.status === "Disetujui";
          title = `Logbook ${isApproved ? "Disetujui" : "Ditolak"}`;
          desc = `${escapeHTML(n.kompetensi)} - ${escapeHTML(n.feedback || "Tanpa catatan")}`;
          icon = isApproved ? "fa-circle-check" : "fa-circle-xmark";
        }
        return `
                  <div class="p-3 border-bottom hover-bg-light" style="cursor:pointer;" onclick="closeModal(); ${currentUser.role === "admin" ? "loadView('adminLaporanView')" : currentUser.role.includes("preseptor") ? "loadView('validasiView')" : "loadView('logbookView')"}">
                      <div class="d-flex align-start gap-3">
                          <div class="bg-light p-2 rounded-lg text-primary"><i class="fa-solid ${icon}"></i></div>
                          <div>
                              <div class="text-sm font-bold text-slate-800">${title}</div>
                              <div class="text-xs text-slate-500">${desc}</div>
                              <div class="text-xs text-slate-400 mt-1">${formatRelativeTime(n.created_at)}</div>
                          </div>
                      </div>
                  </div>
              `;
      })
      .join("");
  } else {
    html += `<div class="text-center py-5 text-muted">Belum ada notifikasi baru untuk Anda.</div>`;
  }

  html += `</div></div>`;
  openModal("Sesi Pemberitahuan", html);
};

function formatRelativeTime(dateStr) {
  const now = new Date();
  const then = new Date(dateStr);
  const diff = Math.floor((now - then) / 1000); // seconds
  if (diff < 60) return "Baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return then.toLocaleDateString("id-ID");
}

// PRESEPTOR: SCAN MAHASISWA (QUICK IDENTITY)
window.bukaModalScanMhs = () => {
  openModal(
    "Scan Identitas Mahasiswa",
    `
      <div class="animate-fade-in text-center">
          <div id="reader-mhs" style="width: 100%; max-width: 400px; margin: 0 auto; border-radius: 12px; overflow: hidden;"></div>
          <div id="mhs-scan-result" class="mt-4">
              <div class="alert bg-light border p-4 text-muted">
                  <i class="fa-solid fa-qrcode fa-3x mb-3 d-block"></i>
                  <p>Arahkan kamera ke QR Code di aplikasi Mahasiswa untuk melihat profil & progres klinis mereka secara instan.</p>
              </div>
          </div>
          <button class="btn btn-outline btn-block mt-3" onclick="closeModal()">Tutup</button>
      </div>
      `,
  );

  const scanner = new Html5Qrcode("reader-mhs");
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };

  scanner
    .start(
      { facingMode: "environment" },
      config,
      async (decodedText) => {
        scanner.stop();
        document
          .getElementById("beep-sound")
          .play()
          .catch((e) => {});
        renderMiniProfile(decodedText);
      },
      (err) => {},
    )
    .catch((err) => {
      showToast("Error Kamera", "Gagal mengakses kamera.", "error");
    });

  const renderMiniProfile = async (identifier) => {
    const resultArea = document.getElementById("mhs-scan-result");
    resultArea.innerHTML = `<div class="p-5 text-center"><i class="fa-solid fa-spinner fa-spin fa-2x text-primary"></i><br>Mencari data...</div>`;

    const res = await fetchAPI("getStudentMiniProfile", { identifier });
    if (res.success && res.data) {
      const u = res.data;
      resultArea.innerHTML = `
              <div class="card shadow-sm border-primary animate-fade-in" style="background:var(--primary-light); border-left: 5px solid var(--primary);">
                  <div class="card-body">
                      <div class="d-flex align-center gap-3 mb-3">
                          <div style="width:60px; height:60px; border-radius:12px; background:white; color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1.5rem; box-shadow:0 4px 6px rgba(0,0,0,0.1)">
                              ${u.nama.charAt(0)}
                          </div>
                          <div class="text-left">
                              <h4 class="mb-0 font-bold" style="color:var(--text-strong)">${u.nama}</h4>
                              <div class="badge bg-primary text-white">${u.username}</div>
                          </div>
                      </div>
                      <div class="grid-cards" style="grid-template-columns: 1fr 1fr; gap:0.5rem;">
                          <div class="bg-white p-2 text-left" style="border-radius:8px;">
                              <div class="text-xs text-muted">Program Studi</div>
                              <div class="font-bold text-sm">${u.prodi}</div>
                          </div>
                          <div class="bg-white p-2 text-left" style="border-radius:8px;">
                              <div class="text-xs text-muted">Angkatan</div>
                              <div class="font-bold text-sm">2022</div>
                          </div>
                      </div>
                  </div>
              </div>
              <button class="btn btn-primary btn-block mt-3" onclick="closeModal(); loadView('mahasiswaView');">Buka Detail Penilaian</button>
          `;
    } else {
      resultArea.innerHTML = `<div class="alert bg-danger-soft text-danger p-4">Mahasiswa tidak ditemukan atau QR tidak valid.</div>`;
    }
  };
};

// MAHASISWA: QR IDENTITY CARD
window.bukaModalMyQR = () => {
  openModal(
    "Identity QR Mahasiswa",
    `
          <div class="p-4 text-center">
              <div class="alert bg-primary-soft text-primary mb-4" style="border-radius:12px; font-size:0.85rem">
                  <i class="fa-solid fa-info-circle"></i> Tunjukkan QR ini kepada Preseptor untuk proses identifikasi cepat / verifikasi profil.
              </div>
              <div id="my-qr-render" style="margin: 0 auto 1.5rem; background:white; padding:1.5rem; border-radius:16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); display:inline-block;"></div>
              <div class="font-bold text-lg">${currentUser.nama}</div>
              <div class="text-muted text-sm mb-4">${currentUser.username}</div>
              <button class="btn btn-primary btn-block" onclick="closeModal()">Tutup</button>
          </div>
          `,
  );
  setTimeout(() => {
    new QRCode(document.getElementById("my-qr-render"), {
      text: currentUser.username,
      width: 250,
      height: 250,
      colorDark: "#0f172a",
      colorLight: "#ffffff",
    });
  }, 150);
};

// MAHASISWA: EKSPOR PDF LOGBOOK
window.exportLogbookPDF = async () => {
  showLoader(true);
  const res = await fetchAPI("getOfficialLogbook", { user_id: currentUser.id });
  showLoader(false);

  if (!res.success || !res.data || res.data.length === 0) {
    return showToast(
      "Gagal",
      "Belum ada logbook yang disetujui untuk diekspor.",
      "warning",
    );
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("LAPORAN LOGBOOK KLINIS MAHASISWA", 105, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nama Mahasiswa : ${currentUser.nama}`, 20, 35);
  doc.text(`NIM            : ${currentUser.username}`, 20, 41);
  doc.text(`Program Studi  : ${currentUser.prodi || "-"}`, 20, 47);
  doc.text(`Tanggal Cetak  : ${new Date().toLocaleString()}`, 20, 53);

  const tableData = res.data.map((r) => [
    r.tanggal,
    r.lahan,
    r.kompetensi,
    r.level,
    r.nilai || "-",
    r.feedback || "-",
  ]);

  doc.autoTable({
    startY: 60,
    head: [
      [
        "Tanggal",
        "Lahan",
        "Kompetensi",
        "Level",
        "Nilai",
        "Feedback Preseptor",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: { fillStyle: "var(--primary)" },
  });

  doc.save(
    `Logbook_Official_${currentUser.username}_${new Date().getTime()}.pdf`,
  );
};

// PRESEPTOR: KOMUNIKASI ANTAR-PRESEPTOR (PRIVATE COORDINATION LOG)
window.bukaModalPreceptorNotes = async (studentId, studentNama) => {
  showLoader(true);
  const res = await fetchAPI("getPreceptorNotes", { student_id: studentId });
  showLoader(false);

  openModal(
    `Koordinasi Bimbingan: ${studentNama}`,
    `
      <div class="animate-fade-in">
          <div class="alert bg-primary-soft text-primary p-3 mb-4" style="border-radius:12px; font-size:0.85rem">
              <i class="fa-solid fa-shield-halved"></i> <strong>Catatan Internal Dosen</strong><br>
              Gunakan area ini untuk berkoordinasi antara Preseptor Klinik & Akademik mengenai perkembangan sikap/keterampilan mahasiswa ini.
          </div>

          <div id="preceptor-notes-history" style="max-height:300px; overflow-y:auto; border-radius:12px; background:#f8fafc; padding:1rem; border:1px solid #e2e8f0;">
              ${renderNotesList(res.data || [])}
          </div>

          <form id="form-preceptor-note" class="mt-4">
              <div class="form-group">
                  <label>Tambah Catatan Baru</label>
                  <textarea id="pn-deskripsi" class="form-control" rows="3" placeholder="Tuliskan perkembangan bimbingan mahasiswa ini..." required></textarea>
              </div>
              <button type="submit" class="btn btn-primary btn-block">
                  <i class="fa-solid fa-paper-plane"></i> Simpan Catatan Koordinasi
              </button>
          </form>
      </div>
      `,
  );

  document.getElementById("form-preceptor-note").onsubmit = async (e) => {
    e.preventDefault();
    const deskripsi = document.getElementById("pn-deskripsi").value;
    showLoader(true);
    const postRes = await postAPI("saveReport", {
      student_id: studentId,
      user_id_pelapor: currentUser.id,
      nama_pelapor: currentUser.nama,
      role_pelapor: currentUser.role,
      tipe_kejadian: "Preceptor Note",
      deskripsi: deskripsi,
    });
    showLoader(false);

    if (postRes.success) {
      showToast("Berhasil", "Catatan koordinasi berhasil disimpan", "success");
      bukaModalPreceptorNotes(studentId, studentNama); // reload
    }
  };
};

function renderNotesList(notes) {
  if (notes.length === 0)
    return `<div class="text-center py-4 text-muted">Belum ada catatan bimbingan untuk mahasiswa ini.</div>`;

  return notes
    .map((n) => {
      const isMe = n.user_id_pelapor === currentUser.id;
      const roleLabel = n.role_pelapor?.includes("akademik")
        ? "AKADEMIK"
        : "KLINIK";
      const badgeColor = n.role_pelapor?.includes("akademik")
        ? "#f59e0b"
        : "#0ea5e9";

      return `
              <div class="mb-3 p-3 bg-white" style="border-radius:12px; ${isMe ? "border-right: 3px solid var(--primary);" : "border-left: 3px solid #64748b;"} box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <div class="d-flex justify-between align-center mb-1">
                      <strong style="font-size:0.8rem; color:var(--text-strong)">${n.nama_pelapor}</strong>
                      <span class="badge" style="background:${badgeColor}; color:white; font-size:0.6rem;">${roleLabel}</span>
                  </div>
                  <p class="m-0" style="font-size:0.9rem; color:#475569">${n.deskripsi}</p>
                  <div class="text-right text-xs text-muted mt-2">${formatRelativeTime(n.created_at)}</div>
              </div>
          `;
    })
    .join("");
}

// ADMIN: BROADCAST SYSTEM
window.eksekusiBroadcast = async () => {
  const msg = document.getElementById("bc-message").value;
  if (!msg)
    return showToast(
      "Kosong",
      "Tuliskan pesan pengumuman terlebih dahulu.",
      "warning",
    );

  showLoader(true);
  const res = await fetchAPI("updateBroadcast", { message: msg });
  showLoader(false);

  if (res.success) {
    showToast(
      "Berhasil",
      "Pengumuman telah disiarkan ke seluruh pengguna.",
      "success",
    );
    document.getElementById("bc-message").value = "";
    loadView("dashboardView");
  }
};
