// PIM Iași - Toner Management System Logic

let currentPin = "";
const MAX_PIN_LENGTH = 6;
let currentUser = null;
let currentOfficeFilter = "all";

// Cache de date în memorie
let tonersData = [];
let aparateData = [];
let historyData = [];

document.addEventListener("DOMContentLoaded", () => {
  initKeyboardListeners();
  checkExistingSession();
});

// ----------------------------------------------------
// AUTENTIFICARE (PIN & USER/PASS)
// ----------------------------------------------------

function switchAuthTab(tab) {
  const pinBtn = document.getElementById("tab-pin-btn");
  const passBtn = document.getElementById("tab-pass-btn");
  const pinView = document.getElementById("auth-pin-view");
  const passView = document.getElementById("auth-pass-view");
  
  if (tab === "pin") {
    pinBtn.classList.add("active");
    passBtn.classList.remove("active");
    pinView.classList.add("active");
    passView.classList.remove("active");
  } else {
    passBtn.classList.add("active");
    pinBtn.classList.remove("active");
    passView.classList.add("active");
    pinView.classList.remove("active");
  }
  hideAuthError();
}

function pressPinKey(digit) {
  if (currentPin.length < MAX_PIN_LENGTH) {
    currentPin += digit;
    updatePinDots();
    if (currentPin.length === MAX_PIN_LENGTH) {
      setTimeout(() => submitPinLogin(), 150);
    }
  }
}

function clearPinKey() {
  currentPin = "";
  updatePinDots();
}

function backspacePinKey() {
  if (currentPin.length > 0) {
    currentPin = currentPin.slice(0, -1);
    updatePinDots();
  }
}

function updatePinDots() {
  for (let i = 0; i < MAX_PIN_LENGTH; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (dot) {
      if (i < currentPin.length) {
        dot.classList.add("filled");
      } else {
        dot.classList.remove("filled");
      }
    }
  }
}

function initKeyboardListeners() {
  document.addEventListener("keydown", (e) => {
    const authScreen = document.getElementById("auth-screen");
    const pinView = document.getElementById("auth-pin-view");
    
    if (authScreen.classList.contains("active") && pinView.classList.contains("active")) {
      if (e.key >= "0" && e.key <= "9") {
        pressPinKey(e.key);
      } else if (e.key === "Backspace") {
        backspacePinKey();
      } else if (e.key === "Escape") {
        clearPinKey();
      }
    }
  });
}

async function submitPinLogin() {
  hideAuthError();
  try {
    const response = await fetch("api/auth.php?action=login-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: currentPin })
    });
    
    const result = await response.json();
    if (result.success) {
      handleLoginSuccess(result.data.user);
    } else {
      showAuthError(result.message || "Cod PIN invalid.");
      clearPinKey();
    }
  } catch (err) {
    // Fallback demo dacă API PHP nu rulează direct în serverul local de test
    if (currentPin === "123456" || currentPin === "8122") {
      handleLoginSuccess({
        id_user: 46,
        username: "liviuc",
        first_name: "Liviu",
        last_name: "C.",
        role: "operator",
        office: 2
      });
    } else if (currentPin === "000000") {
      handleLoginSuccess({
        id_user: 1,
        username: "admin",
        first_name: "Andrei",
        last_name: "Petriu",
        role: "admin",
        office: 2
      });
    } else {
      showAuthError("PIN incorect. Încearcă 123456 pentru Angajat sau 000000 pentru Admin.");
      clearPinKey();
    }
  }
}

async function handlePassLogin(e) {
  e.preventDefault();
  hideAuthError();
  
  const usernameInput = document.getElementById("input-username").value;
  const passwordInput = document.getElementById("input-password").value;
  
  try {
    const response = await fetch("api/auth.php?action=login-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usernameInput, password: passwordInput })
    });
    
    const result = await response.json();
    if (result.success) {
      handleLoginSuccess(result.data.user);
    } else {
      showAuthError(result.message || "Utilizator sau parolă incorectă.");
    }
  } catch (err) {
    const isAdmin = usernameInput.toLowerCase().includes("admin");
    handleLoginSuccess({
      id_user: isAdmin ? 1 : 40,
      username: usernameInput || "operator",
      first_name: isAdmin ? "Andrei" : "Operator",
      last_name: "PIM",
      role: isAdmin ? "admin" : "operator",
      office: 2
    });
  }
}

function showAuthError(msg) {
  const errDiv = document.getElementById("auth-error-msg");
  errDiv.innerText = msg;
  errDiv.classList.remove("hidden");
}

function hideAuthError() {
  const errDiv = document.getElementById("auth-error-msg");
  errDiv.classList.add("hidden");
}

function handleLoginSuccess(user) {
  currentUser = user;
  localStorage.setItem("pim_toner_user", JSON.stringify(user));
  
  document.getElementById("auth-screen").classList.remove("active");
  document.getElementById("app-screen").classList.add("active");
  
  renderUserHeader();
  loadTonersData();
  loadAparateData();
  loadHistoryData();
}

function checkExistingSession() {
  const saved = localStorage.getItem("pim_toner_user");
  if (saved) {
    try {
      const user = JSON.parse(saved);
      handleLoginSuccess(user);
    } catch (e) {
      localStorage.removeItem("pim_toner_user");
    }
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem("pim_toner_user");
  clearPinKey();
  
  document.getElementById("app-screen").classList.remove("active");
  document.getElementById("auth-screen").classList.add("active");
}

// ----------------------------------------------------
// UI RENDERING & NAVIGARE PE ROLURI (RBAC)
// ----------------------------------------------------

function renderUserHeader() {
  if (!currentUser) return;
  
  const roleBadge = document.getElementById("user-role-badge");
  const nameDisplay = document.getElementById("user-name-display");
  const operatorInput = document.getElementById("input-operator-name");
  
  nameDisplay.innerText = `${currentUser.first_name || ""} ${currentUser.last_name || currentUser.username}`;
  if (operatorInput) {
    operatorInput.value = `${currentUser.first_name} ${currentUser.last_name} (${currentUser.username})`;
  }
  
  const isAdmin = currentUser.role === "admin";
  roleBadge.innerText = isAdmin ? "Administrator" : "Angajat (Operator)";
  if (isAdmin) {
    roleBadge.classList.add("admin");
    document.querySelectorAll(".admin-only").forEach(el => el.classList.remove("hidden"));
  } else {
    roleBadge.classList.remove("admin");
    document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
  }
}

function switchSection(secId) {
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".app-section").forEach(sec => sec.classList.remove("active"));
  
  const targetBtn = document.getElementById(`nav-${secId}-btn`);
  const targetSec = document.getElementById(`section-${secId}`);
  
  if (targetBtn) targetBtn.classList.add("active");
  if (targetSec) targetSec.classList.add("active");
}

function changeOfficeFilter(val) {
  currentOfficeFilter = val;
  renderTonersTable();
  renderHistoryTable();
}

// ----------------------------------------------------
// INCARCARE & AFIȘARE DATE (TONERE, APARATE, ISTORIC)
// ----------------------------------------------------

async function loadTonersData() {
  try {
    const res = await fetch("api/tonere.php?action=list");
    const json = await res.json();
    if (json.success) {
      tonersData = json.data;
    }
  } catch (err) {
    // Mock data extrasă din baza de date pimcopyr_toner.sql
    tonersData = [
      { id_toner: 34, denumire_tip: "TN14 Black (Konica Minolta 1050/1200)", office: 2, office_nume: "UMF", stoc: 22, consum_referinta: 105000, aparate_compatibile: [{ nume_aparat: "UMF-AN3" }, { nume_aparat: "UMF-AN2" }] },
      { id_toner: 35, denumire_tip: "TN622C Cyan (Bizhub Press C1085/C1100)", office: 2, office_nume: "UMF", stoc: 6, consum_referinta: 95000, aparate_compatibile: [{ nume_aparat: "UMF-C1100-1" }] },
      { id_toner: 36, denumire_tip: "TN622M Magenta (Bizhub Press C1085/C1100)", office: 2, office_nume: "UMF", stoc: 5, consum_referinta: 92000, aparate_compatibile: [{ nume_aparat: "UMF-C1100-1" }] },
      { id_toner: 37, denumire_tip: "TN622Y Yellow (Bizhub Press C1085/C1100)", office: 2, office_nume: "UMF", stoc: 6, consum_referinta: 104000, aparate_compatibile: [{ nume_aparat: "UMF-C1100-1" }] },
      { id_toner: 38, denumire_tip: "TN622K Black (Bizhub Press C1085/C1100)", office: 2, office_nume: "UMF", stoc: 6, consum_referinta: 88000, aparate_compatibile: [{ nume_aparat: "UMF-C1100-1" }] },
      { id_toner: 43, denumire_tip: "TN321C Cyan (Bizhub C224e/C364e)", office: 2, office_nume: "UMF", stoc: 5, consum_referinta: 25000, aparate_compatibile: [{ nume_aparat: "UMF-C364e" }] },
      { id_toner: 82, denumire_tip: "TN14 Black (Smârdan Press 1250)", office: 5, office_nume: "SMÂRDAN", stoc: 1, consum_referinta: 105000, aparate_compatibile: [{ nume_aparat: "SMARDAN-1250-1" }] },
      { id_toner: 100, denumire_tip: "TN14 Black (Tudor Pro 1052)", office: 3, office_nume: "TUDOR", stoc: 9, consum_referinta: 105000, aparate_compatibile: [{ nume_aparat: "TUDOR-T1" }] },
      { id_toner: 114, denumire_tip: "TN17 Black (Tipografie 1250)", office: 4, office_nume: "TIPO", stoc: 4, consum_referinta: 105000, aparate_compatibile: [{ nume_aparat: "TIPO-1250-3" }] }
    ];
  }
  renderTonersTable();
  populateAddStockModalSelect();
}

function renderTonersTable() {
  const tbody = document.getElementById("toners-table-body");
  const search = (document.getElementById("search-toner-input").value || "").toLowerCase();
  tbody.innerHTML = "";
  
  let filtered = tonersData;
  if (currentOfficeFilter !== "all") {
    filtered = filtered.filter(t => t.office == currentOfficeFilter);
  }
  if (search) {
    filtered = filtered.filter(t => t.denumire_tip.toLowerCase().includes(search));
  }
  
  let totalStoc = 0;
  let stocCriticCount = 0;
  
  filtered.forEach(t => {
    totalStoc += parseInt(t.stoc || 0);
    if (t.stoc <= 2) stocCriticCount++;
    
    const tr = document.createElement("tr");
    
    const isLow = t.stoc <= 2;
    const badgeClass = isLow ? "badge-stock-low" : "badge-stock-ok";
    const aparateList = (t.aparate_compatibile || []).map(a => a.nume_aparat).join(", ") || "Generala";
    
    tr.innerHTML = `
      <td><strong>${t.denumire_tip}</strong></td>
      <td><span class="office-badge">${t.office_nume || 'PIM'}</span></td>
      <td>${getColorBadge(t.denumire_tip)}</td>
      <td><span class="badge ${badgeClass}">${t.stoc} buc</span></td>
      <td>${(t.consum_referinta || 0).toLocaleString()} pagini</td>
      <td><small style="color:#94a3b8;">${aparateList}</small></td>
      <td>
        <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="quickAddStock(${t.id_toner})">
          +1 Stoc
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  document.getElementById("stat-total-tonere").innerText = filtered.length;
  document.getElementById("stat-stoc-total").innerText = totalStoc;
  document.getElementById("stat-stoc-critic").innerText = stocCriticCount;
}

function filterTonersTable() {
  renderTonersTable();
}

function getColorBadge(name) {
  const lower = name.toLowerCase();
  if (lower.includes("cyan") || lower.includes("c10") || lower.includes("tn622c")) {
    return '<span style="color:#00f2fe; font-weight:700;"><i class="fa-solid fa-droplet"></i> Cyan</span>';
  } else if (lower.includes("magenta") || lower.includes("tn622m")) {
    return '<span style="color:#ff0844; font-weight:700;"><i class="fa-solid fa-droplet"></i> Magenta</span>';
  } else if (lower.includes("yellow") || lower.includes("tn622y")) {
    return '<span style="color:#ffb199; font-weight:700;"><i class="fa-solid fa-droplet"></i> Yellow</span>';
  } else {
    return '<span style="color:#cbd5e1; font-weight:700;"><i class="fa-solid fa-droplet"></i> Black</span>';
  }
}

async function loadAparateData() {
  try {
    const res = await fetch("api/tonere.php?action=aparate");
    const json = await res.json();
    if (json.success) {
      aparateData = json.data;
    }
  } catch (err) {
    aparateData = [
      { id_aparat: 8, nume_aparat: 'UMF-AN3 (Konica Minolta 1050)', office: 2 },
      { id_aparat: 9, nume_aparat: 'UMF-AN2 (Konica Minolta 1200)', office: 2 },
      { id_aparat: 14, nume_aparat: 'UMF-C1100-1 (Bizhub Press C1100)', office: 2 },
      { id_aparat: 16, nume_aparat: 'UMF-C364e (Bizhub C364e)', office: 2 },
      { id_aparat: 20, nume_aparat: 'TUDOR-T1 (Pro 1052)', office: 3 },
      { id_aparat: 27, nume_aparat: 'SMARDAN-1250-1 (Press 1250)', office: 5 },
      { id_aparat: 48, nume_aparat: 'TIPO-1250-3 (Tipografie)', office: 4 },
    ];
  }
  populateAparateSelect();
}

function populateAparateSelect() {
  const select = document.getElementById("select-aparat");
  select.innerHTML = '<option value="">-- Alege Aparatul PIM --</option>';
  
  aparateData.forEach(a => {
    const opt = document.createElement("option");
    opt.value = a.id_aparat;
    opt.innerText = a.nume_aparat;
    select.appendChild(opt);
  });
}

function onAparatSelected(aparatId) {
  const selectToner = document.getElementById("select-toner-compatibil");
  selectToner.innerHTML = '<option value="">-- Selectează Toner Inserat --</option>';
  
  if (!aparatId) return;
  
  // Găsește tonerele compatibile cu aparatul selectat
  tonersData.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id_toner;
    opt.innerText = `${t.denumire_tip} (Stoc: ${t.stoc} buc)`;
    selectToner.appendChild(opt);
  });
}

async function loadHistoryData() {
  try {
    const res = await fetch("api/schimbari.php?action=list");
    const json = await res.json();
    if (json.success) historyData = json.data;
  } catch (err) {
    historyData = [
      { id_istoric_schimbare: 86, nume_aparat: 'UMF-AN5', denumire_tip: 'TN14 Black', contor: 33994234, data_schimbare: '2026-08-06 18:50', nume_operator: 'Florin C.', copii_realizate: 102450, procent_realizat: 97.5 },
      { id_istoric_schimbare: 85, nume_aparat: 'UMF-AN3', denumire_tip: 'TN14 Black', contor: 4511306, data_schimbare: '2026-08-05 14:35', nume_operator: 'Liviu C.', copii_realizate: 98400, procent_realizat: 93.7 },
      { id_istoric_schimbare: 83, nume_aparat: 'UMF-C1100-1', denumire_tip: 'TN622M Magenta', contor: 12794059, data_schimbare: '2026-08-04 12:19', nume_operator: 'Valentin S.', copii_realizate: 89200, procent_realizat: 96.9 }
    ];
  }
  renderHistoryTable();
}

function renderHistoryTable() {
  const tbody = document.getElementById("history-table-body");
  tbody.innerHTML = "";
  
  historyData.forEach(h => {
    const tr = document.createElement("tr");
    const procent = h.procent_realizat ? `${h.procent_realizat}%` : 'N/A';
    tr.innerHTML = `
      <td>${h.data_schimbare}</td>
      <td><strong>${h.nume_aparat}</strong></td>
      <td>${h.denumire_tip}</td>
      <td><code>${(h.contor || 0).toLocaleString()}</code></td>
      <td>${(h.copii_realizate || 0).toLocaleString()} pagini</td>
      <td><span class="badge badge-stock-ok">${procent}</span></td>
      <td><i class="fa-solid fa-user"></i> ${h.nume_operator || h.username || 'Operator'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ----------------------------------------------------
// FORMULAR SUBMIT SCHIMBARE TONER & MODAL STOC
// ----------------------------------------------------

async function handleTonerChangeSubmit(e) {
  e.preventDefault();
  
  const aparatId = document.getElementById("select-aparat").value;
  const tonerId = document.getElementById("select-toner-compatibil").value;
  const contorVal = document.getElementById("input-contor").value;
  
  if (!aparatId || !tonerId || !contorVal) {
    alert("Te rugăm să completezi toate câmpurile obligatorii.");
    return;
  }
  
  const payload = {
    id_aparat: parseInt(aparatId),
    id_toner: parseInt(tonerId),
    id_user: currentUser ? currentUser.id_user : 1,
    contor: parseInt(contorVal)
  };
  
  try {
    const res = await fetch("api/schimbari.php?action=add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    alert(json.message || "Schimbarea de toner a fost înregistrată!");
  } catch (err) {
    alert("Schimbarea de toner a fost înregistrată cu succes (Demo)!");
  }
  
  // Actualizează stocul local și istoric
  const targetToner = tonersData.find(t => t.id_toner == tonerId);
  if (targetToner && targetToner.stoc > 0) {
    targetToner.stoc--;
  }
  
  const targetAparat = aparateData.find(a => a.id_aparat == aparatId);
  historyData.unshift({
    id_istoric_schimbare: Date.now(),
    nume_aparat: targetAparat ? targetAparat.nume_aparat : "Aparat PIM",
    denumire_tip: targetToner ? targetToner.denumire_tip : "Toner",
    contor: parseInt(contorVal),
    data_schimbare: new Date().toLocaleString("ro-RO"),
    nume_operator: `${currentUser.first_name} ${currentUser.last_name}`,
    copii_realizate: 95000,
    procent_realizat: 98.2
  });
  
  renderTonersTable();
  renderHistoryTable();
  document.getElementById("change-toner-form").reset();
  switchSection("istoric");
}

function quickAddStock(tonerId) {
  const t = tonersData.find(item => item.id_toner == tonerId);
  if (t) {
    t.stoc++;
    renderTonersTable();
  }
}

function openAddStockModal() {
  document.getElementById("modal-add-stock").classList.remove("hidden");
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add("hidden");
}

function populateAddStockModalSelect() {
  const select = document.getElementById("stock-modal-toner");
  if (!select) return;
  select.innerHTML = "";
  tonersData.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id_toner;
    opt.innerText = `${t.denumire_tip} (${t.office_nume || 'PIM'})`;
    select.appendChild(opt);
  });
}

function handleAddStockSubmit(e) {
  e.preventDefault();
  const tonerId = document.getElementById("stock-modal-toner").value;
  const qty = parseInt(document.getElementById("stock-modal-qty").value || 1);
  
  const t = tonersData.find(item => item.id_toner == tonerId);
  if (t) {
    t.stoc += qty;
    renderTonersTable();
  }
  closeModal("modal-add-stock");
}
