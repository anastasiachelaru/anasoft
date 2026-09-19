// =============================================================================
// PIM Iași - Modul Asistent Schimbare Toner (Wizard Multi-Step) (js/wizard.js)
// =============================================================================

let aparateData = [];
let wizardSelectedAparat = null;
let wizardSelectedToner = null;
let wizardCurrentStep = 1;
let currentMachineTonersCount = 0;
let wizardIndexVechi = 0;
let wizardMinAllowed = 0;
let wizardMaxAllowed = 0;
let wizardConsumRef = 105000;
let aparateCustomIndexesMap = {};

async function loadAparateData() {
  try {
    const res = await fetch("api/tonere.php?action=aparate");
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      aparateData = json.data;
    }
  } catch (err) {
    console.warn("Eroare incarcare aparate din backend, folosesc fallback local:", err);
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
      { id_aparat: 4, nume_aparat: 'UMF-KIP7970', office: 2 }
    ];
  }
}

function openWizardModal() {
  wizardSelectedAparat = null;
  wizardSelectedToner = null;
  wizardCurrentStep = 1;
  
  const effectiveOffice = (typeof currentOfficeFilter !== 'undefined' && currentOfficeFilter !== 'all') 
    ? parseInt(currentOfficeFilter) 
    : (currentUser ? currentUser.office : 4);
    
  const officeLabel = document.getElementById("wizard-office-label");
  if (officeLabel) {
    officeLabel.innerText = `Sediu: ${formatOfficeName(effectiveOffice) || 'Toate Sediile PIM Iași'}`;
  }
  
  renderWizardStep1Aparate();
  goToWizardStep(1);
  openModal("modal-wizard");
}

function closeWizardModal() {
  closeModal("modal-wizard");
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
  const stepTarget = document.getElementById(`wizard-step-${stepNum}`);
  if (stepTarget) {
    stepTarget.classList.add("active");
  }
  
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
  
  const effectiveOffice = (typeof currentOfficeFilter !== 'undefined' && currentOfficeFilter !== 'all') 
    ? parseInt(currentOfficeFilter) 
    : (currentUser ? currentUser.office : 4);
  const search = (document.getElementById("wizard-aparat-search")?.value || "").toLowerCase();
  
  // EXCLUDERE STRICTĂ APARATE INACTIVE (aparat_activ === 0)
  const activeAparateData = aparateData.filter(a => parseInt(a.aparat_activ) === 1 || a.aparat_activ === undefined);
  
  const currentFilter = (typeof currentOfficeFilter !== 'undefined') ? currentOfficeFilter : 'all';
  let officeAparate = (currentFilter === 'all')
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

// MANEVRARE SELECTARE APARAT & VERIFICARE AUTO-SELECTARE TONER UNIC
async function handleWizardSelectAparat(aparat) {
  wizardSelectedAparat = aparat;
  wizardSelectedToner = null; // Resetare toner ales anterior
  
  const badgeStep2 = document.getElementById("summary-aparat-badge");
  const badgeStep3 = document.getElementById("summary-aparat-badge-final");
  if (badgeStep2) badgeStep2.innerText = `Aparat: ${aparat.nume_aparat}`;
  if (badgeStep3) badgeStep3.innerText = `Aparat: ${aparat.nume_aparat}`;
  
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
  if (!container) return;
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
      <div class="card-subtitle">Consum Referință: ${formatNumberWithDots(t.consum_referinta || 105000)} pagini</div>
    `;
    container.appendChild(card);
  });
}

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
  
  const dispIndexVechi = document.getElementById("display-index-vechi");
  const dispMin = document.getElementById("display-min-allowed");
  const dispMax = document.getElementById("display-max-allowed");
  const dispRef = document.getElementById("display-consum-ref");
  const contorInput = document.getElementById("input-wizard-contor");

  if (dispIndexVechi) dispIndexVechi.innerText = formatNumberWithDots(wizardIndexVechi) || '0';
  if (dispMin) dispMin.innerText = formatNumberWithDots(wizardMinAllowed) || '0';
  if (dispMax) dispMax.innerText = formatNumberWithDots(wizardMaxAllowed) || '0';
  if (dispRef) dispRef.innerText = formatNumberWithDots(wizardConsumRef) || '0';
  if (contorInput) contorInput.value = "";
  
  calculateWizardMetrics();
}

// CALCUL METRICE ÎN TIMP REAL ȘI VALIDARE
function calculateWizardMetrics() {
  const contorInput = document.getElementById("input-wizard-contor");
  const contorVal = parseDotsNumber(contorInput ? contorInput.value : 0);
  
  const alertDiv = document.getElementById("wizard-validation-alert");
  const alertText = document.getElementById("wizard-validation-text");
  const submitBtn = document.getElementById("btn-submit-wizard");
  const dispCopii = document.getElementById("display-copii-realizate");
  const dispProcent = document.getElementById("display-procent-realizat");
  
  if (!contorVal) {
    if (dispCopii) dispCopii.innerText = "0";
    if (dispProcent) dispProcent.innerText = "0,00%";
    if (alertDiv) alertDiv.classList.add("hidden");
    if (submitBtn) submitBtn.disabled = false;
    return;
  }
  
  const copiiRealizate = contorVal - wizardIndexVechi;
  const procentRealizat = (wizardConsumRef > 0 && copiiRealizate > 0) ? ((copiiRealizate / wizardConsumRef) * 100) : 0;
  
  if (dispCopii) dispCopii.innerText = formatNumberWithDots(copiiRealizate > 0 ? copiiRealizate : 0) || '0';
  if (dispProcent) dispProcent.innerText = `${procentRealizat.toFixed(2)}%`;
  
  // VALIDARE STRICTĂ CONFORM CERINȚEI (MINIM 1 copie, MAXIM 200% din referință)
  if (contorVal < wizardMinAllowed) {
    if (alertText) alertText.innerText = `Contorul introdus (${formatNumberWithDots(contorVal)}) este sub Minimul Permis (${formatNumberWithDots(wizardMinAllowed)}). A fost efectuat cel puțin 1 copie?`;
    if (alertDiv) alertDiv.classList.remove("hidden");
    if (submitBtn) submitBtn.disabled = true;
  } else if (contorVal > wizardMaxAllowed) {
    if (alertText) alertText.innerText = `Contorul introdus (${formatNumberWithDots(contorVal)}) depășește Maximul Permis de 200% (${formatNumberWithDots(wizardMaxAllowed)}). Procentul maxim admis este de 200%.`;
    if (alertDiv) alertDiv.classList.remove("hidden");
    if (submitBtn) submitBtn.disabled = true;
  } else {
    if (alertDiv) alertDiv.classList.add("hidden");
    if (submitBtn) submitBtn.disabled = false;
  }
}

// SALVARE SCHIMBARE DIN WIZARD
async function handleWizardSubmit(e) {
  if (e) e.preventDefault();

  if (!wizardSelectedToner || parseInt(wizardSelectedToner.stoc || 0) <= 0) {
    alert("Imposibil de salvat! Tonerul selectat nu are stoc suficient (0 bucăți). Vă rugăm să suplimentați stocul mai întâi.");
    return;
  }
  
  const contorVal = parseDotsNumber(document.getElementById("input-wizard-contor")?.value);
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
        if (typeof tonersData !== 'undefined') {
          const matchToner = tonersData.find(t => t.id_toner == wizardSelectedToner.id_toner || t.id_tip_toner == wizardSelectedToner.id_tip_toner);
          if (matchToner) matchToner.stoc = Math.max(0, parseInt(matchToner.stoc || 1) - 1);
        }
      }

      alert(json.message || "Schimbarea de toner a fost salvată! Stocul a fost scăzut.");

      if (typeof loadHistoryData === 'function') await loadHistoryData();
      if (typeof loadTonersData === 'function') await loadTonersData();
      if (typeof loadManageCatalogData === 'function') await loadManageCatalogData();
      if (typeof renderTonersTable === 'function') renderTonersTable();
      if (typeof renderManageTonersView === 'function') renderManageTonersView();
      if (typeof renderManageAparateView === 'function') renderManageAparateView();
      if (typeof renderTonerePicker === 'function') renderTonerePicker();
      if (typeof renderAparatePicker === 'function') renderAparatePicker();
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
    if (typeof renderTonersTable === 'function') renderTonersTable();
    closeWizardModal();
  }
}

// ----------------------------------------------------
// TASTATURĂ NUMERICĂ INTEGRATĂ PENTRU MODAL WIZARD
// ----------------------------------------------------
function appendWizardDigit(digit) {
  const input = document.getElementById("input-wizard-contor");
  if (!input) return;
  const rawCurrent = parseDotsNumber(input.value);
  const rawStr = (rawCurrent > 0 ? String(rawCurrent) : "") + digit;
  input.value = formatNumberWithDots(rawStr);
  calculateWizardMetrics();
}

function clearWizardDigit() {
  const input = document.getElementById("input-wizard-contor");
  if (!input) return;
  input.value = "";
  calculateWizardMetrics();
}

function backspaceWizardDigit() {
  const input = document.getElementById("input-wizard-contor");
  if (!input) return;
  const rawStr = String(parseDotsNumber(input.value));
  if (rawStr.length > 1) {
    input.value = formatNumberWithDots(rawStr.slice(0, -1));
  } else {
    input.value = "";
  }
  calculateWizardMetrics();
}
