// PIM Iași - Toner Management System & Wizard Logic

let currentPin = "";
const MAX_PIN_LENGTH = 6;
let currentUser = null;
let currentOfficeFilter = "all";

// Cache de date în memorie
let tonersData = [];
let aparateData = [];
let historyData = [];

// Stare Paginație
let historyCurrentPage = 1;
let recentCurrentPage = 1;
const PAGE_SIZE = 10;

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
  const selectElem = document.getElementById("office-filter-select");
  
  roleBadge.innerText = isAdmin ? "Administrator" : "Angajat (Operator)";
  if (isAdmin) {
    roleBadge.classList.add("admin");
    document.querySelectorAll(".admin-only").forEach(el => el.classList.remove("hidden"));
    document.getElementById("nav-istoric-btn")?.classList.remove("hidden");
    if (selectElem) {
      selectElem.disabled = false;
    }
    loadUsersData();
  } else {
    roleBadge.classList.remove("admin");
    document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
    document.getElementById("nav-istoric-btn")?.classList.remove("hidden");
    
    // Operatorul vede DOAR sediul la care a fost asignat!
    currentOfficeFilter = String(currentUser.office);
    if (selectElem) {
      selectElem.value = currentUser.office;
      selectElem.disabled = true;
    }
    switchSection("schimbare");
  }
}

function switchSection(secId) {
  // Operatorii nu au voie pe utilizatori
  if (currentUser && currentUser.role !== "admin" && secId === "utilizatori") {
    secId = "schimbare";
  }

  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".app-section").forEach(sec => sec.classList.remove("active"));
  
  const targetBtn = document.getElementById(`nav-${secId}-btn`);
  const targetSec = document.getElementById(`section-${secId}`);
  
  if (targetBtn) targetBtn.classList.add("active");
  if (targetSec) targetSec.classList.add("active");
}

// ----------------------------------------------------
// MANAGEMENT UTILIZATORI (ADMIN ONLY)
// ----------------------------------------------------

let usersData = [];

async function loadUsersData() {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  
  try {
    const res = await fetch("api/users.php?action=list");
    const json = await res.json();
    if (json.success) usersData = json.data;
  } catch (err) {
    usersData = [
      { id_user: 1, username: 'admin', role: 'admin', office: 2, office_nume: 'Independenței', full_name: 'Admin PIM', cont_active: 1, pin_code: '000000', password: 'admin' },
      { id_user: 46, username: 'operator', role: 'operator', office: 2, office_nume: 'Independenței', full_name: 'Operator Independenței', cont_active: 1, pin_code: '123456', password: 'operator' }
    ];
  }
  
  renderUsersTable();
}

function renderUsersTable() {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  
  const officeNames = { 2: "Independenței", 3: "TUDOR", 4: "Tipografie (TIPO)", 5: "SMÂRDAN", 6: "UMF2" };

  usersData.forEach(u => {
    const tr = document.createElement("tr");
    const isAdmin = u.role === "admin";
    const roleBadgeClass = isAdmin ? "badge-primary" : "badge-secondary";
    const roleLabel = isAdmin ? "Administrator" : "Operator (Angajat)";
    const isActive = parseInt(u.cont_active) === 1;
    const statusBadge = isActive 
      ? '<span class="badge badge-stock-ok">Activ</span>' 
      : '<span class="badge badge-stock-low">Inactiv</span>';
    
    const pinDisplay = u.pin_code ? `<code style="color:#00f2fe; font-weight:700;">PIN: ${u.pin_code}</code>` : '<small style="color:#94a3b8;">Fără PIN</small>';

    tr.innerHTML = `
      <td>
        <strong>${u.full_name || u.username}</strong>
        <br><small style="color:#94a3b8;">@${u.username} (ID #${u.id_user})</small>
      </td>
      <td><span class="badge ${roleBadgeClass}">${roleLabel}</span></td>
      <td><span class="office-badge">${officeNames[u.office] || u.office_nume || 'PIM'}</span></td>
      <td>${pinDisplay}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="toggleUserStatus(${u.id_user})">
          ${isActive ? 'Dezactivează' : 'Activează'}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openNewUserModal() {
  document.getElementById("newuser-username").value = "";
  document.getElementById("newuser-fullname").value = "";
  document.getElementById("newuser-password").value = "";
  document.getElementById("newuser-confirm-password").value = "";
  document.getElementById("newuser-pin").value = "";
  document.getElementById("modal-new-user").classList.remove("hidden");
}

async function handleCreateUserSubmit(e) {
  e.preventDefault();
  
  const office = document.getElementById("newuser-office").value;
  const username = document.getElementById("newuser-username").value.trim();
  const role = document.getElementById("newuser-role").value;
  const fullName = document.getElementById("newuser-fullname").value.trim();
  const password = document.getElementById("newuser-password").value;
  const confirmPassword = document.getElementById("newuser-confirm-password").value;
  const pin = document.getElementById("newuser-pin").value.trim();
  
  if (password !== confirmPassword) {
    alert("Parolele introduse nu se potrivesc!");
    return;
  }
  
  try {
    const res = await fetch("api/users.php?action=create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        office,
        username,
        role,
        full_name: fullName,
        password,
        confirm_password: confirmPassword,
        pin
      })
    });
    
    const json = await res.json();
    if (json.success) {
      alert(`Contul utilizatorului @${username} a fost creat cu succes!\n\nCod PIN atribuit pentru autentificare: ${json.data.pin_code}`);
      closeModal("modal-new-user");
      await loadUsersData();
    } else {
      alert("Eroare creare cont: " + json.message);
    }
  } catch (err) {
    alert("Eroare de rețea la crearea contului.");
  }
}

async function toggleUserStatus(idUser) {
  try {
    const res = await fetch("api/users.php?action=toggle-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_user: idUser })
    });
    const json = await res.json();
    if (json.success) {
      await loadUsersData();
    } else {
      alert("Eroare status: " + json.message);
    }
  } catch (err) {
    alert("Eroare conectare server.");
  }
}

async function changeOfficeFilter(val) {
  currentOfficeFilter = val;
  historyCurrentPage = 1;
  recentCurrentPage = 1;
  renderTonersTable();
  await loadHistoryData();
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
      { id_toner: 35, denumire_tip: "TN622C Cyan", office: 2, office_nume: "Independenței", stoc: 6, consum_referinta: 95000, aparate_compatibile: [{ nume_aparat: "UMF-C1100-1" }] },
      { id_toner: 36, denumire_tip: "TN622M Magenta", office: 2, office_nume: "Independenței", stoc: 5, consum_referinta: 92000, aparate_compatibile: [{ nume_aparat: "UMF-C1100-1" }] },
      { id_toner: 37, denumire_tip: "TN622Y Yellow", office: 2, office_nume: "Independenței", stoc: 6, consum_referinta: 104000, aparate_compatibile: [{ nume_aparat: "UMF-C1100-1" }] },
      { id_toner: 38, denumire_tip: "TN622K Black", office: 2, office_nume: "Independenței", stoc: 6, consum_referinta: 88000, aparate_compatibile: [{ nume_aparat: "UMF-C1100-1" }] },
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

function getColorBadgeInfo(name) {
  const str = (name || "").trim();
  const lower = str.toLowerCase();
  
  let color = "black";
  let label = "Black";
  
  if (
    lower.includes("cyan") || 
    /\b[a-z0-9]+c\b/i.test(str) || 
    /\b[a-z0-9]+c[\s\(\-]/.test(str) ||
    /toner c\b/i.test(str) ||
    lower.endsWith("c")
  ) {
    color = "cyan";
    label = "Cyan";
  } else if (
    lower.includes("magenta") || 
    /\b[a-z0-9]+m\b/i.test(str) || 
    /\b[a-z0-9]+m[\s\(\-]/.test(str) ||
    /toner m\b/i.test(str) ||
    lower.endsWith("m")
  ) {
    color = "magenta";
    label = "Magenta";
  } else if (
    lower.includes("yellow") || 
    /\b[a-z0-9]+y\b/i.test(str) || 
    /\b[a-z0-9]+y[\s\(\-]/.test(str) ||
    /toner y\b/i.test(str) ||
    lower.endsWith("y")
  ) {
    color = "yellow";
    label = "Yellow";
  }
  
  let cleanModel = str;
  cleanModel = cleanModel.replace(/^(cyan|magenta|yellow|black)\s+/i, '');
  const displayText = `${label} ${cleanModel}`;
  const badgeHtml = `<span class="toner-color-text toner-color-${color}"><i class="fa-solid fa-droplet"></i> ${displayText}</span>`;
  
  return {
    color,
    label,
    displayText,
    badgeHtml
  };
}

function getColorBadge(name) {
  return getColorBadgeInfo(name).badgeHtml;
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
    const url = (currentOfficeFilter !== "all") 
      ? `api/schimbari.php?action=list&office=${currentOfficeFilter}` 
      : "api/schimbari.php?action=list";
    const res = await fetch(url);
    const json = await res.json();
    if (json.success) historyData = json.data;
  } catch (err) {
    historyData = [];
  }
  renderHistoryTable();
  renderWizardRecentTable();
}

function renderPaginationControls(containerId, infoId, currentPage, totalItems, pageSize, onPageChange) {
  const container = document.getElementById(containerId);
  const infoElem = document.getElementById(infoId);
  if (!container || !infoElem) return;
  
  container.innerHTML = "";
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIdx = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIdx = Math.min(currentPage * pageSize, totalItems);
  
  infoElem.innerHTML = `Afișare <strong>${startIdx}-${endIdx}</strong> din <strong>${totalItems}</strong> înregistrări (Pagina ${currentPage} din ${totalPages})`;
  
  if (totalPages <= 1) return;
  
  const prevBtn = document.createElement("button");
  prevBtn.className = "page-btn";
  prevBtn.disabled = currentPage === 1;
  prevBtn.innerHTML = '<i class="fa-solid fa-angle-left"></i>';
  prevBtn.onclick = () => onPageChange(currentPage - 1);
  container.appendChild(prevBtn);
  
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);
  
  if (startPage > 1) {
    const p1 = document.createElement("button");
    p1.className = "page-btn";
    p1.innerText = "1";
    p1.onclick = () => onPageChange(1);
    container.appendChild(p1);
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.className = "page-ellipsis";
      ellipsis.innerText = "...";
      container.appendChild(ellipsis);
    }
  }
  
  for (let p = startPage; p <= endPage; p++) {
    const btn = document.createElement("button");
    btn.className = `page-btn ${p === currentPage ? "active" : ""}`;
    btn.innerText = p;
    btn.onclick = () => onPageChange(p);
    container.appendChild(btn);
  }
  
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.className = "page-ellipsis";
      ellipsis.innerText = "...";
      container.appendChild(ellipsis);
    }
    const pLast = document.createElement("button");
    pLast.className = "page-btn";
    pLast.innerText = totalPages;
    pLast.onclick = () => onPageChange(totalPages);
    container.appendChild(pLast);
  }
  
  const nextBtn = document.createElement("button");
  nextBtn.className = "page-btn";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.innerHTML = '<i class="fa-solid fa-angle-right"></i>';
  nextBtn.onclick = () => onPageChange(currentPage + 1);
  container.appendChild(nextBtn);
}

function renderHistoryTable() {
  const tbody = document.getElementById("history-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  
  let filtered = historyData;
  if (currentOfficeFilter !== "all") {
    filtered = filtered.filter(h => h.office == currentOfficeFilter);
  }
  
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;
  if (historyCurrentPage < 1) historyCurrentPage = 1;
  
  const startIdx = (historyCurrentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  
  pageItems.forEach(h => {
    const tr = document.createElement("tr");
    const procentStr = h.procent_realizat ? `${parseFloat(h.procent_realizat).toFixed(2)}%` : '0.00%';
    const colorBadge = getColorBadge(h.denumire_tip || '');
    
    tr.innerHTML = `
      <td><strong>${h.id_istoric_schimbare}</strong></td>
      <td><strong>${h.nume_aparat}</strong></td>
      <td>${colorBadge} <strong>${h.denumire_tip}</strong></td>
      <td><span class="office-badge">${h.office_nume || 'PIM'}</span></td>
      <td><i class="fa-solid fa-user"></i> ${h.nume_operator || h.username}</td>
      <td><code>${(h.contor || 0).toLocaleString()}</code><br><small style="color:#94a3b8;">Ref: ${(h.consum_referinta || 105000).toLocaleString()}</small></td>
      <td>${(h.copii_realizate || 0).toLocaleString()}</td>
      <td><strong>${procentStr}</strong></td>
      <td><small>${h.data_schimbare}</small></td>
    `;
    tbody.appendChild(tr);
  });
  
  renderPaginationControls(
    "history-pagination-controls",
    "history-pagination-info",
    historyCurrentPage,
    totalItems,
    PAGE_SIZE,
    (newPage) => {
      historyCurrentPage = newPage;
      renderHistoryTable();
    }
  );
}

function renderWizardRecentTable() {
  const tbody = document.getElementById("wizard-recent-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  
  let filtered = historyData;
  if (currentOfficeFilter !== "all") {
    filtered = filtered.filter(h => h.office == currentOfficeFilter);
  }
  
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  if (recentCurrentPage > totalPages) recentCurrentPage = totalPages;
  if (recentCurrentPage < 1) recentCurrentPage = 1;
  
  const startIdx = (recentCurrentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  
  pageItems.forEach(h => {
    const tr = document.createElement("tr");
    const procentStr = h.procent_realizat ? `${parseFloat(h.procent_realizat).toFixed(2)}%` : '0.00%';
    const colorBadge = getColorBadge(h.denumire_tip || '');
    
    tr.innerHTML = `
      <td><strong>${h.id_istoric_schimbare}</strong></td>
      <td><strong>${h.nume_aparat}</strong></td>
      <td>${colorBadge} <strong>${h.denumire_tip}</strong></td>
      <td><span class="office-badge">${h.office_nume || 'PIM'}</span></td>
      <td>${h.nume_operator || h.username}</td>
      <td><code>${(h.contor || 0).toLocaleString()}</code> / ${(h.consum_referinta || 105000).toLocaleString()}</td>
      <td>${(h.copii_realizate || 0).toLocaleString()}</td>
      <td><strong>${procentStr}</strong></td>
      <td><small>${h.data_schimbare}</small></td>
    `;
    tbody.appendChild(tr);
  });
  
  renderPaginationControls(
    "recent-pagination-controls",
    "recent-pagination-info",
    recentCurrentPage,
    totalItems,
    PAGE_SIZE,
    (newPage) => {
      recentCurrentPage = newPage;
      renderWizardRecentTable();
    }
  );
}

// ----------------------------------------------------
// LOGICĂ ASISTENT WIZARD (MULTI-STEP)
// ----------------------------------------------------

function openWizardModal() {
  wizardSelectedAparat = null;
  wizardSelectedToner = null;
  wizardCurrentStep = 1;
  
  const officeNames = { 2: "Independenței", 3: "TUDOR", 4: "Tipografie (TIPO)", 5: "SMÂRDAN", 6: "UMF2" };
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
  
  const officeNames = { 2: "Independenței", 3: "TUDOR", 4: "Tipografie (TIPO)", 5: "SMÂRDAN", 6: "UMF2" };
  
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
    const colorInfo = getColorBadgeInfo(t.denumire_tip);
    const card = document.createElement("div");
    card.className = `card-select-item card-color-${colorInfo.color}`;
    card.onclick = () => {
      wizardSelectedToner = t;
      document.getElementById("summary-toner-badge-final").innerText = `Toner: ${colorInfo.displayText}`;
      goToWizardStep(3);
    };
    
    card.innerHTML = `
      <div class="card-title">${colorInfo.badgeHtml}</div>
      <div class="card-subtitle" style="margin-top: 6px;">Stoc disponibil: <strong>${t.stoc} buc</strong></div>
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
// GESTIUNE STOC MODAL (ADĂUGARE / SCĂDERE)
// ----------------------------------------------------

let currentStockOp = 'add';

function openAddStockModal() {
  if (!currentUser || currentUser.role !== "admin") {
    alert("Acces restricționat! Doar administratorii au permisiunea de a modifica stocul de tonere.");
    return;
  }
  populateAddStockModalSelect();
  toggleStockOp('add');
  document.getElementById("modal-add-stock").classList.remove("hidden");
  updateStockModalPreview();
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add("hidden");
}

function populateAddStockModalSelect() {
  const select = document.getElementById("stock-modal-toner");
  if (!select) return;
  select.innerHTML = "";
  
  let availableToners = tonersData;
  if (currentOfficeFilter !== 'all') {
    availableToners = tonersData.filter(t => t.office == currentOfficeFilter);
  }
  if (availableToners.length === 0) availableToners = tonersData;

  availableToners.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id_toner;
    opt.innerText = `${t.denumire_tip} (${t.office_nume || 'PIM'}) - Stoc: ${t.stoc} buc`;
    select.appendChild(opt);
  });
}

function toggleStockOp(opType) {
  currentStockOp = opType;
  const addLabel = document.getElementById("op-label-add");
  const subLabel = document.getElementById("op-label-sub");
  const submitBtn = document.getElementById("stock-modal-submit-btn");
  
  if (opType === 'add') {
    addLabel.classList.add("active");
    subLabel.classList.remove("active");
    if (submitBtn) {
      submitBtn.className = "btn btn-success";
      submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Adaugă în Stoc';
    }
  } else {
    subLabel.classList.add("active");
    addLabel.classList.remove("active");
    if (submitBtn) {
      submitBtn.className = "btn btn-danger-custom";
      submitBtn.innerHTML = '<i class="fa-solid fa-minus"></i> Scade din Stoc';
    }
  }
  updateStockModalPreview();
}

function updateStockModalPreview() {
  const select = document.getElementById("stock-modal-toner");
  if (!select || select.value === "") return;
  
  const tonerId = select.value;
  const qtyInput = document.getElementById("stock-modal-qty");
  const qty = parseInt(qtyInput ? qtyInput.value : 0) || 0;
  const t = tonersData.find(item => item.id_toner == tonerId);
  
  if (!t) return;
  
  const currentStoc = parseInt(t.stoc || 0);
  let newStoc = currentStoc;
  
  if (currentStockOp === 'add') {
    newStoc = currentStoc + qty;
  } else {
    newStoc = Math.max(0, currentStoc - qty);
  }
  
  const curElem = document.getElementById("preview-current-stock");
  const newElem = document.getElementById("preview-new-stock");
  
  if (curElem) curElem.innerText = `${currentStoc} bucăți`;
  if (newElem) newElem.innerText = `${newStoc} bucăți`;
}

async function handleAddStockSubmit(e) {
  e.preventDefault();
  if (!currentUser || currentUser.role !== "admin") {
    alert("Acces restricționat! Doar administratorii au permisiunea de a modifica stocul de tonere.");
    closeModal("modal-add-stock");
    return;
  }

  const select = document.getElementById("stock-modal-toner");
  const tonerId = select.value;
  const qty = parseInt(document.getElementById("stock-modal-qty").value || 1);
  const op = currentStockOp;
  
  if (!tonerId || qty <= 0) return;

  try {
    const res = await fetch("api/tonere.php?action=update-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_toner: tonerId,
        cantitate: qty,
        operation: op,
        user_role: currentUser ? currentUser.role : 'operator'
      })
    });
    
    const json = await res.json();
    if (json.success) {
      const t = tonersData.find(item => item.id_toner == tonerId);
      if (t) {
        if (op === 'add') {
          t.stoc = parseInt(t.stoc || 0) + qty;
        } else {
          t.stoc = Math.max(0, parseInt(t.stoc || 0) - qty);
        }
      }
      renderTonersTable();
      closeModal("modal-add-stock");
      alert(json.message || `Stocul a fost actualizat cu succes (${op === 'add' ? '+' : '-'}${qty} buc).`);
    } else {
      alert("Eroare la actualizarea stocului: " + json.message);
    }
  } catch (err) {
    const t = tonersData.find(item => item.id_toner == tonerId);
    if (t) {
      if (op === 'add') {
        t.stoc = parseInt(t.stoc || 0) + qty;
      } else {
        t.stoc = Math.max(0, parseInt(t.stoc || 0) - qty);
      }
      renderTonersTable();
    }
    closeModal("modal-add-stock");
    alert(`Stoc actualizat (${op === 'add' ? '+' : '-'}${qty} buc).`);
  }
}
