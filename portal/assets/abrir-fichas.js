/* A navegação substitui esta página; não cria um segundo iframe. */
(() => {
  'use strict';
  const oficial = window.VisatModo === 'oficial';
  const link = document.querySelector(oficial ? '[data-fichas-oficial]' : '[data-fichas-replica]');
  if (!link) return;
  const destino = new URL(link.getAttribute('href'), document.baseURI);
  // Os parâmetros do fluxo atual são preservados. A cópia de teste impõe
  // homologação e remove o envio independentemente da query string.
  if (!oficial) destino.searchParams.set('homologacao', '1');
  location.replace(destino.href);
})();
