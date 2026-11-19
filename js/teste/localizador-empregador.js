/*
 * localizador-empregador.js — Localizador cruzado da empresa/empregador (VISAT/SMS Florianópolis)
 *
 * Qualquer dado já conhecido, em qualquer ordem, filtra os demais:
 *   CNPJ (completo ou raiz) · nome · CNAE (código da TB_CNAE do Sinan) · município · CEP · bairro · endereço · número.
 * Base: empresas já cadastradas pela VISAT (data/empresas-visat.json). Sem resultado nessa lista, a busca online do nome (cadastro online)
 * e a consulta do CNPJ (BrasilAPI/CNPJ.ws) continuam como reserva.
 * A escolha preenche o bloco e dispara a consulta do CNPJ, que confere e completa os dados (telefone, situação).
 */
(function () {
  'use strict';

  var MAX_LISTA = 12;
    var ALIAS = {
    cnpj: ['cnpj'], nome: ['empresa', 'empresaNome', 'razao'], cnae: ['cnae'],
    mun: ['munEmp'], ibge: ['ibgeEmp'], uf: ['ufEmp'], cep: ['cepEmp'],
    bairro: ['bairroEmp', 'bairro'], end: ['endEmp', 'endereco'], num: ['numEmp', 'numero'], comp: ['compEmp']
  };
  var ROTULO = { mun: 'Município', cnpj: 'CNPJ', nome: 'Nome', cnae: 'CNAE', cep: 'CEP', bairro: 'Bairro', end: 'Endereço', num: 'Número' };
  var TIPOS_LOG = /^(RUA|R|AVENIDA|AV|RODOVIA|ROD|SERVIDAO|SERV|TRAVESSA|TV|ESTRADA|EST|ALAMEDA|AL|PRACA|PC|VIA|BECO|LARGO|CAMINHO|GENERAL|DOUTOR|DR|PROFESSOR|PROF)$/;

  /* ---------- utilidades ---------- */
  function norm(t) {
    return String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  }
  function digitos(v) { return String(v || '').replace(/\D/g, ''); }
  function titulo(t) { return window.visatTitulo ? window.visatTitulo(t) : t; }
  function fmtCnpj(n) { return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'); }
  function fmtCep(n) { return n && n.length === 8 ? n.slice(0, 5) + '-' + n.slice(5) : n; }
  function cnpjValido(c) {
    if (!/^\d{14}$/.test(c) || /^(\d)\1+$/.test(c)) return false;
    function dv(base) {
      var pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      var s = 0; for (var i = 0; i < base.length; i++) s += +base[i] * pesos[i];
      var r = s % 11; return r < 2 ? 0 : 11 - r;
    }
    return dv(c.slice(0, 12)) === +c[12] && dv(c.slice(0, 13)) === +c[13];
  }
  function campo(raiz, chaves) {
    for (var i = 0; i < chaves.length; i++) {
      var el = raiz.querySelector('[data-key="' + chaves[i] + '"]');
      if (el) return el;
    }
    return null;
  }
  function el(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
  }
  function disparar(c) {
    c.dispatchEvent(new Event('input', { bubbles: true }));
    c.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function escrever(c, v) {
    if (!c) return;
    c.value = v == null ? '' : String(v);
    disparar(c);
  }

  /* ---------- atividade: palavras do dia a dia -> descrição da TB_CNAE ---------- */
  var SINONIMOS = {
    PANIF: ['PADARIA'], PADAR: ['PADARIA'], CONFEI: ['CONFEITARIA'], ACADEM: ['CONDICIONAMENTO FISICO', 'DESPORTIV', 'GINASTICA'],
    GINAS: ['DESPORTIV', 'CONDICIONAMENTO FISICO'], SUPERM: ['SUPERMERCADO', 'MERCADORIAS EM GERAL'], MERCAD: ['MERCADORIAS EM GERAL', 'MINIMERCADO', 'SUPERMERCADO'],
    CONSTRU: ['CONSTRUCAO', 'EDIFICACOES', 'OBRAS'], OBRA: ['OBRAS', 'EDIFICACOES'], HOSPIT: ['HOSPITALAR'], CLINIC: ['AMBULATORIAL', 'CLINICA'],
    RESTAU: ['RESTAURANTE'], LANCHO: ['LANCHONETE'], FARMAC: ['FARMACEUTIC'], DROGAR: ['FARMACEUTIC'], OFICIN: ['MANUTENCAO E REPARACAO'],
    MECANI: ['MANUTENCAO E REPARACAO'], POSTO: ['COMBUSTIVE'], COMBUS: ['COMBUSTIVE'], ESCOLA: ['ENSINO', 'EDUCACAO'], COLEGI: ['ENSINO'],
    CRECHE: ['CRECHE', 'EDUCACAO INFANTIL'], CONDOM: ['CONDOMINIO'], TRANSP: ['TRANSPORTE'], LIMPEZ: ['LIMPEZA'], FAXIN: ['LIMPEZA'],
    SEGURA: ['VIGILANCIA', 'SEGURANCA'], VIGIL: ['VIGILANCIA'], ACOUG: ['CARNES'], SALAO: ['CABELEIREIRO'], CABELE: ['CABELEIREIRO'],
    HOTEL: ['HOTEIS', 'ALOJAMENTO'], POUSAD: ['ALOJAMENTO', 'HOTEIS'], BANCO: ['BANCOS', 'BANCARI'], LABORA: ['LABORATORI'],
    PREFEI: ['ADMINISTRACAO PUBLICA'], ODONT: ['ODONTOLOG'], DENTIS: ['ODONTOLOG'], FRIGOR: ['ABATE', 'FRIGORIFIC'], PESCA: ['PESCA'],
    ELETRIC: ['ELETRIC'], CALL: ['TELEATENDIMENTO'], TELEMA: ['TELEATENDIMENTO'], LAVAND: ['LAVANDERIA'], GRAFIC: ['IMPRESSAO', 'GRAFIC']
  };
  var VAZIAS = { DE: 1, DA: 1, DO: 1, DAS: 1, DOS: 1, E: 1, LTDA: 1, ME: 1, EPP: 1, SA: 1, EIRELI: 1 };
  function alternativas(p) {
    var r = p.length >= 6 ? p.slice(0, 5) : p;
    var alt = [r];
    Object.keys(SINONIMOS).forEach(function (k) { if (p.indexOf(k) === 0 || (k.length >= 5 && k.indexOf(p) === 0 && p.length >= 4)) alt = alt.concat(SINONIMOS[k]); });
    return alt;
  }
  // Texto livre (ex.: "panificadora") combina com a descrição da atividade (ex.: "...PRODUTOS DE PADARIA...").
  function atividadeCombina(texto, descricao) {
    var palavras = norm(texto).split(' ').filter(function (p) { return p.length >= 3 && !VAZIAS[p]; });
    if (!palavras.length) return false;
    descricao = norm(descricao);
    return palavras.every(function (p) { return alternativas(p).some(function (a) { return descricao.indexOf(a) >= 0; }); });
  }
  window.visatAtividadeCombina = atividadeCombina;
  function classesPorTexto(texto) {
    if (!tabelaCnae) return null;
    var cods = {};
    var n = 0;
    tabelaCnae.classes.forEach(function (x) { if (atividadeCombina(texto, x[2])) { cods[x[0]] = 1; n++; } });
    return n && n <= 40 ? cods : null;
  }

  /* ---------- base: empresas já cadastradas pela VISAT (data/empresas-visat.json) ---------- */
  var baseUnica = null;
  function carregarBase() {
    if (!baseUnica) {
      baseUnica = Promise.all([
        fetch('data/empresas-visat.json?v=20261116').then(function (r) { if (!r.ok) throw new Error(); return r.json(); }),
        fetch('data/cnae-correspondencias.json?v=20261117-ibge').then(function (r) { return r.ok ? r.json() : { subclasses: {} }; })
          .catch(function () { return { subclasses: {} }; })
      ]).then(function (res) { return preparar(res[0], res[1].subclasses || {}); })
        .catch(function () { baseUnica = null; return null; });
    }
    return baseUnica;
  }
  // Registro de origem: [cnpj, fantasia, razão, -, município, UF, Matriz/Filial, CNAE, logradouro, número, complemento, bairro, CEP, divergente]
  function preparar(lista, corr) {
    // Map preserva a ordem de inserção (objeto ordenaria chaves numéricas, como os códigos CNAE).
    var cnaes = new Map(), bairros = new Map(), logs = new Map(), muns = new Map();
    function idx(d, v) { if (!d.has(v)) d.set(v, d.size); return d.get(v); }
    var regs = lista.map(function (x) {
      return [String(x[0]), x[1] && x[1] !== x[2] ? x[1] : '', x[2] || x[1] || '', idx(cnaes, String(x[7] || '')), [],
        digitos(x[12]), idx(bairros, x[11] || ''), idx(logs, x[8] || ''), x[9] || '', x[10] || '',
        /filial/i.test(x[6]) ? 2 : 1, '', idx(muns, (x[4] || '') + '|' + (x[5] || ''))];
    });
    var d = { registros: regs, cnaes: Array.from(cnaes.keys()), bairros: Array.from(bairros.keys()), logradouros: Array.from(logs.keys()),
      municipios: Array.from(muns.keys()).map(function (m) { return m.split('|'); }),
      situacoes: { A: 'Ativa', S: 'Suspensa', I: 'Inapta', B: 'Baixada', N: 'Nula' } };
    d.cnaeSinan = d.cnaes.map(function (sub) { return ((corr[sub.padStart(7, '0')] || {}).codigos) || []; });
    d.mapas = { cnaes: cnaes, bairros: bairros, logs: logs, muns: muns, idx: idx, corr: corr };
    d.porCnpj = new Map(regs.map(function (r, i) { return [r[0], i]; }));
    d.nomes = regs.map(function (r) { return norm(r[1] + ' ' + r[2]); });
    d.bairrosN = d.bairros.map(norm);
    d.logsN = d.logradouros.map(norm);
    d.munsN = d.municipios.map(function (m) { return norm(m[0]); });
    return d;
  }
  /* ---------- cadastro online: estabelecimentos (matriz e filiais) que não estão na base VISAT ---------- */
  function indiceEm(d, mapa, lista, listaN, v) {
    var m = d.mapas[mapa];
    if (!m.has(v)) { m.set(v, m.size); d[lista].push(v); if (listaN) d[listaN].push(norm(v)); }
    return m.get(v);
  }
  function indiceCnae(d, sub) {
    sub = String(sub || '');
    if (!d.mapas.cnaes.has(sub)) {
      d.mapas.cnaes.set(sub, d.mapas.cnaes.size);
      d.cnaes.push(sub);
      d.cnaeSinan.push(((d.mapas.corr[sub.padStart(7, '0')] || {}).codigos) || []);
    }
    return d.mapas.cnaes.get(sub);
  }
  function indiceMun(d, mun, uf) {
    var k = norm(mun) + '|' + String(uf || '').toUpperCase();
    if (!d.mapas.muns.has(k)) { d.mapas.muns.set(k, d.mapas.muns.size); d.municipios.push([norm(mun), String(uf || '').toUpperCase()]); d.munsN.push(norm(mun)); }
    return d.mapas.muns.get(k);
  }
  function adicionarOnline(d, item) {
    var n = digitos(item.cnpj);
    if (n.length !== 14 || d.porCnpj.has(n)) return null;
    var r = [n, norm(item.nome_fantasia || ''), norm(item.razao_social || item.nome_fantasia || ''), indiceCnae(d, ''), [], '',
      indiceEm(d, 'bairros', 'bairros', 'bairrosN', ''), indiceEm(d, 'logs', 'logradouros', 'logsN', ''), '', '', 0, '',
      indiceMun(d, item.municipio || '', item.uf || ''), 'online'];
    if (r[1] === r[2]) r[1] = '';
    d.registros.push(r);
    d.nomes.push(norm(r[1] + ' ' + r[2]));
    d.porCnpj.set(n, d.registros.length - 1);
    return r;
  }
  var detalhes = {};
  function detalharCnpj(n) {
    if (!detalhes[n]) {
      detalhes[n] = fetch('https://brasilapi.com.br/api/cnpj/v1/' + n, { credentials: 'omit', referrerPolicy: 'no-referrer' })
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .catch(function () { delete detalhes[n]; return null; });
    }
    return detalhes[n];
  }
  var SIT_ONLINE = { ATIVA: 'A', SUSPENSA: 'S', INAPTA: 'I', BAIXADA: 'B', NULA: 'N' };
  function aplicarDetalhe(d, r, x) {
    if (!x) return;
    r[1] = norm(x.nome_fantasia || '');
    r[2] = norm(x.razao_social || r[2]);
    if (r[1] === r[2]) r[1] = '';
    r[3] = indiceCnae(d, x.cnae_fiscal);
    r[4] = (x.cnaes_secundarios || []).filter(function (s) { return s && s.codigo; }).map(function (s) { return indiceCnae(d, s.codigo); });
    r[5] = digitos(x.cep);
    r[6] = indiceEm(d, 'bairros', 'bairros', 'bairrosN', norm(x.bairro || ''));
    var log = norm([x.descricao_tipo_de_logradouro, x.logradouro].filter(Boolean).join(' '));
    r[7] = indiceEm(d, 'logs', 'logradouros', 'logsN', log);
    r[8] = x.numero || '';
    r[9] = norm(x.complemento || '');
    r[10] = x.identificador_matriz_filial === 2 ? 2 : 1;
    r[11] = SIT_ONLINE[norm(x.descricao_situacao_cadastral)] || '';
    r[12] = indiceMun(d, x.municipio || '', x.uf || '');
    r[13] = 'online-ok';
    d.nomes[d.porCnpj.get(r[0])] = norm(r[1] + ' ' + r[2]);
  }

  var tabelaCnae = null;
  function descricaoCnae(cod) {
    if (!tabelaCnae) return '';
    var it = tabelaCnae.classes.find(function (x) { return x[0] === cod; });
    return it ? it[2] : '';
  }

  /* ---------- filtros a partir dos campos ---------- */
  function lerFiltros(c) {
    var f = {};
    var cnpj = digitos(c.cnpj && c.cnpj.value);
    if (cnpj.length >= 8) f.cnpj = cnpj;
    var nome = norm(c.nome && c.nome.value);
    if (nome.replace(/ /g, '').length >= 3) f.nome = nome.split(' ');
    var cnae = String(c.cnae && c.cnae.value || '').match(/^\s*(\d{2})\.?(\d{2})-?(\d)(\d{2})?/);
    if (cnae) f.cnae = cnae[4] ? cnae.slice(1, 5).join('') : cnae.slice(1, 4).join('');
    else if (norm(c.cnae && c.cnae.value).replace(/[^A-Z]/g, '').length >= 4) f.cnae = 'T:' + (c.cnae.value || '');
    var cep = digitos(c.cep && c.cep.value);
    if (cep.length >= 5) f.cep = cep;
    var bairro = norm(c.bairro && c.bairro.value);
    if (bairro.length >= 3) f.bairro = bairro;
    var end = norm(c.end && c.end.value).split(' ').filter(function (p) { return p && !TIPOS_LOG.test(p); });
    if (end.join('').length >= 3) f.end = end;
    var num = norm(c.num && c.num.value);
    if (num) f.num = num;
    var mun = norm(String(c.mun && c.mun.value || '').split('/')[0]);
    if (mun.length >= 3) f.mun = mun;
    return f;
  }
  function resumoFiltro(k, c) {
    var v = (c[k] && c[k].value || '').trim();
    if (k === 'cnae' && /^\s*\d/.test(v)) v = v.split(/\s+[–-]\s+/)[0];
    return ROTULO[k] + ': ' + (v.length > 28 ? v.slice(0, 27) + '…' : v);
  }

  function filtrar(d, f, ignorar) {
    var regs = d.registros, out = [];
    var usa = function (k) { return f[k] && k !== ignorar; };
    var bairros = null, logs = null, cnaesOk = null;
    if (usa('bairro')) bairros = d.bairrosN.map(function (b) { return b.indexOf(f.bairro) >= 0; });
    if (usa('end')) logs = d.logsN.map(function (l) { return f.end.every(function (p) { return l.indexOf(p) >= 0; }); });
    if (usa('cnae')) {
      var porTexto = f.cnae.indexOf('T:') === 0 ? classesPorTexto(f.cnae.slice(2)) : null;
      if (f.cnae.indexOf('T:') === 0 && !porTexto) cnaesOk = null; // texto ainda sem atividade reconhecida
      else cnaesOk = d.cnaes.map(function (sub, i) {
        if (porTexto) return (d.cnaeSinan[i] || []).some(function (s2) { return porTexto[s2]; });
        return f.cnae.length === 7 ? sub === f.cnae : (d.cnaeSinan[i] || []).indexOf(f.cnae) >= 0;
      });
    }
    // Nome com palavra de atividade (ex.: "panificadora") também encontra empresas por essa atividade.
    var nomeAtiv = null;
    if (usa('nome')) {
      var cl = classesPorTexto(f.nome.join(' '));
      if (cl) nomeAtiv = d.cnaes.map(function (sub, i) { return (d.cnaeSinan[i] || []).some(function (s2) { return cl[s2]; }); });
    }
    // Município e número sozinhos não bastam para listar empresas.
    if (!Object.keys(f).some(function (k) { return k !== 'num' && k !== 'mun' && k !== ignorar; })) return [];
    var munsOk = usa('mun') ? d.munsN.map(function (m) { return m === f.mun || f.mun.indexOf(m) === 0; }) : null;
    for (var i = 0; i < regs.length; i++) {
      var r = regs[i];
      if (munsOk && !munsOk[r[12]]) continue;
      if (usa('cnpj') && r[0].indexOf(f.cnpj) !== 0) continue;
      if (usa('cep') && r[5].indexOf(f.cep) !== 0) continue;
      if (bairros && !bairros[r[6]]) continue;
      if (logs && !logs[r[7]]) continue;
      if (usa('num') && norm(r[8]) !== f.num) continue;
      var sec = false;
      if (cnaesOk && !cnaesOk[r[3]]) {
        sec = r[4].some(function (s) { return cnaesOk[s]; });
        if (!sec) continue;
      }
      var pont = 1;
      if (usa('nome')) {
        var n = d.nomes[i];
        var alvo = f.nome.join(' ');
        if (f.nome.every(function (p) { return n.indexOf(p) >= 0; })) {
          pont = (norm(r[1]) === alvo || norm(r[2]) === alvo) ? 4 : (norm(r[1]).indexOf(alvo) === 0 || norm(r[2]).indexOf(alvo) === 0) ? 3 : 2;
        } else if (nomeAtiv && (nomeAtiv[r[3]] || r[4].some(function (s2) { return nomeAtiv[s2]; }))) {
          pont = 1; // encontrada pela atividade
        } else continue;
      }
      if (sec) pont -= 0.25;
      out.push({ i: i, p: pont, sec: sec, ativ: pont === 1 && usa('nome') });
    }
    out.sort(function (a, b) { return b.p - a.p; });
    return out;
  }

  /* ---------- painel ---------- */
  function configurar(raiz) {
    var c = {};
    Object.keys(ALIAS).forEach(function (k) { c[k] = campo(raiz, ALIAS[k]); });
    if (!c.cnpj || !c.mun || c.cnpj.dataset.visatLocalizador) return;
    c.cnpj.dataset.visatLocalizador = '1';

    var caixaCnpj = c.cnpj.closest('section.visat-r > *') || c.cnpj.parentElement;
    var painel = el('div', 'visat-loc-host');
    painel.style.setProperty('grid-column', '1 / -1', 'important');
    var box = el('div', 'visat-loc');
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Localizar empresa');
    var topo = el('div', 'visat-loc-topo');
    var tit = el('strong', 'visat-loc-titulo', 'Localizar empresa');
    var dica = el('span', 'visat-loc-dica', 'Preencha o que souber, em qualquer ordem (nome, município do local de trabalho, bairro, CNAE, CEP, rua ou CNPJ): os campos se completam e reduzem as opções uns dos outros. O CNPJ deve ser o da unidade onde a pessoa trabalha.');
    topo.append(tit, dica);
    var status = el('p', 'visat-loc-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    var filtrosEl = el('div', 'visat-loc-filtros');
    var facetas = el('div', 'visat-loc-facetas');
    var lista = el('ul', 'visat-loc-lista');
    lista.setAttribute('aria-label', 'Empresas encontradas');
    var mais = el('button', 'visat-loc-mais', 'Mostrar mais');
    mais.type = 'button';
    mais.hidden = true;
    var fonte = el('p', 'visat-loc-fonte');
    var online = el('p', 'visat-loc-fonte');
    online.setAttribute('aria-live', 'polite');
    box.append(topo, filtrosEl, status, facetas, lista, mais, online, fonte);
    painel.append(box);
    caixaCnpj.before(painel);

    var base = null, escolhido = null, limite = MAX_LISTA, espera = null, aplicando = false;

    function garantirBase() {
      if (base) return Promise.resolve(base);
      var carga = window.visatCarregarCnae ? window.visatCarregarCnae().then(function (t) { tabelaCnae = t; }).catch(function () {}) : Promise.resolve();
      return Promise.all([carregarBase(), carga]).then(function (res) {
        base = res[0];
        fonte.textContent = base ? 'Empresas já cadastradas pela VISAT (' + base.registros.length.toLocaleString('pt-BR') +
          '). Sem resultado aqui, valem a lista online do nome e a consulta automática do CNPJ.' : '';
        return base;
      });
    }

    function limparLista() { lista.replaceChildren(); facetas.replaceChildren(); filtrosEl.replaceChildren(); mais.hidden = true; }

    function marcarAntigaLista(temLocal) {
      // Com resultado na base local, a lista antiga do nome fica oculta; sem resultado, ela mostra o cadastro online.
      raiz.classList.toggle('visat-loc-com-resultados', !!temLocal);
    }

    function atualizar() {
      if (aplicando) return;
      clearTimeout(espera);
      espera = setTimeout(executar, 180);
    }

    function executar() {
      var f = lerFiltros(c);
      var chaves = Object.keys(f);
      if (escolhido && digitos(c.cnpj.value) === escolhido) { mostrarEscolhido(); return; }
      escolhido = null;
      if (!chaves.length) { limparLista(); status.textContent = ''; marcarAntigaLista(false); box.classList.remove('ativo'); return; }
      box.classList.add('ativo');
      garantirBase().then(function (d) {
        limparLista();
        chaves.forEach(function (k) {
          var chip = el('button', 'visat-loc-chip', resumoFiltro(k, c));
          chip.type = 'button';
          chip.title = 'Remover este filtro';
          chip.setAttribute('aria-label', 'Remover filtro ' + ROTULO[k]);
          chip.addEventListener('click', function () { escrever(c[k], ''); c[k].focus(); });
          filtrosEl.append(chip);
        });
        if (!d) {
          marcarAntigaLista(false);
          status.textContent = 'Lista de empresas indisponível agora. Use o CNPJ (consulta automática) ou o nome (cadastro online).';
          return;
        }
        var res = filtrar(d, f);
        marcarAntigaLista(res.length > 0);
        if (!res.length) { semResultado(d, f, chaves); return; }
        status.textContent = res.length === 1 ? '1 empresa encontrada. Confira e selecione.' :
          res.length.toLocaleString('pt-BR') + ' empresas compatíveis. Acrescente outro dado ou escolha uma opção.';
        if (res.length > 1) montarFacetas(d, res, f);
        desenhar(d, res, f);
      }).then(function () { buscarOnline(lerFiltros(c)); });
    }

    // Nome digitado: busca também no cadastro online (matriz e filiais), no município do local de trabalho quando informado,
    // e detalha os primeiros CNPJs (bairro, endereço, CNAE, situação) para que os demais filtros valham para eles.
    var ultimaOnline = '', esperaOnline = null, rodada = 0;
    function buscarOnline(f) {
      if (!base || !f.nome) return;
      var termo = (c.nome.value || '').trim();
      var munTxt = String(c.mun && c.mun.value || '').split('/')[0].trim();
      var uf = String(c.uf && c.uf.value || '').trim();
      var chave = norm(termo) + '|' + norm(munTxt) + '|' + uf;
      if (chave === ultimaOnline) return;
      clearTimeout(esperaOnline);
      esperaOnline = setTimeout(function () {
        ultimaOnline = chave;
        var minha = ++rodada;
        var cidade = munTxt ? munTxt.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
        var url = 'https://fichario.app/api/v1/busca?q=' + encodeURIComponent(termo) +
          (uf ? '&uf=' + encodeURIComponent(uf.toUpperCase()) : '') + (cidade ? '&cidade=' + encodeURIComponent(cidade) : '');
        online.textContent = 'Buscando também no cadastro online…';
        fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' })
          .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
          .then(function (dados) {
            if (minha !== rodada) return;
            var novos = [];
            (Array.isArray(dados.resultados) ? dados.resultados : []).forEach(function (item) {
              var n = digitos(item.cnpj);
              var r = adicionarOnline(base, item);
              if (r) novos.push(r);
              else if (base.porCnpj.has(n)) { var ex = base.registros[base.porCnpj.get(n)]; if (ex[13] === 'online') novos.push(ex); }
            });
            online.textContent = novos.length ? 'Cadastro online: ' + novos.length + ' estabelecimento(s) acrescentado(s); conferindo endereço e atividade…' :
              'Cadastro online consultado.';
            executar();
            var fila = novos.slice(0, 10);
            (function proximo() {
              if (minha !== rodada || !fila.length) {
                if (minha === rodada) { online.textContent = novos.length ? 'Cadastro online incluído (selo "Cadastro online").' : ''; executar(); }
                return;
              }
              var r = fila.shift();
              detalharCnpj(r[0]).then(function (x) { aplicarDetalhe(base, r, x); if (minha === rodada) executar(); proximo(); });
            })();
          })
          .catch(function () { if (minha === rodada) { ultimaOnline = ''; online.textContent = 'Cadastro online indisponível agora; a base VISAT continua valendo.'; } });
      }, 500);
    }

    function semResultado(d, f, chaves) {
      var txt = 'Nenhuma empresa cadastrada com todos esses dados.' +
        (f.nome ? ' Sugestões do cadastro online aparecem abaixo do nome.' : ' Com o CNPJ completo, a consulta online é automática.');
      if (chaves.length > 1) {
        var alternativas = chaves.map(function (k) { return [k, filtrar(d, f, k).length]; }).filter(function (x) { return x[1] > 0; });
        if (alternativas.length) {
          txt += ' Algum dado pode estar diferente no cadastro; veja quantas aparecem sem ele:';
          alternativas.forEach(function (x) {
            var b = el('button', 'visat-loc-faceta', 'Sem ' + ROTULO[x[0]].toLowerCase() + ': ' + x[1].toLocaleString('pt-BR'));
            b.type = 'button';
            b.addEventListener('click', function () { escrever(c[x[0]], ''); });
            facetas.append(b);
          });
        }
      }
      status.textContent = txt;
    }

    function montarFacetas(d, res, f) {
      function grupo(rotulo, contagem, aplicar) {
        var itens = Object.keys(contagem).map(function (k) { return [k, contagem[k]]; })
          .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
        if (itens.length < 2) return;
        var g = el('div', 'visat-loc-grupo');
        g.append(el('span', 'visat-loc-grupo-rotulo', rotulo));
        itens.forEach(function (it) {
          var b = el('button', 'visat-loc-faceta');
          b.type = 'button';
          var t = aplicar.rotulo(it[0]);
          b.textContent = (t.length > 46 ? t.slice(0, 45) + '…' : t) + ' (' + it[1].toLocaleString('pt-BR') + ')';
          b.title = t;
          b.addEventListener('click', function () { aplicar.usar(it[0]); });
          g.append(b);
        });
        facetas.append(g);
      }
      if (!f.cnae || f.cnae.indexOf('T:') === 0) {
        var cn = {};
        res.forEach(function (x) { (d.cnaeSinan[d.registros[x.i][3]] || []).forEach(function (s) { cn[s] = (cn[s] || 0) + 1; }); });
        grupo('Atividade (CNAE):', cn, {
          rotulo: function (k) { var ds = descricaoCnae(k); return k + (ds ? ' – ' + titulo(ds) : ''); },
          usar: function (k) { var ds = descricaoCnae(k); escrever(c.cnae, ds ? k + ' – ' + ds : k); }
        });
      }
      if (!f.mun && c.mun) {
        var mu = {};
        res.forEach(function (x) { var m = d.municipios[d.registros[x.i][12]]; if (m && m[0]) { var k = m[0] + '|' + m[1]; mu[k] = (mu[k] || 0) + 1; } });
        grupo('Município do local de trabalho:', mu, {
          rotulo: function (k) { var p = k.split('|'); return titulo(p[0]) + '/' + p[1]; },
          usar: function (k) { var p = k.split('|'); if (c.ibge) escrever(c.ibge, ''); if (c.uf) escrever(c.uf, p[1]); escrever(c.mun, titulo(p[0])); }
        });
      }
      if (!f.bairro && c.bairro) {
        var ba = {};
        res.forEach(function (x) { var b = d.bairros[d.registros[x.i][6]]; if (b) ba[b] = (ba[b] || 0) + 1; });
        grupo('Bairro:', ba, { rotulo: function (k) { return titulo(k); }, usar: function (k) { escrever(c.bairro, titulo(k)); } });
      }
    }

    function selos(d, r, x) {
      var s = [];
      if (r[11]) s.push([d.situacoes[r[11]] || r[11], r[11] === 'A' ? 'ok' : 'alerta']);
      if (r[10]) s.push([r[10] === 1 ? 'Matriz' : 'Filial', '']);
      if (x.sec) s.push(['CNAE secundário', 'alerta']);
      if (x.ativ) s.push(['Pela atividade', '']);
      if (r[13]) s.push(['Cadastro online', '']);
      if (!cnpjValido(r[0])) s.push(['CNPJ a conferir', 'alerta']);
      return s;
    }

    function desenhar(d, res) {
      res.slice(0, limite).forEach(function (x) {
        var r = d.registros[x.i];
        var li = el('li');
        var b = el('button', 'visat-loc-item');
        b.type = 'button';
        var nome = el('span', 'visat-loc-nome', titulo(r[1] || r[2]));
        var linha2 = el('span', 'visat-loc-linha', [r[1] && r[2] ? titulo(r[2]) : '', fmtCnpj(r[0])].filter(Boolean).join(' · '));
        var subs = d.cnaeSinan[r[3]] || [];
        var cnaeTxt = subs.length === 1 ? subs[0] + ' – ' + titulo(descricaoCnae(subs[0])) : d.cnaes[r[3]] ? 'CNAE ' + d.cnaes[r[3]] : '';
        var m = d.municipios[r[12]] || [];
        var end = [titulo(d.logradouros[r[7]]), r[8], r[9] && titulo(r[9]), titulo(d.bairros[r[6]]),
          m[0] ? titulo(m[0]) + '/' + m[1] : '', fmtCep(r[5])].filter(Boolean).join(', ');
        var linha3 = el('span', 'visat-loc-linha', [cnaeTxt, end || (r[13] === 'online' ? 'conferindo endereço…' : '')].filter(Boolean).join(' · '));
        var sel = el('span', 'visat-loc-selos');
        selos(d, r, x).forEach(function (s) { sel.append(el('span', 'visat-loc-selo ' + s[1], s[0])); });
        b.append(nome, sel, linha2, linha3);
        b.addEventListener('click', function () { selecionar(d, r); });
        li.append(b);
        lista.append(li);
      });
      mais.hidden = res.length <= limite;
      mais.textContent = 'Mostrar mais (' + Math.min(MAX_LISTA, res.length - limite) + ' de ' + (res.length - limite).toLocaleString('pt-BR') + ' restantes)';
    }

    function selecionar(d, r) {
      aplicando = true;
      try {
        c.cnpj.dispatchEvent(new Event('visat:trocar-empresa'));
        if (c.cep) c.cep.dispatchEvent(new Event('visat:trocar-empresa'));
        var subs = d.cnaeSinan[r[3]] || [];
        escrever(c.nome, titulo(r[1] || r[2]));
        if (c.cnae) escrever(c.cnae, subs.length === 1 ? subs[0] + ' – ' + descricaoCnae(subs[0]) : '');
        escrever(c.cep, fmtCep(r[5]));
        escrever(c.bairro, titulo(d.bairros[r[6]]));
        escrever(c.end, titulo(d.logradouros[r[7]]));
        escrever(c.num, r[8]);
        if (c.comp) escrever(c.comp, titulo(r[9]));
        var m = d.municipios[r[12]] || [];
        if (m[0] && !(c.mun && c.mun.value.trim())) {
          if (c.ibge) escrever(c.ibge, '');
          if (c.uf) escrever(c.uf, m[1]);
          if (c.mun) escrever(c.mun, titulo(m[0]));
        }
        escolhido = r[0];
        // Por último o CNPJ: a consulta online confere e completa (telefone, situação, CNAE no código do Sinan).
        escrever(c.cnpj, fmtCnpj(r[0]));
      } finally {
        aplicando = false;
      }
      mostrarEscolhido(d, r);
      c.cnpj.focus();
    }

    function mostrarEscolhido(d, r) {
      d = d || base;
      if (!r && d) r = d.registros.find(function (x) { return x[0] === escolhido; });
      limparLista();
      marcarAntigaLista(true);
      if (!r) { status.textContent = 'Empresa selecionada. Confira os dados.'; return; }
      var avisos = [];
      if (r[11] && r[11] !== 'A') avisos.push('situação cadastral ' + (d.situacoes[r[11]] || r[11]).toLowerCase() + ' na Receita');
      var mr = d.municipios[r[12]] || [];
      var munInf = norm(String(c.mun && c.mun.value || '').split('/')[0]);
      if (mr[0] && munInf && munInf.indexOf(norm(mr[0])) !== 0)
        avisos.push('este CNPJ é de ' + titulo(mr[0]) + '/' + mr[1] + ', diferente do município do local de trabalho; escolha a unidade (filial) onde a pessoa trabalha');
      if (r[10] === 2) avisos.push('filial: confirme se é o estabelecimento onde a pessoa trabalha');
      if ((d.cnaeSinan[r[3]] || []).length > 1) avisos.push('o CNAE tem mais de uma correspondência no Sinan: escolha a atividade');
      status.textContent = 'Selecionada: ' + titulo(r[1] || r[2]) + ' (' + fmtCnpj(r[0]) + '). ' +
        (avisos.length ? 'Atenção: ' + avisos.join('; ') + '. ' : '') + 'A consulta do CNPJ completa telefone e confere os dados.';
      var trocar = el('button', 'visat-loc-faceta', 'Escolher outra empresa');
      trocar.type = 'button';
      trocar.addEventListener('click', function () {
        escolhido = null;
        ['cnpj', 'nome', 'cep', 'bairro', 'end', 'num', 'comp'].forEach(function (k) { if (c[k]) escrever(c[k], ''); });
        c.cnpj.dispatchEvent(new Event('visat:trocar-empresa'));
        c.nome.focus();
      });
      facetas.append(trocar);
    }

    // Lista do CNAE restrita pelos demais dados (lógica conjunta de preenchimento).
    if (c.cnae) contextos.set(c.cnae, function () {
      var f = lerFiltros(c);
      delete f.cnae;
      if (!Object.keys(f).some(function (k) { return k !== 'num' && k !== 'mun'; })) return null;
      return garantirBase().then(function (d) {
        if (!d) return null;
        var contagem = {}, total = 0;
        filtrar(d, f).forEach(function (x) {
          total++;
          var r = d.registros[x.i];
          [r[3]].concat(r[4]).forEach(function (ci) { (d.cnaeSinan[ci] || []).forEach(function (s) { contagem[s] = (contagem[s] || 0) + 1; }); });
        });
        return { total: total, contagem: contagem, rotulo: Object.keys(f).map(function (k) { return ROTULO[k].toLowerCase(); }).join(', ') };
      });
    });

    mais.addEventListener('click', function () { limite += MAX_LISTA; executar(); });
    ['cnpj', 'nome', 'cnae', 'mun', 'cep', 'bairro', 'end', 'num'].forEach(function (k) {
      if (!c[k]) return;
      c[k].addEventListener('input', atualizar);
      c[k].addEventListener('change', atualizar);
    });
    // Carrega a base ao primeiro foco no bloco, antes da digitação.
    painel.parentElement.addEventListener('focusin', function primeiro() {
      painel.parentElement.removeEventListener('focusin', primeiro);
      garantirBase();
    });
    ['nome', 'cnae', 'cep', 'bairro', 'end'].forEach(function (k) { if (c[k]) c[k].addEventListener('input', function () { limite = MAX_LISTA; }); });
  }

  var contextos = new WeakMap();
  window.visatCnaesCompativeis = function (input) {
    var fn = contextos.get(input);
    return fn ? fn() : null;
  };

  /* ---------- montagem ---------- */
  var agendado = null;
  function examinar() {
    clearTimeout(agendado);
    agendado = setTimeout(function () {
      document.querySelectorAll('[data-key="cnpj"]:not([data-visat-localizador])').forEach(function (cnpj) {
        var raiz = cnpj.closest('.acidente-inline, form, [class*="inline"]') || cnpj.closest('.screen') || document;
        if (raiz.querySelector('[data-key="munEmp"]')) configurar(raiz);
      });
    }, 400);
  }
  function iniciar() {
    new MutationObserver(examinar).observe(document.body, { childList: true, subtree: true });
    examinar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
