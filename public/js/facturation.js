// js/facturation.js — Version 1.1 (Firebase v9 compatible)
// ========================================================
// Gère la logique principale de facturation (Firebase + interface)

import {
  ref,
  get,
  set,
  update,
  push,
  child
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

document.addEventListener('DOMContentLoaded', async () => {

  // ======================================================
  // Vérification Firebase
  if (!window?.db) {
    console.warn('[facturation] Firebase non initialisé (window.db manquant).');
    return;
  }

  console.log('[facturation] module chargé ✅');

  // Petit helper pour Firebase v9+
  const dbRef = (path) => ref(window.db, path);

  // ======================================================
  // CONFIGURATION GLOBALE
  const vatPath = 'settings/vatRate';
  const seqPath = `settings/invoiceSeq/${new Date().getFullYear()}`;
  const invoicesPath = 'invoices';
  const clientsPaths = ['clients/pro', 'clients/part'];

  // ======================================================
  // OUTILS UTILES
  const formatMoney = (n) => `${parseFloat(n || 0).toFixed(2)} €`;
  const nowDate = () => new Date().toISOString().split('T')[0];
  const randomKey = () => Math.random().toString(36).substring(2, 10);

  // ======================================================
  // INITIALISATION TVA
  let vatRate = 21;
  try {
    const vatSnap = await get(dbRef(vatPath));
    if (vatSnap.exists()) {
      vatRate = vatSnap.val();
    } else {
      await set(dbRef(vatPath), vatRate);
    }
  } catch (e) {
    console.error('Erreur récupération TVA', e);
  }

  // ======================================================
  // CHARGEMENT CLIENTS (PRO + PART)
  async function loadClients() {
    const allClients = [];
    for (const path of clientsPaths) {
      const snap = await get(dbRef(path));
      if (snap.exists()) {
        Object.values(snap.val()).forEach(c => {
          allClients.push({
            type: path.includes('pro') ? 'PRO' : 'PART',
            nom: c.nom || c.entreprise || c.prenom || 'Inconnu',
            id: c.id || randomKey()
          });
        });
      }
    }

    // Tri alphabétique (ignore la forme juridique)
    allClients.sort((a, b) =>
      a.nom.replace(/\b(SPRL|SRL|SA|ASBL|BVBA)\b/gi, '')
        .localeCompare(b.nom.replace(/\b(SPRL|SRL|SA|ASBL|BVBA)\b/gi, ''), 'fr')
    );

    return allClients;
  }

  // ======================================================
  // GÉNÉRATION DU NUMÉRO DE FACTURE
  async function getNextInvoiceNumber() {
    const year = new Date().getFullYear();
    const seqRef = dbRef(`settings/invoiceSeq/${year}`);
    const snap = await get(seqRef);
    let n = snap.exists() ? snap.val() + 1 : 1;
    await set(seqRef, n);
    return `${year}-${String(n).padStart(3, '0')}`;
  }

  // ======================================================
  // CRÉATION / ENREGISTREMENT D’UNE FACTURE
  async function createInvoice(data) {
    const num = await getNextInvoiceNumber();

    const invoice = {
      id: randomKey(),
      number: num,
      date: nowDate(),
      clientType: data.clientType,
      clientName: data.clientName,
      description: data.description,
      serviceType: data.serviceType,
      amountHT: parseFloat(data.amountHT || 0),
      vat: parseFloat(data.vat || vatRate),
      acompte: parseFloat(data.acompte || 0),
      remise: parseFloat(data.remise || 0),
      status: 'a_payer',
      createdAt: Date.now(),
    };

    // Calcul TTC
    invoice.amountTTC = invoice.amountHT * (1 + invoice.vat / 100) - invoice.acompte - invoice.remise;

    // Enregistrement dans Firebase
    await set(dbRef(`${invoicesPath}/${invoice.id}`), invoice);
    console.log('💾 Facture enregistrée :', invoice);

    return invoice;
  }

  // ======================================================
  // CHARGEMENT DES FACTURES EXISTANTES
  async function loadInvoices() {
    const snap = await get(dbRef(invoicesPath));
    if (!snap.exists()) return [];
    const list = Object.values(snap.val());
    // tri par date descendante
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  // ======================================================
  // TEST TEMPORAIRE DANS CONSOLE
  const clients = await loadClients();
  console.table(clients);

  const invoices = await loadInvoices();
  console.table(invoices);

  // Exemple : Création test (désactivé par défaut)
  /*
  const newInv = await createInvoice({
    clientType: 'PRO',
    clientName: 'Loca-lift SRL',
    description: 'Service de levage - Mission LIFT',
    serviceType: 'mission',
    amountHT: 200,
    acompte: 50,
    remise: 0
  });
  console.log('Nouvelle facture :', newInv);
  */
});
