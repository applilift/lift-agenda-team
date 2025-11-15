document.addEventListener('DOMContentLoaded', () => {
  if (!window?.db) {
    console.warn('[facturation] Firebase non initialisé (window.db manquant).');
    return;
  }

  window.hashtag = window.hashtag || {};
  window.hashtag.facturation = { version: '0.0.1', ready: true };

  console.log('[facturation] module chargé ✅');
});
