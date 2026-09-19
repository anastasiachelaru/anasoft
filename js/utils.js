// =============================================================================
// PIM Iași - Modul Utilitare, Formatare & Interceptor API (js/utils.js)
// =============================================================================

// 1. Interceptor Global Fetch pentru Sesiuni Securizate, CORS și Bearer Token
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  options = options || {};
  options.credentials = options.credentials || 'same-origin';
  
  options.headers = options.headers || {};
  const token = localStorage.getItem("pim_auth_token");
  if (token) {
    if (options.headers instanceof Headers) {
      if (!options.headers.has('Authorization')) {
        options.headers.set('Authorization', `Bearer ${token}`);
      }
    } else {
      if (!options.headers['Authorization']) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }
    }
  }

  const response = await originalFetch(url, options);

  // Dacă sesiunea a expirat pe server (401), atenționăm utilizatorul și deconectăm curat
  if (response.status === 401 && typeof url === 'string' && !url.includes('action=login') && !url.includes('action=check-session')) {
    if (typeof currentUser !== 'undefined' && currentUser) {
      console.warn("Sesiune expirată sau neautorizată (401).");
      alert("Sesiunea ta a expirat. Te rugăm să te reconectezi.");
      if (typeof logout === 'function') {
        logout();
      }
    }
  }

  return response;
};

// 2. Formatare Cifre cu Punct la Mii/Milioane (ex: 1.000.000)
function formatNumberWithDots(val) {
  if (val === null || val === undefined || val === '') return '';
  const digits = String(val).replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseDotsNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  const digits = String(val).replace(/\./g, '').replace(/\D/g, '');
  return parseInt(digits, 10) || 0;
}

function formatContorInput(inputElem) {
  if (!inputElem) return;
  const cursorStart = inputElem.selectionStart;
  const prevLen = inputElem.value.length;
  const rawDigits = inputElem.value.replace(/\D/g, '');
  
  if (!rawDigits) {
    inputElem.value = '';
    return;
  }
  
  const formatted = formatNumberWithDots(rawDigits);
  inputElem.value = formatted;
  
  // Menținere poziție cursor tastare
  if (cursorStart !== null) {
    const diff = formatted.length - prevLen;
    const newPos = Math.max(0, cursorStart + diff);
    try {
      inputElem.setSelectionRange(newPos, newPos);
    } catch (e) {}
  }
}

// 3. Utilitare Modale (Deschidere, Închidere, Backdrop Click)
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
  }
}

// Închidere automată la click pe backdrop sau tasta Escape
document.addEventListener("click", (e) => {
  if (e.target && e.target.classList && e.target.classList.contains("modal-overlay")) {
    e.target.classList.add("hidden");
    document.body.style.overflow = "";
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const openModals = document.querySelectorAll(".modal-overlay:not(.hidden)");
    openModals.forEach(m => {
      m.classList.add("hidden");
    });
    document.body.style.overflow = "";
  }
});
