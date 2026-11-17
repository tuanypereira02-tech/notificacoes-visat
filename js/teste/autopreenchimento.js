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

  // Correspondências oficiais por subclasse, com revisão dos casos ambíguos.
  var correspondenciasCnae = null;
  var consultaCorrespondencias = null;
  function carregarCorrespondencias() {
    if (!consultaCorrespondencias) {
      consultaCorrespondencias = fetch('data/cnae-correspondencias.json?v=20261117-ibge')
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (t) { correspondenciasCnae = t.subclasses; return t; })
        .catch(function (erro) { consultaCorrespondencias = null; throw erro; });
    }
    return consultaCorrespondencias;
  }

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

  function correspondenciaCnae(subclasse) {
    var texto = String(subclasse == null ? '' : subclasse).trim();
    if (!/^[0-9./-]+$/.test(texto)) return null;
    var numero = texto.replace(/\D/g, '');
    if (!/^\d{6,7}$/.test(numero) || !tabelaCnae || !correspondenciasCnae) return null;
    return correspondenciasCnae[numero.padStart(7, '0')] || null;
  }

  function candidatosCnae(subclasse) {
    var registro = correspondenciaCnae(subclasse);
    return registro ? registro.codigos.filter(function (codigo) {
      return tabelaCnae.classes.some(function (item) { return item[0] === codigo; });
    }) : [];
  }

  function cnaeSinan(subclasse) {
    var registro = correspondenciaCnae(subclasse);
    var candidatos = candidatosCnae(subclasse);
    return registro && registro.automatico && candidatos.length === 1 ? candidatos[0] : '';
  }

  window.visatCnaeLegado = function (codigo) {
    return !!tabelaCnae && tabelaCnae.classes.some(function (item) { return item[0] === codigo; });
  };

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
    ajuda.textContent = 'Sem CEP? Preencha o endereço e escolha na lista.';
    // Explicação só para leitores de tela: a lista de CEPs aparece sozinha.
    ajuda.setAttribute('data-visat-oculto', '');
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
    ajuda.after(resultados);

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

    cep.addEventListener('visat:trocar-empresa', function () {
      consulta++;
      ultimoCep = '';
      preenchidosPeloCep.clear();
      editados.clear();
      fecharResultados();
      aviso(cep, '');
    });

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
        ? 'CEP localizado. Dados digitados mantidos; endereço do CEP: ' +
          [endereco.logradouro, endereco.bairro, [endereco.localidade, endereco.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ') + '.'
        : 'CEP localizado.');
    }

    async function pesquisarEndereco() {
      fecharResultados();
      const dados = enderecoInformado();
      const [uf, municipio, logradouro, bairro] = dados;
      if (!/^[A-Z]{2}$/.test(uf) || municipio.length < 3 || logradouro.length < 3) {
        aviso(cep, 'Informe UF, município e logradouro.', true);
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
          aviso(cep, 'Nenhum CEP para este endereço.', true);
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
        aviso(cep, 'Escolha o CEP na lista.');
        const lista = document.createElement('ul');
        for (const endereco of opcoes.values()) {
          const item = document.createElement('li');
          const botao = document.createElement('button');
          botao.type = 'button';
          botao.className = 'btn';
          botao.dataset.variant = 'outline';
          botao.textContent = [endereco.cep, titulo(endereco.logradouro), titulo(endereco.bairro), titulo(endereco.complemento)].filter(Boolean).join(' · ');
          botao.addEventListener('click', () => selecionar(endereco));
          item.append(botao);
          lista.append(item);
        }
        resultados.append(lista);
        resultados.hidden = false;
      } catch {
        if (atual === consultaEndereco && cep.isConnected) {
          aviso(cep, 'Consulta indisponível. Digite o CEP.', true);
        }
      }
    }

    buscarEndereco.addEventListener('click', pesquisarEndereco);

    // Busca automática do CEP pelo endereço: dispara ao chegar ao CEP vazio ou ao alterar o endereço.
    let ultimaBuscaAutomatica = '';
    let esperaAutomatica;
    function buscarCepAutomatico() {
      clearTimeout(esperaAutomatica);
      esperaAutomatica = setTimeout(() => {
        if (!cep.isConnected || digitos(cep.value).length) return;
        const [uf, municipio, logradouro, bairro] = enderecoInformado();
        if (!/^[A-Z]{2}$/.test(uf) || municipio.length < 3 || logradouro.length < 3) return;
        const chave = [uf, municipio, logradouro, bairro].join('|');
        if (chave === ultimaBuscaAutomatica && !resultados.hidden) return;
        ultimaBuscaAutomatica = chave;
        pesquisarEndereco();
      }, 350);
    }
    cep.addEventListener('focus', buscarCepAutomatico);
    for (const el of Object.values(dadosEndereco).filter(Boolean)) {
      el.addEventListener('change', evento => { if (evento.isTrusted || evento.detail === 'visat') buscarCepAutomatico(); });
    }

    // Sugestões de rua ao digitar o logradouro (ViaCEP): escolher preenche rua, bairro e CEP.
    const campoRua = dadosEndereco.logradouro;
    if (campoRua) {
      // O logradouro usa a busca do VISAT, sem sugestões de endereços salvos.
      campoRua.type = 'search';
      campoRua.setAttribute('autocomplete', 'off');
      const sugestoes = document.createElement('ul');
      sugestoes.className = 'empresa-resultados visat-ruas-resultados';
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
              botao.textContent = [titulo(endereco.logradouro), titulo(endereco.bairro), titulo(endereco.complemento), endereco.cep].filter(Boolean).join(' · ');
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
      cep.addEventListener('visat:trocar-empresa', fecharRuas);
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
          aviso(cep, 'CEP não encontrado.', true);
          return;
        }
        aplicarEndereco(endereco);
      } catch {
        if (atual !== consulta || !cep.isConnected || digitos(cep.value) !== numero) return;
        ultimoCep = '';
        aviso(cep, 'Consulta indisponível. Preencha o endereço.', true);
      }
    }

    cep.addEventListener('input', evento => {
      if (evento.isTrusted || !cep.value) buscar();
    });
    cep.addEventListener('change', evento => { if (evento.isTrusted) buscar(); });
  }

  /* ---------- 5. CNPJ (BrasilAPI) ---------- */

  function titulo(t) {
    var texto = String(t || '').trim().replace(/\s+/g, ' ');
    if (!texto || /\p{Ll}/u.test(texto)) return texto;
    var conectivos = new Set(['a', 'as', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos', 'ou', 'para', 'por', 'com']);
    var siglas = new Set('CS UBS USF ESF UPA CAPS CEO CNES SUS CRAS CREAS SESC SESI SENAI SENAC SAMU CIATOX HEMOSC HU UFSC UDESC IFSC SMS PMF LTDA ME EPP EIRELI CNAE CBO CID LDRT HIV AIDS COVID DORT LER ECG DNA RNA UTI SC'.split(' '));
    return texto.replace(/\p{L}+(?:\d+\p{L}*)?/gu, function (palavra, posicao) {
      if (siglas.has(palavra) || /\d|^[IVXLCDM]{2,4}$/.test(palavra)) return palavra;
      var inferior = palavra.toLocaleLowerCase('pt-BR');
      return posicao > 0 && conectivos.has(inferior) ? inferior :
        inferior.charAt(0).toLocaleUpperCase('pt-BR') + inferior.slice(1);
    });
  }
  window.visatTitulo = titulo;

  /* Consulta a BrasilAPI e, se falhar (limite de uso ou indisponibilidade), a CNPJ.ws.
     Devolve sempre o mesmo formato. */
  function consultarCnpj(n) {
    return fetch('https://brasilapi.com.br/api/cnpj/v1/' + n)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        return {
          nome: d.razao_social, cnae: d.cnae_fiscal, cnaeDescricao: d.cnae_fiscal_descricao, secundarios: d.cnaes_secundarios, cep: d.cep,
          uf: d.uf, municipio: d.municipio, ibge: d.codigo_municipio_ibge, bairro: d.bairro,
          tipoLogradouro: d.descricao_tipo_de_logradouro, logradouro: d.logradouro, numero: d.numero, complemento: d.complemento,
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
              tipoLogradouro: e.tipo_logradouro, logradouro: e.logradouro, numero: e.numero, complemento: e.complemento,
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
      if (codigo && cadastrados.some(function (x) { return candidatosCnae(x).length > 0; }) && !cadastrados.some(function (x) {
        return candidatosCnae(x).includes(codigo.slice(1).join(''));
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
    var opcoesCnae = null;
    function removerOpcoes() {
      if (opcoesCnae) opcoesCnae.remove();
      opcoesCnae = null;
    }
    function preencher(chaves, valor) {
      var destino = campo(raiz, chaves);
      if (definir(destino, valor)) preenchidos.set(destino, destino.value);
    }
    // A seleção explícita de outra empresa invalida consultas e dados anteriores.
    el.addEventListener('visat:trocar-empresa', function () {
      consulta++;
      removerOpcoes();
      empresasConsultadas.delete(el);
      delete el.dataset.ultimoCnpj;
      preenchidos.clear();
      aviso(el, '');
    });
    el.addEventListener('input', function () {
      var n = digitos(el.value);
      if (n === el.dataset.ultimoCnpj) return;
      consulta++;
      removerOpcoes();
      empresasConsultadas.delete(el);
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
      Promise.all([consultarCnpj(n), window.visatCarregarCnae().catch(function () { return null; }), carregarCorrespondencias().catch(function () { return null; })])
        .then(function (respostas) {
          if (!el.isConnected || atual !== consulta || digitos(el.value) !== n) return;
          var d = respostas[0];
          empresasConsultadas.set(el, { cnpj: n, dados: d, destino: destino });
          var codSinan = cnaeSinan(d.cnae);
          var atividade = codSinan && tabelaCnae.classes.find(function (item) { return item[0] === codSinan; });
          var cnae = atividade ? atividade[0] + ' – ' + atividade[2] : '';
          var logradouro = [d.tipoLogradouro, d.logradouro].filter(Boolean).join(' ');
          var mun = ibgeSinan(d.ibge) === PADRAO.ibge ? PADRAO.municipio : titulo(d.municipio);
          if (destino.nome) preencher(destino.nome, titulo(d.nome));
          if (destino.cnae) preencher(destino.cnae, cnae);
          if (destino.uf) preencher(destino.uf, d.uf);
          if (destino.municipio) preencher(destino.municipio, mun);
          if (destino.ibge) preencher(destino.ibge, ibgeSinan(d.ibge));
          if (destino.bairro) preencher(destino.bairro, titulo(d.bairro));
          if (destino.endereco) preencher(destino.endereco, titulo(logradouro));
          if (destino.numero) preencher(destino.numero, d.numero);
          if (destino.complemento) preencher(destino.complemento, d.complemento);
          if (destino.telefone) preencher(destino.telefone, d.telefone);
          if (destino.cep) preencher(destino.cep, d.cep);
          var mensagem = 'Confira os dados da empresa preenchidos.';
          if (destino.cnae) {
            var registro = correspondenciaCnae(d.cnae);
            var candidatos = candidatosCnae(d.cnae);
            mensagem = cnae ? 'Confira o CNAE.' :
              'Escolha o CNAE na lista.';
            removerOpcoes();
            if (!cnae && candidatos.length) {
              var campoCnae = campo(raiz, destino.cnae);
              if (campoCnae) {
                opcoesCnae = document.createElement('div');
                opcoesCnae.className = 'visat-lista-apoio';
                opcoesCnae.setAttribute('role', 'group');
                opcoesCnae.setAttribute('aria-label', 'Correspondências CNAE para conferir');
                var explicacao = document.createElement('p');
                explicacao.className = 'field-help';
                explicacao.textContent = 'Escolha a atividade:';
                opcoesCnae.appendChild(explicacao);
                candidatos.forEach(function (codigo) {
                  var item = tabelaCnae.classes.find(function (x) { return x[0] === codigo; });
                  var botao = document.createElement('button');
                  botao.type = 'button';
                  botao.className = 'btn';
                  botao.textContent = item[0] + ' – ' + item[2];
                  botao.addEventListener('click', function () {
                    if (atual !== consulta || digitos(el.value) !== n) return;
                    definir(campoCnae, item[0] + ' – ' + item[2], true);
                    preenchidos.set(campoCnae, campoCnae.value);
                    removerOpcoes();
                    campoCnae.focus();
                    aviso(el, 'Atividade selecionada.');
                  });
                  opcoesCnae.appendChild(botao);
                });
                campoCnae.after(opcoesCnae);
              }
            }
            if (registro && registro.ausentes.length) {
              mensagem += ' Há correspondência oficial ausente da tabela fornecida. Não foi substituída por outro código.';
            }
          }
          aviso(el, mensagem);
        })
        .catch(function () {
          if (!el.isConnected || atual !== consulta || digitos(el.value) !== n) return;
          delete el.dataset.ultimoCnpj;
          aviso(el, 'CNPJ não encontrado. Preencha manualmente.', true);
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
      complemento: ['compEmp'],
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
    // Ordem do SINAN: CNPJ (35) antes do nome da empresa (36). A busca funciona pelos dois campos.
    var ajuda = document.createElement('p');
    ajuda.className = 'field-help';
    ajuda.textContent = 'Digite o nome e escolha na lista.';
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
      compEmp: campo(raiz, ['compEmp']), cepEmp: campo(raiz, ['cepEmp']),
      ibgeEmp: campo(raiz, ['ibgeEmp']), cnae: campo(raiz, ['cnae']),
      telEmp: campo(raiz, ['telEmp', 'telefone']), refEmp: campo(raiz, ['refEmp'])
    };
    var consultaAtual = 0;
    var espera;
    var aplicando = false;

    function ocultar() { resultados.replaceChildren(); resultados.hidden = true; }
    function cancelar() { consultaAtual++; clearTimeout(espera); }
    function filtroDe(el) { return el && el.value.trim() ? normalizarNome(el.value) : ''; }

    function selecionar(empresa) {
      cancelar();
      aplicando = true;
      try {
        cnpj.dispatchEvent(new Event('visat:trocar-empresa'));
        if (enderecoEmpresa.cepEmp) enderecoEmpresa.cepEmp.dispatchEvent(new Event('visat:trocar-empresa'));
        Object.keys(enderecoEmpresa).forEach(function (chave) { limparCampo(enderecoEmpresa[chave]); });
        nome.value = titulo(empresa.nome);
        nome.dispatchEvent(new Event('input', { bubbles: true }));
        // Preenche a seleção e consulta o CNPJ para completar os dados disponíveis.
        Object.keys(enderecoEmpresa).forEach(function (chave) { definir(enderecoEmpresa[chave], empresa[chave], true); });
        cnpj.value = empresa.cnpj;
        cnpj.dispatchEvent(new Event('input', { bubbles: true }));
        cnpj.dispatchEvent(new Event('change', { bubbles: true }));
      } finally {
        aplicando = false;
      }
      ocultar();
      retorno.textContent = 'Empresa selecionada. Confira os dados.' +
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
        b.textContent = [titulo(empresa.nome), local, empresa.tipo, empresa.cnpjFormatado, empresa.divergente ? 'Conferir município' : ''].filter(Boolean).join(' · ');
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
      if (busca.length < 3) return;
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


