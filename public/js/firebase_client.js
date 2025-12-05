// public/client/js/firebase_client.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  update,
  remove,
  onValue,
  query,
  orderByChild,
  startAt,
  endAt,
  get
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// ⚠️ EXACTEMENT la même config que dans index.html
const firebaseConfig = {
  apiKey: "AIzaSyC5Rly--5aw3vSEuhRcyZxzD5fg1JJowbE",
  authDomain: "lift-agenda-app.firebaseapp.com",
  databaseURL: "https://lift-agenda-app-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "lift-agenda-app",
  storageBucket: "lift-agenda-app.firebasestorage.app",
  messagingSenderId: "162981688841",
  appId: "1:162981688841:web:8ceee20cd7500aedb1ead8"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

window.db = db;
window.firebaseRef = ref;
window.firebasePush = push;
window.firebaseUpdate = update;
window.firebaseRemove = remove;
window.firebaseOnValue = onValue;
window.firebaseQuery = query;
window.firebaseOrderByChild = orderByChild;
window.firebaseStartAt = startAt;
window.firebaseEndAt = endAt;
window.firebaseGet = get;

console.log("🔥 Firebase connecté (client) — lift-agenda-app");
