/*
 * localizador-empregador.js — Localizador cruzado da empresa/empregador (VISAT/SMS Florianópolis)
 *
 * Qualquer dado já conhecido, em qualquer ordem, filtra os demais:
 *   CNPJ (completo ou raiz) · nome · CNAE (código da TB_CNAE do Sinan) · município · CEP · bairro · endereço · número.
 * Base: data/empresas-locais/{ibge}.json, gerada dos dados abertos do CNPJ (Receita Federal) por
 * scripts/gerar-base-empresas.py. Sem resultado na base local, a busca online do nome (cadastro online)
 * e a consulta do CNPJ (BrasilAPI/CNPJ.ws) continuam como reserva.
 * A escolha preenche o bloco e dispara a consulta do CNPJ, que confere e completa os dados (telefone, situação).
 */
(function () {
  'use strict';

  var MAX_LISTA = 12;
  var PADRAO_IBGE = '420540'; // Florianópolis
  var ALIAS = {
    cnpj: ['cnpj'], nome: ['empresa', 'empresaNome', 'razao'], cnae: ['cnae'],
    mun: ['munEmp'], ibge: ['ibgeEmp'], uf: ['ufEmp'], cep: ['cepEmp'],
    bairro: ['bairroEmp', 'bairro'], end: ['endEmp', 'endereco'], num: ['numEmp', 'numero'], comp: ['compEmp']
  };
  var ROTULO = { cnpj: 'CNPJ', nome: 'Nome', cnae: 'CNAE', cep: 'CEP', bairro: 'Bairro', end: 'Endereço', num: 'Número' };
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

  /* ---------- bases ---------- */
  var indice = null;
  function carregarIndice() {
    if (!indice) {
      indice = fetch('data/empresas-locais/indice.json', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .catch(function () { indice = null; return { municipios: [] }; });
    }
    return indice;
  }
  var bases = {};
  function carregarBase(ibge) {
    if (!bases[ibge]) {
      bases[ibge] = carregarIndice().then(function (ind) {
        var info = (ind.municipios || []).find(function (m) { return m.ibge === ibge; });
        if (!info) return null;
        return fetch('data/empresas-locais/' + ibge + '.json?ref=' + encodeURIComponent(ind.referencia || ''))
          .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
          .then(preparar);
      }).catch(function () { delete bases[ibge]; return null; });
    }
    return bases[ibge];
  }
  function preparar(d) {
    var regs = d.registros;
    d.nomes = new Array(regs.length);
    for (var i = 0; i < regs.length; i++) d.nomes[i] = norm(regs[i][1] + ' ' + regs[i][2]);
    d.bairrosN = d.bairros.map(norm);
    d.logsN = d.logradouros.map(norm);
    return d;
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
    var cep = digitos(c.cep && c.cep.value);
    if (cep.length >= 5) f.cep = cep;
    var bairro = norm(c.bairro && c.bairro.value);
    if (bairro.length >= 3) f.bairro = bairro;
    var end = norm(c.end && c.end.value).split(' ').filter(function (p) { return p && !TIPOS_LOG.test(p); });
    if (end.join('').length >= 3) f.end = end;
    var num = norm(c.num && c.num.value);
    if (num) f.num = num;
    return f;
  }
  function resumoFiltro(k, c) {
    var v = (c[k] && c[k].value || '').trim();
    if (k === 'cnae') v = v.split(/\s+[–-]\s+/)[0];
    return ROTULO[k] + ': ' + (v.length > 28 ? v.slice(0, 27) + '…' : v);
  }

  function filtrar(d, f, ignorar) {
    var regs = d.registros, out = [];
    var usa = function (k) { return f[k] && k !== ignorar; };
    var bairros = null, logs = null, cnaesOk = null;
    if (usa('bairro')) bairros = d.bairrosN.map(function (b) { return b.indexOf(f.bairro) >= 0; });
    if (usa('end')) logs = d.logsN.map(function (l) { return f.end.every(function (p) { return l.indexOf(p) >= 0; }); });
    if (usa('cnae')) {
      cnaesOk = d.cnaes.map(function (sub, i) {
        return f.cnae.length === 7 ? sub === f.cnae : (d.cnaeSinan[i] || []).indexOf(f.cnae) >= 0;
      });
    }
    var soNumero = usa('num') && Object.keys(f).filter(function (k) { return k !== 'num' && k !== ignorar; }).length === 0;
    if (soNumero) return [];
    for (var i = 0; i < regs.length; i++) {
      var r = regs[i];
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
        if (!f.nome.every(function (p) { return n.indexOf(p) >= 0; })) continue;
        var alvo = f.nome.join(' ');
        pont = (norm(r[1]) === alvo || norm(r[2]) === alvo) ? 4 : (norm(r[1]).indexOf(alvo) === 0 || norm(r[2]).indexOf(alvo) === 0) ? 3 : 2;
      }
      if (r[11] === 'A') pont += 0.5;
      if (sec) pont -= 0.25;
      out.push({ i: i, p: pont, sec: sec });
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
    var dica = el('span', 'visat-loc-dica', 'Preencha qualquer dado que tiver (CNPJ, nome, CNAE, CEP, bairro ou rua), em qualquer ordem: cada campo reduz as opções dos outros.');
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
    box.append(topo, filtrosEl, status, facetas, lista, mais, fonte);
    painel.append(box);
    caixaCnpj.before(painel);

    var base = null, ibgeAtual = null, escolhido = null, limite = MAX_LISTA, espera = null, aplicando = false;

    function ibgeDoCampo() {
      var cod = digitos(c.ibge && c.ibge.value).slice(0, 6);
      if (cod.length === 6) return cod;
      var nome = norm((c.mun.value || '').split('/')[0]);
      if (!nome) return PADRAO_IBGE;
      return carregarIndice().then(function (ind) {
        var m = (ind.municipios || []).find(function (x) { return norm(x.municipio) === nome || nome.indexOf(norm(x.municipio)) === 0; });
        return m ? m.ibge : null;
      });
    }

    function garantirBase() {
      return Promise.resolve(ibgeDoCampo()).then(function (ibge) {
        if (ibge === ibgeAtual && (base || !ibge)) return base;
        ibgeAtual = ibge;
        base = null;
        if (!ibge) return null;
        status.textContent = 'Carregando a base de empresas do município…';
        var carga = window.visatCarregarCnae ? window.visatCarregarCnae().then(function (t) { tabelaCnae = t; }).catch(function () {}) : Promise.resolve();
        return Promise.all([carregarBase(ibge), carga]).then(function (res) {
          if (ibgeAtual !== ibge) return base;
          base = res[0];
          fonte.textContent = base ? 'Base local: ' + base.registros.length.toLocaleString('pt-BR') + ' estabelecimentos de ' +
            base.municipio + '/' + base.uf + ' (ativos, suspensos e inaptos) · ' + base.fonte + ', referência ' + base.referencia +
            '. Confira sempre o CNPJ do local de trabalho.' : '';
          return base;
        });
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
          status.textContent = 'Sem base local para este município. Use o CNPJ (consulta automática) ou o nome (cadastro online).';
          return;
        }
        var res = filtrar(d, f);
        marcarAntigaLista(res.length > 0);
        if (!res.length) { semResultado(d, f, chaves); return; }
        status.textContent = res.length === 1 ? '1 empresa encontrada. Confira e selecione.' :
          res.length.toLocaleString('pt-BR') + ' empresas compatíveis. Acrescente outro dado ou escolha uma opção.';
        if (res.length > 1) montarFacetas(d, res, f);
        desenhar(d, res, f);
      });
    }

    function semResultado(d, f, chaves) {
      var txt = 'Nenhuma empresa da base local com todos esses dados.' +
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
      if (!f.cnae) {
        var cn = {};
        res.forEach(function (x) { (d.cnaeSinan[d.registros[x.i][3]] || []).forEach(function (s) { cn[s] = (cn[s] || 0) + 1; }); });
        grupo('Atividade (CNAE):', cn, {
          rotulo: function (k) { var ds = descricaoCnae(k); return k + (ds ? ' – ' + titulo(ds) : ''); },
          usar: function (k) { var ds = descricaoCnae(k); escrever(c.cnae, ds ? k + ' – ' + ds : k); }
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
      s.push([d.situacoes[r[11]] || r[11], r[11] === 'A' ? 'ok' : 'alerta']);
      s.push([r[10] === 1 ? 'Matriz' : 'Filial', '']);
      if (x.sec) s.push(['CNAE secundário', 'alerta']);
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
        var cnaeTxt = subs.length === 1 ? subs[0] + ' – ' + titulo(descricaoCnae(subs[0])) : 'CNAE ' + d.cnaes[r[3]];
        var end = [titulo(d.logradouros[r[7]]), r[8], r[9] && titulo(r[9]), titulo(d.bairros[r[6]]), fmtCep(r[5])].filter(Boolean).join(', ');
        var linha3 = el('span', 'visat-loc-linha', cnaeTxt + ' · ' + end);
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
        if (c.uf) escrever(c.uf, d.uf);
        if (c.mun && !c.mun.value.trim()) escrever(c.mun, d.municipio);
        if (c.ibge) escrever(c.ibge, d.ibge);
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
      if (r[11] !== 'A') avisos.push('situação cadastral ' + (d.situacoes[r[11]] || r[11]).toLowerCase() + ' na Receita');
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
