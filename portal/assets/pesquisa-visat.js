/* Pesquisa local no catálogo comum; funciona sem depender do menu da réplica. */
(function () {
  'use strict';

  function normalize(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function initialize() {
    var portal = window.VisatPortal;
    if (!portal || !document.body || document.querySelector('.visat-pesquisa')) return;
    var target = document.querySelector('.replica-conteudo') || document.querySelector('main');
    if (!target) return;

    var section = document.createElement('section');
    section.className = 'visat-pesquisa';
    section.setAttribute('aria-label', 'Pesquisa do portal VISAT');
    var form = document.createElement('form');
    form.setAttribute('role', 'search');
    var input = document.createElement('input');
    input.type = 'search';
    input.name = 'q';
    input.maxLength = 120;
    input.placeholder = 'Pesquisar no portal VISAT';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Pesquisar no portal VISAT');
    input.setAttribute('aria-controls', 'visat-pesquisa-resultados');
    var button = document.createElement('button');
    button.type = 'submit';
    button.textContent = 'Pesquisar';
    form.append(input, button);
    var status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    status.hidden = true;
    var results = document.createElement('ul');
    results.id = 'visat-pesquisa-resultados';
    results.hidden = true;
    section.append(form, status, results);
    target.before(section);

    var catalog = portal.pages.map(function (page) {
      return { page: page, searchable: normalize(page.title + ' ' + page.terms) };
    });

    function search() {
      var query = normalize(input.value.trim());
      results.replaceChildren();
      if (!query) {
        status.textContent = '';
        status.hidden = results.hidden = true;
        return;
      }
      var tokens = query.split(/\s+/);
      var found = catalog.filter(function (entry) {
        return tokens.every(function (token) { return entry.searchable.indexOf(token) !== -1; });
      });
      found.forEach(function (entry) {
        var item = document.createElement('li');
        var link = document.createElement('a');
        link.textContent = entry.page.title;
        link.href = portal.url(entry.page.file);
        portal.prepareLink(link);
        item.appendChild(link);
        results.appendChild(item);
      });
      status.textContent = found.length
        ? found.length + (found.length === 1 ? ' página encontrada' : ' páginas encontradas')
        : 'Nenhuma página encontrada. Tente outro assunto.';
      status.hidden = false;
      results.hidden = found.length === 0;
    }

    form.addEventListener('submit', function (event) { event.preventDefault(); search(); });
    input.addEventListener('input', search);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { input.value = ''; search(); }
    });
  }

  // Ambos os scripts podem ser carregados antes ou depois de DOMContentLoaded.
  document.addEventListener('visat:ready', initialize, { once: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
  if (window.VisatPortal) window.VisatPortal.ready.then(initialize);
})();
