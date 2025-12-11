console.log("🟢 slot.js — multi-missions + optimisation Sprimont active");

// =========================
// CONFIG
// =========================
const START_HOUR = 8;
const END_HOUR   = 19;
const PRIX_KM    = 0.5;   // économie = distance Sprimont → client × 0,5€


// =========================
// OUTILS TEMPS
// =========================
function toMinutes(hm) {
  if (!hm) return NaN;

  hm = String(hm).trim();

  // Formats possibles :
  // "17:00", "17:0", "17h00", "17H00", "17"
  hm = hm.replace("H", ":").replace("h", ":");

  const parts = hm.split(":").map(Number);

  const h = parts[0];
  const m = parts[1] || 0; // si "17" → 17:00

  return h * 60 + m;
}



function format2(n) {
  return String(n).padStart(2, "0");
}

function labelFromMinutes(startMin, dureeMin) {
  const h1 = Math.floor(startMin / 60);
  const m1 = startMin % 60;
  const endMin = startMin + dureeMin;
  const h2 = Math.floor(endMin / 60);
  const m2 = endMin % 60;
  return `${format2(h1)}:${format2(m1)}-${format2(h2)}:${format2(m2)}`;
}

function generateDailySlots(dureeMin) {
  const incr = 30;
  const result = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    const m1 = h * 60;
    const m2 = h * 60 + incr;
    if (m1 + dureeMin <= END_HOUR * 60) result.push(m1);
    if (m2 + dureeMin <= END_HOUR * 60) result.push(m2);
  }
  return result;
}


// =========================
// FORMAT DATE FIREBASE
// =========================
function normalizeDate(d) {
  if (!d) return "";
  if (d.includes("/")) {
    const [jj, mm, yyyy] = d.split("/");
    return `${yyyy}-${mm}-${jj}`;
  }
  return d;
}


// =========================
// ECONOMIES
// =========================
//
// Règles :
// - S'il n'y a AUCUN RDV ce jour-là → camion à Sprimont
//   → optimisé si client ≤ 20 km de Sprimont
// - S'il y a des RDV :
//   → pour CHAQUE mission du jour, on regarde si le créneau est
//      • juste AVANT la mission (slotEnd == start)
//      • ou juste APRÈS la mission (slotStart == end)
//      • ET si le client est à ≤ 20km de cette mission
//   → si OUI pour AU MOINS UNE mission : créneau optimisé
// - Le montant de l'économie = distance Sprimont → client × 0,5 €/km
//
function computeBonus(minute, dureeMin, reservations, cpUser) {
  let bonus = 0, ecoKm = 0, ecoEuro = 0;

  if (!cpUser || typeof communes === "undefined") {
    return { bonus, ecoKm, ecoEuro };
  }

  const communeUser = communes.find(c => String(c.cp) === String(cpUser));
  if (!communeUser) {
    return { bonus, ecoKm, ecoEuro };
  }

  const distUser = communeUser.distance || 0;

  // 🔹 CAS 1 : AUCUN RDV → camion à Sprimont
  if (!reservations.length) {
    if (distUser <= 20) {
      ecoKm   = distUser;
      ecoEuro = ecoKm * PRIX_KM;
      bonus   = -ecoEuro;
    }
    return { bonus, ecoKm, ecoEuro };
  }

  // 🔹 CAS 2 : RDV existants → on teste tous les RDV du jour
  const slotStart = minute;
  const slotEnd   = minute + dureeMin;
  let optimisable = false;

  for (const r of reservations) {
    if (!r.start || !r.end || !r.cp) continue;
    // 👉 PATCH TEMPORAIRE
// Si une réservation n'a pas de CP, on assume SPRIMONT (4140)
if (!r.cp) {
  r.cp = "4140";
}



    const communeRes = communes.find(c => String(c.cp) === String(r.cp));
    if (!communeRes) continue;

    const distRes = communeRes.distance || 0;
    const rayonOk = Math.abs(distUser - distRes) <= 20; // rayon 20 km
    if (!rayonOk) continue;

    const rdvStart = toMinutes(r.start);
    const rdvEnd   = toMinutes(r.end);

    const adjacentApres  = (slotStart === rdvEnd);       // créneau juste après RDV
    const adjacentAvant  = (slotEnd   === rdvStart);     // créneau juste avant RDV

    if (adjacentAvant || adjacentApres) {
      optimisable = true;
      break;
    }
  }

  if (!optimisable) {
    return { bonus, ecoKm, ecoEuro };
  }

  // 🔹 Calcul de l'économie (toujours vs Sprimont → client)
  ecoKm   = distUser;
  ecoEuro = ecoKm * PRIX_KM;
  bonus   = -ecoEuro;

  return { bonus, ecoKm, ecoEuro };
}


// =========================
// FIREBASE
// =========================
async function getReservedDataForDate(date) {
  const db = window.db;
  if (!db) return { occupied: [], reservations: [] };

  const ref = window.firebaseRef(db, "reservations");
  const q = window.firebaseQuery(
    ref,
    window.firebaseOrderByChild("date"),
    window.firebaseStartAt(date),
    window.firebaseEndAt(date)
  );

  const snap = await window.firebaseGet(q);
  if (!snap.exists()) return { occupied: [], reservations: [] };

  const occupied = [];
  const reservations = [];

  snap.forEach(child => {
    const d = child.val();
    if (normalizeDate(d.date) !== date) return;
    reservations.push(d);

    if (!d.start || !d.end) return;
    const s = toMinutes(d.start);
    const e = toMinutes(d.end);
    for (let m = s; m < e; m += 30) {
      occupied.push(m);
    }
  });

  return { occupied, reservations };
}


// =========================
// AFFICHAGE DES CRÉNEAUX
// =========================
async function updateSlotsUI() {
  const dateEl   = document.getElementById("date");
  const cpEl     = document.getElementById("cp");
  const typeEl   = document.getElementById("form-type"); // "oneShot" / "simple" / "double"
  const extraEl  = document.getElementById("extra30");
  const wrapper  = document.getElementById("slots-wrapper");
  const slotsDiv = document.getElementById("slots");
  const slotField= document.getElementById("slot");

  if (!dateEl || !slotsDiv) return;

  const date = dateEl.value;
  if (!date) {
    if (wrapper) wrapper.classList.add("hidden");
    return;
  }

  if (wrapper) wrapper.classList.remove("hidden");
  slotsDiv.innerHTML = "";
  if (slotField) slotField.value = "";

  const { occupied, reservations } = await getReservedDataForDate(date);

  // Durée de la mission selon type
  let dureeMin = 30; // oneShot de base
  const type = typeEl?.value;

  if (type === "simple") dureeMin = 60;
  if (type === "double") dureeMin = 120;
  // oneShot reste 30
  if (extraEl?.checked) {
    dureeMin += 30;
  }

  const allSlots = generateDailySlots(dureeMin);
  const cpUser   = cpEl?.value;

  const today  = new Date().toISOString().slice(0, 10);
  const now    = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  allSlots.forEach(minute => {
    const slotStart = minute;
    const slotEnd   = minute + dureeMin;

    // ⛔ Ne pas montrer les créneaux dans le passé (si même jour)
    if (date === today && slotStart < nowMin + 15) {
      return;
    }

    // ⛔ Ne pas proposer de créneau qui chevauche une réservation existante
    let chevauche = false;
    for (let m = slotStart; m < slotEnd; m += 30) {
      if (occupied.includes(m)) {
        chevauche = true;
        break;
      }
    }
    if (chevauche) return;

    // Calcul optimisation
    const { bonus, ecoKm, ecoEuro } = computeBonus(slotStart, dureeMin, reservations, cpUser);

    const label = labelFromMinutes(slotStart, dureeMin);
    const btn   = document.createElement("button");
    btn.className = "slot-btn";
    btn.textContent = label;

    // 🟩 Créneau optimisé
    if (bonus < 0) {
      btn.classList.add("slot-optimise");
      const badge = document.createElement("div");
      badge.className = "badge-opt";
      badge.textContent = `Optimisé = ${ecoEuro.toFixed(1)}€`;
      btn.appendChild(badge);
    }

    btn.onclick = () => {
      if (slotField) slotField.value = label;
      document.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");

      if (window.onCreneauSelected) {
        // tu pourras simplifier le message côté page (One Shot / Double)
        window.onCreneauSelected(bonus, ecoKm, ecoEuro);
      }
    };

    slotsDiv.appendChild(btn);
  });
}


// =========================
// INIT LISTENERS
// =========================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("date")?.addEventListener("input", updateSlotsUI);
  document.getElementById("cp")?.addEventListener("input", updateSlotsUI);
  document.getElementById("extra30")?.addEventListener("change", updateSlotsUI);
});
