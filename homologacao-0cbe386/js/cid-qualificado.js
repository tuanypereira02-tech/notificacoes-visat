/*
 * cid-qualificado.js — CID-10 qualificado nos formulários de Saúde do Trabalhador
 * VISAT / SMS Florianópolis
 *
 * Doenças relacionadas ao trabalho (câncer, dermatose, LER/DORT, PAIR, pneumoconiose, transtorno mental):
 *   - o campo "Diagnóstico específico — CID-10" aceita somente CID do escopo da ficha;
 *   - CID do escopo que consta da LDRT (Portaria GM/MS nº 5.674/2024) mostra capítulo, página e agentes;
 *   - CID do escopo que não consta da LDRT é aceito com aviso;
 *   - CID fora do escopo impede o PDF final e indica a ficha adequada, quando houver.
 * Acidente de trabalho: lesão pela CID-10 cap. XIX (S00–T98) e causa externa pelo cap. XX (V01–Y98).
 * Dados: data/cid-dart.json e data/cid-at.json (gerados da lista-base da VISAT e da tabela CID-10 do DATASUS).
 */
(function () {
  'use strict';

  var FICHA_POR_AGRAVO = { 'C80': 'cancer', 'L98.9': 'dermatose', 'Z57.9': 'lerdort', 'H83.3': 'pair', 'J64': 'pneumo', 'F99': 'mental', 'Y96': 'at', 'Z20.9': 'biologico', 'R49': 'voz' };
  var CAMPO_DIAGNOSTICO = { cancer: 'cid', dermatose: 'cid10', lerdort: 'cidCod', pair: 'cid', pneumo: 'cidDiag', mental: 'cid', at: 'cid' };
  var FAIXAS = {
    cancer: [['C00', 'C97'], ['D00', 'D48']],
    dermatose: [['L00', 'L99']],
    lerdort: [['M00', 'M99'], ['G50', 'G59']],
    pair: [['H833'], ['H90', 'H91'], ['H93', 'H93']],
    pneumo: [['J60', 'J65'], ['J92', 'J92']],
    mental: [['F00', 'F99'], ['Z730']],
    lesao: [['S00', 'T98']],
    causa: [['V01', 'Y98']]
  };
  var NOMES = {
    cancer: 'Câncer relacionado ao trabalho', dermatose: 'Dermatoses ocupacionais', lerdort: 'LER/DORT',
    pair: 'PAIR', pneumo: 'Pneumoconioses', mental: 'Transtornos mentais relacionados ao trabalho',
    lesao: 'lesão do acidente de trabalho, cap. XIX', causa: 'causa externa do acidente, cap. XX'
  };
  var DESCRICAO_FAIXA = {
    cancer: 'C00 a C97 e D00 a D48', dermatose: 'L00 a L99', lerdort: 'M00 a M99 e G50 a G59',
    pair: 'H83.3, H90, H91 e H93', pneumo: 'J60 a J65 e J92', mental: 'F00 a F99 e Z73.0',
    lesao: 'S00 a T98', causa: 'V01 a Y98'
  };

  /* ---------- dados ---------- */
  var dados = { dart: null, at: null };
  var promessas = {};
  function carregar(qual) {
    if (!promessas[qual]) {
      promessas[qual] = fetch('data/cid-' + qual + '.json', { credentials: 'omit' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (j) {
          var mapa = {};
          if (qual === 'dart') {
            j.cid.forEach(function (e) { mapa[e.c.replace('.', '')] = e; });
          } else {
            ['lesao', 'causa'].forEach(function (k) {
              j[k] = j[k].map(function (p) { var e = { c: p[0], d: p[1], f: [k] }; mapa[p[0].replace('.', '')] = e; return e; });
            });
          }
          j.mapa = mapa;
          dados[qual] = j;
          return j;
        })
        .catch(function (e) { delete promessas[qual]; throw e; });
    }
    return promessas[qual];
  }

  /* ---------- regras ---------- */
  function codigoDe(valor) {
    var m = String(valor || '').toUpperCase().replace(/\s+/g, '').match(/^([A-Z])(\d{2})(?:\.?(\d))?(?=$|[^0-9A-Z])/);
    return m ? m[1] + m[2] + (m[3] || '') : null;
  }
  function formatar(c) { return c.length > 3 ? c.slice(0, 3) + '.' + c.slice(3) : c; }
  function naFaixa(c, escopo) {
    return FAIXAS[escopo].some(function (f) {
      if (f.length === 1) return c.indexOf(f[0]) === 0;
      return c.slice(0, 3) >= f[0] && c.slice(0, 3) <= f[1];
    });
  }
  function escopoDoCampo(el) { return el.dataset.visatCid; }
  function outrasFichas(c) {
    return ['cancer', 'dermatose', 'lerdort', 'pair', 'pneumo', 'mental', 'lesao', 'causa'].filter(function (e) { return naFaixa(c, e); });
  }
  function tabelaDo(escopo) { return escopo === 'lesao' || escopo === 'causa' ? dados.at : dados.dart; }

  /* estado: vazio | invalido | fora | inexistente | ldrt | foraLdrt | valido */
  function classificar(el) {
    var escopo = escopoDoCampo(el);
    var bruto = String(el.value || '').trim();
    if (!bruto) return { estado: 'vazio' };
    var c = codigoDe(bruto);
    if (!c) return { estado: 'invalido', mensagem: 'CID-10 em formato inválido. Informe letra e números (ex.: ' + (escopo === 'causa' ? 'W23.9' : escopo === 'lesao' ? 'S61.0' : 'G56.0') + ').' };
    if (!naFaixa(c, escopo)) {
      var outras = outrasFichas(c);
      var texto = 'O CID ' + formatar(c) + ' está fora do escopo ' + (escopo === 'lesao' || escopo === 'causa' ? 'do campo de ' : 'da ficha de ') +
        NOMES[escopo] + ' (' + DESCRICAO_FAIXA[escopo] + ').';
      if (outras.length) texto += ' Corresponde a: ' + outras.map(function (o) { return NOMES[o]; }).join('; ') + '.';
      else texto += ' Não corresponde a uma ficha de Saúde do Trabalhador deste site.';
      return { estado: 'fora', codigo: c, mensagem: texto };
    }
    var tabela = tabelaDo(escopo);
    if (!tabela) return { estado: 'valido', codigo: c };
    var item = tabela.mapa[c];
    if (!item) return { estado: 'inexistente', codigo: c, mensagem: 'O CID ' + formatar(c) + ' não existe na tabela CID-10. Confira o código.' };
    if (escopo === 'lesao' || escopo === 'causa') return { estado: 'valido', codigo: c, item: item };
    return { estado: item.l ? 'ldrt' : 'foraLdrt', codigo: c, item: item };
  }

  function avisosDoCodigo(escopo, r) {
    var a = [];
    var c = r.codigo;
    if (r.estado === 'foraLdrt') a.push('CID do escopo da ficha, mas não consta da LDRT (Portaria GM/MS nº 5.674/2024). Aceito com aviso: descreva na ficha a relação com o trabalho.');
    if (r.item && r.item.ast) a.push('Código asterisco (manifestação): pode não ser aceito como diagnóstico principal no sistema. Confira o código da doença de base.');
    if (escopo === 'lesao' && c >= 'T36' && c < 'T66') a.push('Efeito tóxico/intoxicação: a Intoxicação Exógena é notificada à Vigilância Epidemiológica. Confirme se o caso é acidente de trabalho.');
    if (escopo === 'causa' && c >= 'X60' && c < 'X85') a.push('Lesão autoprovocada: notificar também à Vigilância Epidemiológica (violência).');
    return a;
  }

  /* ---------- interface ---------- */
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  function mostrar(el, r) {
    var caixa = el.parentNode.querySelector('[data-visat-cid-info]');
    if (!caixa) {
      caixa = document.createElement('div');
      caixa.dataset.visatCidInfo = '1';
      caixa.setAttribute('aria-live', 'polite');
      caixa.className = 'visat-cid-info';
      var depois = el.parentNode.querySelector('[data-visat-cid-lista]') || el;
      depois.insertAdjacentElement('afterend', caixa);
    }
    caixa.replaceChildren();
    caixa.dataset.estado = r.estado;
    if (r.estado === 'vazio') return;
    function linha(t, classe) { var p = document.createElement('p'); if (classe) p.className = classe; p.textContent = t; caixa.append(p); return p; }
    if (r.mensagem) { linha(r.mensagem, 'visat-cid-erro'); return; }
    var escopo = escopoDoCampo(el);
    var avisos = avisosDoCodigo(escopo, r);
    var correto = (r.estado === 'ldrt' || r.estado === 'valido') && !avisos.length;
    if (r.item) linha((correto ? '✓ ' : '') + formatar(r.codigo) + ' — ' + r.item.d, 'visat-cid-titulo' + (correto ? ' visat-cid-ok' : ''));
    if (r.estado === 'ldrt') {
      linha('Consta da LDRT — Portaria GM/MS nº 5.674/2024, Anexo LXXX, Lista B' + (r.item.cap ? ', cap. ' + r.item.cap : '') + (r.item.p ? ', p. ' + r.item.p : '') + '.', 'visat-cid-ok');
      var ags = (r.item.a || []).map(function (i) { return dados.dart.agentes[i]; });
      if (ags.length) {
        var det = document.createElement('details');
        var s = document.createElement('summary');
        s.textContent = 'Agentes e fatores de risco listados na LDRT (' + ags.length + ')';
        var ul = document.createElement('ul');
        ags.forEach(function (t) { var li = document.createElement('li'); li.textContent = t; ul.append(li); });
        det.append(s, ul);
        caixa.append(det);
      }
    }
    avisos.forEach(function (t) { linha(t, 'visat-cid-aviso'); });
  }

  function anexar(el, escopo) {
    if (!el || el.dataset.visatCid) return;
    el.dataset.visatCid = escopo;
    el.removeAttribute('maxlength');
    el.removeAttribute('list');
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('aria-describedby', (el.getAttribute('aria-describedby') || '') + ' ' + el.id + '-cid-ajuda');
    var ajuda = document.createElement('p');
    ajuda.className = 'field-help';
    ajuda.id = el.id + '-cid-ajuda';
    ajuda.textContent = 'Digite o código ou o nome do diagnóstico e escolha na lista. Aceita ' + DESCRICAO_FAIXA[escopo] + '. ' +
      'A tabela CID-10 (DATASUS) está incorporada a este formulário: a busca não depende do site do DATASUS.';
    el.insertAdjacentElement('afterend', ajuda);
    var lista = document.createElement('ul');
    lista.className = 'visat-cid-lista';
    lista.dataset.visatCidLista = '1';
    lista.hidden = true;
    lista.setAttribute('aria-label', 'Sugestões de CID-10');
    ajuda.insertAdjacentElement('afterend', lista);
    var qual = escopo === 'lesao' || escopo === 'causa' ? 'at' : 'dart';

    function itensDoEscopo(t) {
      if (qual === 'at') return t[escopo];
      return t.cid.filter(function (e) { return e.f.indexOf(escopo) >= 0; });
    }
    function sugerir() {
      var termo = norm(el.value.trim());
      if (termo.length < 2 || codigoDe(el.value) && / – /.test(el.value)) { lista.hidden = true; lista.replaceChildren(); return; }
      carregar(qual).then(function (t) {
        if (norm(el.value.trim()) !== termo) return;
        var cod = termo.toUpperCase().replace('.', '');
        var palavras = termo.split(/\s+/).filter(Boolean);
        var achados = itensDoEscopo(t).filter(function (e) {
          if (e.c.replace('.', '').indexOf(cod) === 0) return true;
          var alvo = norm(e.c + ' ' + e.d);
          return palavras.every(function (p) { return alvo.indexOf(p) >= 0; });
        });
        achados.sort(function (a, b) {
          var pa = (a.c.replace('.', '').indexOf(cod) === 0 ? 0 : 2) - (a.l ? 1 : 0);
          var pb = (b.c.replace('.', '').indexOf(cod) === 0 ? 0 : 2) - (b.l ? 1 : 0);
          return pa - pb || (a.c < b.c ? -1 : 1);
        });
        lista.replaceChildren();
        achados.slice(0, 12).forEach(function (e) {
          var li = document.createElement('li');
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'btn';
          b.dataset.variant = 'outline';
          b.textContent = e.c + ' · ' + e.d + (e.l ? ' · LDRT' : '');
          b.addEventListener('click', function () {
            el.value = e.c + ' – ' + e.d;
            lista.hidden = true;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.focus();
          });
          li.append(b);
          lista.append(li);
        });
        if (!achados.length) {
          var li = document.createElement('li');
          li.textContent = 'Nenhum CID do escopo (' + DESCRICAO_FAIXA[escopo] + ') para esta busca.';
          lista.append(li);
        }
        lista.hidden = false;
      }).catch(function () {
        lista.replaceChildren();
        var li = document.createElement('li');
        li.textContent = 'A tabela de CID não carregou agora. Digite o código (ex.: ' + (escopo === 'causa' ? 'W23.9' : escopo === 'lesao' ? 'S61.0' : 'G56.0') +
          '): a regra de escopo da ficha continua valendo e a descrição é conferida quando a tabela voltar.';
        lista.append(li);
        lista.hidden = false;
      });
    }
    function conferir() {
      var r = classificar(el);
      mostrar(el, r);
      if (!tabelaDo(escopo) && r.estado !== 'vazio') carregar(qual).then(function () { if (el.isConnected) mostrar(el, classificar(el)); }).catch(function () {});
    }
    el.addEventListener('focus', function () { carregar(qual).catch(function () {}); });
    el.addEventListener('input', function () { sugerir(); conferir(); });
    el.addEventListener('change', function () {
      var digitado = el.value.trim();
      var codigo = codigoDe(digitado);
      if (codigo && !digitado.includes(' – ')) {
        carregar(qual).then(function (tabela) {
          if (!el.isConnected || el.value.trim() !== digitado) return;
          var item = itensDoEscopo(tabela).find(function (registro) {
            return codigoDe(registro.c) === codigo;
          });
          if (!item) return;
          el.value = item.c + ' – ' + item.d;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }).catch(function () {});
      }
      conferir();
    });
    el.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') lista.hidden = true; });
    lista.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { lista.hidden = true; el.focus(); } });
    if (el.value) conferir();
  }

  function fichaDe(raiz) {
    var agravo = raiz.querySelector('#sinan-cidAgravo');
    return agravo ? FICHA_POR_AGRAVO[String(agravo.value).trim().toUpperCase()] : null;
  }

  function configurar(raiz) {
    var ficha = fichaDe(raiz);
    if (!ficha) return;
    var campo = raiz.querySelector('[data-key="' + CAMPO_DIAGNOSTICO[ficha] + '"]');
    if (!CAMPO_DIAGNOSTICO[ficha]) return; // 1.b e 1.e não têm campo de diagnóstico específico
    if (ficha === 'at') {
      anexar(campo, 'lesao');
      anexar(raiz.querySelector('[data-key="cidCausa"]'), 'causa');
      carregar('at').catch(function () {});
    } else {
      anexar(campo, ficha);
      carregar('dart').catch(function () {});
    }
  }

  function camposCid(raiz) { return Array.prototype.slice.call(raiz.querySelectorAll('[data-visat-cid]')); }

  /* Pendências que impedem o PDF final (usadas por formulario-acidente.js). */
  window.visatPendenciasCid = function (raiz) {
    var p = [];
    var ficha = fichaDe(raiz);
    var agravo = raiz.querySelector('#sinan-cidAgravo');
    if (agravo && !ficha) p.push({ campo: agravo, rotulo: 'Código do agravo incompatível com a ficha' });
    camposCid(raiz).forEach(function (el) {
      var r = classificar(el);
      if (r.estado === 'invalido' || r.estado === 'fora' || r.estado === 'inexistente') {
        p.push({ campo: el, rotulo: (el.labels && el.labels[0] ? el.labels[0].textContent.trim() : 'CID-10') + ': ' + r.mensagem });
      }
    });
    return p;
  };

  /* Avisos que não impedem o PDF final. */
  window.visatAvisosCid = function (raiz) {
    var a = [];
    camposCid(raiz).forEach(function (el) {
      var r = classificar(el);
      if (r.codigo) avisosDoCodigo(escopoDoCampo(el), r).forEach(function (t) { a.push({ campo: el, mensagem: formatar(r.codigo) + ': ' + t }); });
      if (!tabelaDo(escopoDoCampo(el)) && r.estado === 'valido') a.push({ campo: el, mensagem: 'A tabela CID-10 não carregou: confira o código ' + formatar(r.codigo) + '.' });
    });
    return a;
  };

  var agendado = null;
  function examinar() {
    clearTimeout(agendado);
    agendado = setTimeout(function () {
      document.querySelectorAll('.acidente-inline').forEach(configurar);
    }, 100);
  }
  function iniciar() {
    if (!document.querySelector('template[id^="form-"]')) return;
    new MutationObserver(examinar).observe(document.body, { childList: true, subtree: true });
    examinar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
