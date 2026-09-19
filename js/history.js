// =============================================================================
// PIM Iași - Modul Istoric Schimbări & Paginare (js/history.js)
// =============================================================================

let historyData = [];
let historyCurrentPage = 1;
let recentCurrentPage = 1;
const PAGE_SIZE = 10;

async function loadHistoryData() {
  try {
    const activeOffice = (typeof currentOfficeFilter !== 'undefined') ? currentOfficeFilter : "all";
    const url = (activeOffice !== "all") 
      ? `api/schimbari.php?action=list&office=${activeOffice}` 
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
  const activeOffice = (typeof currentOfficeFilter !== 'undefined') ? currentOfficeFilter : "all";
  if (activeOffice !== "all") {
    filtered = filtered.filter(h => h.office == activeOffice);
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
    const colorBadge = (typeof getColorBadge === 'function') ? getColorBadge(h.denumire_tip || '') : (h.denumire_tip || '');
    
    let userAccountDisplay = '';
    const firstStr = (h.first_name || '').trim();
    const lastStr = (h.last_name || '').trim();
    const nameStr = (h.nume_operator || '').trim();
    const fullCompStr = (firstStr || lastStr) ? `${firstStr} ${lastStr}`.trim() : nameStr;
    const fullLower = fullCompStr.toLowerCase();
    
    let displayName = fullCompStr;
    if (!displayName || fullLower === 'operator' || fullLower === 'operator operator') {
      displayName = (h.username && h.username.toLowerCase() !== 'operator') ? h.username : 'Admin PIM';
    }
    userAccountDisplay = `<i class="fa-solid fa-user text-cyan" style="margin-right:4px;"></i> <strong>${displayName}</strong>`;

    const contorFormatted = formatNumberWithDots(h.contor || 0);
    const refFormatted = formatNumberWithDots(h.consum_referinta || 105000);
    const copiiFormatted = formatNumberWithDots(h.copii_realizate || 0);

    tr.innerHTML = `
      <td><strong>${h.id_istoric_schimbare}</strong></td>
      <td><strong>${h.nume_aparat}</strong></td>
      <td>${colorBadge}</td>
      <td><span class="office-badge">${formatOfficeName(h.office || h.office_nume)}</span></td>
      <td>${userAccountDisplay}</td>
      <td><code>${contorFormatted}</code><br><small style="color:#94a3b8;">Ref: ${refFormatted}</small></td>
      <td>${copiiFormatted}</td>
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
  const activeOffice = (typeof currentOfficeFilter !== 'undefined') ? currentOfficeFilter : "all";
  if (activeOffice !== "all") {
    filtered = filtered.filter(h => h.office == activeOffice);
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
    const colorBadge = (typeof getColorBadge === 'function') ? getColorBadge(h.denumire_tip || '') : (h.denumire_tip || '');
    
    let userAccountDisplay = '';
    const firstStr = (h.first_name || '').trim();
    const lastStr = (h.last_name || '').trim();
    const nameStr = (h.nume_operator || '').trim();
    const fullCompStr = (firstStr || lastStr) ? `${firstStr} ${lastStr}`.trim() : nameStr;
    const fullLower = fullCompStr.toLowerCase();
    
    let displayName = fullCompStr;
    if (!displayName || fullLower === 'operator' || fullLower === 'operator operator') {
      displayName = (h.username && h.username.toLowerCase() !== 'operator') ? h.username : 'Admin PIM';
    }
    userAccountDisplay = `<i class="fa-solid fa-user text-cyan" style="margin-right:4px;"></i> <strong>${displayName}</strong>`;

    const contorFormatted = formatNumberWithDots(h.contor || 0);
    const refFormatted = formatNumberWithDots(h.consum_referinta || 105000);
    const copiiFormatted = formatNumberWithDots(h.copii_realizate || 0);

    tr.innerHTML = `
      <td><strong>${h.id_istoric_schimbare}</strong></td>
      <td><strong>${h.nume_aparat}</strong></td>
      <td>${colorBadge}</td>
      <td><span class="office-badge">${formatOfficeName(h.office || h.office_nume)}</span></td>
      <td>${userAccountDisplay}</td>
      <td><code>${contorFormatted}</code> / ${refFormatted}</td>
      <td>${copiiFormatted}</td>
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
