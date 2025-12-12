console.log("🟢 slot.js — moteur de créneaux chargé");

/* ================== CONFIG ================== */

const START_HOUR = 8;
const END_HOUR = 19;
const SLOT_DURATION = 30;

/* ================== UTILITAIRES TEMPS ================== */

function toMinutes(hm) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function format2(n) {
  return String(n).padStart(2, "0");
}

function labelFromMinutes(startMin) {
  const endMin = startMin + SLOT_DURATION;
  return (
    `${format2(Math.floor(startMin / 60))}:${format2(startMin % 60)}–` +
    `${format2(Math.floor(endMin / 60))}:${format2(endMin % 60)}`
  );
}

function generateDailySlots() {
  const slots = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    slots.push(h * 60);
    slots.push(h * 60 + SLOT_DURATION);
  }
  return slots;
}

/* ================== DATE ================== */

function normalizeDate(d) {
  if (!d) return "";
  if (d.includes("/")) {
    const [jj, mm, yyyy] = d.split("/");
    return `${yyyy}-${mm}-${jj}`;
  }
  return d;
}

/* ================== BONUS OPTIMISATION ================== */
/* Adjacent + distance <= 10km (si communes dispo) */

function computeBonus(minute, occupiedMinutes, reservationsOfDay, userCP) {
  if (!userCP || typeof communes === "undefined") return 0;

  const isAdjacent =
    occupiedMinutes.includes(minute - SLOT_DURATION) ||
    occupiedMinutes.includes(minute + SLOT_DURATION);

  if (!isAdjacent) return 0;

  const communeUser = communes.find(c => String(c.cp) === String(userCP));
  if (!communeUser) return 0;

  for (const r of reservationsOfDay) {
    if (!r.cp) continue;

    const communeRes = communes.find(c => String(c.cp) === String(r.cp));
    if (!communeRes) continue;

    if (Math.abs(communeUser.distance - communeRes.distance) <= 10) {
      return -5; // slot optimisé
    }
  }

  return 0;
}

/* ================== FIREBASE ================== */

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

  const occupiedMinutes = [];
  const reservationsOfDay = [];

  snap.forEach(child => {
    const r = child.val();
    if (normalizeDate(r.date) !== date) return;

    reservationsOfDay.push(r);

    if (!r.start || !r.end) return;

    const startMin = toMinutes(r.start);
    const endMin = toMinutes(r.end);

    for (let m = startMin; m < endMin; m += SLOT_DURATION) {
      occupiedMinutes.push(m);
    }
  });

  return { occupied: occupiedMinutes, reservations: reservationsOfDay };
}

/* ================== UI CRÉNEAUX ================== */

async function updateSlotsUI() {
  const dateEl = document.getElementById("date");
  const slotField = document.getElementById("slot");
  const slotsDiv = document.getElementById("slots");

  if (!dateEl || !slotField || !slotsDiv) return;
  if (!dateEl.value) return;

  slotField.value = "";
  slotsDiv.innerHTML = "";

  const { occupied, reservations } =
    await getReservedDataForDate(dateEl.value);

  const userCP = document.getElementById("cp")?.value;
  const allSlots = generateDailySlots();

  for (const minute of allSlots) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slot-btn";
    btn.textContent = labelFromMinutes(minute);

    if (occupied.includes(minute)) {
      btn.disabled = true;
      btn.classList.add("disabled");
    } else {
      const bonus = computeBonus(minute, occupied, reservations, userCP);

      if (bonus < 0) btn.classList.add("slot-optimise");

      btn.onclick = () => {
        document
          .querySelectorAll(".slot-btn")
          .forEach(b => b.classList.remove("selected"));

        btn.classList.add("selected");
        slotField.value = btn.textContent;

        if (typeof window.onCreneauSelected === "function") {
          window.onCreneauSelected(bonus);
        }
      };
    }

    slotsDiv.appendChild(btn);
  }
}

/* ================== INIT ================== */

document.addEventListener("DOMContentLoaded", () => {
  const dateEl = document.getElementById("date");
  const cpEl = document.getElementById("cp");

  dateEl?.addEventListener("change", updateSlotsUI);
  cpEl?.addEventListener("change", updateSlotsUI);
});

// Exposé pour appel externe si nécessaire
window.updateSlotsUI = updateSlotsUI;
