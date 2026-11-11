/*
 * autopreenchimento.js — Preenchimento automático dos formulários de notificação
 * VISAT / SMS Florianópolis
 *
 * Arquivo independente: não altera os demais scripts. Incluir em
 *   - notificacao.html  (formulários e link direto para o agravo)
 *   - index.html        (repassa ?agravo= e ?perfil= ao quadro da aplicação)
 *
 * O que faz, sempre sem sobrescrever o que já foi digitado:
 *   1. Data da notificação = hoje; UF = SC; município de notificação = Florianópolis; IBGE (Sinan, 6 dígitos) = 420540.
 *   2. Lembra no navegador SOMENTE os dados do notificante (profissional, função, unidade,
 *      códigos da unidade) e os repõe na próxima notificação. Dados do trabalhador não são guardados.
 *   3. Calcula a idade a partir da data de nascimento.
 *   4. CEP de residência -> logradouro, bairro, município, UF e IBGE (ViaCEP).
 *   5. CNPJ do empregador / da empresa principal -> razão social, CNAE no código do Sinan e endereço (BrasilAPI; reserva: CNPJ.ws).
 *   6. Link direto: ?agravo=1-a&perfil=municipal já seleciona o agravo e o perfil.
 */
(function () {
  'use strict';

  var CHAVE_NOTIFICANTE = 'visat-notificante-v1';
  var PADRAO = { uf: 'SC', municipio: 'Florianópolis', ibge: '420540' }; // Sinan: código IBGE com 6 dígitos

  /* Conversão CNAE (Receita) -> código de atividade do Sinan.
     Mesma regra da ferramenta "Consulta rápida de códigos" do portal VISAT (Como notificar):
     usa a classe CNAE de 5 dígitos; quando a classe CNAE 2.0 tem descrição idêntica a uma classe
     CNAE 1.0, o Sinan usa o código CNAE 1.0. Pares "classe 2.0 -> código Sinan" abaixo (165). */
  var CNAE_SINAN = (function () {
    var m = {};
    '1051115415 1061915512 1062715520 1081315717 1092915822 1094515849 1112715920 1113515938 1220416004 1330817710 1352917620 1353717639 1413418139 1421517728 1510619100 1531919313 1532719321 1610220109 1710921105 1721421210 1731121318 1910123108 2011824112 2012624120 2014224147 2021524210 2031224317 2032124325 2033924333 2062224724 2071124813 2072024821 2073824830 2091624910 2092424929 2093224945 2094124937 2110624511 2121124520 2122024538 2211125119 2311726115 2312526123 2319226190 2320626204 2341926425 2411327138 2412127146 2422927243 2423727251 2424527260 2441527413 2442327421 2512828126 2513628134 2521728215 2541128410 2591828916 2652333502 2732531224 2733331305 2751129815 2814329149 2822429238 2831329327 2840229408 2863129637 2910734100 2920434207 3032635220 3091135912 3101236110 3102136129 3104736145 3220536927 3291436978 3512340126 3513140134 3514040142 3600641009 4321545411 4330445500 4511150105 4520050202 4543950423 4613351136 4617651179 4618451187 4633851330 4635451365 4636251373 4687751551 4723752248 4761052469 4784952477 4785752507 4940060305 5011461115 5012261123 5021161220 5130762308 5212563118 6010192215 6410765102 6421265218 6423965234 6424765242 6432865323 6433665331 6434465510 6435265340 6440965404 6450665927 6470165919 6511166117 6530866133 6541366214 6542166222 6550266303 7010774152 7320374136 7733171331 7740365935 8112570408 8411675116 8413275132 8421375213 8422175221 8423075230 8424875248 8425675256 8513980152 8520180209 8531780314 8532580322 8533380330 8541480969 8542280977 8610185111 9101592517 9420191200 9491091910 9492891928 9603393033 9700595001 9900899007 0114801147 0115601155 0724313242 0132601341 0134201325 0135101333 0151201414 0152101422 0154701449 0155501457 0500310006 0600011100 0710313102 0721913218 0722713226 0723513234 0725113250 0810014109 0892414222'.split(' ').forEach(function (p) { m[p.slice(0, 5)] = p.slice(5); });
    return m;
  })();

  function cnaeSinan(subclasse) {
    var classe = String(subclasse || '').replace(/\D/g, '').padStart(7, '0').slice(0, 5);
    if (classe === '00000') return '';
    return CNAE_SINAN[classe] || classe;
  }

  function ibgeSinan(codigo) { return String(codigo || '').replace(/\D/g, '').slice(0, 6); }

  /* Campos do notificante que podem ser lembrados (data-key -> grupo). */
  var NOTIFICANTE = {
    profissional: 'profissional', investigador: 'profissional',
    funcao: 'funcao',
    unidade: 'unidade', unidNotif: 'unidade', unidadeNotificadora: 'unidade',
    codUnidNotif: 'codUnidade',
    munInvestigadora: 'unidadeInvestigadora',
    codUnidInv: 'codUnidadeInvestigadora'
  };

  /* ---------- utilidades ---------- */

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
    if (!el || valor === undefined || valor === null || valor === '') return false;
    if (!forcar && !vazio(el)) return false;
    valor = String(valor);
    if (el.tagName === 'SELECT') {
      var alvo = valor.toLowerCase();
      var opcao = Array.prototype.find.call(el.options, function (o) {
        return o.value.toLowerCase() === alvo || o.text.trim().toLowerCase() === alvo;
      });
      if (!opcao) return false;
      el.value = opcao.value;
    } else {
      el.value = valor;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function hoje() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function digitos(v) { return String(v || '').replace(/\D/g, ''); }

  function aviso(el, texto, erro) {
    if (!el) return;
    var id = (el.dataset.key || 'campo') + '-autopreenchimento';
    var span = el.parentNode.querySelector('[data-autopreenchimento-aviso="' + id + '"]');
    if (!span) {
      span = document.createElement('small');
      span.setAttribute('data-autopreenchimento-aviso', id);
      span.setAttribute('aria-live', 'polite');
      span.style.display = 'block';
      span.style.marginTop = '4px';
      span.style.fontSize = '12px';
      el.insertAdjacentElement('afterend', span);
    }
    span.style.color = erro ? '#B3261E' : '#112C45';
    span.textContent = texto;
  }

  function lerNotificante() {
    try { return JSON.parse(localStorage.getItem(CHAVE_NOTIFICANTE)) || {}; } catch (e) { return {}; }
  }

  function gravarNotificante(dados) {
    try { localStorage.setItem(CHAVE_NOTIFICANTE, JSON.stringify(dados)); } catch (e) { /* navegador sem armazenamento */ }
  }

  /* ---------- 1. valores padrão da notificação ---------- */

  function preencherPadrao(raiz) {
    definir(campo(raiz, ['dataNotificacao', 'dataNotif']), hoje());

    var temUfNotifEspecifica = !!campo(raiz, ['ufNotif', 'ufNotificacao']);
    // Nos formulários sem "ufNotif/ufNotificacao", o campo "uf" é o da notificação.
    definir(campo(raiz, temUfNotifEspecifica ? ['ufNotif', 'ufNotificacao'] : ['uf']), PADRAO.uf);
    definir(campo(raiz, ['munNotif', 'municipioNotif', 'municipioNotificacao']), PADRAO.municipio);
    definir(campo(raiz, ['ibgeNotif']), PADRAO.ibge);
  }

  /* ---------- 2. dados do notificante ---------- */

  function preencherNotificante(raiz) {
    var salvos = lerNotificante();
    Object.keys(NOTIFICANTE).forEach(function (chave) {
      var el = campo(raiz, [chave]);
      if (!el) return;
      definir(el, salvos[NOTIFICANTE[chave]]);
      if (el.dataset.autopreenchimentoNotificante) return;
      el.dataset.autopreenchimentoNotificante = '1';
      el.addEventListener('change', function () {
        var dados = lerNotificante();
        dados[NOTIFICANTE[chave]] = el.value.trim();
        gravarNotificante(dados);
      });
    });

    if (Object.keys(salvos).length && !raiz.querySelector('[data-autopreenchimento-limpar]')) {
      var ancora = campo(raiz, ['profissional', 'investigador']) || campo(raiz, ['unidade', 'unidNotif', 'unidadeNotificadora']);
      if (!ancora) return;
      var botao = document.createElement('button');
      botao.type = 'button';
      botao.setAttribute('data-autopreenchimento-limpar', '1');
      botao.textContent = 'Esquecer os dados do notificante neste navegador';
      botao.style.cssText = 'display:block;margin-top:6px;padding:0;border:0;background:none;color:#CC6A00;font-size:12px;text-decoration:underline;cursor:pointer';
      botao.addEventListener('click', function () {
        try { localStorage.removeItem(CHAVE_NOTIFICANTE); } catch (e) { /* sem armazenamento */ }
        botao.textContent = 'Dados do notificante apagados deste navegador.';
        botao.disabled = true;
      });
      ancora.insertAdjacentElement('afterend', botao);
    }
  }

  /* ---------- 3. idade a partir da data de nascimento ---------- */

  function configurarIdade(raiz) {
    var nasc = campo(raiz, ['nascimento']);
    var idade = campo(raiz, ['idade']);
    var unidade = campo(raiz, ['idadeUnidade']);
    if (!nasc || !idade || nasc.dataset.autopreenchimentoIdade) return;
    nasc.dataset.autopreenchimentoIdade = '1';

    function calcular() {
      if (!nasc.value) return;
      if (!vazio(idade) && idade.dataset.autopreenchido !== '1') return; // respeita valor digitado
      var n = new Date(nasc.value + 'T00:00:00');
      var ref = new Date();
      var dataNotif = campo(raiz, ['dataNotificacao', 'dataNotif']);
      if (dataNotif && dataNotif.value) ref = new Date(dataNotif.value + 'T00:00:00');
      if (isNaN(n) || n > ref) return;
      var anos = ref.getFullYear() - n.getFullYear();
      if (ref.getMonth() < n.getMonth() || (ref.getMonth() === n.getMonth() && ref.getDate() < n.getDate())) anos--;
      var valor = anos, un = 'Ano';
      if (anos < 1) {
        var meses = (ref.getFullYear() - n.getFullYear()) * 12 + ref.getMonth() - n.getMonth() - (ref.getDate() < n.getDate() ? 1 : 0);
        if (meses >= 1) { valor = meses; un = 'Mês'; } else { valor = Math.floor((ref - n) / 86400000); un = 'Dia'; }
      }
      definir(idade, valor, true);
      idade.dataset.autopreenchido = '1';
      if (unidade) definir(unidade, un, true);
    }
    idade.addEventListener('input', function (ev) { if (ev.isTrusted) idade.dataset.autopreenchido = '0'; });
    nasc.addEventListener('change', calcular);
    calcular();
  }

  /* ---------- 4. CEP de residência (ViaCEP) ---------- */

  function configurarCep(raiz) {
    var cep = campo(raiz, ['cep']);
    if (!cep || cep.dataset.autopreenchimentoCep) return;
    cep.dataset.autopreenchimentoCep = '1';

    function buscar() {
      var n = digitos(cep.value);
      if (n.length !== 8 || cep.dataset.ultimoCep === n) return;
      cep.dataset.ultimoCep = n;
      aviso(cep, 'Buscando endereço pelo CEP…');
      fetch('https://viacep.com.br/ws/' + n + '/json/')
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function (d) {
          if (d.erro) { aviso(cep, 'CEP não encontrado. Preencher o endereço manualmente.', true); return; }
          definir(campo(raiz, ['logRes']), d.logradouro);
          definir(campo(raiz, ['bairroRes']), d.bairro);
          definir(campo(raiz, ['ufRes']), d.uf);
          definir(campo(raiz, ['munRes']), d.localidade);
          definir(campo(raiz, ['ibgeRes']), ibgeSinan(d.ibge));
          aviso(cep, 'Endereço preenchido pelo CEP. Conferir antes de enviar.');
        })
        .catch(function () { aviso(cep, 'Não foi possível consultar o CEP agora. Preencher manualmente.', true); });
    }
    cep.addEventListener('change', buscar);
    cep.addEventListener('blur', buscar);
  }

  /* ---------- 5. CNPJ (BrasilAPI) ---------- */

  function titulo(t) {
    if (!t) return '';
    var minusculas = ['de', 'da', 'do', 'das', 'dos', 'e'];
    return String(t).toLowerCase().split(' ').map(function (p, i) {
      return (i > 0 && minusculas.indexOf(p) >= 0) ? p : p.charAt(0).toUpperCase() + p.slice(1);
    }).join(' ');
  }

  /* Consulta a BrasilAPI e, se falhar (limite de uso ou indisponibilidade), a CNPJ.ws.
     Devolve sempre o mesmo formato. */
  function consultarCnpj(n) {
    return fetch('https://brasilapi.com.br/api/cnpj/v1/' + n)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        return {
          razao_social: d.razao_social, cnae: d.cnae_fiscal, cnaeDescricao: d.cnae_fiscal_descricao, secundarios: d.cnaes_secundarios, cep: d.cep,
          uf: d.uf, municipio: d.municipio, ibge: d.codigo_municipio_ibge, bairro: d.bairro,
          tipoLogradouro: d.descricao_tipo_de_logradouro, logradouro: d.logradouro, numero: d.numero,
          telefone: d.ddd_telefone_1 && String(d.ddd_telefone_1).length >= 10
            ? '(' + String(d.ddd_telefone_1).slice(0, 2) + ') ' + String(d.ddd_telefone_1).slice(2) : d.ddd_telefone_1
        };
      })
      .catch(function () {
        return fetch('https://publica.cnpj.ws/cnpj/' + n)
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(function (d) {
            var e = d.estabelecimento || {};
            var ap = e.atividade_principal || {};
            return {
              razao_social: d.razao_social, cnae: ap.id, cnaeDescricao: ap.descricao, cep: e.cep,
              secundarios: (e.atividades_secundarias || []).map(function (x) { return { codigo: x.id, descricao: x.descricao }; }),
              uf: e.estado && e.estado.sigla, municipio: e.cidade && e.cidade.nome,
              ibge: e.cidade && e.cidade.ibge_id, bairro: e.bairro,
              tipoLogradouro: e.tipo_logradouro, logradouro: e.logradouro, numero: e.numero,
              telefone: e.ddd1 && e.telefone1 ? '(' + e.ddd1 + ') ' + e.telefone1 : ''
            };
          });
      });
  }

  function oferecerCnaes(campoCnpj, campoCnae, dados) {
    if (!campoCnae) return;
    var opcoes = document.createElement('select');
    opcoes.className = 'input';
    opcoes.dataset.cnaesDoCnpj = '1';
    opcoes.setAttribute('aria-label', 'Atividades econômicas cadastradas neste CNPJ');
    opcoes.add(new Option('Selecionar atividade cadastrada neste CNPJ', ''));
    var atividades = [{ codigo: dados.cnae, descricao: dados.cnaeDescricao }].concat(dados.secundarios || []);
    atividades.forEach(function (atividade, i) {
      var codigo = cnaeSinan(atividade.codigo);
      if (!codigo) return;
      var valor = codigo + (atividade.descricao ? ' – ' + atividade.descricao : '');
      opcoes.add(new Option((i === 0 ? 'Principal: ' : 'Secundária: ') + valor, valor));
    });
    opcoes.addEventListener('change', function () { definir(campoCnae, opcoes.value, true); });
    campoCnae.insertAdjacentElement('afterend', opcoes);
    var cnpjConsultado = digitos(campoCnpj.value);
    campoCnpj.addEventListener('input', function remover() {
      if (digitos(campoCnpj.value) === cnpjConsultado) return;
      opcoes.remove();
      campoCnpj.removeEventListener('input', remover);
    });
  }

  function configurarCnpj(raiz, chavesCnpj, destino) {
    var el = campo(raiz, chavesCnpj);
    if (!el || el.dataset.autopreenchimentoCnpj) return;
    el.dataset.autopreenchimentoCnpj = '1';
    var automaticos = new Map();
    function preencher(chaves, valor) {
      var alvo = campo(raiz, chaves);
      if (definir(alvo, valor)) automaticos.set(alvo, alvo.value);
    }
    el.addEventListener('input', function () {
      if (digitos(el.value) === el.dataset.ultimoCnpj) return;
      delete el.dataset.ultimoCnpj;
      automaticos.forEach(function (valor, campo) {
        if (campo.value !== valor) return;
        campo.value = '';
        campo.dispatchEvent(new Event('input', { bubbles: true }));
      });
      automaticos.clear();
    });

    function buscar() {
      var n = digitos(el.value);
      if (n.length !== 14 || el.dataset.ultimoCnpj === n) return; // CPF (11 dígitos) não é consultado
      el.dataset.ultimoCnpj = n;
      aviso(el, 'Consultando CNPJ…');
      consultarCnpj(n)
        .then(function (d) {
          if (!el.isConnected || digitos(el.value) !== n) return;
          var codSinan = cnaeSinan(d.cnae);
          var cnae = codSinan ? codSinan + (d.cnaeDescricao ? ' – ' + d.cnaeDescricao : '') : '';
          var logradouro = [d.tipoLogradouro, d.logradouro].filter(Boolean).join(' ');
          var mun = ibgeSinan(d.ibge) === PADRAO.ibge ? PADRAO.municipio : titulo(d.municipio);
          preencher(destino.razao, d.razao_social);
          preencher(destino.cnae, cnae);
          if (destino.uf) preencher(destino.uf, d.uf);
          if (destino.municipio) preencher(destino.municipio, mun);
          if (destino.ibge) preencher(destino.ibge, ibgeSinan(d.ibge));
          if (destino.bairro) preencher(destino.bairro, titulo(d.bairro));
          if (destino.endereco) preencher(destino.endereco, titulo(logradouro));
          if (destino.numero) preencher(destino.numero, d.numero);
          if (destino.telefone) preencher(destino.telefone, d.telefone);
          if (destino.cep) preencher(destino.cep, d.cep);
          oferecerCnaes(el, campo(raiz, destino.cnae), d);
          aviso(el, 'Confira os dados e escolha a atividade econômica que corresponde ao caso.');
        })
        .catch(function () {
          if (digitos(el.value) !== n) return;
          delete el.dataset.ultimoCnpj;
          aviso(el, 'CNPJ não encontrado ou consulta indisponível. Preencher manualmente.', true);
        });
    }
    el.addEventListener('change', buscar);
    el.addEventListener('blur', buscar);
  }

  function configurarEmpresas(raiz) {
    // Formulários com "ufNotif/ufNotificacao" usam "uf/municipio/bairro/endereco/numero" para a empresa.
    var camposGenericosSaoDaEmpresa = !!campo(raiz, ['ufNotificacao']);
    var telefoneGenericoDaEmpresa = !!campo(raiz, ['telefoneRes']);
    configurarCnpj(raiz, ['cnpj'], {
      razao: ['empresa', 'empresaNome', 'razao'],
      cnae: ['cnae'],
      uf: camposGenericosSaoDaEmpresa ? ['ufEmp', 'uf'] : ['ufEmp'],
      municipio: camposGenericosSaoDaEmpresa ? ['munEmp', 'municipio'] : ['munEmp'],
      ibge: ['ibgeEmp'],
      bairro: ['bairroEmp', 'bairro'],
      endereco: ['endEmp', 'endereco'],
      numero: ['numEmp', 'numero'],
      telefone: telefoneGenericoDaEmpresa ? ['telEmp', 'telefone'] : ['telEmp'],
      cep: ['cepEmp']
    });
    configurarCnpj(raiz, ['cnpjPrincipal', 'cnpjPrinc'], {
      razao: ['razaoPrincipal', 'razaoPrinc'],
      cnae: ['cnaePrincipal', 'cnaePrinc'],
      uf: ['ufPrincipal'], municipio: ['munPrincipal'], ibge: ['ibgePrincipal'],
      bairro: ['bairroPrincipal'], endereco: ['endPrincipal'], numero: ['numPrincipal'], cep: ['cepPrincipal']
    });
  }

  /* ---------- aplicação nos formulários montados ---------- */

  function raizDoFormulario(el) {
    var r = el.closest('[class*="inline"]') || el.closest('form') || el.closest('section');
    return r || document;
  }

  function aplicar(raiz) {
    if (!raiz.querySelector('[data-key]')) return;
    preencherPadrao(raiz);
    preencherNotificante(raiz);
    configurarIdade(raiz);
    configurarCep(raiz);
    configurarEmpresas(raiz);
  }

  var agendado = null;
  function examinar() {
    clearTimeout(agendado);
    // Aguarda o formulário restaurar o rascunho antes de preencher só o que ficou vazio.
    agendado = setTimeout(function () {
      var raizes = new Set();
      document.querySelectorAll('[data-key]').forEach(function (el) { raizes.add(raizDoFormulario(el)); });
      raizes.forEach(aplicar);
    }, 80);
  }

  /* ---------- 6. link direto para agravo e perfil ---------- */

  function parametros() {
    var p = new URLSearchParams(window.location.search);
    return { agravo: p.get('agravo'), perfil: p.get('perfil') };
  }

  function repassarAoQuadro() {
    var quadro = document.getElementById('aplicacao-notificacao');
    if (!quadro) return;
    var p = parametros();
    if (!p.agravo && !p.perfil) return;
    var base = (quadro.getAttribute('src') || 'notificacao.html').split('?')[0];
    quadro.setAttribute('src', base + window.location.search);
  }

  function selecionarPorLink() {
    var p = parametros();
    if (!p.agravo && !p.perfil) return;
    var tentativas = 0;
    var timer = setInterval(function () {
      tentativas++;
      var botao = null;
      if (p.agravo) {
        var id = p.agravo.toLowerCase();
        botao = document.querySelector('.item-agravo[data-id="' + id + '"]') ||
                document.querySelector('.item-agravo[data-id^="' + id + '-"]');
      }
      var perfil = p.perfil ? document.querySelector('input[name="perfil"][value="' + p.perfil + '"]') : null;
      var prontoAgravo = !p.agravo || botao;
      var prontoPerfil = !p.perfil || perfil;
      if ((prontoAgravo && prontoPerfil) || tentativas > 50) {
        clearInterval(timer);
        if (botao && botao.getAttribute('aria-pressed') !== 'true') botao.click();
        if (perfil && !perfil.checked) perfil.click();
        if (botao) botao.scrollIntoView({ block: 'center' });
      }
    }, 200);
  }

  function iniciar() {
    repassarAoQuadro();
    selecionarPorLink();
    if (document.querySelector('template[id^="form-"]') || document.getElementById('busca')) {
      new MutationObserver(examinar).observe(document.body, { childList: true, subtree: true });
      examinar();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
