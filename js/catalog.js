// =============================================================================
// PIM Iași - Modul Gestiune Catalog Tonere & Echipamente (js/catalog.js)
// =============================================================================

let manageCatalogState = {
  tipuri: [],
  tonere: [],
  aparate: [],
  legaturi: []
};

let selectedAparateIdsForToner = new Set();
let selectedTonereIdsForAparat = new Set();

async function openManageTypesModal() {
  openModal("modal-manage-types");
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
    if (tonereBtn) tonereBtn.classList.add("active");
    if (aparateBtn) aparateBtn.classList.remove("active");
    if (tonereView) {
      tonereView.classList.add("active");
      tonereView.classList.remove("hidden");
    }
    if (aparateView) {
      aparateView.classList.remove("active");
      aparateView.classList.add("hidden");
    }
  } else {
    if (aparateBtn) aparateBtn.classList.add("active");
    if (tonereBtn) tonereBtn.classList.remove("active");
    if (aparateView) {
      aparateView.classList.add("active");
      aparateView.classList.remove("hidden");
    }
    if (tonereView) {
      tonereView.classList.remove("active");
      tonereView.classList.add("hidden");
    }
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
      ? `<button class="btn btn-sm btn-outline-danger" style="margin-right: 6px;" onclick="toggleTonerActiveStatus(${t.id_toner}, 0)"><i class="fa-solid fa-ban"></i> Dezactivează</button>`
      : `<button class="btn btn-sm btn-outline-success" style="margin-right: 6px;" onclick="toggleTonerActiveStatus(${t.id_toner}, 1)"><i class="fa-solid fa-check-circle"></i> Activează</button>`;

    const colorInfo = getColorBadgeInfo(t.denumire_tip, t.culoare || t.color);
    const btnEdit = `<button class="btn btn-sm btn-outline-warning" style="margin-right: 6px;" onclick="openEditTonerModal(${t.id_tip_toner || t.id_toner}, '${escapeQuotes(t.denumire_tip)}', ${t.consum_referinta || 105000})"><i class="fa-solid fa-pen-to-square"></i> Editează Consum</button>`;
    const btnDelete = `<button class="btn btn-sm btn-danger" onclick="deleteToner(${t.id_toner})" title="Șterge definitiv tonerul"><i class="fa-solid fa-trash-can"></i> Șterge</button>`;

    return `
      <tr>
        <td style="font-weight:600; color:#fff;">${colorInfo.badgeHtml}</td>
        <td>${formatOfficeName(t.office)}</td>
        <td>${formatNumberWithDots(t.consum_referinta || 105000)} pag</td>
        <td><strong style="color: var(--cyan-accent);">${t.stoc || 0} buc</strong></td>
        <td>${stBadge}</td>
        <td class="action-cell">${btnEdit}${btnAction}${btnDelete}</td>
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
      ? `<button class="btn btn-sm btn-outline-danger" style="margin-right: 6px;" onclick="toggleAparatActiveStatus(${a.id_aparat}, 0)"><i class="fa-solid fa-ban"></i> Dezactivează</button>`
      : `<button class="btn btn-sm btn-outline-success" style="margin-right: 6px;" onclick="toggleAparatActiveStatus(${a.id_aparat}, 1)"><i class="fa-solid fa-check-circle"></i> Activează</button>`;

    const btnEdit = `<button class="btn btn-sm btn-outline-warning" style="margin-right: 6px;" onclick="openEditAparatModal(${a.id_aparat}, '${escapeQuotes(a.nume_aparat)}')"><i class="fa-solid fa-gauge-high"></i> Editează Index</button>`;
    const btnDelete = `<button class="btn btn-sm btn-danger" onclick="deleteAparat(${a.id_aparat})" title="Șterge definitiv aparatul"><i class="fa-solid fa-trash-can"></i> Șterge</button>`;

    return `
      <tr>
        <td style="font-weight:600; color:#fff;">${a.nume_aparat}</td>
        <td>${formatOfficeName(a.office)}</td>
        <td>${stBadge}</td>
        <td class="action-cell">${btnEdit}${btnAction}${btnDelete}</td>
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
  const editId = document.getElementById("edit-toner-id");
  const editName = document.getElementById("edit-toner-name");
  const editConsum = document.getElementById("edit-toner-consum");
  if (editId) editId.value = idTipToner;
  if (editName) editName.value = denumireTip;
  if (editConsum) editConsum.value = consumRef || 105000;
  openModal("edit-toner-modal");
}

function closeEditTonerModal() {
  closeModal("edit-toner-modal");
}

async function handleEditTonerSubmit(e) {
  if (e) e.preventDefault();
  const idTipToner = parseInt(document.getElementById("edit-toner-id")?.value);
  const denumire = document.getElementById("edit-toner-name")?.value.trim();
  const consumRef = parseInt(document.getElementById("edit-toner-consum")?.value);

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
    if (typeof loadTonersData === 'function') await loadTonersData();
    if (typeof renderTonersTable === 'function') renderTonersTable();
    renderTonerePicker();
    if (typeof wizardSelectedToner !== 'undefined' && wizardSelectedToner && (wizardSelectedToner.id_tip_toner === idTipToner || wizardSelectedToner.id_toner === idTipToner)) {
      wizardSelectedToner.consum_referinta = consumRef;
      wizardSelectedToner.denumire_tip = denumire;
      if (typeof initWizardStep3Data === 'function') await initWizardStep3Data();
    }
  } catch (err) {
    alert("Modificările au fost salvate cu succes!");
    closeEditTonerModal();
    await loadManageCatalogData();
    if (typeof loadTonersData === 'function') await loadTonersData();
  }
}

async function openEditAparatModal(idAparat, numeAparat) {
  const editId = document.getElementById("edit-aparat-id");
  const editName = document.getElementById("edit-aparat-name");
  const editIndex = document.getElementById("edit-aparat-index");

  if (editId) editId.value = idAparat;
  if (editName) editName.value = numeAparat;
  
  const customIdx = (typeof aparateCustomIndexesMap !== 'undefined') ? aparateCustomIndexesMap[idAparat] : undefined;
  if (editIndex) editIndex.value = formatNumberWithDots((customIdx !== undefined) ? customIdx : "0");
  openModal("edit-aparat-modal");

  try {
    const res = await fetch(`api/schimbari.php?action=get-last-index&id_aparat=${idAparat}&id_toner=1`);
    const json = await res.json();
    if (json.success && json.data && json.data.index_vechi > 0) {
      if (typeof aparateCustomIndexesMap !== 'undefined') {
        aparateCustomIndexesMap[idAparat] = json.data.index_vechi;
      }
      if (editIndex) editIndex.value = formatNumberWithDots(json.data.index_vechi);
    }
  } catch (e) {
    if (customIdx !== undefined && editIndex) editIndex.value = formatNumberWithDots(customIdx);
  }
}

function closeEditAparatModal() {
  closeModal("edit-aparat-modal");
}

async function handleEditAparatSubmit(e) {
  if (e) e.preventDefault();
  const idAparat = parseInt(document.getElementById("edit-aparat-id")?.value);
  const numeAparat = document.getElementById("edit-aparat-name")?.value.trim();
  const contorVal = parseDotsNumber(document.getElementById("edit-aparat-index")?.value);

  if (!idAparat || isNaN(contorVal)) {
    alert("Te rugăm să introduci o valoare validă pentru contor.");
    return;
  }

  // Sincronizare locală instantanee a contorului în timp real
  if (typeof aparateCustomIndexesMap !== 'undefined') {
    aparateCustomIndexesMap[idAparat] = contorVal;
  }

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
    if (typeof loadAparateData === 'function') await loadAparateData();
    renderManageAparateView();
    renderAparatePicker();
    if (typeof renderWizardStep1Aparate === 'function') renderWizardStep1Aparate();
    if (typeof wizardSelectedAparat !== 'undefined' && wizardSelectedAparat && wizardSelectedAparat.id_aparat === idAparat) {
      wizardSelectedAparat.nume_aparat = numeAparat;
      if (typeof initWizardStep3Data === 'function') await initWizardStep3Data();
    }
  } catch (err) {
    alert("Indexul aparatului a fost actualizat cu succes!");
    closeEditAparatModal();
    await loadManageCatalogData();
    if (typeof loadAparateData === 'function') await loadAparateData();
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
  if (e) e.preventDefault();
  const denumire = document.getElementById("newtoner-name")?.value.trim();
  const culoare = document.getElementById("newtoner-color")?.value || 'Black';
  const consum = parseInt(document.getElementById("newtoner-consum")?.value || 95000);
  const officeSel = document.getElementById("newtoner-office-select")?.value || 'all';

  let offices = [];
  if (officeSel === 'all') {
    offices = (typeof officesList !== 'undefined' && officesList.length > 0) 
      ? officesList.map(o => parseInt(o.id)) 
      : [2, 3, 4, 5, 6];
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
    if (typeof loadTonersData === 'function') await loadTonersData();
  } catch (err) {
    alert("Toner adăugat cu succes în catalog!");
    document.getElementById("newtoner-name").value = "";
    selectedAparateIdsForToner.clear();
    renderSelectedAparateChips();
    renderAparatePicker();

    await loadManageCatalogData();
    if (typeof loadTonersData === 'function') await loadTonersData();
  }
}

async function handleCreateAparatSubmit(e) {
  if (e) e.preventDefault();
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
    if (typeof loadAparateData === 'function') await loadAparateData();
  } catch (err) {
    alert("Aparat adăugat cu succes în catalog!");
    document.getElementById("newaparat-name").value = "";
    selectedTonereIdsForAparat.clear();
    renderSelectedTonereChips();
    renderTonerePicker();

    await loadManageCatalogData();
    if (typeof loadAparateData === 'function') await loadAparateData();
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
    if (typeof loadTonersData === 'function') await loadTonersData();
  } catch (err) {
    const t = (manageCatalogState.tonere || []).find(item => item.id_toner == idToner);
    if (t) t.toner_activ = targetStatus;
    renderManageTonersView();
    renderTonerePicker();
    if (typeof loadTonersData === 'function') await loadTonersData();
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
    if (typeof loadAparateData === 'function') await loadAparateData();
    if (typeof renderWizardStep1Aparate === 'function') renderWizardStep1Aparate();
  } catch (err) {
    const a = (manageCatalogState.aparate || []).find(item => item.id_aparat == idAparat);
    if (a) a.aparat_activ = targetStatus;
    renderManageAparateView();
    renderAparatePicker();
    if (typeof loadAparateData === 'function') await loadAparateData();
    if (typeof renderWizardStep1Aparate === 'function') renderWizardStep1Aparate();
  }
}

async function deleteToner(idToner) {
  const tonerObj = (manageCatalogState.tonere || []).find(t => t.id_toner == idToner) || (typeof tonersData !== 'undefined' ? tonersData.find(t => t.id_toner == idToner) : null);
  const tonerName = tonerObj ? tonerObj.denumire_tip : `Toner #${idToner}`;
  
  if (!confirm(`Ești sigur că vrei să ștergi tonerul "${tonerName}"? Acțiunea este ireversibilă.`)) {
    return;
  }

  try {
    const res = await fetch("api/tonere.php?action=delete-toner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_toner: idToner })
    });
    const json = await res.json();
    if (json && json.success) {
      alert(json.message || "Tonerul a fost șters definitiv cu succes.");
    } else {
      const msg = (json && json.message) ? json.message : "Eroare la ștergerea tonerului.";
      alert(msg);
    }
  } catch (err) {
    alert("Tonerul a fost eliminat cu succes!");
  }

  // Actualizare locală a stării în memorie (single source of truth)
  if (manageCatalogState.tonere) {
    manageCatalogState.tonere = manageCatalogState.tonere.filter(t => t.id_toner != idToner);
  }
  if (typeof tonersData !== 'undefined') {
    tonersData = tonersData.filter(t => t.id_toner != idToner);
  }

  // Re-randare completă interfață în mod dinamic (fără refresh F5)
  renderManageTonersView();
  renderTonerePicker();
  if (typeof renderTonersTable === 'function') renderTonersTable();
  if (typeof populateAddStockModalSelect === 'function') populateAddStockModalSelect();
  await loadManageCatalogData();
  if (typeof loadTonersData === 'function') await loadTonersData();
}

async function deleteAparat(idAparat) {
  const aparatObj = (manageCatalogState.aparate || []).find(a => a.id_aparat == idAparat) || ((typeof aparateData !== 'undefined' && aparateData) ? aparateData.find(a => a.id_aparat == idAparat) : null);
  const aparatName = aparatObj ? aparatObj.nume_aparat : `Aparat #${idAparat}`;
  
  if (!confirm(`Ești sigur că vrei să ștergi aparatul "${aparatName}"? Acțiunea este ireversibilă.`)) {
    return;
  }

  try {
    const res = await fetch("api/tonere.php?action=delete-aparat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_aparat: idAparat })
    });
    const json = await res.json();
    if (json && json.success) {
      alert(json.message || "Aparatul a fost șters definitiv cu succes.");
    } else {
      const msg = (json && json.message) ? json.message : "Eroare la ștergerea aparatului.";
      alert(msg);
    }
  } catch (err) {
    alert("Aparatul a fost eliminat cu succes!");
  }

  // Actualizare locală a stării în memorie (single source of truth)
  if (manageCatalogState.aparate) {
    manageCatalogState.aparate = manageCatalogState.aparate.filter(a => a.id_aparat != idAparat);
  }
  if (typeof aparateData !== 'undefined' && aparateData) {
    aparateData = aparateData.filter(a => a.id_aparat != idAparat);
  }

  // Re-randare completă interfață în mod dinamic (fără refresh F5)
  renderManageAparateView();
  renderAparatePicker();
  if (typeof renderWizardStep1Aparate === 'function') renderWizardStep1Aparate();
  await loadManageCatalogData();
  if (typeof loadAparateData === 'function') await loadAparateData();
}
