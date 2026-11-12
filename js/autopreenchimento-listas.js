/*
 * autopreenchimento-listas.js — Listas de sugestões e códigos automáticos (complemento do autopreenchimento.js)
 * VISAT / SMS Florianópolis
 *
 * Mesmas fontes e formatos do Sinan usados na "Consulta rápida de códigos" do portal VISAT:
 *   - Unidade de saúde: lista CNES da rede de Florianópolis (data/cnes-florianopolis.json); código CNES com 7 dígitos.
 *   - Município: API de localidades do IBGE; código com 6 dígitos (sem o dígito verificador).
 *   - Ocupação: CBO 2002 (MTE) + códigos adaptados pelo DATASUS (data/cbo-datasus-adicional.json); 6 caracteres.
 *   - CID-10: tratado em js/cid-qualificado.js (escopo por ficha, LDRT e cap. XIX/XX no acidente de trabalho).
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
          return { c: p[0], d: p[1], v: nome, uf: 'SC', municipio: 'Florianópolis', ibge: '420540' };
        });
      });
    },
    // Tabela local (IBGE, 5.571 municípios; código do Sinan com 6 dígitos) — data/municipios.json.
    mun: function () {
      return fetch('data/municipios.json')
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (j) {
          return j.map(function (x) { return { c: x[0], d: x[1] + ' – ' + x[2], v: x[1], uf: x[2] }; });
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
    // Tabela efetivamente usada no registro: CNAE do Sinan, classe de 5 dígitos
    // (classes da CNAE 1.0 e classes da CNAE 2.0 de denominação distinta) — data/cnae-sinan.json.
    cnae: function () {
      return fetch('data/cnae-sinan.json')
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (j) {
          return j.classes.map(function (x) {
            return { c: x[0], d: x[2] + ' (CNAE ' + x[1] + ')', v: x[0] + ' – ' + x[2], origem: x[1] };
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
  function anexarLista(input, tipo, aoEscolher, codigoDerivado) {
    if (!input || input.tagName !== 'INPUT' || input.dataset.visatLista) return;
    input.dataset.visatLista = tipo;
    var dl = document.createElement('datalist');
    dl.id = 'visat-lista-' + tipo + '-' + Math.random().toString(36).slice(2, 8);
    input.insertAdjacentElement('afterend', dl);
    input.setAttribute('list', dl.id);
    input.setAttribute('autocomplete', 'off');
    input.title = 'Pressione espaço duas vezes para abrir a lista de apoio.';
    var listaRapida;
    var abertura = 0;

    function fecharListaRapida() {
      abertura++;
      if (listaRapida) listaRapida.remove();
      listaRapida = null;
    }

    function abrirListaRapida() {
      fecharListaRapida();
      var atual = abertura;
      var termo = norm(input.value);
      carregar(tipo).then(function (lista) {
        if (atual !== abertura || !input.isConnected || norm(input.value) !== termo) return;
        var palavras = termo.split(' ').filter(Boolean);
        var itens = lista.filter(function (item) {
          var alvo = norm(item.c + ' ' + item.d);
          return palavras.every(function (p) { return alvo.includes(p); });
        }).slice(0, 12);
        listaRapida = document.createElement('div');
        listaRapida.className = 'visat-lista-apoio';
        var aviso = document.createElement('p');
        aviso.setAttribute('role', 'status');
        aviso.textContent = itens.length ? 'Lista de apoio. Digite no campo para filtrar.' :
          'Nenhuma opção disponível para esta busca.';
        listaRapida.append(aviso);
        var opcoes = document.createElement('ul');
        itens.forEach(function (item) {
          var li = document.createElement('li');
          var botao = document.createElement('button');
          botao.type = 'button';
          botao.className = 'btn';
          botao.dataset.variant = 'outline';
          botao.textContent = item.d + ' · ' + item.c;
          botao.addEventListener('click', function () {
            fecharListaRapida();
            if (aoEscolher) aoEscolher(item);
            else definir(input, item.v, true);
            input.focus();
          });
          li.append(botao);
          opcoes.append(li);
        });
        listaRapida.append(opcoes);
        listaRapida.addEventListener('keydown', function (evento) {
          if (evento.key !== 'Escape') return;
          evento.preventDefault();
          fecharListaRapida();
          input.focus();
        });
        dl.after(listaRapida);
      });
    }

    input.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && listaRapida) {
        evento.preventDefault();
        fecharListaRapida();
      }
      if (evento.key !== ' ' || evento.repeat || evento.ctrlKey || evento.altKey || evento.metaKey ||
          input.selectionStart !== input.value.length || input.selectionEnd !== input.value.length ||
          !input.value.endsWith(' ')) return;
      evento.preventDefault();
      input.value = input.value.trimEnd();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      abrirListaRapida();
    });
    input.addEventListener('input', fecharListaRapida);


    function atualizar() {
      var termo = norm(input.value);
      if (termo.length < 2) { dl.textContent = ''; return; }
      carregar(tipo).then(function (lista) {
        if (norm(input.value) !== termo) return;
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
          o.value = tipo === 'mun' ? x.d : tipo === 'cnes' ? x.v + ' – ' + x.c : x.v;
          o.label = x.d + ' (' + x.c + ')';
          dl.appendChild(o);
        });
      });
    }

    // P14: escolha por clique, teclado ou toque na opção nativa, ou texto/código digitado e saída do campo.
    function confirmar(semPreencher) {
      if (!aoEscolher) return;
      var valor = norm(input.value);
      if (!valor) { estadoCodigo(input, ''); return; }
      if (input.dataset.visatConfirmado === valor) return;
      carregar(tipo).then(function (lista) {
        if (!input.isConnected || norm(input.value) !== valor) return;
        if (!lista.length) { estadoCodigo(input, 'indisponivel', tipo); return; }
        var uf = tipo === 'mun' ? ufVinculada(input) : '';
        var exatos = lista.filter(function (x) {
          return norm(x.d) === valor || x.c === valor || norm(x.v + ' – ' + x.c) === valor ||
            (tipo === 'mun' && /^\d{7}$/.test(valor) && x.c === valor.slice(0, 6));
        });
        if (!exatos.length) exatos = lista.filter(function (x) { return norm(x.v) === valor; });
        if (exatos.length > 1 && uf) exatos = exatos.filter(function (x) { return norm(x.uf) === norm(uf); });
        if (exatos.length === 1) {
          if (semPreencher !== true || (codigoDerivado && !codigoDerivado.value)) aoEscolher(exatos[0]);
          input.dataset.visatConfirmado = norm(input.value);
          estadoCodigo(input, 'validado', tipo, exatos[0].c);
        } else {
          if (semPreencher !== true) estadoCodigo(input, exatos.length > 1 ? 'varios' : 'manual', tipo, exatos.length);
        }
      });
    }

    input.addEventListener('focus', function () { carregar(tipo); });
    input.addEventListener('input', function (evento) {
      delete input.dataset.visatConfirmado;
      atualizar();
      // Preenchimento feito pelo próprio formulário (escolha no campo vinculado): só registra a validação.
      if (!evento.isTrusted) { if (aoEscolher) confirmar(true); return; }
      // Opção nativa escolhida na lista (clique, teclado ou toque): confirma na hora.
      if (!evento.inputType || evento.inputType === 'insertReplacementText') confirmar();
      else if (aoEscolher) estadoCodigo(input, 'digitando', tipo);
    });
    input.addEventListener('change', function (evento) { if (evento.isTrusted) confirmar(); });
    input.addEventListener('blur', function () { confirmar(); });
  }

  function ufVinculada(input) {
    var raiz = input.closest('.acidente-inline') || document;
    var pares = { munNotif: 'ufNotif', municipioNotif: 'ufNotif', municipioNotificacao: 'ufNotificacao', municipio: 'uf',
      munRes: 'ufRes', munEmp: 'ufEmp', munPrincipal: 'ufPrincipal', ibgeNotif: 'ufNotif', ibgeRes: 'ufRes', ibgeEmp: 'ufEmp', ibgePrincipal: 'ufPrincipal' };
    var chave = pares[input.dataset.key];
    var uf = chave && (raiz.querySelector('[data-key="' + chave + '"]') ||
      (chave === 'ufNotif' && (raiz.querySelector('[data-key="ufNotificacao"]') || raiz.querySelector('[data-key="uf"]'))));
    return uf ? uf.value : '';
  }

  var FONTE_OFICIAL = { mun: 'tabela de municípios do IBGE', cnes: 'CNES/DATASUS' };
  function estadoCodigo(input, estado, tipo, extra) {
    var el = input.parentNode.querySelector('[data-visat-estado-codigo="' + input.id + '"]');
    if (!el) {
      el = document.createElement('small');
      el.dataset.visatEstadoCodigo = input.id;
      el.setAttribute('role', 'status');
      el.className = 'visat-estado-codigo';
      (input.parentNode.querySelector('datalist') || input).insertAdjacentElement('afterend', el);
    }
    el.dataset.estado = estado;
    el.textContent = {
      '': '',
      digitando: 'Escolha uma sugestão da lista para preencher o código automaticamente.',
      validado: tipo === 'mun' ? 'Município identificado.' : 'Unidade identificada.',
      varios: 'Há ' + extra + ' opções com este nome. Escolha uma sugestão da lista para preencher o código.',
      manual: 'Preenchimento manual: o código não foi validado. Escolha uma sugestão da lista da ' + FONTE_OFICIAL[tipo] + '.',
      indisponivel: 'Tabela de referência indisponível. Confira o município ou a unidade e tente novamente.'
    }[estado];
  }

  function atualizarDicaCnpj(raiz) {
    raiz.querySelectorAll('.field-help, .hint, .ajuda').forEach(function (el) {
      if (/Preencha o documento e os dados da empresa manualmente/i.test(el.textContent)) {
        el.textContent = 'Informe o CNPJ para preencher o CNAE e os dados da empresa.';
      }
    });
  }

  window.visatConferirTabelas = async function (raiz) {
    var avisos = [];
    var localizacoes = [
      [['munNotif', 'municipioNotif', 'municipioNotificacao', 'municipio'], ['ibgeNotif'], ['ufNotif', 'ufNotificacao', 'uf']],
      [['munRes'], ['ibgeRes'], ['ufRes']],
      [['munEmp'], ['ibgeEmp'], ['ufEmp']],
      [['munPrincipal'], ['ibgePrincipal'], ['ufPrincipal']]
    ].map(function (grupo) {
      return grupo.map(function (chaves) { return campo(raiz, chaves); });
    }).filter(function (grupo) { return grupo[1] && grupo[1].value.trim(); });
    var ocupacao = campo(raiz, ['ocupacao']);
    var cbo = ocupacao && ocupacao.value.match(/^\s*(\d{4})-?(\d{2})\b/);
    var cnes = campo(raiz, ['codUnidNotif']);
    var camposCnae = ['cnae', 'cnaePrincipal', 'cnaePrinc'].map(function (chave) {
      return campo(raiz, [chave]);
    }).filter(function (el) { return el?.value.trim(); });
    var [municipios, ocupacoes, unidades, atividades] = await Promise.all([
      localizacoes.length ? carregar('mun') : [],
      cbo ? carregar('cbo') : [],
      cnes?.value ? carregar('cnes') : [],
      camposCnae.length ? carregar('cnae') : []
    ]);
    localizacoes.forEach(function ([municipio, ibge, uf]) {
      if (!municipios.length) return;
      var codigo = ibge.value.trim();
      var item = /^\d{6,7}$/.test(codigo) && municipios.find(function (x) { return x.c === codigo.slice(0, 6); });
      if (!item || (municipio && municipio.value && norm(municipio.value) !== norm(item.v)) ||
          (uf && uf.value && norm(uf.value) !== norm(item.uf))) {
        avisos.push({ campo: municipio || ibge, mensagem: 'Confira a correspondência entre código IBGE, município e UF nesta etapa.' });
      }
    });
    if (cbo && ocupacoes.length && !ocupacoes.some(function (x) { return x.c === cbo[1] + cbo[2]; })) {
      avisos.push({ campo: ocupacao, mensagem: 'O código CBO informado não foi encontrado na tabela consultada.' });
    }
    if (ocupacao?.value && !cbo) {
      avisos.push({ campo: ocupacao, mensagem: 'A ocupação está em texto livre. Se possível, selecione o código CBO correspondente.' });
    }
    camposCnae.forEach(function (el) {
      var partes = el.value.match(/^\s*(\d{2})\.?(\d{2})-?(\d)(?:\/?\d{2})?\b/);
      var codigo = partes && partes.slice(1).join('');
      if (!codigo || (atividades.length && !atividades.some(function (x) { return x.c === codigo; }))) {
        avisos.push({ campo: el, mensagem: 'O CNAE informado não consta da tabela CNAE do Sinan (classe com 5 dígitos). Confira o código e a versão.' });
      }
    });
    if (cnes?.value) {
      var unidade = unidades.find(function (x) { return x.c === cnes.value.trim(); });
      if (!/^\d{7}$/.test(cnes.value.trim())) {
        avisos.push({ campo: cnes, mensagem: 'Confira o código CNES. Informe sete dígitos.' });
      } else if (unidade) {
        var nome = campo(raiz, ['unidNotif', 'unidade', 'unidadeNotificadora']);
        var cidade = campo(raiz, ['munNotif', 'municipioNotif', 'municipioNotificacao', 'municipio']);
        var uf = campo(raiz, ['ufNotif', 'ufNotificacao', 'uf']);
        if ((nome?.value && norm(nome.value) !== norm(unidade.v)) ||
            (cidade?.value && norm(cidade.value) !== norm(unidade.municipio)) ||
            (uf?.value && norm(uf.value) !== norm(unidade.uf))) {
          avisos.push({ campo: cnes, mensagem: 'Confira unidade, CNES, município e UF da notificação.' });
        }
      }
    }
    if (localizacoes.length && !municipios.length || cbo && !ocupacoes.length || camposCnae.length && !atividades.length) {
      avisos.push({ mensagem: 'Uma tabela de referência está indisponível. Confira os códigos antes do envio.' });
    }
    return avisos;
  };

  /* ---------- configuração por formulário ---------- */

  function configurar(raiz) {
    atualizarDicaCnpj(raiz);

    var nomeUnidade = campo(raiz, ['unidNotif', 'unidade', 'unidadeNotificadora']);
    var cnes = campo(raiz, ['codUnidNotif']);
    var municipioNotif = campo(raiz, ['munNotif', 'municipioNotif', 'municipioNotificacao', 'municipio']);
    var ufNotif = campo(raiz, ['ufNotif', 'ufNotificacao', 'uf']);
    var ibgeNotif = campo(raiz, ['ibgeNotif']);
    function vincularCampos(origens, vinculados) {
      var confirmados = new Map();
      origens.filter(Boolean).forEach(function (origem) {
        origem.addEventListener('input', function (evento) {
          if (!evento.isTrusted || !confirmados.has(origem) || confirmados.get(origem) === norm(origem.value)) return;
          confirmados.clear();
          vinculados.forEach(function (el) {
            if (!el || el === origem || !el.value) return;
            el.value = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
          });
        });
      });
      return function () {
        origens.filter(Boolean).forEach(function (origem) { confirmados.set(origem, norm(origem.value)); });
      };
    }
    var confirmarUnidade = vincularCampos([nomeUnidade, cnes], [nomeUnidade, cnes, municipioNotif, ufNotif, ibgeNotif]);
    function preencherUnidade(item) {
      definir(nomeUnidade, item.v, true);
      definir(cnes, item.c, true);
      definir(municipioNotif, item.municipio, true);
      definir(ufNotif, item.uf, true);
      definir(ibgeNotif, item.ibge, true);
      confirmarUnidade();
    }
    anexarLista(nomeUnidade, 'cnes', preencherUnidade);
    anexarLista(cnes, 'cnes', preencherUnidade);
    var investigadora = campo(raiz, ['munInvestigadora']);
    anexarLista(investigadora, 'cnes', function (item) {
      definir(investigadora, item.v, true);
      definir(campo(raiz, ['codUnidInv']), item.c, true);
    });

    // A escolha inclui a UF para distinguir municípios com o mesmo nome.
    [
      [municipioNotif, ibgeNotif, ufNotif],
      [campo(raiz, ['munRes']), campo(raiz, ['ibgeRes']), campo(raiz, ['ufRes'])],
      [campo(raiz, ['munEmp']), campo(raiz, ['ibgeEmp']), campo(raiz, ['ufEmp'])],
      [campo(raiz, ['munPrincipal']), campo(raiz, ['ibgePrincipal']), campo(raiz, ['ufPrincipal'])]
    ].forEach(function (t) {
      var municipio = t[0], ibge = t[1], uf = t[2];
      if (!municipio || !ibge) return;
      // Ao editar a localização, descarta o código anterior e resolve a nova combinação.
      [municipio, uf].filter(Boolean).forEach(function (el) {
        el.addEventListener('input', function (evento) {
          if (!evento.isTrusted) return;
          ibge.value = '';
          delete municipio.dataset.visatConfirmado;
        });
      });
      if (uf) uf.addEventListener('change', function (evento) {
        if (evento.isTrusted) municipio.dispatchEvent(new Event('blur'));
      });
      function preencherMunicipio(item) {
        definir(ibge, item.c, true);
        definir(municipio, item.v, true);
        definir(uf, item.uf, true);
      }
      anexarLista(municipio, 'mun', preencherMunicipio, ibge);
    });

    // Ocupação -> CBO
    anexarLista(campo(raiz, ['ocupacao']), 'cbo', null);

    anexarLista(campo(raiz, ['cnae']), 'cnae', null);
    // A emissão da CAT é um serviço externo distinto da notificação.
    raiz.querySelectorAll('[data-chips="cat"]').forEach(function (grupo) {
      if (grupo.nextElementSibling?.matches('[data-visat-link-cat]')) return;
      var link = document.createElement('a');
      link.dataset.visatLinkCat = '';
      link.className = 'field-help';
      link.href = 'https://www.gov.br/pt-br/servicos/registrar-comunicacao-de-acidente-de-trabalho-cat';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Registrar CAT no INSS';
      grupo.after(link);
    });
    // Diagnóstico -> CID-10: busca restrita ao escopo de cada ficha em js/cid-qualificado.js.
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
