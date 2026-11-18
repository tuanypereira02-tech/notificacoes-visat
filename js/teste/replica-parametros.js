/* Réplica para testes: sempre no escopo VISAT e em homologação (PDF e e-mail marcados). */
window.VISAT_MODELO_FINAL_TODAS = true; // réplica: modelo final nas 10 fichas
(function () {
  var p = new URLSearchParams(location.search);
  if (!p.has('homologacao') || p.get('escopo') !== 'visat') {
    p.set('escopo', 'visat');
    p.set('homologacao', '1');
    location.replace(location.pathname + '?' + p.toString() + location.hash);
  }
})();
