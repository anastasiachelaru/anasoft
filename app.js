// PIM Iași - Toner Management System & Wizard Logic

let currentPin = "";
const MAX_PIN_LENGTH = 6;
let currentUser = null;
let currentOfficeFilter = "all";

// Cache de date în memorie
let tonersData = [];
let aparateData = [];
let historyData = [];

// Stare Asistent Wizard
let wizardCurrentStep = 1;
let wizardSelectedAparat = null;
let wizardSelectedToner = null;
let wizardIndexVechi = 0;
let wizardConsumRef = 105000;
let wizardMinAllowed = 0;
let wizardMaxAllowed = 0;

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
    // Fallback demo
    if (currentPin === "123456" || currentPin === "8122") {
      handleLoginSuccess({
        id_user: 46,
        username: "poturuandreea",
        first_name: "Andreea",
        last_name: "Poturu",
        role: "operator",
        office: 4 // Tipografie (TIPO)
      });
    } else if (currentPin === "000000") {
      handleLoginSuccess({
        id_user: 1,
        username: "admin",
        first_name: "Admin",
        last_name: "PIM",
        role: "admin",
        office: 2
      });
    } else {
      showAuthError("PIN incorect. Încearcă 123456 pentru Operator sau 000000 pentru Admin.");
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
      username: usernameInput || "poturuandreea",
      first_name: isAdmin ? "Admin" : "Andreea",
      last_name: "Poturu",
      role: isAdmin ? "admin" : "operator",
      office: 4
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
  
  nameDisplay.innerText = `${currentUser.first_name || ""} ${currentUser.last_name || currentUser.username}`;
  
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
// INCARCARE & AFIȘARE DATE
// ----------------------------------------------------

async function loadTonersData() {
  try {
    const res = await fetch("api/tonere.php?action=list");
    const json = await res.json();
    if (json.success) {
      tonersData = json.data;
    }
  } catch (err) {
    tonersData = [
      { id_toner: 34, denumire_tip: "TN14", office: 4, office_nume: "TIPO", stoc: 22, consum_referinta: 105000, aparate_compatibile: [{ nume_aparat: "TIPO-2250-5-ST" }, { nume_aparat: "TIPO-2250-5-DR" }] },
      { id_toner: 35, denumire_tip: "TN622C Cyan", office: 2, office_nume: "UMF", stoc: 6, consum_referinta: 95000, aparate_compatibile: [{ nume_aparat: "UMF-C1100-1" }] },
      { id_toner: 36, denumire_tip: "TN622M Magenta", office: 2, office_nume: "UMF", stoc: 5, consum_referinta: 92000, aparate_compatibile: [{ nume_aparat: "UMF-C1100-1" }] },
      { id_toner: 37, denumire_tip: "TN622Y Yellow", office: 2, office_nume: "UMF", stoc: 6, consum_referinta: 104000, aparate_compatibile: [{ nume_aparat: "UMF-C1100-1" }] },
      { id_toner: 38, denumire_tip: "TN622K Black", office: 2, office_nume: "UMF", stoc: 6, consum_referinta: 88000, aparate_compatibile: [{ nume_aparat: "UMF-C1100-1" }] },
      { id_toner: 82, denumire_tip: "TN14 Black", office: 5, office_nume: "SMÂRDAN", stoc: 7, consum_referinta: 105000, aparate_compatibile: [{ nume_aparat: "SMARDAN-1250-1" }] },
      { id_toner: 100, denumire_tip: "TN14 Black", office: 3, office_nume: "TUDOR", stoc: 9, consum_referinta: 105000, aparate_compatibile: [{ nume_aparat: "TUDOR-T1" }] },
      { id_toner: 114, denumire_tip: "TN627K Black", office: 4, office_nume: "TIPO", stoc: 4, consum_referinta: 174000, aparate_compatibile: [{ nume_aparat: "TIPO-C14000-2" }] }
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
      { id_aparat: 48, nume_aparat: 'TIPO-1250-3', office: 4 },
      { id_aparat: 50, nume_aparat: 'TIPO-2250-1-DR', office: 4 },
      { id_aparat: 51, nume_aparat: 'TIPO-2250-2-DR', office: 4 },
      { id_aparat: 52, nume_aparat: 'TIPO-2250-3-DR', office: 4 },
      { id_aparat: 53, nume_aparat: 'TIPO-2250-4-DR', office: 4 },
      { id_aparat: 54, nume_aparat: 'TIPO-2250-5-DR', office: 4 },
      { id_aparat: 55, nume_aparat: 'TIPO-2250-6-DR', office: 4 },
      { id_aparat: 68, nume_aparat: 'TIPO-2250-1-ST', office: 4 },
      { id_aparat: 69, nume_aparat: 'TIPO-2250-2-ST', office: 4 },
      { id_aparat: 70, nume_aparat: 'TIPO-2250-3-ST', office: 4 },
      { id_aparat: 71, nume_aparat: 'TIPO-2250-4-ST', office: 4 },
      { id_aparat: 72, nume_aparat: 'TIPO-2250-5-ST', office: 4 },
      { id_aparat: 91, nume_aparat: 'TIPO-C14000-2', office: 4 },
      { id_aparat: 8, nume_aparat: 'UMF-AN3', office: 2 },
      { id_aparat: 9, nume_aparat: 'UMF-AN2', office: 2 },
      { id_aparat: 14, nume_aparat: 'UMF-C1100-1', office: 2 },
      { id_aparat: 20, nume_aparat: 'TUDOR-T1', office: 3 },
      { id_aparat: 27, nume_aparat: 'SMARDAN-1250-1', office: 5 },
    ];
  }
}

async function loadHistoryData() {
  try {
    const res = await fetch("api/schimbari.php?action=list");
    const json = await res.json();
    if (json.success) historyData = json.data;
  } catch (err) {
    historyData = [
      { id_istoric_schimbare: 11897, nume_aparat: 'TIPO-2250-5-ST', denumire_tip: 'TN14', office_nume: 'Tipografie', contor: 39823159, data_schimbare: '06-08-2026 19:19:00', nume_operator: 'poturuandreea', copii_realizate: 64216, consum_referinta: 105000, procent_realizat: 61.16 },
      { id_istoric_schimbare: 11896, nume_aparat: 'TIPO-2250-5-DR', denumire_tip: 'TN14', office_nume: 'Tipografie', contor: 39823097, data_schimbare: '06-08-2026 19:19:00', nume_operator: 'poturuandreea', copii_realizate: 64216, consum_referinta: 105000, procent_realizat: 61.16 },
      { id_istoric_schimbare: 11894, nume_aparat: 'TIPO-2250-4-ST', denumire_tip: 'TN14', office_nume: 'Tipografie', contor: 80270366, data_schimbare: '06-08-2026 10:03:00', nume_operator: 'alina', copii_realizate: 62013, consum_referinta: 105000, procent_realizat: 59.06 },
      { id_istoric_schimbare: 11893, nume_aparat: 'TIPO-2250-3-ST', denumire_tip: 'TN14', office_nume: 'Tipografie', contor: 70305786, data_schimbare: '05-08-2026 20:55:00', nume_operator: 'poturuandreea', copii_realizate: 81419, consum_referinta: 105000, procent_realizat: 77.54 },
      { id_istoric_schimbare: 11892, nume_aparat: 'TIPO-2250-6-ST', denumire_tip: 'TN14', office_nume: 'Tipografie', contor: 46716706, data_schimbare: '05-08-2026 18:17:00', nume_operator: 'poturuandreea', copii_realizate: 94105, consum_referinta: 105000, procent_realizat: 89.62 },
      { id_istoric_schimbare: 11890, nume_aparat: 'TIPO-C14000-2', denumire_tip: 'TN627K', office_nume: 'Tipografie', contor: 20492021, data_schimbare: '04-08-2026 20:35:00', nume_operator: 'poturuandreea', copii_realizate: 99546, consum_referinta: 174000, procent_realizat: 57.21 }
    ];
  }
  renderHistoryTable();
  renderWizardRecentTable();
}

function renderHistoryTable() {
  const tbody = document.getElementById("history-table-body");
  tbody.innerHTML = "";
  
  let filtered = historyData;
  if (currentOfficeFilter !== "all") {
    filtered = filtered.filter(h => h.office == currentOfficeFilter);
  }
  
  filtered.forEach(h => {
    const tr = document.createElement("tr");
    const procentStr = h.procent_realizat ? `${parseFloat(h.procent_realizat).toFixed(2)}%` : '0.00%';
    tr.innerHTML = `
      <td><strong>${h.id_istoric_schimbare}</strong></td>
      <td><strong>${h.nume_aparat}</strong></td>
      <td><span class="badge badge-stock-ok">${h.denumire_tip}</span></td>
      <td><span class="office-badge">${h.office_nume || 'PIM'}</span></td>
      <td><i class="fa-solid fa-user"></i> ${h.nume_operator || h.username}</td>
      <td><code>${(h.contor || 0).toLocaleString()}</code><br><small style="color:#94a3b8;">Ref: ${(h.consum_referinta || 105000).toLocaleString()}</small></td>
      <td>${(h.copii_realizate || 0).toLocaleString()}</td>
      <td><strong>${procentStr}</strong></td>
      <td><small>${h.data_schimbare}</small></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderWizardRecentTable() {
  const tbody = document.getElementById("wizard-recent-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  
  let filtered = historyData;
  if (currentOfficeFilter !== "all") {
    filtered = filtered.filter(h => h.office == currentOfficeFilter);
  }
  
  const recent = filtered.slice(0, 6);
  recent.forEach(h => {
    const tr = document.createElement("tr");
    const procentStr = h.procent_realizat ? `${parseFloat(h.procent_realizat).toFixed(2)}%` : '0.00%';
    tr.innerHTML = `
      <td><strong>${h.id_istoric_schimbare}</strong></td>
      <td><strong>${h.nume_aparat}</strong></td>
      <td><span class="badge badge-stock-ok">${h.denumire_tip}</span></td>
      <td><span class="office-badge">${h.office_nume || 'PIM'}</span></td>
      <td>${h.nume_operator || h.username}</td>
      <td><code>${(h.contor || 0).toLocaleString()}</code> / ${(h.consum_referinta || 105000).toLocaleString()}</td>
      <td>${(h.copii_realizate || 0).toLocaleString()}</td>
      <td><strong>${procentStr}</strong></td>
      <td><small>${h.data_schimbare}</small></td>
    `;
    tbody.appendChild(tr);
  });
}

// ----------------------------------------------------
// LOGICĂ ASISTENT WIZARD (MULTI-STEP)
// ----------------------------------------------------

function openWizardModal() {
  wizardSelectedAparat = null;
  wizardSelectedToner = null;
  wizardCurrentStep = 1;
  
  const officeNames = { 2: "UMF", 3: "TUDOR", 4: "Tipografie (TIPO)", 5: "SMÂRDAN", 6: "UMF2", 0: "COPOU" };
  const effectiveOffice = (currentOfficeFilter !== 'all') ? parseInt(currentOfficeFilter) : (currentUser ? currentUser.office : 4);
  document.getElementById("wizard-office-label").innerText = `Punct de lucru: ${officeNames[effectiveOffice] || 'Toate Punctele PIM Iași'}`;
  
  renderWizardStep1Aparate();
  goToWizardStep(1);
  document.getElementById("modal-wizard").classList.remove("hidden");
}

function closeWizardModal() {
  document.getElementById("modal-wizard").classList.add("hidden");
}

function goToWizardStep(stepNum) {
  wizardCurrentStep = stepNum;
  
  document.querySelectorAll(".wizard-step-item").forEach((el, idx) => {
    const num = idx + 1;
    if (num === stepNum) {
      el.classList.add("active");
      el.classList.remove("completed");
    } else if (num < stepNum) {
      el.classList.remove("active");
      el.classList.add("completed");
    } else {
      el.classList.remove("active");
      el.classList.remove("completed");
    }
  });
  
  document.querySelectorAll(".step-connector").forEach((el, idx) => {
    if (idx + 1 < stepNum) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });
  
  document.querySelectorAll(".wizard-step-content").forEach(el => el.classList.remove("active"));
  const currentContent = document.getElementById(`wizard-step-${stepNum}`);
  if (currentContent) currentContent.classList.add("active");
  
  if (stepNum === 3) {
    initWizardStep3Data();
  }
}

// PASUL 1: REDARE APARATE PE PUNCTUL DE LUCRU SELECTAT
function renderWizardStep1Aparate() {
  const container = document.getElementById("wizard-aparate-container");
  container.innerHTML = "";
  
  const effectiveOffice = (currentOfficeFilter !== 'all') ? parseInt(currentOfficeFilter) : (currentUser ? currentUser.office : 4);
  const search = (document.getElementById("wizard-aparat-search").value || "").toLowerCase();
  
  let officeAparate = (currentOfficeFilter === 'all')
    ? aparateData 
    : aparateData.filter(a => a.office == effectiveOffice);

  if (search) {
    officeAparate = officeAparate.filter(a => a.nume_aparat.toLowerCase().includes(search));
  }
  
  if (officeAparate.length === 0) {
    container.innerHTML = '<p class="text-muted" style="grid-column:1/-1; padding:20px; text-align:center;">Nu au fost găsite aparate active pe acest sediu.</p>';
    return;
  }
  
  const officeNames = { 2: "UMF", 3: "TUDOR", 4: "Tipografie (TIPO)", 5: "SMÂRDAN", 6: "UMF2", 0: "COPOU" };
  
  officeAparate.forEach(aparat => {
    const card = document.createElement("div");
    card.className = "card-select-item";
    card.onclick = () => handleWizardSelectAparat(aparat);
    
    const officeLabel = officeNames[aparat.office] || 'PIM Iași';
    
    card.innerHTML = `
      <div class="card-title"><i class="fa-solid fa-print text-cyan"></i> ${aparat.nume_aparat}</div>
      <div class="card-subtitle">Sediu: ${officeLabel}</div>
    `;
    container.appendChild(card);
  });
}

function filterWizardAparateList() {
  renderWizardStep1Aparate();
}

let currentMachineTonersCount = 0;

// MANEVRARE SELECTARE APARAT & VERIFICARE AUTO-SELECTARE TONER UNIC
async function handleWizardSelectAparat(aparat) {
  wizardSelectedAparat = aparat;
  wizardSelectedToner = null; // Resetare toner ales anterior
  
  document.getElementById("summary-aparat-badge").innerText = `Aparat: ${aparat.nume_aparat}`;
  document.getElementById("summary-aparat-badge-final").innerText = `Aparat: ${aparat.nume_aparat}`;
  
  // Golește containerul de tonere din Pasul 2 pentru a preveni opțiunile rămase de la aparatul anterior!
  const containerStep2 = document.getElementById("wizard-tonere-container");
  if (containerStep2) containerStep2.innerHTML = "";
  
  // Încarcă tonerele compatibile pentru aparatul ales
  let compatibleToners = [];
  try {
    const res = await fetch(`api/tonere.php?action=tonere-aparat&id_aparat=${aparat.id_aparat}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      compatibleToners = json.data;
    }
  } catch (err) {
    compatibleToners = [];
  }

  currentMachineTonersCount = compatibleToners.length;

  // Actualizăm eticheta butonului Înapoi din Pasul 3
  const step3BackText = document.getElementById("step3-back-btn-text");
  if (step3BackText) {
    step3BackText.innerText = (currentMachineTonersCount > 1) 
      ? "Înapoi la Selectare Tonere" 
      : "Înlocuiește Aparatul";
  }
  
  // 1. DACA APARATUL NU ARE NICIUN TONER ÎN BAZA DE DATE (ex: UMF-KIP7970)
  if (compatibleToners.length === 0) {
    if (containerStep2) {
      containerStep2.innerHTML = `
        <div style="grid-column: 1/-1; padding: 28px; text-align: center; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 16px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 12px; display: block; color: #fca5a5;"></i>
          <h4 style="font-weight: 700; margin-bottom: 8px; color: #fca5a5; font-size: 1.1rem;">
            Nu aveți tipuri de toner pentru aparatul selectat! Contactați administratorul!.
          </h4>
          <p style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 16px;">Echipamentul "${aparat.nume_aparat}" nu are asociate tipuri de toner în baza de date.</p>
          <button class="btn btn-secondary" onclick="goToWizardStep(1)">
            <i class="fa-solid fa-arrow-left"></i> Înapoi la Aparate
          </button>
        </div>
      `;
    }
    goToWizardStep(2); // Deschide Pasul 2 cu mesajul roșu de avertizare!
    return;
  }

  // 2. DACA APARATUL ARE UN SINGUR TONER COMPATIBIL
  if (compatibleToners.length === 1) {
    wizardSelectedToner = compatibleToners[0];
    document.getElementById("summary-toner-badge-final").innerText = `Toner: ${wizardSelectedToner.denumire_tip}`;
    goToWizardStep(3); // Sare direct la Pasul 3!
  } else {
    // 3. DACA APARATUL ARE MULTIPLE TONERE COMPATIBILE (ex: Color)
    renderWizardStep2Tonere(compatibleToners);
    goToWizardStep(2);
  }
}

function handleStep3Back() {
  if (currentMachineTonersCount > 1) {
    goToWizardStep(2);
  } else {
    goToWizardStep(1);
  }
}

// PASUL 2: REDARE TONERE COMPATIBILE
function renderWizardStep2Tonere(tonersList) {
  const container = document.getElementById("wizard-tonere-container");
  container.innerHTML = "";
  
  tonersList.forEach(t => {
    const card = document.createElement("div");
    card.className = "card-select-item";
    card.onclick = () => {
      wizardSelectedToner = t;
      document.getElementById("summary-toner-badge-final").innerText = `Toner: ${t.denumire_tip}`;
      goToWizardStep(3);
    };
    
    card.innerHTML = `
      <div class="card-title">${getColorBadge(t.denumire_tip)} ${t.denumire_tip}</div>
      <div class="card-subtitle">Stoc disponibil: <strong>${t.stoc} buc</strong></div>
      <div class="card-subtitle">Consum Referință: ${(t.consum_referinta || 105000).toLocaleString()} pagini</div>
    `;
    container.appendChild(card);
  });
}

// PASUL 3: PRELUARE INDEX VECHI, CALCUL LIMITĂ MIN/MAX & METRICE ÎN TIMP REAL
async function initWizardStep3Data() {
  if (!wizardSelectedAparat || !wizardSelectedToner) return;
  
  let lastIndexData = null;
  try {
    const res = await fetch(`api/schimbari.php?action=get-last-index&id_aparat=${wizardSelectedAparat.id_aparat}&id_toner=${wizardSelectedToner.id_toner}`);
    const json = await res.json();
    if (json.success) lastIndexData = json.data;
  } catch (e) {
    lastIndexData = {
      index_vechi: 39823097,
      consum_referinta: wizardSelectedToner.consum_referinta || 105000,
      min_contor: 39823098,
      max_contor: 39823097 + ((wizardSelectedToner.consum_referinta || 105000) * 2)
    };
  }
  
  if (!lastIndexData) {
    lastIndexData = {
      index_vechi: 39823097,
      consum_referinta: wizardSelectedToner.consum_referinta || 105000,
      min_contor: 39823098,
      max_contor: 39823097 + ((wizardSelectedToner.consum_referinta || 105000) * 2)
    };
  }
  
  wizardIndexVechi = lastIndexData.index_vechi;
  wizardConsumRef = lastIndexData.consum_referinta;
  wizardMinAllowed = lastIndexData.min_contor;
  wizardMaxAllowed = lastIndexData.max_contor;
  
  document.getElementById("display-index-vechi").innerText = wizardIndexVechi.toLocaleString();
  document.getElementById("display-min-allowed").innerText = wizardMinAllowed.toLocaleString();
  document.getElementById("display-max-allowed").innerText = wizardMaxAllowed.toLocaleString();
  document.getElementById("display-consum-ref").innerText = wizardConsumRef.toLocaleString();
  
  document.getElementById("input-wizard-contor").value = "";
  calculateWizardMetrics();
}

// CALCUL METRICE ÎN TIMP REAL ȘI VALIDARE
function calculateWizardMetrics() {
  const contorInput = document.getElementById("input-wizard-contor");
  const contorVal = parseInt(contorInput.value || 0);
  
  const alertDiv = document.getElementById("wizard-validation-alert");
  const alertText = document.getElementById("wizard-validation-text");
  const submitBtn = document.getElementById("btn-submit-wizard");
  
  if (!contorVal) {
    document.getElementById("display-copii-realizate").innerText = "0";
    document.getElementById("display-procent-realizat").innerText = "0,00%";
    alertDiv.classList.add("hidden");
    submitBtn.disabled = false;
    return;
  }
  
  const copiiRealizate = contorVal - wizardIndexVechi;
  const procentRealizat = (wizardConsumRef > 0 && copiiRealizate > 0) ? ((copiiRealizate / wizardConsumRef) * 100) : 0;
  
  document.getElementById("display-copii-realizate").innerText = (copiiRealizate > 0 ? copiiRealizate : 0).toLocaleString();
  document.getElementById("display-procent-realizat").innerText = `${procentRealizat.toFixed(2)}%`;
  
  // VALIDARE STRICTĂ CONFORM CERINȚEI (MINIM 1 copie, MAXIM 200% din referință)
  if (contorVal < wizardMinAllowed) {
    alertText.innerText = `Contorul introdus (${contorVal.toLocaleString()}) este sub Minimul Permis (${wizardMinAllowed.toLocaleString()}). A fost efectuat cel puțin 1 copie?`;
    alertDiv.classList.remove("hidden");
    submitBtn.disabled = true;
  } else if (contorVal > wizardMaxAllowed) {
    alertText.innerText = `Contorul introdus (${contorVal.toLocaleString()}) depășește Maximul Permis de 200% (${wizardMaxAllowed.toLocaleString()}). Procentul maxim admis este de 200%.`;
    alertDiv.classList.remove("hidden");
    submitBtn.disabled = true;
  } else {
    alertDiv.classList.add("hidden");
    submitBtn.disabled = false;
  }
}

// SALVARE SCHIMBARE DIN WIZARD
async function handleWizardSubmit(e) {
  e.preventDefault();
  
  const contorVal = parseInt(document.getElementById("input-wizard-contor").value);
  if (!contorVal || contorVal < wizardMinAllowed || contorVal > wizardMaxAllowed) {
    alert("Te rugăm să introduci un contor valid în intervalul minim și maxim permis.");
    return;
  }
  
  const payload = {
    id_aparat: wizardSelectedAparat.id_aparat,
    id_toner: wizardSelectedToner.id_toner,
    id_user: currentUser ? currentUser.id_user : 1,
    contor: contorVal
  };
  
  try {
    const res = await fetch("api/schimbari.php?action=add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      alert(json.message || "Schimbarea de toner a fost salvată!");
      await loadHistoryData();
      await loadTonersData();
      closeWizardModal();
    } else {
      alert("Eroare la salvare: " + (json.message || "Nu s-a putut efectua salvarea."));
    }
  } catch (err) {
    alert("Eroare la salvarea schimbării: " + err.message);
  }
}

// ----------------------------------------------------
// SUPLIMENTARE STOC MODAL
// ----------------------------------------------------

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
