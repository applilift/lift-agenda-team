// === service-worker.js ===
// Écoute les clics sur les notifications
self.addEventListener("notificationclick", event => {
  event.notification.close();
  // Ouvrir ou focus l'appli quand on clique sur la notif
  event.waitUntil(
    clients.matchAll({ type: "window" }).then(clientList => {
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});

// (Optionnel) Écoute la réception de push messages si tu veux les utiliser plus tard
self.addEventListener("push", event => {
  if (event.data) {
    const data = event.data.json();
    const title = data.title || "Notification";
    const options = {
      body: data.body || "",
      tag: data.tag || "agenda",
      requireInteraction: true,   // ✅ la notif reste affichée jusqu'à action manuelle
      renotify: true,            // ✅ si même tag → remplace la précédente
      data: data.data || {}
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

