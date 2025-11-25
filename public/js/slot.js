/* ============================================================
   1. CHARGEMENT DES COMMUNES
   ============================================================ */
let dataCommunes = [];

export async function loadCommunes() {
  const r = await fetch("../communes_client.json");
  return await r.json();
}

loadCommunes().then(list => { dataCommunes = list; });

function getDistanceFromCP(cp) {
  const item = dataCommunes.find(x => String(x.cp) === String(cp));
  return item ? item.distance : 0;
}

/* ============================================================
   2. AUTOCOMPLETE
   ============================================================ */
export function initAutocomplete(cpField, communeField, suggestionBox) {

  cpField.addEventListener("input", () => {
    const val = cpField.value.trim();

    if (val.length < 2) {
      suggestionBox.classList.add("hidden");
      return;
    }

    const filtered = dataCommunes
      .filter(x =>
        String(x.cp).startsWith(val) ||
        x.nom.toLowerCase().includes(val.toLowerCase())
      )
      .slice(0, 20);

    suggestionBox.innerHTML = "";

    filtered.forEach(item => {
      const div = document.createElement("div");
      div.className = "suggestion-item";
      div.textContent = `${item.cp} – ${item.nom}`;

      div.onclick = () => {
        cpField.value = item.cp;
        communeField.value = item.nom;
        suggestionBox.classList.add("hidden");

        if (window.recalculerCreneaux) window.recalculerCreneaux();
      };

      suggestionBox.appendChild(div);
    });

    suggestionBox.classList.remove("hidden");
  });

  document.addEventListener("click", e => {
    if (!suggestionBox.contains(e.target) && e.target !== cpField) {
      suggestionBox.classList.add("hidden");
    }
  });
}

/* ============================================================
   3. AFFICHAGE DES CRENEAUX
   ============================================================ */
export function afficherCreneaux(optimises, libres, cfg) {
  const zoneOpt  = document.getElementById(cfg.optimZoneId);
  const zoneFree = document.getElementById(cfg.freeZoneId);

  zoneOpt.innerHTML = "";
  zoneFree.innerHTML = "";

  optimises.forEach(cr => {
    const btn = document.createElement("button");
    btn.className = "slot-btn slot-optimise";
    btn.textContent = cr.label;
    btn.onclick = () =>
      document.getElementById(cfg.heureHiddenId).value = cr.heure;

    zoneOpt.appendChild(btn);
  });

  libres.forEach(cr => {
    const btn = document.createElement("button");
    btn.className = "slot-btn";
    btn.textContent = cr.label;
    btn.onclick = () =>
      document.getElementById(cfg.heureHiddenId).value = cr.heure;

    zoneFree.appendChild(btn);
  });
}

/* ============================================================
   4. FAUX CRENEAUX (provisoires)
   ============================================================ */
function fakeCreneaux(economie) {
  const optim = [
    { heure: "08:00" },
    { heure: "09:30" },
    { heure: "11:00" }
  ];

  const libres = [
    { heure: "13:00" },
    { heure: "15:00" },
    { heure: "17:00" }
  ];

  return {
    optimises: optim.map(x => ({
      ...x,
      label: `${x.heure} – Créneau optimisé${economie ? " (" + economie + ")" : ""}`
    })),
    libres: libres.map(x => ({
      ...x,
      label: `${x.heure}`
    }))
  };
}

/* ============================================================
   5. RECHARGEMENT AUTOMATIQUE
   ============================================================ */
window.recalculerCreneaux = function () {
  const cfg = window._creneauConfig;
  if (!cfg) return;

  const date = document.getElementById(cfg.dateId)?.value;
  const cp   = document.getElementById(cfg.cpId)?.value;

  if (!date || !cp) {
    document.getElementById(cfg.wrapperId)?.classList.add("hidden");
    return;
  }

  // Distance Sprimont -> CP
  const distance = getDistanceFromCP(cp);

  /* ------------------------------
     CAS SIMPLE & DOUBLE
  ------------------------------ */
  if (cfg.type !== "one_shot") {
    let dureeSup = 0;
    if (cfg.dureeSupId) {
      const el = document.getElementById(cfg.dureeSupId);
      if (el) dureeSup = parseFloat(el.value.replace(",", ".")) || 0;
    }

    const dureeTotale = (cfg.baseDuration || 1) + dureeSup;
    const economie = (distance * 0.5).toFixed(2) + " €";

    const slots = fakeCreneaux(economie);

    afficherCreneaux(slots.optimises, slots.libres, cfg);

    document.getElementById(cfg.wrapperId).classList.remove("hidden");
    return;
  }

  /* ------------------------------
     CAS ONE SHOT (Prix fixe 85 € + distance×0.5)
  ------------------------------ */
  if (cfg.type === "one_shot") {
    const prixBase = 85;
    const supplement = distance * 0.5;
    const prixTotal = prixBase + supplement;

    const msg = document.getElementById(cfg.messageId);
    if (msg) msg.textContent = `Prix total estimé : ${prixTotal.toFixed(2)} €`;

    const slots = fakeCreneaux(null);

    afficherCreneaux(slots.optimises, slots.libres, cfg);
    document.getElementById(cfg.wrapperId).classList.remove("hidden");
  }
};


