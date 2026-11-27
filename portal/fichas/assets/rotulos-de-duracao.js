(() => {
  function rotular() {
    for (const linha of document.querySelectorAll(".acidente-inline .unit-row")) {
      const campo = linha.querySelector("input");
      const unidade = linha.querySelector("select");
      const titulo = linha.dataset.summary || linha.parentElement.querySelector(".field-label")?.textContent.trim();
      if (!campo || !unidade || !titulo) continue;
      if (!campo.labels?.length && !campo.hasAttribute("aria-label")) campo.setAttribute("aria-label", titulo);
      if (!unidade.labels?.length && !unidade.hasAttribute("aria-label")) unidade.setAttribute("aria-label", "Unidade de " + titulo.toLocaleLowerCase("pt-BR"));
    }
  }
  let pendente = false;
  new MutationObserver(() => {
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(() => { pendente = false; rotular(); });
  }).observe(document.body, {childList: true, subtree: true});
  rotular();
})();
