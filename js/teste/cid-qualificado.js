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
  var CAMPO_DIAGNOSTICO = { cancer: 'cid', dermatose: 'cid10', lerdort: 'cidCod', pair: 'cid', pneumo: 'cidDiag', mental: 'cid', voz: 'cid', at: 'cid' };
  var FAIXAS = {
    cancer: [['C00', 'C97'], ['D00', 'D48']],
    dermatose: [['L00', 'L99']],
    lerdort: [['M00', 'M99'], ['G50', 'G59'], ['G90', 'G99']],
    pair: [['H833'], ['H90', 'H91'], ['H93', 'H93']],
    pneumo: [['J60', 'J65'], ['J92', 'J92']],
    mental: [['F00', 'F99'], ['Z730'], ['Y90', 'Y91'], ['R40', 'R46'], ['Z55', 'Z65'], ['Y96', 'Y96'], ['X60', 'X84']],
    voz: [['J371'], ['J38', 'J38'], ['R49', 'R49']],
    lesao: [['S00', 'T98']],
    causa: [['V01', 'Y95'], ['Y97', 'Y98']]
  };
  var NOMES = {
    cancer: 'Câncer relacionado ao trabalho', dermatose: 'Dermatoses ocupacionais', lerdort: 'LER/DORT',
    pair: 'PAIR', pneumo: 'Pneumoconioses', mental: 'Transtornos mentais relacionados ao trabalho',
    voz: 'Distúrbio de voz relacionado ao trabalho',
    lesao: 'lesão do acidente de trabalho, cap. XIX', causa: 'causa externa do acidente, cap. XX'
  };
  var DESCRICAO_FAIXA = {
    cancer: 'C00 a C97 e D00 a D48', dermatose: 'L00 a L99', lerdort: 'M00 a M99, G50 a G59 e G90 a G99',
    pair: 'H83.3, H90, H91 e H93', pneumo: 'J60 a J65 e J92', mental: 'F00 a F99, Z73.0, Y90 a Y91, R40 a R46, Z55 a Z65, Y96 e X60 a X84',
    voz: 'J37.1, J38 e R49',
    lesao: 'S00 a T98', causa: 'V01 a Y98, exceto Y96'
  };

  /* ---------- dados ---------- */
  var dados = { dart: null, at: null };
  var promessas = {};
  // Portaria GM/MS nº 5.674/2024, Anexo LXXX.
  var cidVozLdrt = [
    { c: 'J37.1', d: 'Laringotraqueíte crônica' },
    { c: 'J38', d: 'Doenças das cordas vocais e da laringe não classificadas em outra parte' },
    { c: 'J38.2', d: 'Nódulos das cordas vocais' },
    { c: 'R49', d: 'Distúrbios da voz', busca: 'disfonia rouquidão' }
  ];
  function carregar(qual) {
    if (!promessas[qual]) {
      promessas[qual] = fetch('data/cid-' + qual + '.json?v=20261117-faixas-sinan', { credentials: 'omit' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (j) {
          var mapa = {};
          if (qual === 'dart') {
            cidVozLdrt.forEach(function (e) {
              j.cid.push(Object.assign({ f: ['voz'], l: 1 }, e));
            });
            j.cid.forEach(function (e) { mapa[e.c.replace('.', '')] = e; });
          } else {
            ['lesao', 'causa'].forEach(function (k) {
              j[k] = j[k].filter(function (p) { return naFaixa(p[0], k); }).map(function (p) {
                var e = { c: p[0], d: p[1], f: [k] }; mapa[p[0].replace('.', '')] = e; return e;
              });
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
    return ['cancer', 'dermatose', 'lerdort', 'pair', 'pneumo', 'mental', 'voz', 'lesao', 'causa'].filter(function (e) { return naFaixa(c, e); });
  }
  function tabelaDo(escopo) { return escopo === 'lesao' || escopo === 'causa' ? dados.at : dados.dart; }

  /* estado: vazio | invalido | fora | inexistente | ldrt | foraLdrt | valido */
  function classificar(el) {
    var escopo = escopoDoCampo(el);
    var bruto = String(el.value || '').trim();
    if (!bruto) return { estado: 'vazio' };
    // Causa "Outro" em Como ocorreu: a VISAT atribui o código na revisão (campo 54 = A revisar).
    if (escopo === 'causa' && /^a revisar$/i.test(bruto)) return { estado: 'revisar' };
    var c = codigoDe(bruto);
    if (!c) return { estado: 'invalido', mensagem: 'CID-10 em formato inválido. Informe letra e números (ex.: ' + (escopo === 'causa' ? 'W23.9' : escopo === 'lesao' ? 'S61.0' : 'G56.0') + ').' };
    if (!naFaixa(c, escopo)) {
      // Y96 identifica o agravo (campo 2 da ficha); não é causa nem lesão.
      if (c.slice(0, 3) === 'Y96' && (escopo === 'lesao' || escopo === 'causa')) {
        return { estado: 'fora', codigo: c, mensagem: 'Y96 já identifica o agravo no campo 2. ' +
          (escopo === 'lesao' ? 'Informe o diagnóstico da lesão (S00 a T98).' : 'Informe a causa externa do acidente (campo 54).') };
      }
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
    if (r.estado === 'foraLdrt') a.push('Fora da LDRT: descreva a relação com o trabalho.');
    if (r.item && r.item.ast) a.push('Código asterisco: prefira o código da doença de base.');
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
    if (r.estado === 'vazio' || r.estado === 'revisar') return;
    function linha(t, classe) { var p = document.createElement('p'); if (classe) p.className = classe; p.textContent = t; caixa.append(p); return p; }
    if (r.mensagem) { linha(r.mensagem, 'visat-cid-erro'); return; }
    var escopo = escopoDoCampo(el);
    var avisos = avisosDoCodigo(escopo, r);
    var correto = (r.estado === 'ldrt' || r.estado === 'valido') && !avisos.length;
    // Mensagem curta: o código e o nome já aparecem no campo; a referência completa fica no title.
    if (r.item && !/ – /.test(el.value)) linha(formatar(r.codigo) + ' — ' + (window.visatTitulo?.(r.item.d) ?? r.item.d), 'visat-cid-titulo');
    if (r.estado === 'ldrt') {
      // Sem linha verde: a informação da LDRT fica no próprio resumo dos agentes.
      var fonte = 'Portaria GM/MS nº 5.674/2024, Anexo LXXX, Lista B' + (r.item.cap ? ', cap. ' + r.item.cap : '') + (r.item.p ? ', p. ' + r.item.p : '') + '.';
      var ags = (r.item.a || []).map(function (i) { return dados.dart.agentes[i]; });
      if (ags.length) {
        var det = document.createElement('details');
        det.className = 'visat-cid-agentes';
        var s = document.createElement('summary');
        s.textContent = 'Consta na Lista de Doenças Relacionadas ao Trabalho (LDRT) · ' + (ags.length === 1 ? 'ver agente relacionado' : 'ver ' + ags.length + ' agentes relacionados');
        s.title = fonte;
        var ul = document.createElement('ul');
        ags.forEach(function (t) { var li = document.createElement('li'); li.textContent = t; ul.append(li); });
        det.append(s, ul);
        caixa.append(det);
      } else {
        linha('Consta na Lista de Doenças Relacionadas ao Trabalho (LDRT)', 'visat-cid-ldrt').title = fonte;
      }
    }
    avisos.forEach(function (t) { linha(t, 'visat-cid-aviso'); });
  }

  function anexar(el, escopo) {
    if (!el || el.dataset.visatCid) return;
    el.dataset.visatCid = escopo;
    el.removeAttribute('maxlength');
    el.removeAttribute('list');
    el.setAttribute('autocomplete', 'visat-sem-preenchimento');
    el.setAttribute('aria-describedby', (el.getAttribute('aria-describedby') || '') + ' ' + el.id + '-cid-ajuda');
    var ajuda = document.createElement('p');
    ajuda.className = 'field-help';
    ajuda.id = el.id + '-cid-ajuda';
    ajuda.textContent = '';
    ajuda.hidden = true;
    el.placeholder = 'Código ou nome (' + DESCRICAO_FAIXA[escopo] + ')';
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
    var solicitacao = 0;
    function fecharLista() {
      solicitacao++;
      lista.hidden = true;
      el.setAttribute('aria-expanded', 'false');
      el.removeAttribute('aria-activedescendant');
    }
    // Réplica para testes: dois espaços no CID da lesão abrem os grupos da CID-10 (região do corpo e tipo de lesão).
    var GRUPOS_LESAO = [['S00', 'S09', 'Cabeça'], ['S10', 'S19', 'Pescoço'], ['S20', 'S29', 'Tórax'],
      ['S30', 'S39', 'Abdome, dorso, coluna lombar e pelve'], ['S40', 'S49', 'Ombro e braço'], ['S50', 'S59', 'Cotovelo e antebraço'],
      ['S60', 'S69', 'Punho e mão'], ['S70', 'S79', 'Quadril e coxa'], ['S80', 'S89', 'Joelho e perna'], ['S90', 'S99', 'Tornozelo e pé'],
      ['T00', 'T07', 'Várias regiões do corpo'], ['T08', 'T14', 'Parte do corpo não especificada'], ['T15', 'T19', 'Corpo estranho por orifício natural'],
      ['T20', 'T32', 'Queimaduras e corrosões'], ['T33', 'T35', 'Geladuras'], ['T36', 'T50', 'Intoxicação por medicamentos e substâncias biológicas'],
      ['T51', 'T65', 'Efeitos tóxicos de outras substâncias'], ['T66', 'T78', 'Outros efeitos de causas externas'],
      ['T79', 'T79', 'Complicações precoces de traumatismo'], ['T80', 'T88', 'Complicações de cuidados médicos e cirúrgicos'], ['T90', 'T98', 'Sequelas']];
    function botaoLista(texto, aoEscolher) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.dataset.variant = 'outline';
      b.textContent = texto;
      b.addEventListener('click', aoEscolher);
      li.append(b);
      lista.append(li);
    }
    function mostrarGrupos() {
      solicitacao++;
      lista.replaceChildren();
      lista.dataset.visatSemJanela = '1';
      GRUPOS_LESAO.forEach(function (g) {
        botaoLista(g[0] + (g[1] !== g[0] ? '–' + g[1] : '') + ' · ' + g[2], function () {
          carregar(qual).then(function (t) {
            lista.replaceChildren();
            itensDoEscopo(t).filter(function (e) { return e.c.length === 3 && e.c >= g[0] && e.c <= g[1]; }).forEach(function (e) {
              botaoLista(e.c + ' · ' + (window.visatTitulo?.(e.d) ?? e.d), function () {
                el.value = e.c;
                el.focus();
                sugerir();
              });
            });
            lista.hidden = false;
          }).catch(function () {});
        });
      });
      lista.hidden = false;
      el.setAttribute('aria-expanded', 'true');
    }
    function sugerir() {
      if (el.closest('.visat-modelo-final') && escopo === 'lesao' && /^\s{2,}$/.test(el.value)) { mostrarGrupos(); return; }
      delete lista.dataset.visatSemJanela;
      var atual = ++solicitacao;
      var termo = norm(el.value.trim());
      // Campo vazio: nas doenças, mostra os CIDs da LDRT da ficha; nos campos do acidente, espera a primeira letra.
      if (!termo && qual === 'at' || codigoDe(el.value) && / – /.test(el.value)) { fecharLista(); return; }
      carregar(qual).then(function (t) {
        if (atual !== solicitacao || !el.isConnected || norm(el.value.trim()) !== termo) return;
        var cod = termo.toUpperCase().replace('.', '');
        var palavras = termo.split(/\s+/).filter(Boolean);
        var achados = itensDoEscopo(t).filter(function (e) {
          if (!termo) return !!e.l;
          if (e.c.replace('.', '').indexOf(cod) === 0) return true;
          var alvo = norm(e.c + ' ' + e.d + ' ' + (e.busca || ''));
          return palavras.every(function (p) { return alvo.indexOf(p) >= 0; });
        });
        function relevancia(item) {
          var codigo = item.c.replace('.', '');
          var descricao = norm(item.d);
          if (termo && codigo === cod) return 0;
          if (codigo.startsWith(cod) || descricao.startsWith(termo)) return 1;
          if (descricao.includes(termo)) return 2;
          return 3;
        }
        achados.sort(function (a, b) {
          return relevancia(a) - relevancia(b) || Number(Boolean(b.l)) - Number(Boolean(a.l)) ||
            a.c.localeCompare(b.c);
        });
        lista.replaceChildren();
        achados.slice(0, 12).forEach(function (e) {
          var li = document.createElement('li');
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'btn';
          b.dataset.variant = 'outline';
          b.textContent = e.c + ' · ' + (window.visatTitulo?.(e.d) ?? e.d) + (e.l ? ' · LDRT' : '');
          b.addEventListener('click', function () {
            el.value = e.c + ' – ' + e.d;
            fecharLista();
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
        el.setAttribute('aria-expanded', 'true');
      }).catch(function () {
        if (atual !== solicitacao || !el.isConnected) return;
        lista.replaceChildren();
        var li = document.createElement('li');
        li.textContent = 'A tabela de CID não carregou agora. Digite o código (ex.: ' + (escopo === 'causa' ? 'W23.9' : escopo === 'lesao' ? 'S61.0' : 'G56.0') +
          '): a regra de escopo da ficha continua valendo e a descrição é conferida quando a tabela voltar.';
        lista.append(li);
        lista.hidden = false;
        el.setAttribute('aria-expanded', 'true');
      });
    }
    function conferir() {
      var r = classificar(el);
      mostrar(el, r);
      if (!tabelaDo(escopo) && r.estado !== 'vazio') carregar(qual).then(function () { if (el.isConnected) mostrar(el, classificar(el)); }).catch(function () {});
    }
    el.addEventListener('click', sugerir);
    el.addEventListener('input', function (evento) {
      if (evento.isTrusted) sugerir();
      else fecharLista();
      conferir();
    });
    function fecharAoSair(evento) {
      if (evento.relatedTarget !== el && !lista.contains(evento.relatedTarget)) fecharLista();
    }
    el.addEventListener('focusout', fecharAoSair);
    lista.addEventListener('focusout', fecharAoSair);
    el.addEventListener('change', function () {
      var digitado = el.value.trim();
      var codigo = codigoDe(digitado);
      // Formato da ficha oficial (decisão VISAT 17/11/2026): letra, dois números, ponto e 4º caractere (ex.: Z57.9).
      if (codigo && !digitado.includes(' – ') && /^[A-Za-z]\d{2}\.?\d?$/.test(digitado.replace(/\s+/g, ''))) {
        el.value = formatar(codigo);
        digitado = el.value;
      }
      if (codigo && !digitado.includes(' – ')) {
        carregar(qual).then(function (tabela) {
          if (!el.isConnected || el.value.trim() !== digitado) return;
          var item = itensDoEscopo(tabela).find(function (registro) {
            return codigoDe(registro.c) === codigo;
          });
          if (!item) return;
          el.value = item.c + ' – ' + (window.visatTitulo?.(item.d) ?? item.d);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }).catch(function () {});
      }
      conferir();
    });
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') fecharLista();
      if (ev.key === 'ArrowDown' && lista.hidden && !ev.defaultPrevented) {
        ev.preventDefault();
        sugerir();
      }
    });
    lista.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { fecharLista(); el.focus(); }
    });
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
    if (!CAMPO_DIAGNOSTICO[ficha]) return; // A ficha de material biológico usa somente o CID do agravo.
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

