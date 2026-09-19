// =============================================================================
// PIM Iași - Modul Management Utilizatori (js/users.js)
// =============================================================================

let usersData = [];
let currentUserStatusFilter = 'all'; // 'all', 'activ', 'inactiv'

function setUserStatusFilter(statusFilter) {
  currentUserStatusFilter = statusFilter;
  const buttons = ['all', 'activ', 'inactiv'];
  buttons.forEach(b => {
    const btn = document.getElementById(`filter-user-${b}`);
    if (btn) {
      if (b === statusFilter) {
        btn.classList.add('active');
        btn.style.background = '#0284c7';
        btn.style.borderColor = '#38bdf8';
        btn.style.color = '#ffffff';
      } else {
        btn.classList.remove('active');
        btn.style.background = 'rgba(30, 41, 59, 0.6)';
        btn.style.borderColor = 'rgba(148, 163, 184, 0.2)';
        btn.style.color = '#94a3b8';
      }
    }
  });
  renderUsersTable();
}

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
      { id_user: 173, username: 'anastasia', role: 'admin', office: 'ALL', office_nume: 'Toate sediile PIM', full_name: 'Anastasia Chelaru', cont_active: 1, status: 'activ' },
      { id_user: 117, username: 'eugenadmin', role: 'admin', office: 'ALL', office_nume: 'Toate sediile PIM', full_name: 'Eugen Admin', cont_active: 1, status: 'activ' }
    ];
  }
  
  renderUsersTable();
  populateEditUserSelect();
}

function populateEditUserSelect() {
  const select = document.getElementById("edituser-select");
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = "";
  if (!usersData || usersData.length === 0) return;
  usersData.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.id_user;
    const st = u.status || ((parseInt(u.cont_active) === 1) ? 'activ' : 'inactiv');
    const statusText = (st === 'inactiv') ? ' (Inactiv)' : '';
    opt.innerText = `${u.full_name || u.username} (@${u.username})${statusText} - ${formatOfficeName(u.office || u.office_nume)}`;
    select.appendChild(opt);
  });
  if (currentVal && usersData.some(u => u.id_user == currentVal)) {
    select.value = currentVal;
  }
}

function renderUsersTable() {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!usersData || usersData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:28px; color:#94a3b8;"><i class="fa-solid fa-users-slash" style="font-size:1.5rem; margin-bottom:8px; display:block;"></i>Nu au fost găsiți utilizatori în baza de date.<br>Apasă pe butonul <strong style="color:#38bdf8;">"+ Utilizator Nou"</strong> pentru a crea un cont.</td></tr>`;
    return;
  }

  const filteredUsers = usersData.filter(u => {
    const st = u.status || ((parseInt(u.cont_active) === 1) ? 'activ' : 'inactiv');
    if (currentUserStatusFilter === 'activ') return st === 'activ';
    if (currentUserStatusFilter === 'inactiv') return st === 'inactiv';
    return true;
  });

  if (filteredUsers.length === 0) {
    const label = (currentUserStatusFilter === 'activ') ? 'activi' : 'inactivi';
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:28px; color:#94a3b8;"><i class="fa-solid fa-user-slash" style="font-size:1.5rem; margin-bottom:8px; display:block;"></i>Nu există utilizatori ${label} în baza de date.</td></tr>`;
    return;
  }

  filteredUsers.forEach(u => {
    const tr = document.createElement("tr");
    const PROTECTED_ADMIN_USERNAMES = ['eugenadmin', 'anastasia'];
    const isSuperAdmin = u.username && PROTECTED_ADMIN_USERNAMES.includes(u.username.toLowerCase().trim());
    const isAdmin = u.role === "admin" || (u.username && u.username.toLowerCase().includes("admin"));
    const roleBadgeClass = isAdmin ? "badge-primary" : "badge-secondary";
    const roleLabel = isAdmin ? "Administrator" : "Operator (Angajat)";
    
    const userStatus = u.status || ((parseInt(u.cont_active) === 1) ? 'activ' : 'inactiv');
    const isActive = userStatus === 'activ' && parseInt(u.cont_active) !== 0;

    const statusBadge = isActive 
      ? '<span class="badge" style="background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); padding: 4px 8px; border-radius: 6px;"><i class="fa-solid fa-circle-check"></i> Activ</span>' 
      : '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 8px; border-radius: 6px;"><i class="fa-solid fa-circle-minus"></i> Inactiv</span>';

    // Verificăm dacă utilizatorul din rând este cel conectat în prezent
    const isCurrentLoggedInUser = currentUser && (
      (currentUser.id_user && parseInt(currentUser.id_user) === parseInt(u.id_user)) || 
      (currentUser.username && u.username && currentUser.username.toLowerCase() === u.username.toLowerCase())
    );

    let actionsHtml = "";
    if (isSuperAdmin) {
      const editBtn = `<button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="openEditUserModal(${u.id_user})"><i class="fa-solid fa-user-pen"></i> Editează</button>`;
      const protBadge = `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); padding: 6px 10px; font-size: 0.78rem;" title="Contul de administrator (@${u.username}) este protejat și nu poate fi șters sau dezactivat"><i class="fa-solid fa-shield-halved"></i> Protejat</span>`;
      actionsHtml = `<div style="display:flex; gap:6px; align-items:center;">${editBtn}${protBadge}</div>`;
    } else {
      const editBtn = `<button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="openEditUserModal(${u.id_user})"><i class="fa-solid fa-user-pen"></i> Editează</button>`;
      const toggleBtn = `<button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="toggleUserStatus(${u.id_user})">${isActive ? 'Dezactivează' : 'Activează'}</button>`;
      
      let deleteBtn = "";
      if (isCurrentLoggedInUser) {
        deleteBtn = `<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 5px 10px; font-size: 0.75rem;" title="Nu îți poți șterge propriul cont pe care ești conectat"><i class="fa-solid fa-user-check"></i> Cont Conectat</span>`;
      } else {
        deleteBtn = `<button class="btn btn-outline-danger" style="padding: 4px 10px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px;" onclick="deleteUser(${u.id_user}, '${u.username}')" title="Șterge definitiv contul"><i class="fa-solid fa-trash-can"></i> Șterge</button>`;
      }
      
      actionsHtml = `<div style="display:flex; gap:6px; align-items:center;">${editBtn}${toggleBtn}${deleteBtn}</div>`;
    }

    tr.innerHTML = `
      <td>
        <strong>${u.full_name || u.username}</strong>
        ${isCurrentLoggedInUser ? ' <span class="badge" style="background:rgba(56, 189, 248, 0.2); color:#38bdf8; border:1px solid rgba(56,189,248,0.4); font-size:0.7rem; padding:2px 6px;">(Tu)</span>' : ''}
        <br><small style="color:#94a3b8;">@${u.username} (ID #${u.id_user})</small>
      </td>
      <td><span class="badge ${roleBadgeClass}">${roleLabel}</span></td>
      <td><span class="office-badge">${formatOfficeName(u.office || u.office_nume)}</span></td>
      <td>${statusBadge}</td>
      <td>${actionsHtml}</td>
    `;
    tbody.appendChild(tr);
  });
}

function openEditUserModal(userId) {
  const select = document.getElementById("edituser-select");
  if (!select) return;

  if (!usersData || usersData.length === 0) {
    alert("Nu există utilizatori încărcați.");
    return;
  }

  populateEditUserSelect();

  if (userId) {
    select.value = userId;
  }

  onEditUserSelectChange();
  openModal("modal-edit-user");
}

function generateRandomUserPin(formType) {
  const roleSelect = document.getElementById(`${formType}-role`);
  const role = roleSelect ? roleSelect.value : 'operator';

  let newPin = '';
  if (role === 'admin') {
    newPin = '';
    for (let i = 0; i < 12; i++) {
      newPin += Math.floor(Math.random() * 10).toString();
    }
  } else {
    newPin = String(Math.floor(100000 + Math.random() * 900000));
  }

  const pinInput = document.getElementById(`${formType}-pin`);
  if (pinInput) {
    pinInput.value = newPin;
  }
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const icon = btn ? btn.querySelector('i') : null;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.className = 'fa-solid fa-eye-slash';
  } else {
    input.type = 'password';
    if (icon) icon.className = 'fa-solid fa-eye';
  }
}

function onUserModalRoleChange(formType) {
  const roleSelect = document.getElementById(`${formType}-role`);
  const officeSelect = document.getElementById(`${formType}-office`);
  const officeAllOption = document.getElementById(`${formType}-office-all`);
  const pinInput = document.getElementById(`${formType}-pin`);
  const pinLabel = document.getElementById(`${formType}-pin-label`);
  const pinGroup = document.getElementById(`${formType}-pin-group`);

  const role = roleSelect ? roleSelect.value : 'operator';

  if (role === 'admin') {
    if (officeAllOption) {
      officeAllOption.style.display = '';
      officeAllOption.disabled = false;
    }
  } else {
    if (officeAllOption) {
      officeAllOption.style.display = 'none';
      officeAllOption.disabled = true;
    }
    if (officeSelect && officeSelect.value === 'ALL') {
      officeSelect.value = '4';
    }
  }

  if (formType === 'newuser') {
    const passSection = document.getElementById('newuser-password-section');
    const passTitle = document.getElementById('newuser-password-title');
    const passInput = document.getElementById('newuser-password');
    const confirmInput = document.getElementById('newuser-confirm-password');

    if (role === 'admin') {
      if (officeSelect && (!officeSelect.value || officeSelect.value === '4')) {
        officeSelect.value = 'ALL';
      }
      if (passSection) passSection.style.display = 'grid';
      if (passTitle) passTitle.innerText = 'SETARE PAROLĂ & PIN ADMINISTRATOR';
      if (passInput) passInput.required = true;
      if (confirmInput) confirmInput.required = true;
      if (pinGroup) pinGroup.style.display = 'block';
      if (pinInput) {
        pinInput.required = false;
        pinInput.setAttribute('maxlength', '12');
        pinInput.setAttribute('placeholder', 'ex: 123456789012');
      }
      if (pinLabel) pinLabel.innerHTML = 'Cod PIN Administrator (12 Cifre - opțional)';
    } else {
      if (passSection) passSection.style.display = 'none';
      if (passTitle) passTitle.innerText = 'SETARE COD PIN OPERATOR';
      if (passInput) {
        passInput.required = false;
        passInput.value = '';
      }
      if (confirmInput) {
        confirmInput.required = false;
        confirmInput.value = '';
      }
      if (pinGroup) pinGroup.style.display = 'block';
      if (pinInput) {
        pinInput.required = true;
        pinInput.setAttribute('maxlength', '6');
        pinInput.setAttribute('placeholder', 'ex: 111111');
      }
      if (pinLabel) pinLabel.innerHTML = 'Cod PIN Operator (6 Cifre) *';
    }
  } else if (formType === 'edituser') {
    const passGroup = document.getElementById('edituser-password-group');
    const passTitle = document.getElementById('edituser-password-title');
    const passInput = document.getElementById('edituser-password');

    if (role === 'admin') {
      if (passGroup) passGroup.style.display = 'block';
      if (passInput) passInput.value = '';
      if (passTitle) passTitle.innerText = 'SCHIMBARE PAROLĂ & PIN ADMINISTRATOR';
      if (pinGroup) pinGroup.style.display = 'block';
      if (pinInput) {
        pinInput.required = false;
        pinInput.setAttribute('maxlength', '12');
        pinInput.setAttribute('placeholder', 'ex: 123456789012');
      }
      if (pinLabel) pinLabel.innerHTML = 'Cod PIN Administrator (12 cifre - opțional)';
    } else {
      if (passGroup) passGroup.style.display = 'none';
      if (passInput) passInput.value = '';
      if (passTitle) passTitle.innerText = 'SCHIMBARE COD PIN OPERATOR';
      if (pinGroup) pinGroup.style.display = 'block';
      if (pinInput) {
        pinInput.required = false;
        pinInput.setAttribute('maxlength', '6');
        pinInput.setAttribute('placeholder', 'Lasă gol pentru a păstra PIN-ul existent');
      }
      if (pinLabel) pinLabel.innerHTML = 'Cod PIN Operator (opțional - lasă gol pentru a păstra PIN-ul actual)';
    }
  }
}

function onEditUserSelectChange() {
  const select = document.getElementById("edituser-select");
  if (!select || !select.value) return;
  const userId = select.value;
  const user = usersData.find(u => u.id_user == userId);
  if (!user) return;

  const role = user.role || "operator";
  const roleSelect = document.getElementById("edituser-role");
  if (roleSelect) roleSelect.value = role;

  onUserModalRoleChange('edituser');

  const off = user.office;
  const officeSelect = document.getElementById("edituser-office");
  if (officeSelect) {
    if (!off || off === 'ALL' || off === 'all' || off === 'toate' || off === '0' || off === 0) {
      officeSelect.value = (role === 'admin') ? 'ALL' : '4';
    } else {
      officeSelect.value = String(off);
    }
  }

  document.getElementById("edituser-username").value = user.username || "";
  document.getElementById("edituser-fullname").value = user.full_name || "";
  document.getElementById("edituser-pin").value = "";
  document.getElementById("edituser-password").value = "";
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
  const pinInput = document.getElementById("edituser-pin");
  const pin = pinInput ? pinInput.value.trim() : '';
  const password = document.getElementById("edituser-password").value;

  if (role === 'admin') {
    if (pin && pin.length !== 12) {
      showUserModalError("edituser", "Codul PIN pentru Administrator trebuie să conțină exact 12 cifre (dacă dorești Schimbarea PIN-ului)!");
      alert("Codul PIN pentru Administrator trebuie să conțină exact 12 cifre (dacă dorești Schimbarea PIN-ului)!");
      return;
    }
  } else {
    if (pin && pin.length !== 6) {
      showUserModalError("edituser", "Codul PIN pentru Operator trebuie să aibă exact 6 cifre (dacă dorești Schimbarea PIN-ului)!");
      alert("Codul PIN pentru Operator trebuie să aibă exact 6 cifre (dacă dorești Schimbarea PIN-ului)!");
      return;
    }
  }

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

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (parseErr) {}

    if (json && json.success) {
      hideUserModalError("edituser");
      alert(json.message || "Datele utilizatorului au fost actualizate cu succes!");
      closeModal("modal-edit-user");
      await loadUsersData();
    } else {
      const msg = (json && json.message) ? json.message : text;
      showUserModalError("edituser", msg);
      alert(msg);
    }
  } catch (err) {
    showUserModalError("edituser", "Eroare de conectare: " + err.message);
    alert("Eroare conectare: " + err.message);
  }
}

function showUserModalError(type, msg) {
  const alertElem = document.getElementById(`${type}-error-alert`);
  const textElem = document.getElementById(`${type}-error-text`);
  if (alertElem && textElem) {
    textElem.innerText = msg;
    alertElem.classList.remove("hidden");
  }
}

function hideUserModalError(type) {
  const alertElem = document.getElementById(`${type}-error-alert`);
  if (alertElem) alertElem.classList.add("hidden");
}

function openNewUserModal() {
  hideUserModalError("newuser");
  document.getElementById("newuser-username").value = "";
  document.getElementById("newuser-fullname").value = "";
  document.getElementById("newuser-password").value = "";
  document.getElementById("newuser-confirm-password").value = "";
  document.getElementById("newuser-pin").value = "";
  document.getElementById("newuser-role").value = "operator";
  document.getElementById("newuser-office").value = "4";
  onUserModalRoleChange('newuser');
  openModal("modal-new-user");
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
  
  if (role === 'admin') {
    if (!password) {
      showUserModalError("newuser", "Parola este obligatorie pentru Administrator!");
      alert("Parola este obligatorie pentru Administrator!");
      return;
    }
    if (password !== confirmPassword) {
      showUserModalError("newuser", "Parolele introduse nu se potrivesc!");
      alert("Parolele introduse nu se potrivesc!");
      return;
    }
    if (pin && pin.length !== 12) {
      showUserModalError("newuser", "Codul PIN pentru Administrator trebuie să conțină exact 12 cifre!");
      alert("Codul PIN pentru Administrator trebuie să conțină exact 12 cifre!");
      return;
    }
  } else {
    if (!pin) {
      showUserModalError("newuser", "Te rugăm să introduci sau să generezi un cod PIN din 6 cifre!");
      alert("Te rugăm să introduci sau să generezi un cod PIN din 6 cifre!");
      return;
    }
    if (pin.length !== 6) {
      showUserModalError("newuser", "Codul PIN pentru Operator trebuie să aibă exact 6 cifre!");
      alert("Codul PIN pentru Operator trebuie să aibă exact 6 cifre!");
      return;
    }
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
        password: role === 'admin' ? password : '',
        confirm_password: role === 'admin' ? confirmPassword : '',
        pin
      })
    });
    
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (parseErr) {
      console.error("Server raw response:", text);
      showUserModalError("newuser", "Eroare răspuns server nevalid.");
      alert("Eroare răspuns server (non-JSON):\n" + text.substring(0, 300));
      return;
    }
    
    if (json && json.success) {
      hideUserModalError("newuser");
      const pinMsg = pin ? `\n\nCod PIN atribuit: ${pin}` : '';
      alert(`Contul utilizatorului @${username} a fost creat cu succes!${pinMsg}`);
      closeModal("modal-new-user");
      await loadUsersData();
    } else {
      const msg = (json && json.message) ? json.message : "Răspuns server nevalid.";
      showUserModalError("newuser", msg);
      alert(msg);
    }
  } catch (err) {
    console.error("Eroare conectare la crearea contului:", err);
    showUserModalError("newuser", "Eroare de conexiune la crearea contului: " + err.message);
    alert("Eroare de conexiune la crearea contului: " + err.message);
  }
}

async function toggleUserStatus(idUser) {
  const target = usersData.find(u => u.id_user == idUser);
  const PROTECTED_ADMIN_USERNAMES = ['eugenadmin', 'anastasia'];
  const isSuperAdmin = target && target.username && PROTECTED_ADMIN_USERNAMES.includes(target.username.toLowerCase().trim());
  if (isSuperAdmin) {
    alert(`Contul de administrator (@${target.username}) este protejat și nu poate fi dezactivat.`);
    return;
  }

  try {
    const res = await fetch("api/users.php?action=toggle-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_user: idUser })
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) {}
    if (json && json.success) {
      await loadUsersData();
    } else {
      alert("Eroare status: " + (json ? json.message : text));
    }
  } catch (err) {
    alert("Eroare conectare server: " + err.message);
  }
}

async function deleteUser(idUser, username) {
  const target = usersData.find(u => u.id_user == idUser);
  const PROTECTED_ADMIN_USERNAMES = ['eugenadmin', 'anastasia'];
  const isSuperAdmin = (target && target.username && PROTECTED_ADMIN_USERNAMES.includes(target.username.toLowerCase().trim())) ||
                       (username && PROTECTED_ADMIN_USERNAMES.includes(username.toLowerCase().trim()));
  if (isSuperAdmin) {
    alert(`Contul de administrator (@${username}) este protejat și nu poate fi șters.`);
    return;
  }

  if (currentUser && ((currentUser.id_user && currentUser.id_user == idUser) || (currentUser.username && username && currentUser.username.toLowerCase() === username.toLowerCase()))) {
    alert("Nu îți poți șterge propriul cont pe care ești conectat în prezent.");
    return;
  }

  if (!confirm(`Ești sigur că vrei să ștergi contul '@${username}'? Acțiunea este ireversibilă.`)) {
    return;
  }

  try {
    const res = await fetch("api/users.php?action=delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_user: idUser })
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) {}
    if (json && json.success) {
      usersData = usersData.filter(u => u.id_user != idUser);
      renderUsersTable();
      populateEditUserSelect();
      await loadUsersData();
    } else {
      const msg = (json && json.message) ? json.message : text;
      alert(msg || "Eroare la ștergerea utilizatorului.");
    }
  } catch (err) {
    alert("Eroare conectare server: " + err.message);
  }
}
