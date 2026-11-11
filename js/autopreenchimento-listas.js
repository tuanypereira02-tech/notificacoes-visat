/*
 * autopreenchimento-listas.js — Listas de sugestões e códigos automáticos (complemento do autopreenchimento.js)
 * VISAT / SMS Florianópolis
 *
 * Mesmas fontes e formatos do Sinan usados na "Consulta rápida de códigos" do portal VISAT:
 *   - Unidade de saúde: lista CNES da rede de Florianópolis (data/cnes-florianopolis.json); código CNES com 7 dígitos.
 *   - Município: API de localidades do IBGE; código com 6 dígitos (sem o dígito verificador).
 *   - Ocupação: CBO 2002 (MTE) + códigos adaptados pelo DATASUS (data/cbo-datasus-adicional.json); 6 caracteres.
 *   - CID-10: tabela do DATASUS; código sem ponto, com 3 ou 4 caracteres.
 * Ao escolher um item da lista, o campo recebe "código – descrição" (ou o nome, no caso de unidade e município)
 * e o campo de código correspondente é preenchido. Nada já digitado é apagado.
 */
(function () {
  'use strict';

  var GH = 'https://raw.githubusercontent.com/';
  var cache = {};

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function csv(url, enc) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(function (b) {
        return new TextDecoder(enc).decode(b).split(/\r?\n/).slice(1).filter(Boolean).map(function (l) { return l.split(';'); });
      });
  }

  /* Cada fonte devolve [{c: código, d: descrição, v: valor a gravar no campo, uf?}] */
  var FONTES = {
    cnes: function () {
      return fetch('data/cnes-florianopolis.json').then(function (r) { return r.json(); }).then(function (l) {
        return l.map(function (p) {
          var nome = String(p[1]).split(' · ')[0];
          return { c: p[0], d: p[1], v: nome };
        });
      });
    },
    mun: function () {
      return fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado')
        .then(function (r) { return r.json(); })
        .then(function (j) {
          return j.map(function (x) {
            var id = String(x['municipio-id']);
            return { c: id.slice(0, 6), d: x['municipio-nome'] + ' – ' + x['UF-sigla'], v: x['municipio-nome'], uf: x['UF-sigla'] };
          });
        });
    },
    cbo: function () {
      return Promise.all([
        csv(GH + 'brazilian-utils/javascript/main/scripts/data/cbo2002-ocupacao.csv', 'windows-1252'),
        fetch('data/cbo-datasus-adicional.json').then(function (r) { return r.json(); }).catch(function () { return []; })
      ]).then(function (a) {
        var l = a[0].map(function (p) { return { c: p[0].trim(), d: p[1].trim() }; });
        a[1].forEach(function (p) { l.push({ c: p[0], d: p[1] }); });
        l.forEach(function (x) { x.v = x.c + ' – ' + x.d; });
        return l;
      });
    },
    cnae: function () {
      return fetch('https://servicodados.ibge.gov.br/api/v2/cnae/classes')
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (classes) {
          return classes.map(function (x) {
            var codigo = String(x.id).replace(/\D/g, '').padStart(5, '0');
            return { c: codigo, d: x.descricao, v: codigo + ' – ' + x.descricao };
          });
        });
    },
    cid: function () {
      var u = GH + 'msrodrigues/cid10/master/data-raw/';
      return Promise.all([csv(u + 'CID-10-CATEGORIAS.CSV', 'iso-8859-1'), csv(u + 'CID-10-SUBCATEGORIAS.CSV', 'iso-8859-1')])
        .then(function (a) {
          var m = {};
          a[0].forEach(function (p) { m[p[0]] = p[2]; });
          a[1].forEach(function (p) { m[p[0]] = p[4]; });
          return Object.keys(m).sort().map(function (k) { return { c: k, d: m[k], v: k + ' – ' + m[k] }; });
        });
    }
  };

  function carregar(tipo) {
    if (!cache[tipo]) {
      cache[tipo] = FONTES[tipo]().catch(function () { delete cache[tipo]; return []; });
    }
    return cache[tipo];
  }

  function campo(raiz, chaves) {
    for (var i = 0; i < chaves.length; i++) {
      var el = raiz.querySelector('[data-key="' + chaves[i] + '"]');
      if (el) return el;
    }
    return null;
  }

  function vazio(el) {
    if (!el) return false;
    if (el.tagName === 'SELECT') return !el.value || /^selecione/i.test(el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '');
    return !String(el.value || '').trim();
  }

  function definir(el, valor, forcar) {
    if (!el || valor === undefined || valor === null || valor === '') return;
    if (!forcar && !vazio(el)) return;
    if (el.tagName === 'SELECT') {
      var alvo = String(valor).toLowerCase();
      var op = Array.prototype.find.call(el.options, function (o) {
        return o.value.toLowerCase() === alvo || o.text.trim().toLowerCase() === alvo;
      });
      if (!op) return;
      el.value = op.value;
    } else {
      el.value = valor;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* Lista de sugestões nativa do navegador (datalist), filtrada enquanto a pessoa digita. */
  function anexarLista(input, tipo, aoEscolher) {
    if (!input || input.tagName !== 'INPUT' || input.dataset.visatLista) return;
    input.dataset.visatLista = tipo;
    var dl = document.createElement('datalist');
    dl.id = 'visat-lista-' + tipo + '-' + Math.random().toString(36).slice(2, 8);
    input.insertAdjacentElement('afterend', dl);
    input.setAttribute('list', dl.id);
    input.setAttribute('autocomplete', 'off');

    function atualizar() {
      var termo = norm(input.value);
      if (termo.length < 2) { dl.textContent = ''; return; }
      carregar(tipo).then(function (lista) {
        var palavras = termo.split(' ');
        var achados = [];
        for (var i = 0; i < lista.length && achados.length < 400; i++) {
          var x = lista[i];
          var alvo = norm(x.c + ' ' + x.d);
          if (palavras.every(function (w) { return alvo.indexOf(w) >= 0; })) achados.push(x);
        }
        // Ordem: nome exato, depois início igual, depois o restante; Santa Catarina primeiro.
        function nota(x) {
          var v = norm(x.v), d = norm(x.d);
          var n = (v === termo || x.c === termo) ? 0 : (v.indexOf(termo) === 0 || d.indexOf(termo) === 0 || x.c.indexOf(termo) === 0) ? 1 : 2;
          return n - (x.uf === 'SC' ? 0.5 : 0);
        }
        achados.sort(function (a, b) { return nota(a) - nota(b); });
        achados = achados.slice(0, 30);
        dl.textContent = '';
        achados.forEach(function (x) {
          var o = document.createElement('option');
          o.value = x.v;
          o.label = x.d + ' (' + x.c + ')';
          dl.appendChild(o);
        });
      });
    }

    function confirmar() {
      var valor = norm(input.value);
      if (!valor) return;
      carregar(tipo).then(function (lista) {
        var iguais = lista.filter(function (x) { return norm(x.v) === valor; });
        var item = iguais.find(function (x) { return x.uf === 'SC'; }) || iguais[0] ||
                   lista.find(function (x) { return norm(x.d) === valor || x.c === input.value.trim(); });
        if (item && aoEscolher) aoEscolher(item);
      });
    }

    input.addEventListener('focus', function () { carregar(tipo); });
    input.addEventListener('input', atualizar);
    input.addEventListener('change', confirmar);
  }

  /* ---------- CNPJ a partir do nome da empresa ---------- */

  // Não há serviço público gratuito que devolva o CNPJ pelo nome. O botão abre a busca já com o nome
  // digitado; ao colar o CNPJ encontrado no campo de CNPJ, o autopreenchimento.js completa os demais dados.
  function botaoBuscaCnpj(raiz, chavesNome, chavesCnpj) {
    var nome = campo(raiz, chavesNome);
    var cnpj = campo(raiz, chavesCnpj);
    if (!nome || !cnpj || nome.dataset.visatBuscaCnpj) return;
    nome.dataset.visatBuscaCnpj = '1';

    var caixa = document.createElement('div');
    caixa.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:6px';
    var botao = document.createElement('button');
    botao.type = 'button';
    botao.textContent = 'Buscar CNPJ pelo nome ↗';
    botao.style.cssText = 'padding:6px 12px;border:1px solid #112C45;border-radius:6px;background:#112C45;color:#FFFFFF;font-size:12px;font-weight:600;cursor:pointer';
    var dica = document.createElement('small');
    dica.style.cssText = 'color:#4A5D70;font-size:12px';
    dica.textContent = 'Abre a busca em nova aba. Copie o CNPJ encontrado e cole no campo de CNPJ: os demais dados são preenchidos automaticamente.';
    caixa.appendChild(botao);
    caixa.appendChild(dica);
    nome.insertAdjacentElement('afterend', caixa);

    botao.addEventListener('click', function () {
      var termo = String(nome.value || '').trim();
      if (termo.length < 3) {
        dica.style.color = '#B3261E';
        dica.textContent = 'Digite ao menos parte do nome da empresa antes de buscar.';
        nome.focus();
        return;
      }
      dica.style.color = '#4A5D70';
      dica.textContent = 'Copie o CNPJ encontrado e cole no campo de CNPJ: os demais dados são preenchidos automaticamente.';
      window.open('https://www.google.com/search?q=' + encodeURIComponent('"' + termo + '" CNPJ'), '_blank', 'noopener');
      setTimeout(function () { cnpj.focus(); }, 300);
    });
  }

  function atualizarDicaCnpj(raiz) {
    raiz.querySelectorAll('small, p, span, .hint, .ajuda').forEach(function (el) {
      if (/Preencha o documento e os dados da empresa manualmente/i.test(el.textContent) && !el.dataset.visatDica) {
        el.dataset.visatDica = '1';
        el.textContent = 'Digite o CNPJ: nome, atividade econômica e endereço da empresa são preenchidos automaticamente. Para CPF, preencha os dados manualmente.';
      }
    });
  }

  /* ---------- configuração por formulário ---------- */

  function configurar(raiz) {
    botaoBuscaCnpj(raiz, ['empresa', 'empresaNome', 'razao'], ['cnpj']);
    botaoBuscaCnpj(raiz, ['razaoPrincipal', 'razaoPrinc'], ['cnpjPrincipal', 'cnpjPrinc']);
    atualizarDicaCnpj(raiz);

    // Unidade notificadora -> código CNES
    [['unidNotif', 'codUnidNotif'], ['unidade', 'codUnidNotif'], ['unidadeNotificadora', 'codUnidNotif'], ['munInvestigadora', 'codUnidInv']]
      .forEach(function (par) {
        var nome = campo(raiz, [par[0]]);
        var cod = par[1] ? campo(raiz, [par[1]]) : null;
        anexarLista(nome, 'cnes', function (item) {
          if (nome.value !== item.v) definir(nome, item.v, true);
          if (cod) definir(cod, item.c, true);
        });
      });

    // Município -> código IBGE (6 dígitos) e UF
    [['munRes', 'ibgeRes', 'ufRes'], ['munEmp', 'ibgeEmp', 'ufEmp'], ['municipioNotif', 'ibgeNotif', 'uf'],
     ['munNotif', 'ibgeNotif', 'ufNotif'], ['municipioNotificacao', 'ibgeNotif', 'ufNotificacao'], ['munPrincipal', 'ibgePrincipal', 'ufPrincipal']]
      .forEach(function (t) {
        var mun = campo(raiz, [t[0]]);
        var ibge = t[1] ? campo(raiz, [t[1]]) : null;
        var uf = t[2] ? campo(raiz, [t[2]]) : null;
        anexarLista(mun, 'mun', function (item) {
          if (norm(mun.value) !== norm(item.v)) definir(mun, item.v, true);
          if (ibge) definir(ibge, item.c, true);
          if (uf) definir(uf, item.uf, true);
        });
      });

    // Ocupação -> CBO
    anexarLista(campo(raiz, ['ocupacao']), 'cbo', null);

    ['cnae', 'cnaePrincipal', 'cnaePrinc'].forEach(function (k) {
      anexarLista(campo(raiz, [k]), 'cnae', null);
    });
    if (!campo(raiz, ['munNotif', 'municipioNotif', 'municipioNotificacao'])) {
      var municipio = campo(raiz, ['municipio']);
      anexarLista(municipio, 'mun', function (item) {
        definir(campo(raiz, ['ibgeNotif']), item.c, true);
        definir(campo(raiz, ['uf']), item.uf, true);
      });
    }

    // Diagnóstico -> CID-10 (campos editáveis; o CID fixo do agravo não é alterado)
    ['cid', 'cid10', 'cid10Notif'].forEach(function (k) {
      var el = campo(raiz, [k]);
      if (el && !el.readOnly && !el.disabled) anexarLista(el, 'cid', null);
    });
  }

  function raizDoFormulario(el) {
    return el.closest('[class*="inline"]') || el.closest('form') || el.closest('section') || document;
  }

  var agendado = null;
  function examinar() {
    clearTimeout(agendado);
    agendado = setTimeout(function () {
      var raizes = new Set();
      document.querySelectorAll('[data-key]').forEach(function (el) { raizes.add(raizDoFormulario(el)); });
      raizes.forEach(configurar);
    }, 120);
  }

  function iniciar() {
    if (!document.querySelector('template[id^="form-"]') && !document.getElementById('busca')) return;
    new MutationObserver(examinar).observe(document.body, { childList: true, subtree: true });
    examinar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
