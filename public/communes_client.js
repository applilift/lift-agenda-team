// communes_client.js
// Charge communes_client.json et fournit : window.communes + autocomplete CP/commune

window.communes = [];

async function loadCommunes() {
  try {
    const res = await fetch("../communes_client.json");
    const data = await res.json();
    window.communes = data;
    console.log("📌 Communes chargées :", communes.length);
    initAutocompleteCP();
  } catch (e) {
    console.error("Erreur chargement communes_client.json :", e);
  }
}

function initAutocompleteCP() {
  const cpInput       = document.getElementById("cp");
  const communeInput  = document.getElementById("commune");
  const suggestionsEl = document.getElementById("suggestions-cp");

  if (!cpInput || !communeInput || !suggestionsEl) return;

  cpInput.addEventListener("input", () => {
    const val = cpInput.value.trim();
    suggestionsEl.innerHTML = "";

    if (val.length < 2) {
      suggestionsEl.classList.add("hidden");
      return;
    }

    const list = communes
      .filter(c =>
        String(c.cp).startsWith(val) ||
        (c.nom && c.nom.toLowerCase().includes(val.toLowerCase()))
      )
      .slice(0, 20);

    if (!list.length) {
      suggestionsEl.classList.add("hidden");
      return;
    }

    list.forEach(c => {
      const div = document.createElement("div");
      div.className = "suggestion-item";
      div.textContent = `${c.cp} – ${c.nom}`;
      div.onclick = () => {
        cpInput.value      = c.cp;
        communeInput.value = c.nom;
        suggestionsEl.classList.add("hidden");
        suggestionsEl.innerHTML = "";

        // Si ta fonction existe (depuis ton script inline), on recalcule le prix et les créneaux
        if (typeof window.calculerPrixOneShot === "function") {
          window.calculerPrixOneShot();
        }
        if (typeof window.afficherCreneauxOneShot === "function") {
          window.afficherCreneauxOneShot();
        }
      };
      suggestionsEl.appendChild(div);
    });

    suggestionsEl.classList.remove("hidden");
  });

  document.addEventListener("click", e => {
    if (!suggestionsEl.contains(e.target) && e.target !== cpInput) {
      suggestionsEl.classList.add("hidden");
    }
  });
}

// lancer le chargement au démarrage
document.addEventListener("DOMContentLoaded", loadCommunes);

