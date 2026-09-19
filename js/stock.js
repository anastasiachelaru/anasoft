// =============================================================================
// PIM Iași - Modul Gestiune Stocuri Tonere (js/stock.js)
// =============================================================================

let tonersData = [];
let currentStockOp = 'add';

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
  if (!tbody) return;
  const searchInput = document.getElementById("search-toner-input");
  const search = (searchInput ? searchInput.value : "").toLowerCase();
  tbody.innerHTML = "";
  
  let filtered = tonersData;
  const activeOfficeFilter = (typeof currentOfficeFilter !== 'undefined') ? currentOfficeFilter : "all";
  if (activeOfficeFilter !== "all") {
    filtered = filtered.filter(t => t.office == activeOfficeFilter);
  }
  if (search) {
    filtered = filtered.filter(t => (t.denumire_tip || "").toLowerCase().includes(search));
  }
  
  let totalStoc = 0;
  let stocCriticCount = 0;
  
  filtered.forEach(t => {
    totalStoc += parseInt(t.stoc || 0);
    if (t.stoc <= 2) stocCriticCount++;
    
    const tr = document.createElement("tr");
    const isLow = t.stoc <= 2;
    const badgeClass = isLow ? "badge-stock-low" : "badge-stock-ok";
    const aparateList = (t.aparate_compatibile || []).map(a => a.nume_aparat).join(", ") || "General";
    const colorInfo = getColorBadgeInfo(t.denumire_tip, t.culoare || t.color);
    tr.innerHTML = `
      <td>${colorInfo.badgeHtml}</td>
      <td><span class="office-badge">${formatOfficeName(t.office || t.office_nume)}</span></td>
      <td><span class="toner-color-text toner-color-${colorInfo.color}"><i class="fa-solid fa-droplet"></i> ${colorInfo.label}</span></td>
      <td><span class="badge ${badgeClass}">${t.stoc} buc</span></td>
      <td>${formatNumberWithDots(t.consum_referinta || 0)} pagini</td>
      <td><small style="color:#94a3b8;">${aparateList}</small></td>
    `;

    tbody.appendChild(tr);
  });
  
  const statTotal = document.getElementById("stat-total-tonere");
  const statStoc = document.getElementById("stat-stoc-total");
  const statCritic = document.getElementById("stat-stoc-critic");
  if (statTotal) statTotal.innerText = filtered.length;
  if (statStoc) statStoc.innerText = totalStoc;
  if (statCritic) statCritic.innerText = stocCriticCount;
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

function openAddStockModal() {
  if (!currentUser || currentUser.role !== "admin") {
    alert("Acces restricționat! Doar administratorii au permisiunea de a modifica stocul de tonere.");
    return;
  }
  populateAddStockModalSelect();
  toggleStockOp('add');
  openModal("modal-add-stock");
  updateStockModalPreview();
}

function populateAddStockModalSelect() {
  const select = document.getElementById("stock-modal-toner");
  if (!select) return;
  select.innerHTML = "";
  
  let availableToners = tonersData;
  const activeOfficeFilter = (typeof currentOfficeFilter !== 'undefined') ? currentOfficeFilter : "all";
  if (activeOfficeFilter !== 'all') {
    availableToners = tonersData.filter(t => t.office == activeOfficeFilter);
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
    if (addLabel) addLabel.classList.add("active");
    if (subLabel) subLabel.classList.remove("active");
    if (submitBtn) {
      submitBtn.className = "btn btn-success";
      submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Adaugă în Stoc';
    }
  } else {
    if (subLabel) subLabel.classList.add("active");
    if (addLabel) addLabel.classList.remove("active");
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
        operation: op
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
