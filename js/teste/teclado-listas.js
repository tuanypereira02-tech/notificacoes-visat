
/* Seleção pelo teclado em todas as listas do formulário e da consulta.
   Campo com lista: setas destacam o item sem tirar o cursor do campo; Enter ou Espaço escolhem.
   Com o foco num item da lista (tecla Tab): setas sobem e descem, Home e End vão ao primeiro e ao último item,
   Enter ou Espaço escolhem, Esc fecha a lista e volta ao campo.
   Grupos de opções (botões de escolha): setas movem entre as opções; Enter ou Espaço escolhem. */
(function () {
  var LISTAS = '.visat-lista-apoio, .empresa-resultados, .visat-cid-lista, #lista-agravos';
  var CAMPOS = 'input:not([type="hidden"]):not([type="date"]):not([type="time"]):not([type="radio"]):not([type="checkbox"]), textarea';

  function visivel(el) { return !!el && !el.hidden && el.getClientRects().length > 0; }
  var TAMANHO_JANELA = 4;
  var janelas = new WeakMap();
  function caixaDaOpcao(lista, botao) {
    var item = botao.closest('li');
    return item && lista.contains(item) ? item : botao;
  }
  function itensDe(lista) {
    return Array.prototype.filter.call(lista.querySelectorAll('button:not([disabled])'), function (botao) {
      return visivel(botao) || (lista.id !== 'lista-agravos' &&
        caixaDaOpcao(lista, botao).hasAttribute('data-visat-fora-da-janela') &&
        !botao.closest('[hidden]'));
    });
  }
  function ajustarJanela(lista, itens, indice) {
    if (lista.id === 'lista-agravos' || !itens.length) return;
    var estado = janelas.get(lista);
    if (!estado || estado.primeiro !== itens[0] || estado.total !== itens.length) {
      estado = { primeiro: itens[0], total: itens.length, inicio: 0 };
      janelas.set(lista, estado);
    }
    if (indice >= 0) estado.inicio = Math.floor(indice / TAMANHO_JANELA) * TAMANHO_JANELA;
    itens.forEach(function (botao, pos) {
      caixaDaOpcao(lista, botao).toggleAttribute('data-visat-fora-da-janela',
        pos < estado.inicio || pos >= estado.inicio + TAMANHO_JANELA);
    });
  }
  function atualizarJanelas() {
    document.querySelectorAll(LISTAS).forEach(function (lista) {
      if (lista.id !== 'lista-agravos' && visivel(lista)) ajustarJanela(lista, itensDe(lista));
    });
  }
  function listaDoCampo(campo) {
    if (campo.id === 'busca') return document.getElementById('lista-agravos');
    var caixa = campo.parentElement;
    if (!caixa) return null;
    var listas = caixa.querySelectorAll(LISTAS);
    for (var i = 0; i < listas.length; i++) {
      var lista = listas[i];
      if (lista.compareDocumentPosition(campo) & Node.DOCUMENT_POSITION_PRECEDING && visivel(lista) && itensDe(lista).length) return lista;
    }
    return null;
  }
  function campoDaLista(lista) {
    if (lista.id === 'lista-agravos') return document.getElementById('busca');
    var caixa = lista.parentElement;
    if (!caixa) return null;
    var campos = Array.prototype.filter.call(caixa.querySelectorAll(CAMPOS), function (c) {
      return lista.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_PRECEDING;
    });
    return campos[campos.length - 1] || null;
  }
  function focar(item) {
    if (!item) return;
    item.focus();
    try { item.scrollIntoView({ block: 'nearest' }); } catch (e) {}
  }

  // Campo com lista: o cursor continua no campo; seta para baixo e para cima destacam o item;
  // Enter ou Espaço escolhem o item destacado; Esc tira o destaque e fecha a lista.
  var ATIVO = 'visat-item-ativo';
  var contador = 0;
  function ativoDe(lista) {
    var atual = lista.querySelector('.' + ATIVO);
    return atual && visivel(atual) ? atual : null;
  }
  function destacar(campo, lista, item) {
    document.querySelectorAll('.' + ATIVO).forEach(function (el) { el.classList.remove(ATIVO); el.removeAttribute('aria-selected'); });
    if (!lista.id) lista.id = 'visat-lista-' + (++contador);
    lista.setAttribute('role', 'listbox');
    itensDe(lista).forEach(function (b) {
      if (!b.id) b.id = lista.id + '-item-' + (++contador);
      b.setAttribute('role', 'option');
      b.tabIndex = -1;
    });
    campo.setAttribute('aria-controls', lista.id);
    campo.setAttribute('aria-expanded', 'true');
    if (!item) { campo.removeAttribute('aria-activedescendant'); return; }
    item.classList.add(ATIVO);
    item.setAttribute('aria-selected', 'true');
    campo.setAttribute('aria-activedescendant', item.id);
    try { item.scrollIntoView({ block: 'nearest' }); } catch (e) {}
  }
  document.addEventListener('keydown', function (ev) {
    if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.isComposing) return;
    var campo = ev.target;
    if (!(campo instanceof Element) || !campo.matches(CAMPOS)) return;
    var lista = listaDoCampo(campo);
    if (!lista) { campo.removeAttribute('aria-activedescendant'); return; }
    var itens = itensDe(lista);
    var ativo = ativoDe(lista);
    var pos = ativo ? itens.indexOf(ativo) : -1;
    var tecla = ev.key;
    if (tecla === 'ArrowDown' || tecla === 'ArrowUp' || tecla === 'PageDown' || tecla === 'PageUp') {
      var novo;
      if (tecla === 'ArrowDown') novo = Math.min(pos + 1, itens.length - 1);
      else if (tecla === 'ArrowUp') novo = pos - 1;
      else if (tecla === 'PageDown') novo = Math.min(pos + 5, itens.length - 1);
      else novo = Math.max(pos - 5, 0);
      ev.preventDefault();
      ev.stopPropagation();
      ajustarJanela(lista, itens, novo < 0 ? 0 : novo);
      destacar(campo, lista, novo >= 0 ? itens[novo] : null);
      return;
    }
    if ((tecla === 'Enter' || tecla === ' ' || tecla === 'Spacebar') && ativo) {
      ev.preventDefault();
      ev.stopPropagation();
      campo.removeAttribute('aria-activedescendant');
      campo.setAttribute('aria-expanded', 'false');
      ativo.classList.remove(ATIVO);
      ativo.click();
      if (document.activeElement !== campo && campo.isConnected && lista.id !== 'lista-agravos') campo.focus();
      return;
    }
    if (tecla === 'Escape' && ativo) {
      destacar(campo, lista, null);
    }
  }, true);
  // Digitar outra letra tira o destaque, pois a lista é refeita.
  document.addEventListener('input', function (ev) {
    var campo = ev.target;
    if (campo instanceof Element && campo.hasAttribute('aria-activedescendant')) campo.removeAttribute('aria-activedescendant');
  }, true);

  document.addEventListener('keydown', function (ev) {
    if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    var alvo = ev.target;
    if (!(alvo instanceof Element)) return;

    // 2) Item de lista.
    var lista = alvo.closest(LISTAS);
    if (lista && alvo.tagName === 'BUTTON') {
      var itens = itensDe(lista);
      var pos = itens.indexOf(alvo);
      if (pos < 0) return;
      function moverPara(indice) {
        ajustarJanela(lista, itens, indice);
        focar(itens[indice]);
      }
      if (ev.key === 'ArrowDown') { ev.preventDefault(); moverPara(Math.min(pos + 1, itens.length - 1)); }
      else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (pos > 0) moverPara(pos - 1);
        else { var origem = campoDaLista(lista); if (origem) origem.focus(); }
      }
      else if (ev.key === 'Home') { ev.preventDefault(); moverPara(0); }
      else if (ev.key === 'End') { ev.preventDefault(); moverPara(itens.length - 1); }
      else if (ev.key === 'Escape') {
        var campo = campoDaLista(lista);
        if (lista.id !== 'lista-agravos') lista.hidden = true;
        if (campo) { ev.preventDefault(); campo.focus(); }
      }
      return;
    }

    // 3) Grupo de opções em botões (chips).
    var grupo = alvo.closest('[data-chips]');
    if (grupo && alvo.classList.contains('chip')) {
      var opcoes = Array.prototype.filter.call(grupo.querySelectorAll('.chip:not([disabled])'), visivel);
      var i = opcoes.indexOf(alvo);
      if (i < 0) return;
      var destino = null;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') destino = opcoes[(i + 1) % opcoes.length];
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') destino = opcoes[(i - 1 + opcoes.length) % opcoes.length];
      else if (ev.key === 'Home') destino = opcoes[0];
      else if (ev.key === 'End') destino = opcoes[opcoes.length - 1];
      if (destino) { ev.preventDefault(); focar(destino); }
    }
  });

  // Instrução para leitores de tela e para quem navega pelo teclado nos campos com sugestões.
  function anotar(raiz) {
    (raiz || document).querySelectorAll('input[data-visat-lista], input[data-visat-busca-empresa], input[data-visat-cid], #busca').forEach(function (campo) {
      if (campo.dataset.visatDicaTeclado) return;
      campo.dataset.visatDicaTeclado = '1';
      campo.setAttribute('aria-keyshortcuts', 'ArrowDown');
      var dica = document.createElement('span');
      dica.className = 'visat-dica-teclado sr-only-visat';
      dica.id = (campo.id || 'campo-' + Math.random().toString(36).slice(2, 8)) + '-dica-teclado';
      dica.textContent = 'Use as setas para cima e para baixo para destacar uma sugestão e Enter ou Espaço para escolher. Esc fecha a lista.';
      dica.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';
      campo.insertAdjacentElement('afterend', dica);
      var atual = campo.getAttribute('aria-describedby');
      campo.setAttribute('aria-describedby', (atual ? atual + ' ' : '') + dica.id);
    });
  }
  var agendado = false;
  new MutationObserver(function () {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(function () { agendado = false; anotar(document); atualizarJanelas(); });
  }).observe(document.body, { childList: true, subtree: true });
  anotar(document);
  atualizarJanelas();
})();
