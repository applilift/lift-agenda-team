/* Chargement du fichier communes_client.json */
export async function loadCommunes() {
  const res = await fetch("./communes_client.json");
  return await res.json();
}

/* Autocomplete CP + Commune */
export function initAutocomplete(cpField, communeField, suggestionBox) {
  let data = [];

  loadCommunes().then(list => { data = list; });

  cpField.addEventListener("input", () => {
    const val = cpField.value.trim();
    if (val.length < 2) {
      suggestionBox.classList.add("hidden");
      return;
    }

    const filtered = data
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
