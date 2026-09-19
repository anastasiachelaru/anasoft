// =============================================================================
// PIM Iași - Management Gestiune Tonere & Echipamente
// Bootstrap Principal & Coordonator Aplicație (app.js)
// =============================================================================

let currentOfficeFilter = "all";

/**
 * Schimbare secțiune activă în interfață (Tab-uri)
 */
function switchSection(secId) {
  // Operatorii nu au voie pe tab-ul de utilizatori
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.role !== "admin" && secId === "utilizatori") {
    secId = "schimbare";
  }

  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".app-section").forEach(sec => sec.classList.remove("active"));
  
  const targetBtn = document.getElementById(`nav-${secId}-btn`);
  const targetSec = document.getElementById(`section-${secId}`);
  
  if (targetBtn) targetBtn.classList.add("active");
  if (targetSec) targetSec.classList.add("active");

  if (secId === "utilizatori" && typeof loadUsersData === 'function') {
    loadUsersData();
  }
}

/**
 * Schimbare filtru global de sediu din header
 */
async function changeOfficeFilter(val) {
  currentOfficeFilter = val;
  if (typeof historyCurrentPage !== 'undefined') historyCurrentPage = 1;
  if (typeof recentCurrentPage !== 'undefined') recentCurrentPage = 1;
  
  if (typeof renderTonersTable === 'function') renderTonersTable();
  if (typeof loadHistoryData === 'function') await loadHistoryData();
  if (typeof renderWizardStep1Aparate === 'function') renderWizardStep1Aparate();
}

/**
 * Suport Fullscreen Nativ pentru tablete și ecrane tactile
 */
function toggleFullScreen() {
  try {
    const doc = window.document;
    const docEl = doc.documentElement;

    const requestFS = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.webkitRequestFullScreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
    const cancelFS = doc.exitFullscreen || doc.webkitExitFullscreen || doc.webkitCancelFullScreen || doc.mozCancelFullScreen || doc.msExitFullscreen;

    const isFS = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;

    if (!isFS) {
      if (requestFS) {
        const promise = requestFS.call(docEl);
        if (promise && promise.catch) {
          promise.catch(err => {
            console.warn("Fullscreen request error:", err);
          });
        }
      } else {
        window.scrollTo(0, 1);
        alert("Pentru Fullscreen pe iPad / iPhone Safari, folosiți opțiunea Safari 'Adaugă pe ecranul de pornire'.");
      }
    } else {
      if (cancelFS) {
        cancelFS.call(doc);
      }
    }
  } catch (err) {
    console.error("Fullscreen error:", err);
  }
}

['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evtName => {
  document.addEventListener(evtName, () => {
    const isFS = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    const icon = document.getElementById("icon-fullscreen");
    const text = document.getElementById("text-fullscreen");
    if (icon) {
      icon.className = isFS ? "fa-solid fa-compress" : "fa-solid fa-expand";
    }
    if (text) {
      text.textContent = isFS ? "Ieșire Fullscreen" : "Ecran Complet";
    }
  });
});

/**
 * Inițializare aplicație
 */
async function initApp() {
  // 1. Încărcare sedii dinamice și populare selectoare
  if (typeof loadOfficesData === 'function') {
    await loadOfficesData();
  }

  // 2. Inițializare Tastatură Numerică și PIN login
  if (typeof renderPinDots === 'function') renderPinDots();
  if (typeof switchLoginRole === 'function') switchLoginRole('operator');
  if (typeof initKeyboardListeners === 'function') initKeyboardListeners();

  // 3. Verificare sesiune activă (Auto-login dacă utilizatorul are sesiune salvată)
  if (typeof checkExistingSession === 'function') {
    await checkExistingSession();
  }
}

// Pornire la finalizarea încărcării DOM-ului
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});
