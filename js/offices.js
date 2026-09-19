// =============================================================================
// PIM Iași - Modul Gestiune Sedii Dinamice (js/offices.js)
// =============================================================================

let officesList = [
  { id_office: 2, nume_sediu: "Independenței" },
  { id_office: 3, nume_sediu: "Tudor" },
  { id_office: 4, nume_sediu: "Tipografie" },
  { id_office: 5, nume_sediu: "Smârdan" },
  { id_office: 6, nume_sediu: "UMF 2" }
];

let officesMap = {
  'ALL': 'Toate sediile PIM',
  2: 'Independenței',
  3: 'Tudor',
  4: 'Tipografie',
  5: 'Smârdan',
  6: 'UMF 2'
};

async function loadOfficesData() {
  try {
    const res = await fetch("api/offices.php?action=list");
    const json = await res.json();
    if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
      officesList = json.data;
      officesMap = { 'ALL': 'Toate sediile PIM' };
      officesList.forEach(o => {
        officesMap[o.id_office] = o.nume_sediu;
        officesMap[String(o.id_office)] = o.nume_sediu;
      });
    }
  } catch (err) {
    console.warn("Folosire cache implicit pentru sedii:", err);
  }

  populateAllOfficeDropdowns();
}

function formatOfficeName(officeIdOrName) {
  if (officeIdOrName === 'ALL' || officeIdOrName === 'all' || officeIdOrName === 'toate' || officeIdOrName === 'TOATE' || officeIdOrName === 'Toate sediile' || officeIdOrName === 'Toate sediile PIM') {
    return 'Toate sediile PIM';
  }
  if (officeIdOrName === 0 || officeIdOrName === '0' || officeIdOrName === null || officeIdOrName === undefined) {
    return 'Inexistent';
  }
  
  const key = parseInt(officeIdOrName);
  if (!isNaN(key)) {
    if (key === 0) return 'Inexistent';
    if (officesMap[key]) return officesMap[key];
  }
  if (officesMap[officeIdOrName]) return officesMap[officeIdOrName];

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

function populateAllOfficeDropdowns() {
  // 1. Selector filtru sediu din bara de sus (Header / Nav)
  const headerFilter = document.getElementById("office-filter-select") || document.getElementById("header-office-filter");
  if (headerFilter) {
    const currentVal = headerFilter.value || "all";
    headerFilter.innerHTML = `<option value="all">Toate Sediile</option>`;
    officesList.forEach(o => {
      const opt = document.createElement("option");
      opt.value = String(o.id_office);
      opt.innerText = o.nume_sediu;
      headerFilter.appendChild(opt);
    });
    headerFilter.value = currentVal;
  }

  // 2. Dropdown sediu la Creare Utilizator Nou (#newuser-office)
  const newUserOffice = document.getElementById("newuser-office");
  if (newUserOffice) {
    const currentVal = newUserOffice.value || "4";
    newUserOffice.innerHTML = `
      <option value="ALL" id="newuser-office-all" class="admin-office-option" style="display: none;">Toate sediile PIM</option>
    `;
    officesList.forEach(o => {
      const opt = document.createElement("option");
      opt.value = String(o.id_office);
      opt.innerText = o.nume_sediu;
      newUserOffice.appendChild(opt);
    });
    newUserOffice.value = currentVal;
  }

  // 3. Dropdown sediu la Editare Utilizator (#edituser-office)
  const editUserOffice = document.getElementById("edituser-office");
  if (editUserOffice) {
    const currentVal = editUserOffice.value || "4";
    editUserOffice.innerHTML = `
      <option value="ALL" id="edituser-office-all" class="admin-office-option" style="display: none;">Toate sediile PIM</option>
    `;
    officesList.forEach(o => {
      const opt = document.createElement("option");
      opt.value = String(o.id_office);
      opt.innerText = o.nume_sediu;
      editUserOffice.appendChild(opt);
    });
    editUserOffice.value = currentVal;
  }

  // 4. Dropdown sediu la Adăugare Aparat Nou (#newaparat-office sau #aparat-modal-office)
  const aparatOffice = document.getElementById("newaparat-office") || document.getElementById("aparat-modal-office");
  if (aparatOffice) {
    const currentVal = aparatOffice.value || "2";
    aparatOffice.innerHTML = "";
    officesList.forEach(o => {
      const opt = document.createElement("option");
      opt.value = String(o.id_office);
      opt.innerText = o.nume_sediu;
      aparatOffice.appendChild(opt);
    });
    aparatOffice.value = currentVal;
  }

  // 5. Dropdown sediu la Catalog Toner Nou (#newtoner-office-select)
  const tonerOffice = document.getElementById("newtoner-office-select");
  if (tonerOffice) {
    const currentVal = tonerOffice.value || "all";
    tonerOffice.innerHTML = `<option value="all">Toate sediile (General)</option>`;
    officesList.forEach(o => {
      const opt = document.createElement("option");
      opt.value = String(o.id_office);
      opt.innerText = o.nume_sediu;
      tonerOffice.appendChild(opt);
    });
    tonerOffice.value = currentVal;
  }
}
