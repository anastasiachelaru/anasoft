// =============================================================================
// PIM Iași - Modul Autentificare, Sesiuni & Roluri RBAC (js/auth.js)
// =============================================================================

let currentLoginRole = "operator"; // "operator" sau "admin"
let currentPin = "";
let maxPinLength = 6;
let currentUser = null;

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

function switchLoginRole(role) {
  currentLoginRole = role;
  currentPin = "";
  maxPinLength = (role === "admin") ? 12 : 6;

  const opBtn = document.getElementById("role-operator-btn");
  const adminBtn = document.getElementById("role-admin-btn");
  const instText = document.getElementById("pin-instruction-text");
  const authTabs = document.querySelector(".auth-tabs");

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
    if (authTabs) authTabs.style.display = "flex";
    switchAuthTab('pass');
    if (instText) instText.innerText = "Conectează-te cu User & Parolă de Administrator sau folosește codul PIN de 12 cifre:";
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
    if (authTabs) authTabs.style.display = "none";
    switchAuthTab('pin');
    if (instText) instText.innerText = "Introdu codul PIN din 6 cifre atribuit contului tău de Operator:";
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

function switchAuthTab(tab) {
  const pinBtn = document.getElementById("tab-pin-btn");
  const passBtn = document.getElementById("tab-pass-btn");
  const pinView = document.getElementById("auth-pin-view");
  const passView = document.getElementById("auth-pass-view");
  
  if (tab === "pin") {
    if (pinBtn) pinBtn.classList.add("active");
    if (passBtn) passBtn.classList.remove("active");
    if (pinView) pinView.classList.add("active");
    if (passView) passView.classList.remove("active");
  } else {
    if (passBtn) passBtn.classList.add("active");
    if (pinBtn) pinBtn.classList.remove("active");
    if (passView) passView.classList.add("active");
    if (pinView) pinView.classList.remove("active");
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

async function submitPinLogin() {
  hideAuthError();
  const pinToSubmit = String(currentPin || "").trim();
  const roleToSubmit = currentLoginRole;

  if (!pinToSubmit) return;

  try {
    const response = await fetch("api/auth.php?action=login-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pinToSubmit, role: roleToSubmit })
    });
    
    const result = await response.json();
    if (result && result.success && result.data && result.data.user) {
      handleLoginSuccess(result.data.user, result.data.token);
    } else {
      showAuthError((result && result.message) ? result.message : "Cod PIN incorect.");
      clearPinKey();
    }
  } catch (err) {
    showAuthError("Eroare de conectare la server sau PIN invalid.");
    clearPinKey();
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
    if (result && result.success && result.data && result.data.user) {
      handleLoginSuccess(result.data.user, result.data.token);
    } else {
      showAuthError((result && result.message) ? result.message : "Utilizator sau parolă incorectă.");
    }
  } catch (err) {
    showAuthError("Eroare de conexiune la server. Te rugăm să reîncerci.");
  }
}

function showAuthError(msg) {
  const errDiv = document.getElementById("auth-error-msg");
  if (errDiv) {
    errDiv.innerText = msg;
    errDiv.classList.remove("hidden");
  }
}

function hideAuthError() {
  const errDiv = document.getElementById("auth-error-msg");
  if (errDiv) {
    errDiv.classList.add("hidden");
  }
}

function handleLoginSuccess(user, token) {
  currentUser = user;
  if (token) {
    try {
      localStorage.setItem("pim_auth_token", token);
    } catch (e) {}
  }
  try {
    localStorage.setItem("pim_toner_user", JSON.stringify(user));
  } catch (e) {}
  
  const authScr = document.getElementById("auth-screen");
  const appScr = document.getElementById("app-screen");
  if (authScr) {
    authScr.classList.remove("active");
    authScr.style.setProperty("display", "none", "important");
  }
  if (appScr) {
    appScr.classList.add("active");
    appScr.style.setProperty("display", "flex", "important");
  }

  window.scrollTo(0, 0);
  
  try {
    renderUserHeader();
    if (typeof loadOfficesData === 'function') loadOfficesData();
    if (typeof loadTonersData === 'function') loadTonersData();
    if (typeof loadAparateData === 'function') loadAparateData();
    if (typeof loadHistoryData === 'function') loadHistoryData();
  } catch (e) {
    console.error("Eroare la încărcarea datelor după autentificare:", e);
  }
}

async function checkExistingSession() {
  const saved = localStorage.getItem("pim_toner_user");
  const token = localStorage.getItem("pim_auth_token");
  if (saved) {
    try {
      const user = JSON.parse(saved);
      if (user && user.id_user) {
        // Validăm sesiunea în mod silențios cu backend-ul
        try {
          const res = await fetch("api/auth.php?action=check-session");
          const json = await res.json();
          if (json && json.success && json.data && json.data.user) {
            handleLoginSuccess(json.data.user, token);
            return;
          }
        } catch (e) {
          // În caz de deconectare temporară de rețea, menținem starea locală
          handleLoginSuccess(user, token);
          return;
        }
      }
    } catch (e) {
      localStorage.removeItem("pim_toner_user");
      localStorage.removeItem("pim_auth_token");
    }
  }
}

async function logout() {
  currentUser = null;
  localStorage.removeItem("pim_toner_user");
  localStorage.removeItem("pim_auth_token");
  clearPinKey();
  
  try {
    await originalFetch("api/auth.php?action=logout", {
      method: "POST",
      credentials: "same-origin"
    });
  } catch (e) {}

  const authScr = document.getElementById("auth-screen");
  const appScr = document.getElementById("app-screen");
  if (appScr) {
    appScr.classList.remove("active");
    appScr.style.setProperty("display", "none", "important");
  }
  if (authScr) {
    authScr.classList.add("active");
    authScr.style.setProperty("display", "flex", "important");
  }

  window.scrollTo(0, 0);
}

function renderUserHeader() {
  if (!currentUser) return;
  
  const roleBadge = document.getElementById("user-role-badge");
  const nameDisplay = document.getElementById("user-name-display");
  
  const fn = (currentUser.first_name || "").trim();
  const ln = (currentUser.last_name || "").trim();
  const fullName = (fn || ln) ? `${fn} ${ln}`.trim() : (currentUser.username || "Operator");
  
  if (nameDisplay) {
    nameDisplay.innerText = fullName;
  }
  
  const userRole = (currentUser.role || "operator").toLowerCase();
  const isAdmin = (userRole === "admin");
  const selectElem = document.getElementById("office-filter-select") || document.getElementById("header-office-filter");
  
  if (roleBadge) {
    roleBadge.innerText = userRole;
    if (isAdmin) {
      roleBadge.classList.add("admin");
    } else {
      roleBadge.classList.remove("admin");
    }
  }

  if (isAdmin) {
    document.querySelectorAll(".admin-only").forEach(el => el.classList.remove("hidden"));
    document.getElementById("nav-istoric-btn")?.classList.remove("hidden");
    if (selectElem) {
      selectElem.disabled = false;
      const off = currentUser ? currentUser.office : null;
      if (!off || off === 'ALL' || off === 'all' || off === 'toate' || off === '0' || off === 0) {
        if (typeof currentOfficeFilter !== 'undefined') currentOfficeFilter = "all";
        selectElem.value = "all";
      } else {
        if (typeof currentOfficeFilter !== 'undefined') currentOfficeFilter = String(off);
        selectElem.value = String(off);
      }
    }
    if (typeof loadUsersData === 'function') loadUsersData();
  } else {
    document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
    document.getElementById("nav-istoric-btn")?.classList.remove("hidden");
    
    // Operatorul vede DOAR sediul la care a fost asignat!
    if (typeof currentOfficeFilter !== 'undefined') {
      currentOfficeFilter = String(currentUser.office || 4);
    }
    if (selectElem) {
      selectElem.value = currentUser.office || 4;
      selectElem.disabled = true;
    }
    if (typeof switchSection === 'function') {
      switchSection("schimbare");
    }
  }
}
