/*
 * datas-limite.js — Limites das datas das fichas (VISAT/SMS Florianópolis)
 * Todas as datas das fichas são de fatos já ocorridos (nascimento, acidente, sintomas, diagnóstico, notificação,
 * óbito, encerramento): mínimo 01/01/1900 e máximo hoje. Com min e max de 4 dígitos, o navegador deixa digitar
 * só 4 dígitos no ano (antes aceitava 6, ex.: 198743). O aviso aparece ao sair do campo, não durante a digitação.
 */
(function () {
  'use strict';
  var MIN = '1900-01-01';
  function hoje() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function aviso(campo, texto) {
    var id = (campo.id || campo.dataset.key || 'data') + '-limite';
    var el = document.getElementById(id);
    if (!el && texto) {
      el = document.createElement('small');
      el.id = id;
      el.className = 'field-help';
      el.setAttribute('role', 'alert');
      el.style.color = '#B3261E';
      el.style.display = 'block';
      campo.insertAdjacentElement('afterend', el);
    }
    if (el) { el.textContent = texto || ''; el.hidden = !texto; }
  }
  function conferir(campo) {
    var v = campo.value;
    var max = hoje();
    campo.max = max;
    var texto = '';
    if (v && (v < MIN || v > max || !/^\d{4}-\d{2}-\d{2}$/.test(v))) {
      texto = 'Data inválida (de 01/01/1900 até hoje).';
    }
    campo.setCustomValidity(texto);
    aviso(campo, texto);
  }
  function preparar(raiz) {
    (raiz || document).querySelectorAll('input[type="date"]:not([data-visat-limite])').forEach(function (campo) {
      campo.dataset.visatLimite = '1';
      campo.min = MIN;
      campo.max = hoje();
      // Enquanto digita, o ano passa por 0002, 0020, 0202...: não avisa; confere ao sair do campo.
      campo.addEventListener('input', function () {
        if (document.activeElement === campo) { campo.setCustomValidity(''); aviso(campo, ''); } else conferir(campo);
      });
      // O controle nativo permite selecionar dia, mês ou ano com o mouse ou com as setas.
      campo.addEventListener('blur', function () { conferir(campo); });
      if (campo.value) conferir(campo);
    });
  }
  var agendado = null;
  function iniciar() {
    preparar();
    new MutationObserver(function () { clearTimeout(agendado); agendado = setTimeout(preparar, 150); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
