// =============================================================================
// PIM Iași - Modul Istoric Schimbări & Paginare Server-Side (js/history.js)
// =============================================================================

let historyData = [];
let historyTotalRecords = 0;
let historyCurrentPage = 1;

let recentData = [];
let recentTotalRecords = 0;
let recentCurrentPage = 1;

let historySearchQuery = '';
let historySearchDebounceTimer = null;
const PAGE_SIZE = 10;

async function loadHistoryData() {
  await loadRecentHistoryData(recentCurrentPage, recentSearchQuery);
}

let recentSearchQuery = '';
let recentSearchDebounceTimer = null;

async function loadRecentHistoryData(page = 1, searchQuery = '') {
  recentCurrentPage = Math.max(1, parseInt(page) || 1);
  if (typeof searchQuery === 'string') recentSearchQuery = searchQuery;

  const tbody = document.getElementById("wizard-recent-tbody");
  if (tbody) tbody.classList.add("table-loading");

  try {
    const activeOffice = (typeof currentOfficeFilter !== 'undefined') ? currentOfficeFilter : "all";
    const url = `api/schimbari.php?action=list&page=${recentCurrentPage}&per_page=${PAGE_SIZE}&office=${activeOffice}&search=${encodeURIComponent(recentSearchQuery)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json && json.success && Array.isArray(json.data)) {
      recentData = json.data;
      recentTotalRecords = (typeof json.total === 'number') ? json.total : json.data.length;
    } else {
      recentData = [];
      recentTotalRecords = 0;
    }
  } catch (err) {
    console.warn("Eroare la incarcare istoric recent:", err);
    recentData = [];
    recentTotalRecords = 0;
  } finally {
    if (tbody) tbody.classList.remove("table-loading");
  }
  renderWizardRecentTable();
}

function onSearchRecentInput(query) {
  const clearBtn = document.getElementById("btn-clear-recent-search");
  if (clearBtn) {
    if (query && query.trim().length > 0) {
      clearBtn.classList.remove("hidden");
    } else {
      clearBtn.classList.add("hidden");
    }
  }

  clearTimeout(recentSearchDebounceTimer);
  recentSearchDebounceTimer = setTimeout(() => {
    loadRecentHistoryData(1, (query || '').trim());
  }, 300);
}

function resetRecentSearch() {
  const input = document.getElementById("search-recent-input");
  if (input) input.value = '';
  const clearBtn = document.getElementById("btn-clear-recent-search");
  if (clearBtn) clearBtn.classList.add("hidden");

  clearTimeout(recentSearchDebounceTimer);
  recentSearchQuery = '';
  loadRecentHistoryData(1, '');
}

async function loadFullHistoryData(page = 1, searchQuery = '') {
  historyCurrentPage = Math.max(1, parseInt(page) || 1);
  historySearchQuery = searchQuery;
  
  const tbody = document.getElementById("history-table-body");
  if (tbody) tbody.classList.add("table-loading");

  try {
    const activeOffice = (typeof currentOfficeFilter !== 'undefined') ? currentOfficeFilter : "all";
    const url = `api/schimbari.php?action=list&page=${historyCurrentPage}&per_page=${PAGE_SIZE}&office=${activeOffice}&search=${encodeURIComponent(searchQuery)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json && json.success && Array.isArray(json.data)) {
      historyData = json.data;
      historyTotalRecords = (typeof json.total === 'number') ? json.total : json.data.length;
    } else {
      historyData = [];
      historyTotalRecords = 0;
    }
  } catch (err) {
    console.warn("Eroare la incarcare istoric complet:", err);
    historyData = [];
    historyTotalRecords = 0;
  } finally {
    if (tbody) tbody.classList.remove("table-loading");
  }
  renderHistoryTable();
}

function onSearchHistoryInput(query) {
  const clearBtn = document.getElementById("btn-clear-history-search");
  if (clearBtn) {
    if (query && query.trim().length > 0) {
      clearBtn.classList.remove("hidden");
    } else {
      clearBtn.classList.add("hidden");
    }
  }

  clearTimeout(historySearchDebounceTimer);
  historySearchDebounceTimer = setTimeout(() => {
    loadFullHistoryData(1, (query || '').trim());
  }, 300);
}

function resetHistorySearch() {
  const input = document.getElementById("search-history-input");
  if (input) input.value = '';
  const clearBtn = document.getElementById("btn-clear-history-search");
  if (clearBtn) clearBtn.classList.add("hidden");

  clearTimeout(historySearchDebounceTimer);
  historySearchQuery = '';
  loadFullHistoryData(1, '');
}

function renderPaginationControls(containerId, infoId, currentPage, totalItems, pageSize, onPageChange) {
  const container = document.getElementById(containerId);
  const infoElem = document.getElementById(infoId);
  if (!container || !infoElem) return;
  
  container.innerHTML = "";
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIdx = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIdx = Math.min(currentPage * pageSize, totalItems);
  
  const activeSearch = (containerId === "history-pagination-controls") ? historySearchQuery : ((containerId === "recent-pagination-controls") ? recentSearchQuery : '');
  const searchNotice = activeSearch
    ? ` pentru căutarea <strong style="color:var(--cyan-accent);">„${String(activeSearch).replace(/</g, '&lt;').replace(/>/g, '&gt;')}”</strong>`
    : '';
  infoElem.innerHTML = `Afișare <strong>${startIdx}-${endIdx}</strong> din <strong>${totalItems}</strong> înregistrări${searchNotice} (Pagina ${currentPage} din ${totalPages})`;
  
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
  
  if (historyData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:20px;">Nu există înregistrări în istoric conform filtrelor selectate.</td></tr>';
    renderPaginationControls("history-pagination-controls", "history-pagination-info", 1, 0, PAGE_SIZE, () => {});
    return;
  }
  
  historyData.forEach(h => {
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
    historyTotalRecords,
    PAGE_SIZE,
    (newPage) => {
      loadFullHistoryData(newPage, historySearchQuery);
    }
  );
}

function renderWizardRecentTable() {
  const tbody = document.getElementById("wizard-recent-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  
  if (recentData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:20px;">Nu există schimbări recente pe acest sediu.</td></tr>';
    renderPaginationControls("recent-pagination-controls", "recent-pagination-info", 1, 0, PAGE_SIZE, () => {});
    return;
  }
  
  recentData.forEach(h => {
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
    recentTotalRecords,
    PAGE_SIZE,
    (newPage) => {
      loadRecentHistoryData(newPage, recentSearchQuery);
    }
  );
}

window.loadHistoryData = loadHistoryData;
window.loadRecentHistoryData = loadRecentHistoryData;
window.loadFullHistoryData = loadFullHistoryData;
window.onSearchHistoryInput = onSearchHistoryInput;
window.resetHistorySearch = resetHistorySearch;
window.onSearchRecentInput = onSearchRecentInput;
window.resetRecentSearch = resetRecentSearch;
window.renderHistoryTable = renderHistoryTable;
window.renderWizardRecentTable = renderWizardRecentTable;
