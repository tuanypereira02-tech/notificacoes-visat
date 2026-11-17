/*
 * autopreenchimento.js — Preenchimento automático dos formulários de notificação
 * VISAT / SMS Florianópolis
 *
 * Arquivo independente: não altera os demais scripts. Incluir em
 *   - notificacao.html  (formulários e link direto para o agravo)
 *   - index.html        (repassa ?agravo= e ?perfil= ao quadro da aplicação)
 *
 * Consulta dados de apoio na ficha em uso.
 *   3. Calcula a idade a partir da data de nascimento.
 *   4. CEP de residência -> logradouro, bairro, município, UF e IBGE (ViaCEP).
 *   5. CNPJ do empregador / da empresa principal -> razão social, CNAE no código do Sinan e endereço (BrasilAPI; reserva: CNPJ.ws).
 *   6. Link direto: ?agravo=1-a&perfil=municipal já seleciona o agravo e o perfil; ?homologacao=1 marca o ambiente de teste.
 */
(function () {
  'use strict';

  var PADRAO = { uf: 'SC', municipio: 'Florianópolis', ibge: '420540' }; // Sinan: código IBGE com 6 dígitos

  /* Correspondências já usadas pelo portal. Cada destino precisa existir na TB_CNAE
     extraída. A tabela SQL não fornece uma correspondência completa com a Receita. */
  var CNAE_SINAN = (function () {
    var m = {};
    '0114801147 0115601155 0132601341 0134201325 0135101333 0151201414 0152101422 0154701449 0155501457 0500310006 0600011100 0710313102 0721913218 0722713226 0723513234 0724313242 0725113250 0810014109 0892414222 1051115415 1061915512 1062715520 1081315717 1092915822 1094515849 1112715920 1113515938 1220416004 1330817710 1352917620 1353717639 1413418139 1421517728 1510619100 1531919313 1532719321 1610220109 1710921105 1721421210 1731121318 1910123108 2011824112 2012624120 2014224147 2021524210 2031224317 2032124325 2033924333 2062224724 2071124813 2072024821 2073824830 2091624910 2092424929 2093224945 2094124937 2110624511 2121124520 2122024538 2211125119 2311726115 2312526123 2319226190 2320626204 2341926425 2411327138 2412127146 2421127235 2422927243 2423727251 2424527260 2441527413 2442327421 2512828126 2513628134 2521728215 2541128410 2591828916 2652333502 2732531224 2733331305 2751129815 2814329149 2822429238 2831329327 2840229408 2863129637 2910734100 2920434207 3032635220 3091135912 3092035920 3101236110 3102136129 3104736145 3220536927 3291436978 3512340126 3513140134 3514040142 3600641009 4321545411 4330445500 4511150105 4520050202 4543950423 4613351136 4617651179 4618451187 4633851330 4635451365 4636251373 4687751551 4723752248 4761052469 4784952477 4785752507 4940060305 5011461115 5012261123 5021161220 5130762308 5212563118 6010192215 6410765102 6421265218 6423965234 6424765242 6432865323 6433665331 6434465510 6435265340 6440965404 6450665927 6470165919 6511166117 6512066125 6530866133 6541366214 6542166222 6550266303 7320374136 7733171331 8112570408 8411675116 8413275132 8421375213 8422175221 8423075230 8424875248 8425675256 8513980152 8520180209 8531780314 8532580322 8533380330 8541480969 8542280977 8610185111 9101592517 9420191200 9491091910 9492891928 9603393033 9700595001 9900899007'.split(' ').forEach(function (p) { m[p.slice(0, 5)] = p.slice(5); });
    return m;
  })();

  var tabelaCnae = null;
  var consultaTabelaCnae = null;
  window.visatCarregarCnae = function () {
    if (!consultaTabelaCnae) {
      consultaTabelaCnae = fetch('data/cnae-sinan.json?v=20261117-tb-cnae')
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (tabela) {
          tabelaCnae = tabela;
          return tabela;
        })
        .catch(function (erro) { consultaTabelaCnae = null; throw erro; });
    }
    return consultaTabelaCnae;
  };

  function cnaeSinan(subclasse) {
    var numero = String(subclasse || '').replace(/\D/g, '');
    if (!/^\d{6,7}$/.test(numero) || !tabelaCnae) return '';
    var classe = numero.padStart(7, '0').slice(0, 5);
    var codigo = CNAE_SINAN[classe];
    return tabelaCnae.classes.some(function (item) { return item[0] === codigo; }) ? codigo : '';
  }

  window.visatCnaeLegado = function (codigo) { return Object.values(CNAE_SINAN).includes(codigo); };

  function ibgeSinan(codigo) { return String(codigo || '').replace(/\D/g, '').slice(0, 6); }

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

  /* ---------- 3. idade a partir da data de nascimento ---------- */

  function configurarIdade(raiz) {
    var nasc = campo(raiz, ['nascimento']);
    var idade = campo(raiz, ['idade']);
    var unidade = campo(raiz, ['idadeUnidade']);
    if (!nasc || !idade || nasc.dataset.autopreenchimentoIdade) return;
    nasc.dataset.autopreenchimentoIdade = '1';

    function calcular() {
      idade.readOnly = !!nasc.value;
      if (unidade) unidade.disabled = !!nasc.value;
      var referencia = [campo(raiz, ['inicioSintomas', 'dataAcidente', 'dataDiag', 'dataDiagnostico']),
        campo(raiz, ['dataNotificacao', 'dataNotif'])].find(function (el) { return el && el.value; });
      if (!nasc.value || !referencia || nasc.value > referencia.value) {
        if (idade.dataset.autopreenchido === '1') {
          limparCampo(idade);
          if (unidade) definir(unidade, 'Ano', true);
          delete idade.dataset.autopreenchido;
        }
        return;
      }
      var n = new Date(nasc.value + 'T00:00:00Z');
      var ref = new Date(referencia.value + 'T00:00:00Z');
      var anos = ref.getUTCFullYear() - n.getUTCFullYear() - Number(referencia.value.slice(5) < nasc.value.slice(5));
      var valor = anos, un = 'Ano';
      if (anos < 1) {
        var meses = (ref.getUTCFullYear() - n.getUTCFullYear()) * 12 + ref.getUTCMonth() - n.getUTCMonth() -
          Number(ref.getUTCDate() < n.getUTCDate());
        if (meses >= 1) { valor = meses; un = 'Mês'; } else { valor = Math.floor((ref - n) / 86400000); un = 'Dia'; }
      }
      definir(idade, valor, true);
      idade.dataset.autopreenchido = '1';
      if (unidade) definir(unidade, un, true);
    }
    nasc.addEventListener('input', calcular);
    nasc.addEventListener('change', calcular);
    ['inicioSintomas', 'dataAcidente', 'dataDiag', 'dataDiagnostico', 'dataNotificacao', 'dataNotif'].forEach(function (chave) {
      var data = campo(raiz, [chave]);
      if (data) {
        data.addEventListener('input', calcular);
        data.addEventListener('change', calcular);
      }
    });
    calcular();
  }

  /* ---------- 4. CEP de residência (ViaCEP) ---------- */

  function limparCampo(el) {
    if (!el || !el.value) return;
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function configurarCep(raiz, chaveCep, destinos) {
    const cep = campo(raiz, [chaveCep]);
    if (!cep || cep.dataset.autopreenchimentoCep) return;
    cep.dataset.autopreenchimentoCep = '1';
    cep.inputMode = 'numeric';
    cep.maxLength = 9;
    cep.placeholder = '00000-000';

    const ajuda = document.createElement('p');
    ajuda.id = cep.id + '-ajuda';
    ajuda.className = 'field-help';
    ajuda.textContent = 'Digite o CEP ou busque por logradouro, município e UF. O bairro ajuda a filtrar.';
    cep.setAttribute('aria-describedby', ajuda.id);
    cep.after(ajuda);

    const preenchidosPeloCep = new Map();
    const normalizar = texto => String(texto || '').normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
    const dadosEndereco = Object.fromEntries(Object.entries(destinos).map(([chave, chaves]) => [chave, campo(raiz, chaves)]));
    const editados = new Set();
    for (const el of Object.values(dadosEndereco).filter(Boolean)) {
      const preservar = () => {
        editados.add(el);
        preenchidosPeloCep.delete(el);
      };
      el.addEventListener('input', evento => { if (evento.isTrusted) preservar(); });
      el.addEventListener('change', evento => { if (evento.isTrusted) preservar(); });
      el.addEventListener('visat:escolha-manual', preservar);
    }
    const buscarEndereco = document.createElement('button');
    buscarEndereco.type = 'button';
    buscarEndereco.className = 'btn';
    buscarEndereco.dataset.variant = 'outline';
    buscarEndereco.dataset.visatBuscarCep = chaveCep;
    buscarEndereco.textContent = 'Buscar CEP pelo endereço';
    const resultados = document.createElement('div');
    resultados.className = 'visat-lista-apoio';
    resultados.hidden = true;
    ajuda.after(buscarEndereco, resultados);

    let consultaEndereco = 0;
    function fecharResultados() {
      consultaEndereco++;
      resultados.replaceChildren();
      resultados.hidden = true;
    }
    function enderecoInformado() {
      return ['uf', 'localidade', 'logradouro', 'bairro'].map(chave => dadosEndereco[chave]?.value.trim() || '');
    }
    const numeroEndereco = campo(raiz, chaveCep === 'cep' ? ['numRes'] : ['numEmp', 'numero']);
    for (const el of [...Object.values(dadosEndereco), numeroEndereco, cep].filter(Boolean)) {
      el.addEventListener('input', evento => { if (evento.isTrusted) fecharResultados(); });
      el.addEventListener('change', evento => { if (evento.isTrusted) fecharResultados(); });
      el.addEventListener('visat:escolha-manual', fecharResultados);
    }
    let ultimoCep = '';
    let consulta = 0;

    function aplicarEndereco(endereco) {
      const conflitantes = [];
      for (const [origem, el] of Object.entries(dadosEndereco)) {
        if (!el) continue;
        if (origem === 'ibge' &&
            (normalizar(dadosEndereco.localidade?.value) !== normalizar(endereco.localidade) ||
             normalizar(dadosEndereco.uf?.value) !== normalizar(endereco.uf))) continue;
        const valor = origem === 'ibge' ? ibgeSinan(endereco.ibge) : endereco[origem];
        if (valor == null || valor === '') continue;
        const exemplo = el.dataset.visatValorTeste === el.value;
        // Texto parcial digitado (ex.: "madre") é completado pelo nome retornado.
        const parcial = el.value && normalizar(valor).includes(normalizar(el.value));
        if ((!editados.has(el) || !el.value || parcial) && definir(el, valor, exemplo || parcial)) {
          delete el.dataset.visatValorTeste;
          preenchidosPeloCep.set(el, el.value);
        } else if (normalizar(el.value) !== normalizar(valor)) {
          conflitantes.push(valor);
        }
      }
      aviso(cep, conflitantes.length
        ? 'CEP localizado. Dados informados foram preservados. Confira o endereço retornado: ' +
          [endereco.logradouro, endereco.bairro, [endereco.localidade, endereco.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ') + '.'
        : 'CEP localizado. Confira o endereço e informe número e complemento, se houver.');
    }

    async function pesquisarEndereco() {
      fecharResultados();
      const dados = enderecoInformado();
      const [uf, municipio, logradouro, bairro] = dados;
      if (!/^[A-Z]{2}$/.test(uf) || municipio.length < 3 || logradouro.length < 3) {
        aviso(cep, 'Informe UF, município e logradouro para buscar o CEP.', true);
        return;
      }
      const atual = consultaEndereco;
      consulta++;
      ultimoCep = '';
      aviso(cep, 'Buscando CEP pelo endereço…');
      try {
        const caminho = [uf, municipio, logradouro].map(encodeURIComponent).join('/');
        const resposta = await fetch('https://viacep.com.br/ws/' + caminho + '/json/', {
          credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000)
        });
        if (!resposta.ok) throw new Error('Consulta indisponível');
        const enderecos = await resposta.json();
        if (atual !== consultaEndereco || !cep.isConnected || enderecoInformado().some((valor, i) => valor !== dados[i])) return;
        const opcoes = new Map();
        for (const endereco of enderecos) {
          if (/^\d{8}$/.test(digitos(endereco.cep)) &&
              (!bairro || normalizar(endereco.bairro).includes(normalizar(bairro)))) {
            opcoes.set(endereco.cep, endereco);
          }
        }
        if (!opcoes.size) {
          aviso(cep, 'Nenhum CEP encontrado para esse endereço. Confira o logradouro e o bairro.', true);
          return;
        }
        function selecionar(endereco) {
          fecharResultados();
          ultimoCep = digitos(endereco.cep);
          definir(cep, endereco.cep, true);
          aplicarEndereco(endereco);
          cep.focus();
        }
        if (opcoes.size === 1) {
          selecionar(opcoes.values().next().value);
          return;
        }
        aviso(cep, 'Escolha o CEP correspondente ao seu endereço. Confira a faixa de numeração quando disponível.');
        const lista = document.createElement('ul');
        for (const endereco of opcoes.values()) {
          const item = document.createElement('li');
          const botao = document.createElement('button');
          botao.type = 'button';
          botao.className = 'btn';
          botao.dataset.variant = 'outline';
          botao.textContent = [endereco.cep, endereco.logradouro, endereco.bairro, endereco.complemento].filter(Boolean).join(' · ');
          botao.addEventListener('click', () => selecionar(endereco));
          item.append(botao);
          lista.append(item);
        }
        resultados.append(lista);
        resultados.hidden = false;
      } catch {
        if (atual === consultaEndereco && cep.isConnected) {
          aviso(cep, 'Consulta de CEP indisponível. Tente novamente ou informe o CEP conhecido.', true);
        }
      }
    }

    buscarEndereco.addEventListener('click', pesquisarEndereco);

    // Sugestões de rua ao digitar o logradouro (ViaCEP): escolher preenche rua, bairro e CEP.
    const campoRua = dadosEndereco.logradouro;
    if (campoRua) {
      const sugestoes = document.createElement('ul');
      sugestoes.className = 'empresa-resultados';
      sugestoes.setAttribute('aria-label', 'Ruas encontradas');
      sugestoes.hidden = true;
      campoRua.after(sugestoes);
      let esperaRua;
      let consultaRua = 0;
      const fecharRuas = () => { consultaRua++; clearTimeout(esperaRua); sugestoes.replaceChildren(); sugestoes.hidden = true; };
      campoRua.addEventListener('input', evento => {
        if (!evento.isTrusted) return;
        fecharRuas();
        const [uf, municipio, rua] = enderecoInformado();
        if (!/^[A-Z]{2}$/.test(uf) || municipio.length < 3 || rua.length < 3) return;
        const atual = consultaRua;
        esperaRua = setTimeout(async () => {
          try {
            const caminho = [uf, municipio, rua].map(encodeURIComponent).join('/');
            const resposta = await fetch('https://viacep.com.br/ws/' + caminho + '/json/', { credentials: 'omit', referrerPolicy: 'no-referrer' });
            if (!resposta.ok) return;
            const lista = await resposta.json();
            if (atual !== consultaRua || !Array.isArray(lista)) return;
            const vistos = new Set();
            for (const endereco of lista) {
              if (!/^\d{8}$/.test(digitos(endereco.cep)) || vistos.has(endereco.cep)) continue;
              vistos.add(endereco.cep);
              const item = document.createElement('li');
              const botao = document.createElement('button');
              botao.type = 'button';
              botao.className = 'btn';
              botao.dataset.variant = 'outline';
              botao.textContent = [endereco.logradouro, endereco.bairro, endereco.complemento, endereco.cep].filter(Boolean).join(' · ');
              botao.addEventListener('pointerdown', ev => ev.preventDefault());
              botao.addEventListener('click', () => {
                fecharRuas();
                definir(campoRua, endereco.logradouro, true);
                ultimoCep = digitos(endereco.cep);
                definir(cep, endereco.cep, true);
                aplicarEndereco(endereco);
                campoRua.focus();
              });
              item.append(botao);
              sugestoes.append(item);
              if (vistos.size >= 15) break;
            }
            sugestoes.hidden = !sugestoes.childElementCount;
          } catch { /* sem sugestões; o campo segue manual */ }
        }, 500);
      });
      campoRua.addEventListener('blur', () => setTimeout(fecharRuas, 200));
    }
    numeroEndereco?.addEventListener('change', evento => {
      const [uf, municipio, logradouro] = enderecoInformado();
      if (evento.isTrusted && numeroEndereco.value.trim() && !cep.value.trim() && uf && municipio.length >= 3 && logradouro.length >= 3) {
        pesquisarEndereco();
      }
    });

    async function buscar() {
      const numero = digitos(cep.value);
      if (numero === ultimoCep) return;
      const cepMudou = numero !== ultimoCep;
      ultimoCep = numero;
      const atual = ++consulta;
      if (cepMudou) {
        for (const [el, valor] of preenchidosPeloCep) {
          if (el.value === valor) limparCampo(el);
        }
        preenchidosPeloCep.clear();
      }
      if (numero.length !== 8) {
        aviso(cep, '');
        return;
      }

      aviso(cep, 'Buscando endereço pelo CEP…');
      try {
        const resposta = await fetch('https://viacep.com.br/ws/' + numero + '/json/', {
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          signal: AbortSignal.timeout(8000)
        });
        if (!resposta.ok) throw new Error('Consulta indisponível');
        const endereco = await resposta.json();
        if (atual !== consulta || !cep.isConnected || digitos(cep.value) !== numero) return;
        if (endereco.erro) {
          aviso(cep, 'CEP não encontrado. Confira o número ou preencha o endereço manualmente.', true);
          return;
        }
        aplicarEndereco(endereco);
      } catch {
        if (atual !== consulta || !cep.isConnected || digitos(cep.value) !== numero) return;
        ultimoCep = '';
        aviso(cep, 'Consulta indisponível. Confira o CEP ou preencha o endereço manualmente.', true);
      }
    }

    cep.addEventListener('input', evento => {
      if (evento.isTrusted || !cep.value) buscar();
    });
    cep.addEventListener('change', evento => { if (evento.isTrusted) buscar(); });
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
          nome: d.razao_social, cnae: d.cnae_fiscal, cnaeDescricao: d.cnae_fiscal_descricao, secundarios: d.cnaes_secundarios, cep: d.cep,
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
              nome: d.razao_social, cnae: ap.id, cnaeDescricao: ap.descricao, cep: e.cep,
              secundarios: (e.atividades_secundarias || []).map(function (x) { return { codigo: x.id, descricao: x.descricao }; }),
              uf: e.estado && e.estado.sigla, municipio: e.cidade && e.cidade.nome,
              ibge: e.cidade && e.cidade.ibge_id, bairro: e.bairro,
              tipoLogradouro: e.tipo_logradouro, logradouro: e.logradouro, numero: e.numero,
              telefone: e.ddd1 && e.telefone1 ? '(' + e.ddd1 + ') ' + e.telefone1 : ''
            };
          });
      });
  }

  var empresasConsultadas = new WeakMap();

  window.visatConferirEmpresas = function (raiz) {
    var avisos = [];
    raiz.querySelectorAll('[data-autopreenchimento-cnpj]').forEach(function (el) {
      var registro = empresasConsultadas.get(el);
      if (!registro || digitos(el.value) !== registro.cnpj) return;
      var dados = registro.dados;
      var destino = registro.destino;
      var cnae = destino.cnae && campo(raiz, destino.cnae);
      var uf = destino.uf && campo(raiz, destino.uf);
      var municipio = destino.municipio && campo(raiz, destino.municipio);
      function normalizar(v) {
        return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      }
      var codigo = cnae && cnae.value.match(/^\s*(\d{2})\.?(\d{2})-?(\d)(?=\s|$)/);
      var cadastrados = [dados.cnae].concat((dados.secundarios || []).map(function (x) { return x.codigo; }));
      if (codigo && cadastrados.some(Boolean) && !cadastrados.some(function (x) {
        return cnaeSinan(x) === codigo.slice(1).join('');
      })) avisos.push({ campo: cnae, mensagem: 'O CNAE informado difere das atividades retornadas para este CNPJ. Confira a atividade pertinente ao caso.' });
      if (uf && uf.value && dados.uf && normalizar(uf.value) !== normalizar(dados.uf)) {
        avisos.push({ campo: uf, mensagem: 'A UF informada difere do cadastro consultado pelo CNPJ.' });
      }
      if (municipio && municipio.value && dados.municipio && normalizar(municipio.value) !== normalizar(dados.municipio)) {
        avisos.push({ campo: municipio, mensagem: 'O município informado difere do cadastro consultado pelo CNPJ.' });
      }
    });
    return avisos;
  };

  function configurarCnpj(raiz, chavesCnpj, destino) {
    var el = campo(raiz, chavesCnpj);
    if (!el || el.dataset.autopreenchimentoCnpj) return;
    el.dataset.autopreenchimentoCnpj = '1';
    var preenchidos = new Map();
    var consulta = 0;
    function preencher(chaves, valor) {
      var destino = campo(raiz, chaves);
      if (definir(destino, valor)) preenchidos.set(destino, destino.value);
    }
    el.addEventListener('input', function () {
      var n = digitos(el.value);
      if (n === el.dataset.ultimoCnpj) return;
      consulta++;
      delete el.dataset.ultimoCnpj;
      preenchidos.forEach(function (valor, campo) {
        if (campo.value === valor) limparCampo(campo);
      });
      preenchidos.clear();
      aviso(el, '');
    });

    function buscar() {
      var n = digitos(el.value);
      if (n.length !== 14 || el.dataset.ultimoCnpj === n) return; // CPF e CNPJ alfanumérico não são consultados neste serviço
      el.dataset.ultimoCnpj = n;
      var atual = ++consulta;
      aviso(el, 'Consultando CNPJ…');
      Promise.all([consultarCnpj(n), window.visatCarregarCnae().catch(function () { return null; })])
        .then(function (respostas) {
          if (!el.isConnected || atual !== consulta || digitos(el.value) !== n) return;
          var d = respostas[0];
          empresasConsultadas.set(el, { cnpj: n, dados: d, destino: destino });
          var codSinan = cnaeSinan(d.cnae);
          var atividade = codSinan && tabelaCnae.classes.find(function (item) { return item[0] === codSinan; });
          var cnae = atividade ? atividade[0] + ' – ' + atividade[2] : '';
          var logradouro = [d.tipoLogradouro, d.logradouro].filter(Boolean).join(' ');
          var mun = ibgeSinan(d.ibge) === PADRAO.ibge ? PADRAO.municipio : titulo(d.municipio);
          if (destino.nome) preencher(destino.nome, d.nome);
          if (destino.cnae) preencher(destino.cnae, cnae);
          if (destino.uf) preencher(destino.uf, d.uf);
          if (destino.municipio) preencher(destino.municipio, mun);
          if (destino.ibge) preencher(destino.ibge, ibgeSinan(d.ibge));
          if (destino.bairro) preencher(destino.bairro, titulo(d.bairro));
          if (destino.endereco) preencher(destino.endereco, titulo(logradouro));
          if (destino.numero) preencher(destino.numero, d.numero);
          if (destino.telefone) preencher(destino.telefone, d.telefone);
          if (destino.cep) preencher(destino.cep, d.cep);
          var mensagem = 'Confira os dados da empresa preenchidos.';
          if (destino.cnae) mensagem = cnae ? 'Confira o CNAE da tabela do SINAN e a atividade do local de trabalho.' :
            'CNPJ consultado. Selecione a atividade na tabela do SINAN: a conversão automática do CNAE não está disponível para este cadastro.';
          aviso(el, mensagem);
        })
        .catch(function () {
          if (!el.isConnected || atual !== consulta || digitos(el.value) !== n) return;
          delete el.dataset.ultimoCnpj;
          aviso(el, 'CNPJ não encontrado ou consulta indisponível. Preencher manualmente.', true);
        });
    }
    el.addEventListener('input', buscar);
    el.addEventListener('change', buscar);
    el.addEventListener('blur', buscar);
  }

  function configurarEmpresas(raiz) {
    configurarCnpj(raiz, ['cnpj'], {
      nome: ['empresa', 'empresaNome', 'razao'],
      cnae: ['cnae'],
      uf: ['ufEmp'],
      municipio: ['munEmp'],
      ibge: ['ibgeEmp'],
      bairro: ['bairroEmp', 'bairro'],
      endereco: ['endEmp', 'endereco'],
      numero: ['numEmp', 'numero'],
      telefone: ['telEmp', 'telefone'],
      cep: ['cepEmp']
    });
    configurarCnpj(raiz, ['cnpjPrincipal', 'cnpjPrinc'], {
      uf: ['ufPrincipal'], municipio: ['munPrincipal'], ibge: ['ibgePrincipal'],
      bairro: ['bairroPrincipal'], endereco: ['endPrincipal'], numero: ['numPrincipal'], cep: ['cepPrincipal']
    });
  }

  /* ---------- 5b. Empresa pelo nome (base VISAT + cadastro online) ---------- */

  var baseEmpresas = null;
  function carregarBaseEmpresas() {
    if (!baseEmpresas) {
      baseEmpresas = fetch('data/empresas-visat.json?v=20261116')
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function (lista) {
          return lista.map(function (registro) {
            return { registro: registro, nomes: [registro[1], registro[2], registro[3]].map(normalizarNome) };
          });
        })
        .catch(function () { baseEmpresas = null; return []; });
    }
    return baseEmpresas;
  }
  function normalizarNome(texto) {
    return String(texto == null ? '' : texto).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function iniciaisDe(nome) {
    return nome.split(' ').filter(function (p) { return p && ['de', 'da', 'do', 'das', 'dos', 'e'].indexOf(p) < 0; })
      .map(function (p) { return p[0]; }).join('');
  }

  function configurarBuscaEmpresa(raiz) {
    var nome = campo(raiz, ['empresa', 'empresaNome', 'razao']);
    var cnpj = campo(raiz, ['cnpj']);
    if (!nome || !cnpj || nome.dataset.visatBuscaEmpresa) return;
    nome.dataset.visatBuscaEmpresa = '1';
    // Como no rascunho: o nome vem antes do CNPJ.
    if (nome.parentElement !== cnpj.parentElement && cnpj.parentElement.parentElement === nome.parentElement.parentElement) {
      cnpj.parentElement.before(nome.parentElement);
    }
    var ajuda = document.createElement('p');
    ajuda.className = 'field-help';
    ajuda.textContent = 'Digite o nome da empresa para filtrar e consultar o cadastro. Ao escolher, o CNPJ e os dados disponíveis são preenchidos.';
    var retorno = document.createElement('p');
    retorno.className = 'field-help';
    retorno.setAttribute('role', 'status');
    var resultados = document.createElement('ul');
    resultados.className = 'empresa-resultados';
    resultados.setAttribute('aria-label', 'Empresas encontradas');
    resultados.hidden = true;
    nome.after(ajuda, retorno, resultados);
    var enderecoEmpresa = {
      ufEmp: campo(raiz, ['ufEmp']), munEmp: campo(raiz, ['munEmp']), endEmp: campo(raiz, ['endEmp', 'endereco']),
      numEmp: campo(raiz, ['numEmp', 'numero']), bairroEmp: campo(raiz, ['bairroEmp', 'bairro']),
      compEmp: campo(raiz, ['compEmp']), cepEmp: campo(raiz, ['cepEmp'])
    };
    var consultaAtual = 0;
    var espera;
    var aplicando = false;

    function ocultar() { resultados.replaceChildren(); resultados.hidden = true; }
    function cancelar() { consultaAtual++; clearTimeout(espera); }
    function filtroDe(el) { return el && el.value.trim() ? normalizarNome(el.value) : ''; }

    function selecionar(empresa) {
      var atualDoc = digitos(cnpj.value);
      var novoDoc = digitos(empresa.cnpj);
      if (atualDoc && atualDoc !== novoDoc) {
        retorno.textContent = 'Já existe um CNPJ informado. Apague ou confira esse CNPJ para usar a empresa escolhida.';
        cnpj.focus();
        return;
      }
      aplicando = true;
      try {
        nome.value = empresa.nome;
        nome.dispatchEvent(new Event('input', { bubbles: true }));
        // Endereço da base só entra em campo vazio; a consulta do CNPJ completa o restante.
        Object.keys(enderecoEmpresa).forEach(function (chave) { definir(enderecoEmpresa[chave], empresa[chave]); });
        cnpj.value = empresa.cnpj;
        cnpj.dispatchEvent(new Event('input', { bubbles: true }));
        cnpj.dispatchEvent(new Event('change', { bubbles: true }));
      } finally {
        aplicando = false;
      }
      ocultar();
      retorno.textContent = 'Empresa selecionada. Confira o CNPJ, a unidade e os dados do local de trabalho.' +
        (empresa.divergente ? ' O município diverge entre as fontes; confira o endereço.' : '');
      nome.focus();
    }

    function mostrar(lista) {
      ocultar();
      lista.slice(0, 30).forEach(function (empresa) {
        var li = document.createElement('li');
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn';
        b.dataset.variant = 'outline';
        var local = [empresa.munEmp, empresa.ufEmp].filter(Boolean).join('/');
        b.textContent = [empresa.nome, local, empresa.tipo, empresa.cnpjFormatado, empresa.divergente ? 'Conferir município' : ''].filter(Boolean).join(' · ');
        b.addEventListener('pointerdown', function (ev) { ev.preventDefault(); });
        b.addEventListener('click', function () { cancelar(); selecionar(empresa); });
        li.append(b);
        resultados.append(li);
      });
      resultados.hidden = !resultados.childElementCount;
      return resultados.childElementCount;
    }

    function formatarCnpj(n) {
      n = digitos(n);
      return n.length === 14 ? n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : n;
    }

    function atualizar() {
      if (aplicando) return;
      cancelar();
      ocultar();
      retorno.textContent = '';
      var termo = nome.value.trim();
      var busca = normalizarNome(termo);
      if (!busca) return;
      var atual = consultaAtual;
      var uf = filtroDe(enderecoEmpresa.ufEmp);
      var cidade = filtroDe(enderecoEmpresa.munEmp);
      var palavras = busca.split(/\s+/);
      var sigla = busca.replace(/ /g, '');
      function relevancia(n) {
        if (n === busca) return 4;
        if (n.indexOf(busca) === 0) return 3;
        if (sigla.length >= 2 && iniciaisDe(n) === sigla) return 2;
        return palavras.every(function (p) { return n.indexOf(p) >= 0; }) ? 1 : 0;
      }
      carregarBaseEmpresas().then(function (indice) {
        if (atual !== consultaAtual) return;
        var locais = indice.filter(function (item) {
          var r = item.registro;
          return (!uf || normalizarNome(r[5]) === uf) && (!cidade || normalizarNome(r[4]) === cidade) &&
            item.nomes.some(relevancia);
        }).sort(function (a, b) {
          return Math.max.apply(null, b.nomes.map(relevancia)) - Math.max.apply(null, a.nomes.map(relevancia));
        }).slice(0, 20).map(function (item) {
          var r = item.registro;
          return { cnpj: r[0], cnpjFormatado: formatarCnpj(r[0]), nome: r[1] || r[2], munEmp: titulo(r[4]), ufEmp: r[5], tipo: r[6],
            endEmp: titulo(r[8]), numEmp: r[9], compEmp: r[10], bairroEmp: titulo(r[11]), cepEmp: r[12], divergente: r[13] };
        });
        function exibir(online) {
          var unicos = {};
          var lista = [];
          locais.concat(online || []).forEach(function (e) {
            var chave = digitos(e.cnpj);
            if (!unicos[chave]) { unicos[chave] = true; lista.push(e); }
          });
          return mostrar(lista);
        }
        var temLocais = exibir();
        if (busca.length < 3) {
          if (!temLocais) retorno.textContent = 'Digite mais letras para ampliar a busca.';
          return;
        }
        retorno.textContent = 'Buscando também no cadastro online…';
        espera = setTimeout(function () {
          var url = 'https://fichario.app/api/v1/busca?q=' + encodeURIComponent(termo) +
            (uf ? '&uf=' + encodeURIComponent(uf.toUpperCase()) : '') + (cidade ? '&cidade=' + encodeURIComponent(cidade) : '');
          fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' })
            .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
            .then(function (dados) {
              if (atual !== consultaAtual || !nome.isConnected) return;
              var online = (Array.isArray(dados.resultados) ? dados.resultados : []).map(function (item) {
                var n = digitos(item.cnpj);
                return { nome: item.nome_fantasia || item.razao_social, cnpj: n, cnpjFormatado: formatarCnpj(n),
                  munEmp: titulo(item.municipio), ufEmp: item.uf };
              }).filter(function (e) { return e.nome && e.cnpj.length === 14; });
              retorno.textContent = exibir(online)
                ? 'Confira o município e o CNPJ da unidade antes de selecionar.'
                : 'Nenhuma empresa encontrada. Confira o nome ou preencha o CNPJ.';
            })
            .catch(function () {
              if (atual !== consultaAtual || !nome.isConnected) return;
              retorno.textContent = temLocais ? 'Consulta online indisponível. As sugestões da base VISAT continuam disponíveis.'
                : 'Consulta online indisponível. Preencha o CNPJ manualmente.';
            });
        }, 450);
      });
    }

    nome.addEventListener('input', function (ev) { if (ev.isTrusted) atualizar(); });
    nome.parentElement.addEventListener('focusout', function (ev) {
      if (nome.parentElement.contains(ev.relatedTarget)) return;
      cancelar();
      ocultar();
      if (retorno.textContent.indexOf('Buscando') === 0) retorno.textContent = '';
    });
    nome.parentElement.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { cancelar(); ocultar(); retorno.textContent = ''; nome.focus(); }
    });
  }

  /* ---------- aplicação nos formulários montados ---------- */

  function raizDoFormulario(el) {
    var r = el.closest('[class*="inline"]') || el.closest('form') || el.closest('section');
    return r || document;
  }

  function aplicar(raiz) {
    if (!raiz.querySelector('[data-key]')) return;
    configurarIdade(raiz);
    configurarCep(raiz, 'cep', {
      logradouro: ['logRes'], bairro: ['bairroRes'], uf: ['ufRes'],
      localidade: ['munRes'], ibge: ['ibgeRes']
    });
    configurarCep(raiz, 'cepEmp', {
      logradouro: ['endEmp', 'endereco'], bairro: ['bairroEmp', 'bairro'],
      uf: ['ufEmp'], localidade: ['munEmp'], ibge: ['ibgeEmp']
    });
    configurarEmpresas(raiz);
    configurarBuscaEmpresa(raiz);
  }

  var agendado = null;
  function examinar() {
    clearTimeout(agendado);
    // Aguarda a montagem dos campos do formulário.
    agendado = setTimeout(function () {
      var raizes = new Set();
      document.querySelectorAll('[data-key]').forEach(function (el) { raizes.add(raizDoFormulario(el)); });
      raizes.forEach(aplicar);
    }, 80);
  }

  /* ---------- 6. link direto para agravo e perfil ---------- */

  function parametros() {
    var p = new URLSearchParams(window.location.search);
    return { agravo: p.get('agravo'), perfil: p.get('perfil'), homologacao: p.has('homologacao'), escopo: p.get('escopo') };
  }

  function repassarAoQuadro() {
    var quadro = document.getElementById('aplicacao-notificacao');
    if (!quadro) return;
    var p = parametros();
    if (!p.agravo && !p.perfil && !p.homologacao && !p.escopo) return;
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
