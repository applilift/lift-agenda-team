console.log("🟢 slot.js — Optimisation géo-temporelle active");

/* Créneaux 30min entre 8h et 19h */
const START_HOUR = 8;
const END_HOUR = 19;

/* ================== UTILITAIRES ================== */

function toMinutes(hm) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function format2(n) {
  return String(n).padStart(2, "0");
}

function labelFromMinutes(startMin) {
  const h1 = Math.floor(startMin / 60);
  const m1 = startMin % 60;
  const h2 = Math.floor((startMin + 30) / 60);
  const m2 = (startMin + 30) % 60;
  return `${format2(h1)}:${format2(m1)}-${format2(h2)}:${format2(m2)}`;
}

function generateDailySlots() {
  const slots = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    slots.push(h * 60);
    slots.push(h * 60 + 30);
  }
  return slots;
}

/* Format date Firebase FR → ISO */
function normalizeDate(d) {
  if (!d) return "";
  if (d.includes("/")) {
    const [jj, mm, yyyy] = d.split("/");
    return `${yyyy}-${mm}-${jj}`;
  }
  return d;
}

/* BONUS AVANCÉ : Adjacent + distance <= 10 km */
function computeBonus(minute, occupiedMinutes, reservationsOfDay, userCP) {
  const adjacent =
    occupiedMinutes.includes(minute - 30) ||
    occupiedMinutes.includes(minute + 30);

  if (!adjacent) return 0;

  const communeUser = communes.find(c => String(c.cp) === String(userCP));
  if (!communeUser) return 0;

  for (let r of reservationsOfDay) {
    if (!r.cp) continue;
    const communeRes = communes.find(c => String(c.cp) === String(r.cp));
    if (!communeRes) continue;

    const d = Math.abs(communeUser.distance - communeRes.distance);
    if (d <= 10) return -5; // OPTIMISATION VÉRIFIÉE 🎯
  }
  return 0;
}

/* LECTURE FIREBASE : réservations + minutes occupées */
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
  if (!snap.exists()) {
    return { occupied: [], reservations: [] };
  }

  const occupiedMinutes = [];
  const reservationsOfDay = [];

  snap.forEach(child => {
    const d = child.val();
    const dNorm = normalizeDate(d.date);
    if (dNorm !== date) return;

    reservationsOfDay.push(d);

    if (!d.start || !d.end) return;
    const startMin = toMinutes(d.start);
    const endMin = toMinutes(d.end);
    for (let m = startMin; m < endMin; m += 30) {
      occupiedMinutes.push(m);
    }
  });

  console.log("📌 Réservations récupérées :", reservationsOfDay);
  console.log("🔒 Minutes occupées :", occupiedMinutes);
  return { occupied: occupiedMinutes, reservations: reservationsOfDay };
}

/* AFFICHAGE SLOTS */
async function updateSlotsUI() {
  const date = document.getElementById("date")?.value;
  const slotField = document.getElementById("slot");

  if (!date) return;

  slotField.value = "";
  const slotsDiv = document.getElementById("slots");
  slotsDiv.innerHTML = "";

  const { occupied: occupiedMinutes, reservations: reservationsOfDay } =
    await getReservedDataForDate(date);

  const userCP = document.getElementById("cp")?.value;
  const allSlots = generateDailySlots();

  allSlots.forEach(minute => {
    const label = labelFromMinutes(minute);
    const btn = document.createElement("button");
    btn.className = "slot-btn";
    btn.textContent = label;

    if (occupiedMinutes.includes(minute)) {
      btn.classList.add("disabled");
      btn.disabled = true;
    } else {
      const bonus = computeBonus(minute, occupiedMinutes, reservationsOfDay, userCP);

      if (bonus < 0) {
        btn.classList.add("slot-optimise");
      }

      btn.onclick = () => {
        if (btn.disabled) return;
        document.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        slotField.value = label;
        window.onCreneauSelected && window.onCreneauSelected(bonus);
      };
    }

    slotsDiv.appendChild(btn);
  });
}

/* INIT */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("date")?.addEventListener("change", updateSlotsUI);
  document.getElementById("cp")?.addEventListener("input", () => {
    if (document.getElementById("date")?.value) updateSlotsUI();
  });
});
