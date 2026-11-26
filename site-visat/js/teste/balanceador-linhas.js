
/* Balanceamento das linhas do formulário: cada linha com 2 ou 3 campos, sem campo sozinho.
   Grade-base de 6 colunas: 3 campos = 2 colunas cada; 2 campos = 3 colunas cada.
   Recalcula sempre que um campo condicional aparece ou some. */
(function () {
  var ESTRUTURAIS = '.draft-grid-12, .visat-sequencia, .visat-endereco-residencia, [data-visat-complementares], .draft-detalhes, .field-group, section, details';
  var LISTAS = '.visat-lista-apoio:not([hidden]), .empresa-resultados:not([hidden]), .visat-cid-lista:not([hidden])';
  function visivel(el) { return !el.hidden && el.getClientRects().length > 0; }
  function ehLinha(el) { return el.matches('.draft-row:not(.draft-grid-12), .visat-linha-campos, .pair-row'); }
  function limpar(el) { el.removeAttribute('data-visat-span'); el.style.removeProperty('--visat-span'); }
  function largura(el, n) { el.setAttribute('data-visat-span', String(n)); el.style.setProperty('--visat-span', String(n)); }
  function inteira(el) {
    var cs = getComputedStyle(el);
    return cs.gridColumnStart === '1' && cs.gridColumnEnd === '-1';
  }
  // Grade única de 4 colunas (cada coluna = 3 das 12): todas as bordas ficam alinhadas entre as linhas.
  // Campo de texto longo (data-visat-peso >= 1,5) ocupa 2 colunas; os demais, 1. Linha com 2 campos: metade cada;
  // linha com 3 campos: o mais longo ocupa metade. A última linha nunca fica com um campo sozinho.
  function celulasDe(linha) {
    var pesos = linha.map(function (el) { return pesoDe(el); });
    if (linha.length === 1) return [4];
    if (linha.length === 2) return [2, 2];
    if (linha.length === 3) {
      var tamanhos = linha.map(function (el) { return (el.querySelector('.field-label') || el).textContent.trim().length; });
      var maior = 0;
      pesos.forEach(function (p, k) { if (p > pesos[maior] || (p === pesos[maior] && p >= 1.5 && tamanhos[k] > tamanhos[maior])) maior = k; });
      return pesos.map(function (p, k) { return k === maior ? 2 : 1; });
    }
    return linha.map(function () { return 1; });
  }
  // Mede o rótulo: se o texto não cabe numa caixa de 1/4 da linha, o campo ocupa 1/2 (rótulo sempre em uma linha).
  var medidor = document.createElement('canvas').getContext('2d');
  function rotuloLongo(el) {
    var rotulo = el.querySelector('.field-label');
    var grade = el.closest('.field-group');
    if (!rotulo || !grade) return false;
    var cs = getComputedStyle(rotulo);
    medidor.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var texto = rotulo.textContent.replace(/\s+/g, ' ').trim();
    var gap = parseFloat(getComputedStyle(grade).columnGap) || 24;
    var quarto = (grade.getBoundingClientRect().width - 3 * gap) / 4;
    var largura = medidor.measureText(texto).width + 4;
    if (!(quarto > 0) || largura <= quarto) return 0;
    return largura <= 2 * quarto + gap ? 1 : 2;
  }
  function pesoDe(el) {
    var base = pesoBase(el);
    var nivel = rotuloLongo(el);
    if (nivel === 2) return 4;
    return base < 1.5 && nivel === 1 ? 1.5 : base;
  }
  function celulasDesejadas(el) { var p = pesoDe(el); return p >= 4 ? 4 : p >= 1.5 ? 2 : 1; }
  function pesoBase(el) {
    var definido = parseFloat(el.getAttribute('data-visat-peso'));
    if (definido) return definido;
    var campos = el.querySelectorAll('input:not([type="hidden"]), select, textarea');
    if (campos.length === 1 && /^(date|time)$/.test(campos[0].type)) return 0.6;
    // Grupo de opções em botões ocupa metade da linha, para as opções ficarem lado a lado.
    var opcoes = el.querySelector('[data-chips]');
    if (opcoes && opcoes.style.display !== 'none' && opcoes.getClientRects().length && opcoes.querySelectorAll('.chip').length > 2) return 1.5;
    return 1;
  }
  function empacotar(itens) {
    var linhas = [], atual = [], usado = 0;
    itens.forEach(function (el) {
      var d = celulasDesejadas(el);
      if (usado + d > 4) { linhas.push(atual); atual = []; usado = 0; }
      atual.push(el); usado += d;
    });
    if (atual.length) linhas.push(atual);
    // Linha com um campo só: recebe um campo da linha vizinha ou junta-se a ela, se couber;
    // campo de rótulo maior que meia linha ocupa a linha inteira de propósito.
    for (var k = linhas.length - 1; k >= 0; k--) {
      var linha = linhas[k];
      if (linha.length !== 1 || celulasDesejadas(linha[0]) === 4) continue;
      var ant = linhas[k - 1], prox = linhas[k + 1];
      var soma = function (l) { return l.reduce(function (t, el) { return t + celulasDesejadas(el); }, 0); };
      if (ant && ant.length >= 3) { linha.unshift(ant.pop()); continue; }
      if (ant && soma(ant) + celulasDesejadas(linha[0]) <= 4) { linhas[k - 1] = ant.concat(linha); linhas.splice(k, 1); continue; }
      if (prox && prox.length >= 2 && celulasDesejadas(prox[0]) < 4 && soma(prox) + celulasDesejadas(linha[0]) <= 4) { linhas[k + 1] = linha.concat(prox); linhas.splice(k, 1); continue; }
      // Junta-se à linha anterior só se nenhum rótulo precisar quebrar; se não, fica com a linha inteira.
      if (ant && ant.length === 2) {
        var juntos = ant.concat(linha);
        var cel = celulasDe(juntos);
        var cabem = juntos.every(function (el, i) { var nv = rotuloLongo(el); return nv === 0 || (nv === 1 && cel[i] >= 2); });
        if (cabem) { linhas[k - 1] = juntos; linhas.splice(k, 1); continue; }
      }
    }
    return linhas;
  }
  function distribuir(itens) {
    if (itens.length < 2) return;
    empacotar(itens).forEach(function (linha) {
      var celulas = celulasDe(linha);
      linha.forEach(function (el, k) { largura(el, celulas[k] * 3); });
    });
  }
  window.visatEmpacotarLinhas = function (itens) { return empacotar(itens).map(function (l) { return { itens: l, celulas: celulasDe(l) }; }); };

  // Bloco largo que cabe em meia linha: poucas opções curtas ou até dois campos.
  function compacto(el) {
    if (el.tagName !== 'DIV' || el.matches(ESTRUTURAIS) || el.querySelector('textarea, ' + LISTAS)) return false;
    var chips = el.querySelectorAll('.chip');
    if (chips.length) {
      var texto = 0;
      chips.forEach(function (c) { texto += c.textContent.trim().length; });
      return chips.length <= 4 && texto <= 48 && el.querySelectorAll('input, select').length <= 1;
    }
    return el.querySelectorAll('input, select').length <= 2;
  }
  function divisivel(el) {
    return el.tagName === 'DIV' && !el.matches(ESTRUTURAIS) && !el.querySelector('.field-group .field-group, ' + LISTAS);
  }

  function balancear(grade) {
    var cs = getComputedStyle(grade);
    if (cs.display !== 'grid' || cs.gridTemplateColumns.split(' ').length !== 12) return;
    var filhos = Array.prototype.slice.call(grade.children);
    filhos.forEach(function (f) { limpar(f); if (ehLinha(f)) Array.prototype.forEach.call(f.children, limpar); });

    // Sequência de grupos de campos (seg) e de blocos de linha inteira (bloco).
    var seq = [];
    var solto = null;
    filhos.forEach(function (f) {
      if (ehLinha(f)) {
        solto = null;
        var itens = Array.prototype.filter.call(f.children, visivel);
        if (itens.length) seq.push({ tipo: 'seg', itens: itens });
        return;
      }
      if (!visivel(f)) return;
      if (inteira(f)) { solto = null; seq.push({ tipo: 'bloco', el: f }); return; }
      if (!solto) { solto = { tipo: 'seg', itens: [] }; seq.push(solto); }
      solto.itens.push(f);
    });

    // Bloco curto de opções (ex.: Tipo de acidente, CAT emitida?) completa a linha incompleta do grupo vizinho.
    for (var b = 0; b < seq.length; b++) {
      if (seq[b].tipo !== 'bloco' || !compacto(seq[b].el)) continue;
      var antes = seq[b - 1], depois = seq[b + 1];
      if (antes && antes.tipo === 'seg') { antes.itens.push(seq[b].el); seq.splice(b, 1); b--; continue; }
      if (depois && depois.tipo === 'seg') { depois.itens.unshift(seq[b].el); seq.splice(b, 1); b--; }
    }

    // Um campo sozinho: todos os grupos vizinhos seguidos são redistribuídos juntos (linhas de 3, com 2 no fim).
    for (var i = 0; i < seq.length; i++) {
      if (seq[i].tipo !== 'seg') continue;
      var ini = i, fim = i;
      while (ini > 0 && seq[ini - 1].tipo === 'seg') ini--;
      while (fim < seq.length - 1 && seq[fim + 1].tipo === 'seg') fim++;
      if (ini === fim) continue;
      var juntos = [];
      for (var k = ini; k <= fim; k++) juntos = juntos.concat(seq[k].itens);
      seq.splice(ini, fim - ini + 1, { tipo: 'seg', itens: juntos });
      i = ini;
    }

    var usados = new Set();
    seq.forEach(function (item, j) {
      if (item.tipo !== 'seg') return;
      if (item.itens.length > 1) { distribuir(item.itens); return; }
      var campo = item.itens[0];
      var vizinhos = [seq[j - 1], seq[j + 1]].filter(function (v) { return v && v.tipo === 'bloco' && !usados.has(v.el); });
      var meio = vizinhos.find(function (v) { return compacto(v.el) || (pesoDe(campo) >= 1.5 && divisivel(v.el)); });
      if (meio) { usados.add(meio.el); largura(meio.el, 6); largura(campo, 6); return; }
      var parte = vizinhos.find(function (v) { return divisivel(v.el); });
      if (parte) { usados.add(parte.el); largura(parte.el, 9); largura(campo, 3); return; }
      largura(campo, 12);
    });
  }

  // Colunas dos grupos de opções: até 4 numa linha; acima disso, 4 ou 3 por linha, sem opção sozinha.
  function colunasOpcoes(n) {
    if (n <= 4) return n;
    if (n % 4 !== 1) return 4;
    if (n % 3 !== 1) return 3;
    return 2;
  }
  function organizarOpcoes() {
    document.querySelectorAll('.acidente-inline [data-chips]').forEach(function (grupo) {
      if (grupo.style.display === 'none') { grupo.removeAttribute('data-visat-opcoes'); return; }
      var n = Array.prototype.filter.call(grupo.children, function (c) { return c.classList.contains('chip') && !c.hidden; }).length;
      if (n < 2) { grupo.removeAttribute('data-visat-opcoes'); return; }
      grupo.setAttribute('data-visat-opcoes', String(n));
      // Menos colunas quando a palavra mais longa não cabe na caixa; nunca uma opção sozinha na última linha.
      var maiorPalavra = 0;
      Array.prototype.forEach.call(grupo.querySelectorAll('.chip'), function (c) {
        c.textContent.trim().split(/\s+/).forEach(function (p) { maiorPalavra = Math.max(maiorPalavra, p.length); });
      });
      var minimo = maiorPalavra * 8 + 30;
      var largura = grupo.getBoundingClientRect().width;
      var colunas = colunasOpcoes(n);
      while (colunas > 1 && largura && (largura - 8 * (colunas - 1)) / colunas < minimo) {
        colunas--;
        while (colunas > 1 && n % colunas === 1) colunas--;
      }
      grupo.style.setProperty('--visat-opcoes', String(Math.max(colunas, 1)));
      // Grupo na largura total: mesmo espaçamento das colunas de campos, para as caixas ficarem alinhadas.
      var item = grupo;
      while (item.parentElement && !item.parentElement.matches('.field-group')) item = item.parentElement;
      var grade = item.parentElement;
      var cheia = grade && Math.abs(grupo.getBoundingClientRect().width - grade.getBoundingClientRect().width) < 2;
      grupo.style.columnGap = cheia ? 'var(--draft-gap)' : '';
      grupo.style.setProperty('--visat-opcoes-m', String(n % 2 === 0 ? 2 : n === 3 ? 3 : 1));
    });
  }
  // Instruções curtas passam para dentro do campo (texto de exemplo); a explicação fica só para leitores de tela.
  function enxugar() {
    var raiz = document.querySelector('.acidente-inline');
    if (!raiz) return;
    function ocultar(el) { if (el && !el.hasAttribute('data-visat-oculto')) el.setAttribute('data-visat-oculto', ''); }
    var nome = raiz.querySelector('#sinan-nome');
    if (nome && !nome.placeholder) { nome.placeholder = 'Sem abreviações'; ocultar(raiz.querySelector('#sinan-nome-ajuda')); }
    raiz.querySelectorAll('input[data-visat-cid]').forEach(function (cid) {
      var ajuda = document.getElementById(cid.id + '-cid-ajuda');
      if (!ajuda || ajuda.hasAttribute('data-visat-oculto')) return;
      var faixa = (ajuda.textContent.match(/Aceita (.+?)\.?$/) || [])[1];
      cid.placeholder = 'Código ou nome' + (faixa ? ' (' + faixa + ')' : '');
      ocultar(ajuda);
    });
    raiz.querySelectorAll('input[data-visat-busca-empresa]').forEach(function (empresa) {
      empresa.placeholder = 'Digite e escolha na lista';
      Array.prototype.forEach.call(empresa.parentElement.querySelectorAll(':scope > .field-help:not([role])'), function (p) {
        if (/escolha na lista/i.test(p.textContent)) ocultar(p);
      });
    });
    raiz.querySelectorAll('.visat-sequencia > .field-help, .visat-sequencia > .screen-sub').forEach(function (p) {
      if (/^Busque pelo CNPJ/i.test(p.textContent.trim())) ocultar(p);
    });
  }
  var agendado = false;
  function balancearTudo() {
    agendado = false;
    enxugar();
    document.querySelectorAll('.acidente-inline .field-group').forEach(balancear);
    organizarOpcoes();
  }
  function agendar() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(balancearTudo);
  }
  new MutationObserver(agendar).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('resize', agendar);
  agendar();
  window.visatBalancearLinhas = balancearTudo;
})();
