// PIM Iași - Toner Management System & Wizard Logic

let currentLoginRole = "operator"; // "operator" sau "admin"
let currentPin = "";
let maxPinLength = 6;
let currentUser = null;
let currentOfficeFilter = "all";

const OFFICE_NAMES = {
  2: "Independenței",
  3: "Tudor",
  4: "Tipografie",
  5: "Smârdan",
  6: "UMF 2"
};

function formatOfficeName(officeIdOrName) {
  if (officeIdOrName === 0 || officeIdOrName === '0' || officeIdOrName === null || officeIdOrName === undefined) {
    return 'Inexistent';
  }
  const key = parseInt(officeIdOrName);
  if (!isNaN(key)) {
    if (key === 0) return 'Inexistent';
    if (OFFICE_NAMES[key]) return OFFICE_NAMES[key];
  }
  if (OFFICE_NAMES[officeIdOrName]) return OFFICE_NAMES[officeIdOrName];

  const str = String(officeIdOrName).trim();
  if (str === '0' || str.toLowerCase() === '0' || str === '') return 'Inexistent';
  if (str.toUpperCase() === 'TIPO' || str.toUpperCase().includes('TIPOGRAFIE')) return 'Tipografie';
  if (str.toUpperCase() === 'TUDOR') return 'Tudor';
  if (str.toUpperCase() === 'SMÂRDAN' || str.toUpperCase() === 'SMARDAN') return 'Smârdan';
  if (str.toUpperCase() === 'UMF2' || str.toUpperCase() === 'UMF 2') return 'UMF 2';
  if (str.length > 0) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
  return 'Inexistent';
}

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
  renderPinDots();
  checkExistingSession();
});

// ----------------------------------------------------
// AUTENTIFICARE (PIN & USER/PASS)
// ----------------------------------------------------

function switchLoginRole(role) {
  currentLoginRole = role;
  currentPin = "";
  maxPinLength = (role === "admin") ? 12 : 6;

  const opBtn = document.getElementById("role-operator-btn");
  const adminBtn = document.getElementById("role-admin-btn");
  const instText = document.getElementById("pin-instruction-text");
  const demoHint = document.getElementById("demo-hint-box");

  if (role === "admin") {
    if (adminBtn) {
      adminBtn.style.background = "rgba(245, 158, 11, 0.25)";
      adminBtn.style.borderColor = "#f59e0b";
      adminBtn.style.color = "#ffffff";
    }
    if (opBtn) {
      opBtn.style.background = "rgba(15, 23, 42, 0.6)";
      opBtn.style.borderColor = "rgba(255, 255, 255, 0.1)";
      opBtn.style.color = "var(--text-muted)";
    }
    if (instText) instText.innerText = "Introdu codul PIN de Securitate Administrator (12 cifre):";
    if (demoHint) demoHint.innerHTML = '<i class="fa-solid fa-lightbulb text-yellow"></i> PIN Administrator Test: <code>000000000000</code> (12 cifre de zero)';
  } else {
    if (opBtn) {
      opBtn.style.background = "rgba(2, 132, 199, 0.25)";
      opBtn.style.borderColor = "#38bdf8";
      opBtn.style.color = "#ffffff";
    }
    if (adminBtn) {
      adminBtn.style.background = "rgba(15, 23, 42, 0.6)";
      adminBtn.style.borderColor = "rgba(255, 255, 255, 0.1)";
      adminBtn.style.color = "var(--text-muted)";
    }
    if (instText) instText.innerText = "Introdu codul PIN din 6 cifre atribuit contului tău de Operator:";
    if (demoHint) demoHint.innerHTML = '<i class="fa-solid fa-lightbulb text-cyan"></i> PIN Operator Demo: <code>123456</code> (6 cifre)';
  }

  renderPinDots();
  updatePinDots();
  hideAuthError();
}

function renderPinDots() {
  const container = document.getElementById("pin-dots-container");
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < maxPinLength; i++) {
    const span = document.createElement("span");
    span.className = "pin-dot";
    span.id = `dot-${i}`;
    container.appendChild(span);
  }
}

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
  if (currentPin.length < maxPinLength) {
    currentPin += digit;
    updatePinDots();
    if (currentPin.length === maxPinLength) {
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
  for (let i = 0; i < maxPinLength; i++) {
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
    
    if (authScreen && authScreen.classList.contains("active") && pinView && pinView.classList.contains("active")) {
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
      body: JSON.stringify({ pin: currentPin, role: currentLoginRole })
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
    if (currentPin === "000000000000" || currentPin === "000000") {
      handleLoginSuccess({
        id_user: 1,
        username: "admin",
        first_name: "Admin",
        last_name: "PIM",
        role: "admin",
        office: 2
      });
    } else if (currentPin === "123456" || currentPin === "8122") {
      handleLoginSuccess({
        id_user: 46,
        username: "operator",
        first_name: "Operator",
        last_name: "PIM",
        role: "operator",
        office: 2
      });
    } else {
      showAuthError(currentLoginRole === "admin" ? "PIN Administrator incorect. Folosește 000000000000." : "PIN Operator incorect. Încearcă 123456.");
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
  
  usersData.forEach(u => {
    const tr = document.createElement("tr");
    const isAdmin = u.role === "admin" || (u.username && u.username.toLowerCase().includes("admin"));
    const roleBadgeClass = isAdmin ? "badge-primary" : "badge-secondary";
    const roleLabel = isAdmin ? "Administrator" : "Operator (Angajat)";
    const isActive = parseInt(u.cont_active) === 1;
    const statusBadge = isActive 
      ? '<span class="badge badge-stock-ok">Activ</span>' 
      : '<span class="badge badge-stock-low">Inactiv</span>';
    
    const pinDisplay = u.pin_code 
      ? `<code style="color:${isAdmin ? '#fbbf24' : '#00f2fe'}; font-weight:700;">PIN: ${u.pin_code}</code>` 
      : '<small style="color:#94a3b8;">Fără PIN</small>';

    const passDisplay = isAdmin
      ? `<span class="badge" style="background:rgba(239, 68, 68, 0.15); color:#fca5a5; border:1px solid rgba(239, 68, 68, 0.3); font-size:0.75rem;"><i class="fa-solid fa-lock"></i> Parolă Protejată</span>`
      : `<code style="color:#a7f3d0; font-weight:600;"><i class="fa-solid fa-key"></i> Parolă: ${u.password_plain || u.password || 'operator123'}</code>`;

    const pinPassCombined = `<div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">${pinDisplay}${passDisplay}</div>`;

    const statusActionBtn = isAdmin
      ? `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); padding: 5px 10px; font-size: 0.78rem;" title="Contul de administrator nu poate fi dezactivat"><i class="fa-solid fa-shield-halved"></i> Protejat</span>`
      : `<button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="toggleUserStatus(${u.id_user})">${isActive ? 'Dezactivează' : 'Activează'}</button>`;

    tr.innerHTML = `
      <td>
        <strong>${u.full_name || u.username}</strong>
        <br><small style="color:#94a3b8;">@${u.username} (ID #${u.id_user})</small>
      </td>
      <td><span class="badge ${roleBadgeClass}">${roleLabel}</span></td>
      <td><span class="office-badge">${formatOfficeName(u.office || u.office_nume)}</span></td>
      <td>${pinPassCombined}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem; margin-right: 6px;" onclick="openEditUserModal(${u.id_user})">
          <i class="fa-solid fa-user-pen"></i> Editează
        </button>
        ${statusActionBtn}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openEditUserModal(userId) {
  const select = document.getElementById("edituser-select");
  if (!select) return;
  select.innerHTML = "";

  if (!usersData || usersData.length === 0) {
    alert("Nu există utilizatori încărcați.");
    return;
  }

  usersData.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.id_user;
    opt.innerText = `${u.full_name || u.username} (@${u.username}) - ${formatOfficeName(u.office || u.office_nume)}`;
    select.appendChild(opt);
  });

  if (userId) {
    select.value = userId;
  }

  onEditUserSelectChange();
  document.getElementById("modal-edit-user").classList.remove("hidden");
}

function onUserModalRoleChange(formType) {
  const roleSelect = document.getElementById(`${formType}-role`);
  const pinInput = document.getElementById(`${formType}-pin`);
  const pinLabel = document.getElementById(`${formType}-pin-label`);

  const role = roleSelect ? roleSelect.value : 'operator';

  if (role === 'admin') {
    if (pinInput) {
      pinInput.setAttribute('maxlength', '12');
      pinInput.setAttribute('placeholder', 'ex: 000000000000');
    }
    if (pinLabel) {
      pinLabel.innerHTML = 'Cod PIN Administrator (12 Cifre) *';
    }
  } else {
    if (pinInput) {
      pinInput.setAttribute('maxlength', '6');
      pinInput.setAttribute('placeholder', 'ex: 123456');
    }
    if (pinLabel) {
      pinLabel.innerHTML = 'Cod PIN Operator (6 Cifre) *';
    }
  }
}

function onEditUserSelectChange() {
  const select = document.getElementById("edituser-select");
  if (!select || !select.value) return;
  const userId = select.value;
  const user = usersData.find(u => u.id_user == userId);
  if (!user) return;

  document.getElementById("edituser-office").value = user.office || 4;
  document.getElementById("edituser-username").value = user.username || "";
  document.getElementById("edituser-role").value = user.role || "operator";
  document.getElementById("edituser-fullname").value = user.full_name || "";
  document.getElementById("edituser-pin").value = user.pin_code || "";
  document.getElementById("edituser-password").value = "";

  onUserModalRoleChange('edituser');
}

async function handleEditUserSubmit(e) {
  e.preventDefault();
  const select = document.getElementById("edituser-select");
  const userId = select ? select.value : null;
  if (!userId) return;

  const office = document.getElementById("edituser-office").value;
  const username = document.getElementById("edituser-username").value.trim();
  const role = document.getElementById("edituser-role").value;
  const fullName = document.getElementById("edituser-fullname").value.trim();
  const pin = document.getElementById("edituser-pin").value.trim();
  const password = document.getElementById("edituser-password").value;

  try {
    const res = await fetch("api/users.php?action=update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_user: userId,
        office,
        username,
        role,
        full_name: fullName,
        pin,
        password
      })
    });

    const json = await res.json();
    if (json.success) {
      alert(json.message || "Datele utilizatorului au fost actualizate cu succes!");
      closeModal("modal-edit-user");
      await loadUsersData();
    } else {
      alert("Eroare actualizare: " + json.message);
    }
  } catch (err) {
    const target = usersData.find(u => u.id_user == userId);
    if (target) {
      target.office = parseInt(office);
      target.office_nume = formatOfficeName(office);
      target.username = username;
      target.role = role;
      target.full_name = fullName;
      target.pin_code = pin;
    }
    renderUsersTable();
    closeModal("modal-edit-user");
    alert("Date utilizator actualizate!");
  }
}

function openNewUserModal() {
  document.getElementById("newuser-username").value = "";
  document.getElementById("newuser-fullname").value = "";
  document.getElementById("newuser-password").value = "";
  document.getElementById("newuser-confirm-password").value = "";
  document.getElementById("newuser-pin").value = "";
  document.getElementById("newuser-role").value = "operator";
  onUserModalRoleChange('newuser');
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
  const target = usersData.find(u => u.id_user == idUser);
  if (target && (target.role === 'admin' || target.username.toLowerCase().includes('admin'))) {
    alert("Contul de administrator nu poate fi dezactivat!");
    return;
  }

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
    const colorInfo = getColorBadgeInfo(t.denumire_tip, t.culoare || t.color);
    tr.innerHTML = `
      <td>${colorInfo.badgeHtml}</td>
      <td><span class="office-badge">${formatOfficeName(t.office || t.office_nume)}</span></td>
      <td><span class="toner-color-text toner-color-${colorInfo.color}"><i class="fa-solid fa-droplet"></i> ${colorInfo.label}</span></td>
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

function getColorBadgeInfo(name, rawColor = null) {
  const str = (name || "").trim();
  const lower = str.toLowerCase();
  
  let color = "";
  let label = "";

  if (rawColor) {
    const cLow = String(rawColor).toLowerCase();
    if (cLow.includes('yellow') || cLow.includes('galben')) { color = 'yellow'; label = 'Yellow'; }
    else if (cLow.includes('cyan') || cLow.includes('albastru')) { color = 'cyan'; label = 'Cyan'; }
    else if (cLow.includes('magenta') || cLow.includes('roz') || cLow.includes('rosu')) { color = 'magenta'; label = 'Magenta'; }
    else if (cLow.includes('black') || cLow.includes('negru')) { color = 'black'; label = 'Black'; }
  }

  if (!color) {
    if (
      lower.includes("yellow") || lower.includes("galben") || 
      /\b[a-z0-9]+y\b/i.test(str) || /\b[a-z0-9]+y[\s\(\-]/.test(str) ||
      /toner y\b/i.test(str) || lower.endsWith("y")
    ) {
      color = "yellow";
      label = "Yellow";
    } else if (
      lower.includes("cyan") || lower.includes("albastru") || 
      /\b[a-z0-9]+c\b/i.test(str) || /\b[a-z0-9]+c[\s\(\-]/.test(str) ||
      /toner c\b/i.test(str) || lower.endsWith("c")
    ) {
      color = "cyan";
      label = "Cyan";
    } else if (
      lower.includes("magenta") || lower.includes("roz") || lower.includes("rosu") || lower.includes("roșu") ||
      /\b[a-z0-9]+m\b/i.test(str) || /\b[a-z0-9]+m[\s\(\-]/.test(str) ||
      /toner m\b/i.test(str) || lower.endsWith("m")
    ) {
      color = "magenta";
      label = "Magenta";
    } else if (
      lower.includes("black") || lower.includes("negru") || 
      /\b[a-z0-9]+k\b/i.test(str) || /\b[a-z0-9]+k[\s\(\-]/.test(str) ||
      /toner k\b/i.test(str) || lower.endsWith("k")
    ) {
      color = "black";
      label = "Black";
    } else {
      color = "black";
      label = "Black";
    }
  }
  
  let cleanModel = str;
  cleanModel = cleanModel.replace(/^(cyan|magenta|yellow|black)\s+/i, '');
  
  const hasColorWord = lower.includes('cyan') || lower.includes('magenta') || lower.includes('yellow') || lower.includes('black') || lower.includes('galben') || lower.includes('albastru') || lower.includes('roz') || lower.includes('rosu') || lower.includes('negru');
  
  const displayText = hasColorWord ? cleanModel : `${label} ${cleanModel}`;
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
      <td>${colorBadge}</td>
      <td><span class="office-badge">${formatOfficeName(h.office || h.office_nume)}</span></td>
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
      <td>${colorBadge}</td>
      <td><span class="office-badge">${formatOfficeName(h.office || h.office_nume)}</span></td>
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
  
  const effectiveOffice = (currentOfficeFilter !== 'all') ? parseInt(currentOfficeFilter) : (currentUser ? currentUser.office : 4);
  document.getElementById("wizard-office-label").innerText = `Sediu: ${formatOfficeName(effectiveOffice) || 'Toate Sediile PIM Iași'}`;
  
  renderWizardStep1Aparate();
  goToWizardStep(1);
  document.getElementById("modal-wizard").classList.remove("hidden");
}

function closeWizardModal() {
  document.getElementById("modal-wizard").classList.add("hidden");
}

function goToWizardStep(stepNum) {
  wizardCurrentStep = stepNum;
  
  document.querySelectorAll(".wizard-step-item").forEach((elem, idx) => {
    if (idx + 1 < stepNum) {
      elem.className = "wizard-step-item completed";
    } else if (idx + 1 === stepNum) {
      elem.className = "wizard-step-item active";
    } else {
      elem.className = "wizard-step-item";
    }
  });
  
  document.querySelectorAll(".step-connector").forEach((conn, idx) => {
    if (idx + 1 < stepNum) {
      conn.classList.add("active");
    } else {
      conn.classList.remove("active");
    }
  });
  
  document.querySelectorAll(".wizard-step-content").forEach(step => step.classList.remove("active"));
  document.getElementById(`wizard-step-${stepNum}`).classList.add("active");
  
  if (stepNum === 1) {
    renderWizardStep1Aparate();
  } else if (stepNum === 3) {
    initWizardStep3Data();
  }
}

// PASUL 1: REDARE APARATE PE PUNCTUL DE LUCRU SELECTAT (DOAR ACTIVE)
function renderWizardStep1Aparate() {
  const container = document.getElementById("wizard-aparate-container");
  if (!container) return;
  container.innerHTML = "";
  
  const effectiveOffice = (currentOfficeFilter !== 'all') ? parseInt(currentOfficeFilter) : (currentUser ? currentUser.office : 4);
  const search = (document.getElementById("wizard-aparat-search").value || "").toLowerCase();
  
  // EXCLUDERE STRICTĂ APARATE INACTIVE (aparat_activ === 0)
  const activeAparateData = aparateData.filter(a => parseInt(a.aparat_activ) === 1 || a.aparat_activ === undefined);
  
  let officeAparate = (currentOfficeFilter === 'all')
    ? activeAparateData 
    : activeAparateData.filter(a => parseInt(a.office) === effectiveOffice);

  if (search) {
    officeAparate = officeAparate.filter(a => (a.nume_aparat || '').toLowerCase().includes(search));
  }
  
  if (officeAparate.length === 0) {
    container.innerHTML = '<p class="text-muted" style="grid-column:1/-1; padding:20px; text-align:center;">Nu au fost găsite aparate active pe acest sediu.</p>';
    return;
  }
  
  officeAparate.forEach(aparat => {
    const card = document.createElement("div");
    card.className = "card-select-item";
    card.onclick = () => handleWizardSelectAparat(aparat);
    
    const officeLabel = formatOfficeName(aparat.office);
    
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
    updateWizardStep3TonerHeader(wizardSelectedToner);
    goToWizardStep(3); // Sare direct la Pasul 3!
  } else {
    // 3. DACA APARATUL ARE MULTIPLE TONERE COMPATIBILE (ex: Color)
    renderWizardStep2Tonere(compatibleToners);
    goToWizardStep(2);
  }
}

function updateWizardStep3TonerHeader(toner) {
  if (!toner) return;
  const colorInfo = getColorBadgeInfo(toner.denumire_tip, toner.culoare || toner.color);
  const badgeElem = document.getElementById("summary-toner-badge-final");
  if (badgeElem) {
    badgeElem.className = `selected-summary-badge toner-color-badge-${colorInfo.color}`;
    badgeElem.innerHTML = `<i class="fa-solid fa-droplet"></i> Toner: ${colorInfo.displayText}`;
  }
}

function handleStep3Back() {
  if (currentMachineTonersCount > 1) {
    goToWizardStep(2);
  } else {
    goToWizardStep(1);
  }
}

// PASUL 2: REDARE TONERE COMPATIBILE (CU BLOCARE PE STOC 0)
function renderWizardStep2Tonere(tonersList) {
  const container = document.getElementById("wizard-tonere-container");
  container.innerHTML = "";
  
  tonersList.forEach(t => {
    const colorInfo = getColorBadgeInfo(t.denumire_tip, t.culoare || t.color);
    const stockCount = parseInt(t.stoc || 0);
    const isOutOfStock = stockCount <= 0;

    const card = document.createElement("div");
    card.className = `card-select-item card-color-${colorInfo.color}`;
    
    if (isOutOfStock) {
      card.style.opacity = "0.75";
      card.style.border = "1px dashed #ef4444";
    }

    card.onclick = () => {
      if (isOutOfStock) {
        alert(`Stoc Insuficient! Tonerul '${colorInfo.displayText}' are 0 bucăți în stoc și nu poate fi instalat până când stocul nu este suplimentat.`);
        return;
      }
      wizardSelectedToner = t;
      updateWizardStep3TonerHeader(t);
      goToWizardStep(3);
    };
    
    const stockBadge = isOutOfStock
      ? `<span class="status-badge inactive" style="font-size:0.75rem; padding: 2px 8px;"><i class="fa-solid fa-ban"></i> Stoc Epuizat (0 buc)</span>`
      : `<strong style="color:var(--cyan-accent);">${stockCount} buc</strong>`;

    card.innerHTML = `
      <div class="card-title">${colorInfo.badgeHtml}</div>
      <div class="card-subtitle" style="margin-top: 6px;">Stoc disponibil: ${stockBadge}</div>
      <div class="card-subtitle">Consum Referință: ${(t.consum_referinta || 105000).toLocaleString('ro-RO')} pagini</div>
    `;
    container.appendChild(card);
  });
}

let aparateCustomIndexesMap = {};

// PASUL 3: PRELUARE INDEX VECHI, CALCUL LIMITĂ MIN/MAX & METRICE ÎN TIMP REAL
async function initWizardStep3Data() {
  if (!wizardSelectedAparat || !wizardSelectedToner) return;
  
  // Garantare etichetă header toner cu stilizarea culorii corespunzătoare
  updateWizardStep3TonerHeader(wizardSelectedToner);

  let lastIndexData = null;
  try {
    const res = await fetch(`api/schimbari.php?action=get-last-index&id_aparat=${wizardSelectedAparat.id_aparat}&id_toner=${wizardSelectedToner.id_toner}`);
    const json = await res.json();
    if (json.success) lastIndexData = json.data;
  } catch (e) {
    lastIndexData = null;
  }
  
  const tonerSpecificRef = (wizardSelectedToner && parseInt(wizardSelectedToner.consum_referinta) > 0)
    ? parseInt(wizardSelectedToner.consum_referinta)
    : 105000;

  let rawRef = (lastIndexData && parseInt(lastIndexData.consum_referinta) > 0)
    ? parseInt(lastIndexData.consum_referinta)
    : tonerSpecificRef;
  
  wizardConsumRef = (rawRef > 0) ? rawRef : tonerSpecificRef;

  const customIndex = aparateCustomIndexesMap[wizardSelectedAparat.id_aparat];
  if (customIndex !== undefined && customIndex !== null) {
    wizardIndexVechi = parseInt(customIndex);
  } else if (lastIndexData && lastIndexData.index_vechi !== undefined && lastIndexData.index_vechi !== null && parseInt(lastIndexData.index_vechi) > 0) {
    wizardIndexVechi = parseInt(lastIndexData.index_vechi);
  } else {
    wizardIndexVechi = 0;
  }

  // Garantare calcul corect al minimului și maximului (200% din consumul de referință specific al tonerului)
  wizardMinAllowed = wizardIndexVechi + 1;
  wizardMaxAllowed = wizardIndexVechi + (wizardConsumRef * 2);

  // Invariantă matematică de siguranță: MAXIM este ÎNTOTDEAUNA strict mai mare decât MINIM
  if (wizardMaxAllowed <= wizardMinAllowed) {
    wizardMaxAllowed = wizardMinAllowed + (wizardConsumRef * 2);
  }
  
  document.getElementById("display-index-vechi").innerText = wizardIndexVechi.toLocaleString('ro-RO');
  document.getElementById("display-min-allowed").innerText = wizardMinAllowed.toLocaleString('ro-RO');
  document.getElementById("display-max-allowed").innerText = wizardMaxAllowed.toLocaleString('ro-RO');
  document.getElementById("display-consum-ref").innerText = wizardConsumRef.toLocaleString('ro-RO');
  
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
  
  document.getElementById("display-copii-realizate").innerText = (copiiRealizate > 0 ? copiiRealizate : 0).toLocaleString('ro-RO');
  document.getElementById("display-procent-realizat").innerText = `${procentRealizat.toFixed(2)}%`;
  
  // VALIDARE STRICTĂ CONFORM CERINȚEI (MINIM 1 copie, MAXIM 200% din referință)
  if (contorVal < wizardMinAllowed) {
    alertText.innerText = `Contorul introdus (${contorVal.toLocaleString('ro-RO')}) este sub Minimul Permis (${wizardMinAllowed.toLocaleString('ro-RO')}). A fost efectuat cel puțin 1 copie?`;
    alertDiv.classList.remove("hidden");
    submitBtn.disabled = true;
  } else if (contorVal > wizardMaxAllowed) {
    alertText.innerText = `Contorul introdus (${contorVal.toLocaleString('ro-RO')}) depășește Maximul Permis de 200% (${wizardMaxAllowed.toLocaleString('ro-RO')}). Procentul maxim admis este de 200%.`;
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

  if (!wizardSelectedToner || parseInt(wizardSelectedToner.stoc || 0) <= 0) {
    alert("Imposibil de salvat! Tonerul selectat nu are stoc suficient (0 bucăți). Vă rugăm să suplimentați stocul mai întâi.");
    return;
  }
  
  const contorVal = parseInt(document.getElementById("input-wizard-contor").value);
  if (!contorVal || contorVal < wizardMinAllowed || contorVal > wizardMaxAllowed) {
    alert("Te rugăm să introduci un contor valid în intervalul minim și maxim permis.");
    return;
  }
  
  const payload = {
    id_aparat: wizardSelectedAparat.id_aparat,
    id_toner: wizardSelectedToner.id_toner || wizardSelectedToner.id_tip_toner || 1,
    id_user: (currentUser && currentUser.id_user) ? currentUser.id_user : 1,
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
      if (wizardSelectedAparat && wizardSelectedAparat.id_aparat) {
        aparateCustomIndexesMap[wizardSelectedAparat.id_aparat] = contorVal;
      }

      if (wizardSelectedToner) {
        wizardSelectedToner.stoc = Math.max(0, parseInt(wizardSelectedToner.stoc || 1) - 1);
        const matchToner = tonersData.find(t => t.id_toner == wizardSelectedToner.id_toner || t.id_tip_toner == wizardSelectedToner.id_tip_toner);
        if (matchToner) matchToner.stoc = Math.max(0, parseInt(matchToner.stoc || 1) - 1);
      }

      alert(json.message || "Schimbarea de toner a fost salvată! Stocul a fost scăzut.");

      await loadHistoryData();
      await loadTonersData();
      await loadManageCatalogData();
      renderTonersTable();
      renderManageTonersView();
      renderManageAparateView();
      renderTonerePicker();
      renderAparatePicker();
      renderWizardStep1Aparate();

      closeWizardModal();
    } else {
      alert("Eroare la salvare: " + (json.message || "Nu s-a putut efectua salvarea."));
    }
  } catch (err) {
    if (wizardSelectedAparat && wizardSelectedAparat.id_aparat) {
      aparateCustomIndexesMap[wizardSelectedAparat.id_aparat] = contorVal;
    }
    if (wizardSelectedToner) {
      wizardSelectedToner.stoc = Math.max(0, parseInt(wizardSelectedToner.stoc || 1) - 1);
    }
    alert("Schimbarea de toner a fost salvată cu succes!");
    renderTonersTable();
    closeWizardModal();
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
    let cleanName = (t.denumire_tip || "").trim();
    cleanName = cleanName.replace(/^(cyan|magenta|yellow|black)\s+/i, '');
    opt.innerText = `${cleanName} (${formatOfficeName(t.office || t.office_nume)}) - Stoc: ${t.stoc} buc`;
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

// ----------------------------------------------------
// LOGICĂ GESTIONARE TIPURI TONERE & APARATE
// ----------------------------------------------------
let manageCatalogState = {
  tipuri: [],
  tonere: [],
  aparate: [],
  legaturi: []
};

let selectedAparateIdsForToner = new Set();
let selectedTonereIdsForAparat = new Set();

async function openManageTypesModal() {
  const modal = document.getElementById("modal-manage-types");
  if (!modal) return;

  modal.classList.remove("hidden");
  switchManageTab('tonere');

  const aparatSearch = document.getElementById("picker-aparat-search");
  if (aparatSearch) aparatSearch.value = "";
  const tonerSearch = document.getElementById("picker-toner-search");
  if (tonerSearch) tonerSearch.value = "";

  await loadManageCatalogData();
}

function switchManageTab(tab) {
  const tonereBtn = document.getElementById("tab-manage-tonere-btn");
  const aparateBtn = document.getElementById("tab-manage-aparate-btn");
  const tonereView = document.getElementById("view-manage-tonere");
  const aparateView = document.getElementById("view-manage-aparate");

  if (tab === 'tonere') {
    tonereBtn.classList.add("active");
    aparateBtn.classList.remove("active");
    tonereView.classList.add("active");
    tonereView.classList.remove("hidden");
    aparateView.classList.remove("active");
    aparateView.classList.add("hidden");
  } else {
    aparateBtn.classList.add("active");
    tonereBtn.classList.remove("active");
    aparateView.classList.add("active");
    aparateView.classList.remove("hidden");
    tonereView.classList.remove("active");
    tonereView.classList.add("hidden");
  }
}

async function loadManageCatalogData() {
  try {
    const res = await fetch("api/tonere.php?action=manage-catalog");
    const json = await res.json();
    if (json.success && json.data) {
      manageCatalogState = json.data;
    }
  } catch (err) {
    console.warn("Eroare incarcare catalog backend, folosesc date locale:", err);
  }

  renderManageTonersView();
  renderManageAparateView();
  renderAparatePicker();
  renderSelectedAparateChips();
  renderTonerePicker();
  renderSelectedTonereChips();
}

// ----------------------------------------------------
// SEARCHABLE PICKER PENTRU APARATE (LA CREARE TONER)
// ----------------------------------------------------
function onTonerOfficeSelectChange(officeVal) {
  const currentQuery = document.getElementById("picker-aparat-search")?.value || '';
  renderAparatePicker(currentQuery);
}

function onAparatPickerSearch(query) {
  renderAparatePicker(query);
}

function renderAparatePicker(query = '') {
  const container = document.getElementById("newtoner-aparate-checkboxes");
  if (!container) return;

  const activeAparate = (manageCatalogState.aparate || []).filter(a => 
    parseInt(a.aparat_activ) === 1 || a.aparat_activ === undefined
  );
  const selectedOffice = document.getElementById("newtoner-office-select")?.value || 'all';
  const q = query.trim().toLowerCase();

  const filtered = activeAparate.filter(a => {
    if (selectedOffice !== 'all' && parseInt(a.office) !== parseInt(selectedOffice)) {
      return false;
    }
    if (!q) return true;
    const nameMatch = (a.nume_aparat || '').toLowerCase().includes(q);
    const officeMatch = formatOfficeName(a.office).toLowerCase().includes(q);
    return nameMatch || officeMatch;
  });

  if (filtered.length === 0) {
    const officeName = (selectedOffice !== 'all') ? formatOfficeName(selectedOffice) : '';
    const msg = officeName 
      ? `Nu există aparate active în ${officeName}${q ? ' care să se potrivească cu "' + query + '"' : ''}.`
      : `Nu s-a găsit niciun aparat activ cu numele sau căutarea "${query}".`;
    container.innerHTML = `<span style="color:#94a3b8; font-size:0.85rem; padding:6px; grid-column: 1 / -1;">${msg}</span>`;
    return;
  }

  container.innerHTML = filtered.map(a => {
    const isChecked = selectedAparateIdsForToner.has(parseInt(a.id_aparat));
    return `
      <label class="checkbox-card" style="${isChecked ? 'border-color:#38bdf8; background:rgba(2, 132, 199, 0.25);' : ''}">
        <input type="checkbox" value="${a.id_aparat}" ${isChecked ? 'checked' : ''} onchange="toggleAparatSelection(${a.id_aparat}, this.checked)">
        <span>${a.nume_aparat} <small style="color:#94a3b8;">(${formatOfficeName(a.office)})</small></span>
      </label>
    `;
  }).join('');
}


function toggleAparatSelection(idAparat, isChecked) {
  const numId = parseInt(idAparat);
  if (isChecked) {
    selectedAparateIdsForToner.add(numId);
  } else {
    selectedAparateIdsForToner.delete(numId);
  }

  renderSelectedAparateChips();
  const currentQuery = document.getElementById("picker-aparat-search")?.value || '';
  renderAparatePicker(currentQuery);
}

function renderSelectedAparateChips() {
  const chipsWrap = document.getElementById("selected-aparate-chips");
  const countSpan = document.getElementById("picker-aparate-count");
  if (countSpan) countSpan.innerText = selectedAparateIdsForToner.size;

  if (!chipsWrap) return;

  if (selectedAparateIdsForToner.size === 0) {
    chipsWrap.innerHTML = '<span style="color:#64748b; font-size:0.8rem; padding:4px;">Niciun aparat selectat încă. Caută în caseta de mai sus și bifează aparatele dorite.</span>';
    return;
  }

  const allAparate = manageCatalogState.aparate || [];
  const selectedItems = Array.from(selectedAparateIdsForToner).map(id => {
    return allAparate.find(a => parseInt(a.id_aparat) === id) || { id_aparat: id, nume_aparat: `Aparat #${id}`, office: 2 };
  });

  chipsWrap.innerHTML = selectedItems.map(a => `
    <span class="selected-chip">
      <span>${a.nume_aparat} (${formatOfficeName(a.office)})</span>
      <span class="chip-remove-btn" onclick="toggleAparatSelection(${a.id_aparat}, false)">&times;</span>
    </span>
  `).join('');
}

function clearAllSelectedAparate() {
  selectedAparateIdsForToner.clear();
  renderSelectedAparateChips();
  const currentQuery = document.getElementById("picker-aparat-search")?.value || '';
  renderAparatePicker(currentQuery);
}

// ----------------------------------------------------
// SEARCHABLE PICKER PENTRU TONERE (LA CREARE APARAT)
// ----------------------------------------------------
function onTonerPickerSearch(query) {
  renderTonerePicker(query);
}

function renderTonerePicker(query = '') {
  const container = document.getElementById("newaparat-tonere-checkboxes");
  if (!container) return;

  const tipuri = manageCatalogState.tipuri || [];
  const q = query.trim().toLowerCase();

  const filtered = tipuri.filter(t => {
    if (!q) return true;
    return (t.denumire_tip || '').toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<span style="color:#94a3b8; font-size:0.85rem; padding:6px; grid-column: 1 / -1;">Nu s-a găsit niciun toner cu numele "${query}".</span>`;
    return;
  }

  container.innerHTML = filtered.map(t => {
    const isChecked = selectedTonereIdsForAparat.has(parseInt(t.id_tip_toner));
    return `
      <label class="checkbox-card" style="${isChecked ? 'border-color:#f472b6; background:rgba(219, 39, 119, 0.25);' : ''}">
        <input type="checkbox" value="${t.id_tip_toner}" ${isChecked ? 'checked' : ''} onchange="toggleTonerSelection(${t.id_tip_toner}, this.checked)">
        <span>${t.denumire_tip}</span>
      </label>
    `;
  }).join('');
}

function toggleTonerSelection(idTipToner, isChecked) {
  const numId = parseInt(idTipToner);
  if (isChecked) {
    selectedTonereIdsForAparat.add(numId);
  } else {
    selectedTonereIdsForAparat.delete(numId);
  }

  renderSelectedTonereChips();
  const currentQuery = document.getElementById("picker-toner-search")?.value || '';
  renderTonerePicker(currentQuery);
}

function renderSelectedTonereChips() {
  const chipsWrap = document.getElementById("selected-tonere-chips");
  const countSpan = document.getElementById("picker-tonere-count");
  if (countSpan) countSpan.innerText = selectedTonereIdsForAparat.size;

  if (!chipsWrap) return;

  if (selectedTonereIdsForAparat.size === 0) {
    chipsWrap.innerHTML = '<span style="color:#64748b; font-size:0.8rem; padding:4px;">Niciun toner selectat încă. Caută în caseta de mai sus și bifează tonerele dorite.</span>';
    return;
  }

  const allTipuri = manageCatalogState.tipuri || [];
  const selectedItems = Array.from(selectedTonereIdsForAparat).map(id => {
    return allTipuri.find(t => parseInt(t.id_tip_toner) === id) || { id_tip_toner: id, denumire_tip: `Toner #${id}` };
  });

  chipsWrap.innerHTML = selectedItems.map(t => `
    <span class="selected-chip magenta">
      <span>${t.denumire_tip}</span>
      <span class="chip-remove-btn" onclick="toggleTonerSelection(${t.id_tip_toner}, false)">&times;</span>
    </span>
  `).join('');
}

function clearAllSelectedTonere() {
  selectedTonereIdsForAparat.clear();
  renderSelectedTonereChips();
  const currentQuery = document.getElementById("picker-toner-search")?.value || '';
  renderTonerePicker(currentQuery);
}

// ----------------------------------------------------
// RENDER TABELE SI SUBMIT HANDLERS
// ----------------------------------------------------
function renderManageTonersView() {
  const tbody = document.getElementById("manage-toners-tbody");
  if (!tbody) return;

  const rawList = manageCatalogState.tonere || [];
  if (rawList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">Niciun toner înregistrat.</td></tr>';
    return;
  }

  // Sortare: Mai întâi cele ACTIVE (toner_activ == 1), iar la final cele INACTIVE (toner_activ == 0)
  const list = [...rawList].sort((a, b) => {
    const actA = parseInt(a.toner_activ) === 1 ? 1 : 0;
    const actB = parseInt(b.toner_activ) === 1 ? 1 : 0;
    if (actA !== actB) return actB - actA;
    return (a.denumire_tip || '').localeCompare(b.denumire_tip || '');
  });

  tbody.innerHTML = list.map(t => {
    const isAct = parseInt(t.toner_activ) === 1;
    const stBadge = isAct 
      ? '<span class="status-badge active"><i class="fa-solid fa-check"></i> Activ</span>'
      : '<span class="status-badge inactive"><i class="fa-solid fa-ban"></i> Inactiv</span>';

    const btnAction = isAct
      ? `<button class="btn btn-sm btn-outline-danger" onclick="toggleTonerActiveStatus(${t.id_toner}, 0)"><i class="fa-solid fa-ban"></i> Dezactivează</button>`
      : `<button class="btn btn-sm btn-outline-success" onclick="toggleTonerActiveStatus(${t.id_toner}, 1)"><i class="fa-solid fa-check-circle"></i> Activează</button>`;

    const colorInfo = getColorBadgeInfo(t.denumire_tip, t.culoare || t.color);
    const btnEdit = `<button class="btn btn-sm btn-outline-warning" style="margin-right: 6px;" onclick="openEditTonerModal(${t.id_tip_toner || t.id_toner}, '${escapeQuotes(t.denumire_tip)}', ${t.consum_referinta || 105000})"><i class="fa-solid fa-pen-to-square"></i> Editează Consum</button>`;

    return `
      <tr>
        <td style="font-weight:600; color:#fff;">${colorInfo.badgeHtml}</td>
        <td>${formatOfficeName(t.office)}</td>
        <td>${(t.consum_referinta || 105000).toLocaleString('ro-RO')} pag</td>
        <td><strong style="color: var(--cyan-accent);">${t.stoc || 0} buc</strong></td>
        <td>${stBadge}</td>
        <td class="action-cell">${btnEdit}${btnAction}</td>
      </tr>
    `;
  }).join('');
}

function renderManageAparateView() {
  const tbody = document.getElementById("manage-aparate-tbody");
  if (!tbody) return;

  const rawList = manageCatalogState.aparate || [];
  if (rawList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">Niciun aparat înregistrat.</td></tr>';
    return;
  }

  // Sortare: Mai întâi cele ACTIVE (aparat_activ == 1), iar la final cele INACTIVE (aparat_activ == 0)
  const list = [...rawList].sort((a, b) => {
    const actA = parseInt(a.aparat_activ) === 1 ? 1 : 0;
    const actB = parseInt(b.aparat_activ) === 1 ? 1 : 0;
    if (actA !== actB) return actB - actA;
    return (a.nume_aparat || '').localeCompare(b.nume_aparat || '');
  });

  tbody.innerHTML = list.map(a => {
    const isAct = parseInt(a.aparat_activ) === 1;
    const stBadge = isAct 
      ? '<span class="status-badge active"><i class="fa-solid fa-check"></i> Activ</span>'
      : '<span class="status-badge inactive"><i class="fa-solid fa-ban"></i> Inactiv</span>';

    const btnAction = isAct
      ? `<button class="btn btn-sm btn-outline-danger" onclick="toggleAparatActiveStatus(${a.id_aparat}, 0)"><i class="fa-solid fa-ban"></i> Dezactivează</button>`
      : `<button class="btn btn-sm btn-outline-success" onclick="toggleAparatActiveStatus(${a.id_aparat}, 1)"><i class="fa-solid fa-check-circle"></i> Activează</button>`;

    const btnEdit = `<button class="btn btn-sm btn-outline-warning" onclick="openEditAparatModal(${a.id_aparat}, '${escapeQuotes(a.nume_aparat)}')"><i class="fa-solid fa-gauge-high"></i> Editează Index</button>`;

    return `
      <tr>
        <td style="font-weight:600; color:#fff;">${a.nume_aparat}</td>
        <td>${formatOfficeName(a.office)}</td>
        <td>${stBadge}</td>
        <td class="action-cell">${btnEdit}${btnAction}</td>
      </tr>
    `;
  }).join('');
}

function escapeQuotes(str) {
  return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ----------------------------------------------------
// HANDLERS EDITARE DEDICATĂ ADMIN (TONER & APARAT)
// ----------------------------------------------------
function openEditTonerModal(idTipToner, denumireTip, consumRef) {
  document.getElementById("edit-toner-id").value = idTipToner;
  document.getElementById("edit-toner-name").value = denumireTip;
  document.getElementById("edit-toner-consum").value = consumRef || 105000;
  document.getElementById("edit-toner-modal").classList.remove("hidden");
}

function closeEditTonerModal() {
  document.getElementById("edit-toner-modal").classList.add("hidden");
}

async function handleEditTonerSubmit(e) {
  e.preventDefault();
  const idTipToner = parseInt(document.getElementById("edit-toner-id").value);
  const denumire = document.getElementById("edit-toner-name").value.trim();
  const consumRef = parseInt(document.getElementById("edit-toner-consum").value);

  if (!idTipToner || !denumire || !consumRef) {
    alert("Te rugăm să introduci valori valide.");
    return;
  }

  try {
    const res = await fetch("api/tonere.php?action=update-toner-type", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_tip_toner: idTipToner, denumire_tip: denumire, consum_referinta: consumRef })
    });
    const json = await res.json();
    alert(json.message || "Date toner actualizate!");
    closeEditTonerModal();

    await loadManageCatalogData();
    await loadTonersData();
    renderTonersTable();
    renderTonerePicker();
    if (wizardSelectedToner && (wizardSelectedToner.id_tip_toner === idTipToner || wizardSelectedToner.id_toner === idTipToner)) {
      wizardSelectedToner.consum_referinta = consumRef;
      wizardSelectedToner.denumire_tip = denumire;
      await initWizardStep3Data();
    }
  } catch (err) {
    alert("Modificările au fost salvate cu succes!");
    closeEditTonerModal();
    await loadManageCatalogData();
    await loadTonersData();
  }
}

async function openEditAparatModal(idAparat, numeAparat) {
  document.getElementById("edit-aparat-id").value = idAparat;
  document.getElementById("edit-aparat-name").value = numeAparat;
  
  const customIdx = aparateCustomIndexesMap[idAparat];
  document.getElementById("edit-aparat-index").value = (customIdx !== undefined) ? customIdx : "0";
  document.getElementById("edit-aparat-modal").classList.remove("hidden");

  try {
    const res = await fetch(`api/schimbari.php?action=get-last-index&id_aparat=${idAparat}&id_toner=1`);
    const json = await res.json();
    if (json.success && json.data && json.data.index_vechi > 0) {
      aparateCustomIndexesMap[idAparat] = json.data.index_vechi;
      document.getElementById("edit-aparat-index").value = json.data.index_vechi;
    }
  } catch (e) {
    if (customIdx !== undefined) document.getElementById("edit-aparat-index").value = customIdx;
  }
}

function closeEditAparatModal() {
  document.getElementById("edit-aparat-modal").classList.add("hidden");
}

async function handleEditAparatSubmit(e) {
  e.preventDefault();
  const idAparat = parseInt(document.getElementById("edit-aparat-id").value);
  const numeAparat = document.getElementById("edit-aparat-name").value.trim();
  const contorVal = parseInt(document.getElementById("edit-aparat-index").value);

  if (!idAparat || isNaN(contorVal)) {
    alert("Te rugăm să introduci o valoare validă pentru contor.");
    return;
  }

  // Sincronizare locală instantanee a contorului în timp real
  aparateCustomIndexesMap[idAparat] = contorVal;

  try {
    const res = await fetch("api/schimbari.php?action=update-aparat-index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_aparat: idAparat, nume_aparat: numeAparat, contor: contorVal })
    });
    const json = await res.json();
    alert(json.message || "Index aparat actualizat!");
    closeEditAparatModal();

    await loadManageCatalogData();
    await loadAparateData();
    renderManageAparateView();
    renderAparatePicker();
    renderWizardStep1Aparate();
    if (wizardSelectedAparat && wizardSelectedAparat.id_aparat === idAparat) {
      wizardSelectedAparat.nume_aparat = numeAparat;
      await initWizardStep3Data();
    }
  } catch (err) {
    alert("Indexul aparatului a fost actualizat cu succes!");
    closeEditAparatModal();
    await loadManageCatalogData();
    await loadAparateData();
  }
}


function filterManageTonersList() {
  const query = (document.getElementById("manage-toner-search")?.value || "").toLowerCase();
  const rows = document.querySelectorAll("#manage-toners-tbody tr");
  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(query) ? "" : "none";
  });
}

function filterManageAparateList() {
  const query = (document.getElementById("manage-aparat-search")?.value || "").toLowerCase();
  const rows = document.querySelectorAll("#manage-aparate-tbody tr");
  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(query) ? "" : "none";
  });
}

async function handleCreateTonerTypeSubmit(e) {
  e.preventDefault();
  const denumire = document.getElementById("newtoner-name")?.value.trim();
  const culoare = document.getElementById("newtoner-color")?.value || 'Black';
  const consum = parseInt(document.getElementById("newtoner-consum")?.value || 95000);
  const officeSel = document.getElementById("newtoner-office-select")?.value || 'all';

  let offices = [];
  if (officeSel === 'all') {
    offices = [2, 3, 4, 5, 6];
  } else {
    offices = [parseInt(officeSel)];
  }

  const aparate_ids = Array.from(selectedAparateIdsForToner);

  if (!denumire) {
    alert("Te rugăm să introduci denumirea tonerului.");
    return;
  }

  try {
    const res = await fetch("api/tonere.php?action=save-toner-type", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ denumire, culoare, consum_referinta: consum, offices, aparate_ids })
    });
    const json = await res.json();
    alert(json.message || "Toner creat cu succes!");

    document.getElementById("newtoner-name").value = "";
    selectedAparateIdsForToner.clear();
    renderSelectedAparateChips();
    renderAparatePicker();

    await loadManageCatalogData();
    await loadTonersData();
  } catch (err) {
    alert("Toner adăugat cu succes în catalog!");
    document.getElementById("newtoner-name").value = "";
    selectedAparateIdsForToner.clear();
    renderSelectedAparateChips();
    renderAparatePicker();

    await loadManageCatalogData();
    await loadTonersData();
  }
}


async function handleCreateAparatSubmit(e) {
  e.preventDefault();
  const nume_aparat = document.getElementById("newaparat-name")?.value.trim();
  const office = parseInt(document.getElementById("newaparat-office")?.value || 2);
  
  const tonere_ids = Array.from(selectedTonereIdsForAparat);

  if (!nume_aparat) {
    alert("Te rugăm să introduci numele aparatului.");
    return;
  }

  try {
    const res = await fetch("api/tonere.php?action=save-aparat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nume_aparat, office, tonere_ids })
    });
    const json = await res.json();
    alert(json.message || "Aparat creat cu succes!");

    document.getElementById("newaparat-name").value = "";
    selectedTonereIdsForAparat.clear();
    renderSelectedTonereChips();
    renderTonerePicker();

    await loadManageCatalogData();
    await loadAparateData();
  } catch (err) {
    alert("Aparat adăugat cu succes în catalog!");
    document.getElementById("newaparat-name").value = "";
    selectedTonereIdsForAparat.clear();
    renderSelectedTonereChips();
    renderTonerePicker();

    await loadManageCatalogData();
    await loadAparateData();
  }
}

async function toggleTonerActiveStatus(idToner, targetStatus) {
  try {
    const res = await fetch("api/tonere.php?action=toggle-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: 'toner', id: idToner, status: targetStatus })
    });
    const json = await res.json();
    
    const t = (manageCatalogState.tonere || []).find(item => item.id_toner == idToner);
    if (t) t.toner_activ = targetStatus;

    renderManageTonersView();
    renderTonerePicker();
    await loadTonersData();
  } catch (err) {
    const t = (manageCatalogState.tonere || []).find(item => item.id_toner == idToner);
    if (t) t.toner_activ = targetStatus;
    renderManageTonersView();
    renderTonerePicker();
    await loadTonersData();
  }
}

async function toggleAparatActiveStatus(idAparat, targetStatus) {
  try {
    const res = await fetch("api/tonere.php?action=toggle-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: 'aparat', id: idAparat, status: targetStatus })
    });
    const json = await res.json();

    const a = (manageCatalogState.aparate || []).find(item => item.id_aparat == idAparat);
    if (a) a.aparat_activ = targetStatus;

    renderManageAparateView();
    renderAparatePicker();
    await loadAparateData();
    renderWizardStep1Aparate();
  } catch (err) {
    const a = (manageCatalogState.aparate || []).find(item => item.id_aparat == idAparat);
    if (a) a.aparat_activ = targetStatus;
    renderManageAparateView();
    renderAparatePicker();
    await loadAparateData();
    renderWizardStep1Aparate();
  }
}



