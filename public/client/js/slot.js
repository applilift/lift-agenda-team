console.log("🟢 slot.js chargé — GPS, optimisation 10km, tampon intelligent OK");

// ======================================================
// CONFIG GÉNÉRALE
// ======================================================
const ORS_KEY = "5b3ce3597851110001cf6248xxxxxxxxxxxx"; // ← mets ta vraie clé ORS
const DEPOT = { lat: 50.4871, lon: 5.6011 }; // Sprimont
const RAYON_OPTIM = 10;     // km pour optimisation
const RAYON_EXTRA = 5;      // km → tampon 15 min
const TAMPON_5KM = 15;      // minutes
const TAMPON_10KM = 30;     // minutes
const START = 8 * 60;       // 08h00
const END = 18 * 60;        // 18h00 — dernier début
const INCR = 15;            // créneaux toutes les 15 minutes

// ======================================================
// OUTILS TEMPS
// ======================================================
function toMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function fromMin(m) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// ======================================================
// GÉNÉOCODAGE ORS
// ======================================================
async function geocodeAdresse(adresse) {
  try {
    const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_KEY}&text=${encodeURIComponent(adresse)}&boundary.country=BE`;
    const r = await fetch(url);
    const data = await r.json();
    if (!data.features?.length) return null;

    const [lon, lat] = data.features[0].geometry.coordinates;
    window.lastGeocodeClient = { lat, lon };
    return { lat, lon };
  } catch (e) {
    console.error("Erreur ORS:", e);
    return null;
  }
}

// ======================================================
// DISTANCE GPS ORS
// ======================================================
async function distanceGPS(p1, p2) {
  try {
    const url = `https://api.openrouteservice.org/v2/matrix/driving-car`;
    const body = {
      locations: [
        [p1.lon, p1.lat],
        [p2.lon, p2.lat]
      ],
      metrics: ["distance"]
    };

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": ORS_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await r.json();
    if (!data.distances) return 999;

    const meters = data.distances[0][1];
    return meters / 1000; // km
  } catch (e) {
    console.error("Erreur distanceGPS", e);
    return 999;
  }
}

// ======================================================
// FIREBASE — RÉCUPÉRER RÉSERVATIONS DU JOUR
// ======================================================
async function getReservations(date) {
  return new Promise(async (resolve) => {
    const r = window.firebaseRef(window.db, "reservations");
    const snap = await window.firebaseGet(r);

    const lista = [];
    snap.forEach(child => {
      const d = child.val();
      if (d.date === date) lista.push(d);
    });

    resolve(lista);
  });
}

// ======================================================
// GÉNÉRATION DES SLOTS
// ======================================================
function generateSlots(duree) {
  const list = [];
  for (let t = START; t <= END; t += INCR) {
    if (t + duree <= END + 1) list.push(t);
  }
  return list;
}

// ======================================================
// AFFICHAGE DES CRÉNEAUX — MOTEUR PRINCIPAL
// ======================================================
async function updateSlotsUI() {
  const dateEl = document.getElementById("date");
  const cpEl   = document.getElementById("cp");
  const comEl  = document.getElementById("commune");
  const adrEl  = document.getElementById("adresse");
  const typeEl = document.getElementById("form-type");
  const wrapper = document.getElementById("slots-wrapper");
  const slotsDiv = document.getElementById("slots");
  const msg = document.getElementById("msg-slot");
  const slotHidden = document.getElementById("slot");

  slotsDiv.innerHTML = "";
  slotHidden.value = "";
  wrapper.classList.add("hidden");

  if (!dateEl.value || !cpEl.value || !comEl.value || !adrEl.value) return;

  const adresse = `${adrEl.value}, ${cpEl.value} ${comEl.value}, Belgique`;
  const coordsClient = await geocodeAdresse(adresse);
  if (!coordsClient) {
    wrapper.classList.remove("hidden");
    msg.textContent = "Adresse introuvable.";
    return;
  }

  window.coordsClient = coordsClient;

  const reservations = await getReservations(dateEl.value);

  // DÉTERMINATION DE LA DURÉE
  let duree;
  if (typeEl.value === "oneShot") duree = 30;
  else if (typeEl.value === "simple") duree = 60;
  else if (typeEl.value === "double") duree = 90;
  if (document.getElementById("extra30")?.checked) duree += 30;

  const allSlots = generateSlots(duree);

  wrapper.classList.remove("hidden");
  msg.textContent = "Choisissez un créneau :";

  const today = new Date().toISOString().slice(0, 10);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  const slotsAff = [];

  for (const start of allSlots) {

    if (dateEl.value === today && start < nowMin + 15) continue;

    const end = start + duree;
    let interdit = false;
    let optim = false;
    let extra = false;
    let ecoEuro = 0;

    for (const r of reservations) {
      const rStart = toMin(r.start);
      const rEnd   = toMin(r.end);

      const dist = await distanceGPS(coordsClient, r.coords || DEPOT);

      const tampon = dist < RAYON_EXTRA ? TAMPON_5KM : TAMPON_10KM;

      if (end > rStart - tampon && start < rEnd + tampon) {
        interdit = true;
        break;
      }

      // OPTIMISATION 10 KM
      if (dist <= RAYON_OPTIM) {
        const adjacent = (start >= rEnd && start <= rEnd + tampon) ||
                         (end <= rStart && end >= rStart - tampon);
        if (adjacent) {
          optim = true;
          ecoEuro = (await distanceGPS(DEPOT, coordsClient)) * 0.5;
        }
      }

      // EXTRA <5 KM
      if (dist <= RAYON_EXTRA) {
        extra = true;
      }
    }

    if (interdit) continue;

    slotsAff.push({ start, end, optim, extra, ecoEuro });
  }

  slotsAff.sort((a, b) => (b.optim ? 1 : 0) - (a.optim ? 1 : 0));

  slotsAff.forEach((slot) => {

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slot-btn";
    btn.textContent = `${fromMin(slot.start)} – ${fromMin(slot.end)}`;

    if (slot.extra) {
      btn.classList.add("slot-extra");
      btn.innerHTML = `<div class="slot-banner-extra">EXTRA (<5 km)</div>` + btn.textContent;
    }

    if (slot.optim) {
      btn.classList.add("slot-optimise");
      btn.innerHTML = `<div class="slot-banner-optim">OPTIMISÉ • ${slot.ecoEuro.toFixed(1)} €</div>` + btn.textContent;
    }

    btn.onclick = () => {
      document.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      slotHidden.value = `${fromMin(slot.start)} – ${fromMin(slot.end)}`;
    };

    slotsDiv.appendChild(btn);
  });

  if (!slotsAff.length) msg.textContent = "Aucun créneau compatible.";
}

// ======================================================
// INIT LISTENERS
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  ["date", "cp", "commune", "adresse", "extra30"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateSlotsUI);
  });
});

// Export
window.updateSlotsUI = updateSlotsUI;

