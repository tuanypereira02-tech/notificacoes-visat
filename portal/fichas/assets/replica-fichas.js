/* Gerado: modo de teste obrigatório, antes dos demais scripts. */
(function () {
  'use strict';
  window.VISAT_REPLICA_SEM_ENVIO = true;
  window.VISAT_MODELO_FINAL_TODAS = true;
  var url = new URL(window.location.href);
  url.searchParams.set('escopo', 'visat');
  url.searchParams.set('homologacao', '1');
  if (url.href === window.location.href) return;
  try { window.history.replaceState(null, '', url.href); }
  catch (erro) { window.location.replace(url.href); }
})();
