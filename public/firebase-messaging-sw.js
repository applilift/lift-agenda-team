/* ============================================================
   ✅ Service Worker — Firebase Messaging (modulaire)
   Gère la réception des notifications push en arrière-plan
   ============================================================ */

importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js");

// ⚡ Ton config Firebase (identique à index.html)
firebase.initializeApp({
  apiKey: "AIzaSyC5Rly--5aw3vSEuhRcyZxzD5fg1JJowbE",
  authDomain: "lift-agenda-app.firebaseapp.com",
  databaseURL: "https://lift-agenda-app-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "lift-agenda-app",
  storageBucket: "lift-agenda-app.firebasestorage.app",
  messagingSenderId: "162981688841",
  appId: "1:162981688841:web:8ceee20cd7500aedb1ead8"
});

const messaging = firebase.messaging();

/* ============================================================
   📡 Réception d’un message quand l’app est FERMÉE
   (mode background)
   ============================================================ */
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Message reçu en arrière-plan', payload);

  const notificationTitle = payload.notification?.title || "📢 Nouvelle notification";
  const notificationOptions = {
    body: payload.notification?.body || "Vous avez reçu une mise à jour.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    requireInteraction: true, // ✅ La notif reste jusqu’à action manuelle
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

/* ============================================================
   📍 Clic sur une notification → focus ou ouvrir l’app
   ============================================================ */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Ouvre ou focus l'application
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

