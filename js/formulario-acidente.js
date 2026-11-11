// Remove somente as chaves de rascunho criadas por versões anteriores do VISAT.
try {
  const chavesLegadas = ['acidente', 'obito', 'biologico', 'cancer', 'dermatose', 'voz', 'lerdort', 'pair', 'pneumo', 'mental']
    .map(agravo => 'notificacao-' + agravo + '-v1-inline');
  chavesLegadas.push('visat-notificante-v1');
  chavesLegadas.forEach(chave => window.localStorage.removeItem(chave));
} catch (erro) {
  // O formulário funciona mesmo quando o navegador bloqueia o armazenamento.
}
window.addEventListener('pageshow', evento => {
  if (evento.persisted) window.location.reload();
});

const VISAT_MODELO = 'Modelo VISAT 2026.11-1';
const VISAT_EMAIL = 'saudetrab.sms.pmf@floripa.sc.gov.br';
const VISAT_HOMOLOGACAO = (() => {
  try { return new URLSearchParams(window.location.search).has('homologacao'); } catch { return false; }
})();

function completarCamposEmpresa(area) {
  const grupos = [
    {
      chave: 'cnpj',
      campos: [
        [['empresa', 'empresaNome', 'razao'], 'Nome da empresa ou empregador'],
        [['cnae'], 'Atividade econômica (CNAE)'],
        [['ufEmp', 'uf'], 'UF da empresa'],
        [['munEmp', 'municipio'], 'Município da empresa'],
        [['ibgeEmp'], 'Código IBGE do município da empresa'],
        [['bairroEmp', 'bairro'], 'Bairro da empresa'],
        [['endEmp', 'endereco'], 'Logradouro da empresa'],
        [['numEmp', 'numero'], 'Número do endereço da empresa'],
        [['cepEmp'], 'CEP da empresa']
      ]
    },
    {
      chave: 'cnpjPrincipal',
      campos: [
        [['ufPrincipal'], 'UF da empresa principal'],
        [['munPrincipal'], 'Município da empresa principal'],
        [['ibgePrincipal'], 'Código IBGE da empresa principal'],
        [['bairroPrincipal'], 'Bairro da empresa principal'],
        [['endPrincipal'], 'Logradouro da empresa principal'],
        [['numPrincipal'], 'Número do endereço da empresa principal'],
        [['cepPrincipal'], 'CEP da empresa principal']
      ]
    }
  ];
  for (const grupo of grupos) {
    const documento = area.querySelector('[data-key="' + grupo.chave + '"]' +
      (grupo.chave === 'cnpjPrincipal' ? ', [data-key="cnpjPrinc"]' : ''));
    if (!documento) continue;
    const secao = documento.closest('.screen');
    const destino = documento.closest('[data-show-when]') || documento.closest('.field-group');
    for (const [chaves, texto] of grupo.campos) {
      if (chaves.some(chave => secao.querySelector('[data-key="' + chave + '"]'))) continue;
      const chave = chaves[0];
      const caixa = document.createElement('div');
      const label = document.createElement('label');
      label.className = 'field-label';
      label.htmlFor = 'empresa-' + chave;
      label.textContent = texto;
      const input = document.createElement('input');
      input.className = 'input input-lg';
      input.id = label.htmlFor;
      input.dataset.key = chave;
      caixa.append(label, input);
      destino.append(caixa);
    }
  }
}

const blocosSinan = {
  "form-acidente-template": {
    "aliases": {},
    "agravo": "Acidente de trabalho",
    "cid": "Y96",
    "event": "dataAcidente"
  },
  "form-biologico-template": {
    "aliases": {
      "telefoneRes": "telefone"
    },
    "agravo": "Acidente de trabalho com exposição a material biológico",
    "cid": "Z20.9",
    "event": "dataAcidente"
  },
  "form-cancer-template": {
    "aliases": {
      "tipoNotif": "tipoNotificacao",
      "ufNotif": "ufNotificacao",
      "munNotif": "municipioNotificacao",
      "unidNotif": "unidadeNotificadora",
      "cidAgravo": "cid10Notif"
    },
    "agravo": "Câncer relacionado ao trabalho",
    "cid": "C80",
    "event": "dataDiagnostico"
  },
  "form-dermatose-template": {
    "aliases": {
      "tipoNotif": "tipo",
      "dataNotificacao": "dataNotif",
      "ufNotif": "uf",
      "munNotif": "municipioNotif",
      "unidNotif": "unidade",
      "cidAgravo": "cidFixo"
    },
    "agravo": "Dermatoses ocupacionais",
    "cid": "L98.9",
    "event": "dataDiag"
  },
  "form-lerdort-template": {
    "aliases": {
      "tipoNotif": "tipo",
      "dataNotificacao": "dataNotif",
      "ufNotif": "uf",
      "munNotif": "municipio",
      "unidNotif": "unidade",
      "cidAgravo": "cidFixo"
    },
    "agravo": "LER/DORT",
    "cid": "Z57.9",
    "event": "dataDiag"
  },
  "form-pair-template": {
    "aliases": {
      "tipoNotif": "tipo",
      "dataNotificacao": "dataNotif",
      "ufNotif": "uf",
      "munNotif": "municipio",
      "unidNotif": "unidade",
      "cidAgravo": "cidFixo"
    },
    "agravo": "PAIR — Perda auditiva induzida por ruído",
    "cid": "H83.3",
    "event": "dataDiag"
  },
  "form-pneumo-template": {
    "aliases": {
      "tipoNotif": "tipo",
      "dataNotificacao": "dataNotif",
      "ufNotif": "uf",
      "munNotif": "municipio",
      "unidNotif": "unidade",
      "cidAgravo": "cidFixo"
    },
    "agravo": "Pneumoconioses",
    "cid": "J64",
    "event": "dataDiag"
  },
  "form-mental-template": {
    "aliases": {
      "tipoNotif": "tipo",
      "dataNotificacao": "dataNotif",
      "ufNotif": "uf",
      "munNotif": "municipio",
      "unidNotif": "unidade",
      "cidAgravo": "cidFixo"
    },
    "agravo": "Transtornos mentais relacionados ao trabalho",
    "cid": "F99",
    "event": "dataDiagnostico"
  },
  "form-voz-template": {
    "aliases": {},
    "agravo": "Distúrbio de voz relacionado ao trabalho",
    "cid": "R49",
    "event": "inicioSintomas"
  }
};

function montarBlocoSinan(root, options) {
  const config = blocosSinan[options.templateId];
  const area = root.querySelector('#mainArea');
  const bloco = document.getElementById('form-sinan-comum-template').content.cloneNode(true);
  bloco.querySelector('[data-key="agravo"]').value = config.agravo;
  bloco.querySelector('[data-key="cidAgravo"]').value = config.cid;
  const data = config.event && area.querySelector('[data-key="' + config.event + '"]');
  if (data) bloco.querySelector('.field-group').append(data.parentElement);
  for (const [key, alias] of Object.entries(config.aliases)) {
    bloco.querySelector('[data-key="' + key + '"]').dataset.key = alias;
  }
  if (options.obito) {
    root.querySelector('.pill').textContent = 'Óbito por acidente de trabalho';
    const evolucao = root.querySelector('[data-chips="evolucao"]');
    evolucao.parentElement.insertAdjacentHTML('afterend', '<div><label class="field-label" for="dataObito">Data do óbito</label><input class="input" id="dataObito" data-key="dataObito" type="date"></div><div><label class="field-label" for="numeroDO">Número da Declaração de Óbito, se disponível</label><input class="input" id="numeroDO" data-key="numeroDO" type="text"></div>');
    evolucao.querySelectorAll('.chip').forEach(chip => {
      if (chip.dataset.value !== 'Óbito por acidente de trabalho') chip.remove();
    });
  }
  area.prepend(bloco);
  completarCamposEmpresa(area);
  const screens = area.querySelectorAll('.screen');
  screens.forEach((screen, index) => {
    screen.dataset.screen = index + 1;
    screen.classList.toggle('active', index === 0);
  });
  const total = screens.length - 1;
  const track = root.querySelector('.progress-track');
  track.replaceChildren();
  track.style.gridTemplateColumns = 'repeat(' + total + ', 1fr)';
  for (let index = 1; index <= total; index++) {
    const segment = document.createElement('div');
    segment.className = 'progress-seg';
    segment.dataset.seg = index;
    track.append(segment);
  }
  return total;
}

window.montarFormularioAcidente = function montarFormularioAcidente(container, onVoltar, obito = false) {
  return window.montarFormulario(container, onVoltar, {
    templateId: 'form-acidente-template',
    obito,
    defaults: { tempoUnidade: 'Anos', ...(obito ? { evolucao: 'Óbito por acidente de trabalho' } : {}) }
  });
};

window.montarFormulario = function montarFormulario(container, onVoltar, options) {
const template = document.getElementById(options.templateId);
if (!template) throw new Error('Modelo do formulario nao encontrado.');
container.replaceChildren(template.content.cloneNode(true));
const root = container.querySelector('.acidente-inline');
const TOTAL = montarBlocoSinan(root, options);
const config = blocosSinan[options.templateId];
const today = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());
const defaults = {
  [config.aliases.dataNotificacao || 'dataNotificacao']: today,
  ...options.defaults
};
const state = { screen: 1, values: { ...defaults } };
root.querySelectorAll('input[data-key], textarea[data-key]').forEach(campo => {
  campo.setAttribute('autocomplete', 'off');
});
if (root.querySelector('[data-key="dataFechamento"]') && !state.values.dataFechamento) {
  state.values.dataFechamento = today;
}

const area = root.querySelector('#mainArea');
if (VISAT_HOMOLOGACAO) {
  const faixa = document.createElement('p');
  faixa.className = 'highlight-box';
  faixa.dataset.visatHomologacao = '1';
  faixa.textContent = 'Ambiente de homologação: use somente dados fictícios. O PDF e o e-mail saem marcados como HOMOLOGAÇÃO.';
  area.before(faixa);
}
const counter = root.querySelector('#stepCounter');
const btnVoltar = root.querySelector('#btnVoltar');
const btnContinuar = root.querySelector('#btnContinuar');
const btnPdfConferencia = document.createElement('button');
btnPdfConferencia.type = 'button';
btnPdfConferencia.className = 'btn';
btnPdfConferencia.dataset.variant = 'ghost';
btnPdfConferencia.dataset.visatPdfConferencia = '1';
btnPdfConferencia.textContent = 'PDF para conferência';
btnContinuar.before(btnPdfConferencia);
const bottomBar = root.querySelector('#bottomBar');
const progSegs = root.querySelectorAll('.progress-seg');
const campoEvento = root.querySelector('[data-key="' + config.event + '"]');
const residencia = root.querySelector('#sinan-residencia-pais');
const endereco = residencia.closest('.screen');
const gestante = root.querySelector('[data-chips="gestante"]');


function getScreens() { return Array.from(root.querySelectorAll('.screen')); }

function persistInputs() {
root.querySelectorAll('[data-key]').forEach(el => {
state.values[el.dataset.key] = el.value;
});
root.querySelectorAll('[data-chips]').forEach(group => {
const key = group.dataset.chips;
const selected = Array.from(group.querySelectorAll('.chip.selected')).map(c => c.dataset.value);
if (group.dataset.multi) state.values[key] = selected;
else state.values[key] = selected[0] || '';
});
aplicarCondicoes();
}

function restoreInputs() {
root.querySelectorAll('[data-key]').forEach(el => {
const v = state.values[el.dataset.key];
if (v !== undefined) el.value = v;
});
root.querySelectorAll('[data-chips]').forEach(group => {
const key = group.dataset.chips;
const v = state.values[key];
group.querySelectorAll('.chip').forEach(chip => {
const on = group.dataset.multi ? Array.isArray(v) && v.includes(chip.dataset.value) : v === chip.dataset.value;
chip.classList.toggle('selected', !!on);
});
});
aplicarCondicoes();
}

function aplicarCondicoes() {
  atualizarGestante();
  const noBrasil = residencia.value === 'BR';
  marcarObrigatorio(root.querySelector('#sinan-uf-res'), noBrasil);
  marcarObrigatorio(root.querySelector('#sinan-mun-res'), noBrasil);
  marcarObrigatorio(root.querySelector('#sinan-pais'), !noBrasil);

  root.querySelectorAll('[data-show-when]').forEach((el) => {
    const separador = el.dataset.showWhen.indexOf('=');
    const key = el.dataset.showWhen.slice(0, separador);
    const esperado = el.dataset.showWhen.slice(separador + 1);
    el.hidden = state.values[key] !== esperado;
  });
  root.querySelectorAll('[data-show-includes]').forEach((el) => {
    const separador = el.dataset.showIncludes.indexOf('=');
    const key = el.dataset.showIncludes.slice(0, separador);
    const esperado = el.dataset.showIncludes.slice(separador + 1);
    const valor = state.values[key];
    el.hidden = !(Array.isArray(valor) && valor.includes(esperado));
  });
  root.querySelectorAll('[data-show-contains]').forEach((el) => {
    const separador = el.dataset.showContains.indexOf('=');
    const key = el.dataset.showContains.slice(0, separador);
    const esperado = el.dataset.showContains.slice(separador + 1);
    const valor = state.values[key];
    const texto = Array.isArray(valor) ? valor.join(' ') : String(valor || '');
    el.hidden = !texto.includes(esperado);
  });
}

function marcarObrigatorio(campo, ativo = true) {
  const rotulo = campo.labels?.[0] || campo.previousElementSibling;
  rotulo?.toggleAttribute('data-visat-obrigatorio', ativo);
  if (campo.matches('input, select')) {
    if (ativo) campo.setAttribute('aria-required', 'true');
    else campo.removeAttribute('aria-required');
  }
}

function idadeEmAnos() {
  const nascimento = root.querySelector('#sinan-nasc').value;
  const referencia = campoEvento.value || root.querySelector('#sinan-data-notif').value;
  if (nascimento) {
    if (!referencia || nascimento > referencia) return null;
    const ano = Number(referencia.slice(0, 4)) - Number(nascimento.slice(0, 4));
    return ano - Number(referencia.slice(5) < nascimento.slice(5));
  }
  const idade = root.querySelector('#sinan-idade');
  const unidade = root.querySelector('#sinan-idade-un').value;
  const unidadesPorAno = { Hora: 365.25 * 24, Dia: 365.25, 'Mês': 12, Ano: 1 };
  if (!idade.value || !idade.validity.valid || !unidadesPorAno[unidade]) return null;
  return Math.floor(Number(idade.value) / unidadesPorAno[unidade]);
}

function atualizarGestante() {
  const idade = idadeEmAnos();
  const feminino = state.values.sexo === 'Feminino';
  const automatico = state.values.sexo === 'Masculino' || (feminino && idade !== null && idade <= 10);
  if (automatico) state.values.gestante = 'Não se aplica';
  else if (gestante.hasAttribute('data-automatico')) state.values.gestante = '';
  gestante.toggleAttribute('data-automatico', automatico);
  gestante.querySelectorAll('.chip').forEach(chip => {
    const selecionado = chip.dataset.value === state.values.gestante;
    chip.disabled = automatico;
    chip.classList.toggle('selected', selecionado);
    chip.setAttribute('aria-pressed', String(selecionado));
  });
  marcarObrigatorio(gestante, feminino && !automatico);
}

residencia.addEventListener('change', () => {
  endereco.querySelectorAll('[data-key]').forEach(campo => {
    if (!['residencia', 'telefoneRes', 'telefone'].includes(campo.dataset.key)) campo.value = '';
  });
  endereco.querySelectorAll('[data-chips="zona"] .selected').forEach(chip => chip.classList.remove('selected'));
  // Invalida inclusive uma consulta de CEP que ainda esteja em andamento.
  endereco.querySelector('#sinan-cep').dispatchEvent(new Event('input', { bubbles: true }));
});

[
  '#sinan-tipo', '#sinan-agravo', '#sinan-data-notif', '#sinan-uf-notif',
  '#sinan-mun-notif', '#sinan-unid', '#sinan-nome', '[data-chips="sexo"]'
].map(seletor => root.querySelector(seletor)).concat(campoEvento)
  .forEach(campo => marcarObrigatorio(campo));


// Chip interactions
root.querySelectorAll('[data-chips]').forEach(group => {
group.querySelectorAll('.chip').forEach(chip => {
chip.addEventListener('click', () => {
if (group.dataset.chips === 'sexo' && state.values.sexo !== chip.dataset.value) {
  gestante.querySelector('.chip.selected')?.classList.remove('selected');
}
if (group.dataset.multi) {
chip.classList.toggle('selected');
} else {
group.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
chip.classList.add('selected');
}
clearErrorFor(group.dataset.chips);
persistInputs();
if (group.dataset.dynamic) applyDynamic();
});
});
});

function applyDynamic() {
// Tipo de acidente influences nothing structural in this prototype beyond saving;
// kept as hook for conditional requirements.
}

// Input listeners
root.querySelectorAll('[data-key]').forEach(el => {
const evt = el.tagName === 'SELECT' ? 'change' : 'input';
el.addEventListener(evt, () => {
clearErrorFor(el.dataset.key);
persistInputs();

});
if (el.type === 'date') el.addEventListener('change', persistInputs);
});

// Masks
function mascaraCpf(valor) {
  const d = String(valor).replace(/\D/g, '').slice(0, 11);
  return d.replace(/^(\d{3})(\d{0,3})(\d{0,3})(\d{0,2}).*/, (m, a, b, c, e) =>
    [a, b, c].filter(Boolean).join('.') + (e ? '-' + e : ''));
}
function mascaraCnpjOuCpf(valor) {
  let d = String(valor).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^\d{0,11}$/.test(d)) return mascaraCpf(d);
  d = d.slice(0, 14);
  return d.replace(/^([A-Z0-9]{2})([A-Z0-9]{0,3})([A-Z0-9]{0,3})([A-Z0-9]{0,4})([A-Z0-9]{0,2}).*/, (m, a, b, c, e, f) =>
    [a, b, c].filter(Boolean).join('.') + (e ? '/' + e : '') + (f ? '-' + f : ''));
}
root.querySelectorAll('[data-mask="cpf"], #cpf').forEach((campo) => {
  campo.addEventListener('input', () => {
    campo.value = mascaraCpf(campo.value);
  });
});
root.querySelectorAll('[data-mask="cnpj"], [data-key="cnpj"], [data-key="cnpjPrincipal"], [data-key="cnpjPrinc"]').forEach((campo) => {
  campo.setAttribute('inputmode', 'text');
  campo.addEventListener('input', () => {
    campo.value = mascaraCnpjOuCpf(campo.value);
  });
});

function clearErrorFor(key) {
const err = root.querySelector('[data-err="' + key + '"]');
if (err) err.classList.remove('show');
const input = root.querySelector('[data-key="' + key + '"]');
if (input) input.classList.remove('invalid');
}

function preenchidoComLetras(campo) {
  return /\p{L}/u.test(campo.value);
}

function camposBasicosPendentes() {
  const notificacao = root.querySelector('#sinan-data-notif');
  const nascimento = root.querySelector('#sinan-nasc');
  const dataEvento = campoEvento.value;
  const rotuloEvento = campoEvento.labels[0].textContent.trim();
  const faltaNome = seletor => !preenchidoComLetras(root.querySelector(seletor));
  const regras = [
    ['#sinan-tipo', 'Tipo de notificação: 2 – Individual', root.querySelector('#sinan-tipo').value !== '2 – Individual'],
    ['#sinan-agravo', 'Agravo ou doença', !root.querySelector('#sinan-agravo').value],
    ['#sinan-data-notif', 'Data da notificação', !notificacao.value],
    ['#sinan-data-notif', 'A data da notificação deve ser igual ou anterior à data de hoje', notificacao.value > today],
    ['#sinan-uf-notif', 'UF de notificação', !root.querySelector('#sinan-uf-notif').value],
    ['#sinan-mun-notif', 'Nome do município de notificação', faltaNome('#sinan-mun-notif')],
    ['#sinan-unid', 'Nome da unidade de saúde ou fonte notificadora', faltaNome('#sinan-unid')],
    ['#' + campoEvento.id, rotuloEvento, !dataEvento],
    ['#' + campoEvento.id, 'A data de referência do agravo deve ser igual ou anterior à notificação', dataEvento && notificacao.value && dataEvento > notificacao.value],
    ['#sinan-nome', 'Nome completo, sem abreviações', faltaNome('#sinan-nome')],
    ['#sinan-nasc', 'Data de nascimento ou idade com unidade', !nascimento.value && idadeEmAnos() === null],
    ['#sinan-nasc', 'A data de nascimento deve ser igual ou anterior à data de referência do agravo', nascimento.value && dataEvento && nascimento.value > dataEvento],
    ['[data-chips="sexo"]', 'Sexo', !state.values.sexo],
    ['[data-chips="gestante"]', 'Situação gestacional', state.values.sexo === 'Feminino' && !state.values.gestante]
  ];
  const agravoCampo = root.querySelector('#sinan-agravo');
  const cidAgravoCampo = root.querySelector('#sinan-cidAgravo');
  regras.push(['#sinan-agravo', 'Agravo incompatível com esta ficha',
    agravoCampo.value !== config.agravo || cidAgravoCampo.value.trim().toUpperCase() !== config.cid]);
  // Datas impossíveis ou incoerentes impedem o PDF final.
  root.querySelectorAll('input[type="date"][data-key]').forEach((campo, indice) => {
    if (!campo.value || campo.closest('[hidden]') || campo.id === 'sinan-data-notif') return;
    if (!campo.id) campo.id = 'visat-data-' + indice;
    const rotulo = (campo.labels?.[0]?.textContent || 'Data').trim();
    if (!campo.validity.valid || campo.value < '1900-01-01') regras.push(['#' + campo.id, rotulo + ': data impossível', true]);
    else if (campo.value > today) regras.push(['#' + campo.id, rotulo + ': a data não pode ser posterior a hoje', true]);
  });
  if (nascimento.value && notificacao.value && nascimento.value > notificacao.value) {
    regras.push(['#sinan-nasc', 'A data de nascimento deve ser igual ou anterior à data da notificação', true]);
  }
  const idadeAnos = idadeEmAnos();
  if (idadeAnos !== null && idadeAnos > 120) regras.push(['#sinan-nasc', 'Idade acima de 120 anos: confira o nascimento ou a idade', true]);
  for (const { campo, mensagem } of datasIncoerentes()) {
    if (!campo.id) campo.id = 'visat-' + (campo.dataset.key || 'campo');
    regras.push(['#' + campo.id, mensagem, true]);
  }
  if (residencia.value === 'BR') {
    regras.push(['#sinan-uf-res', 'UF de residência', !root.querySelector('#sinan-uf-res').value],
      ['#sinan-mun-res', 'Nome do município de residência', faltaNome('#sinan-mun-res')]);
  } else {
    const pais = root.querySelector('#sinan-pais');
    regras.push(['#sinan-pais', 'Nome do país de residência fora do Brasil',
      !preenchidoComLetras(pais) || /^bra[sz]il$/i.test(pais.value.trim())]);
  }
  const pendentes = regras.filter(([, , pendente]) => pendente).map(([seletor, rotulo]) => {
    const campo = root.querySelector(seletor);
    return { tela: Number(campo.closest('.screen').dataset.screen), rotulo, campo };
  });
  for (const { campo, rotulo } of window.visatPendenciasCid?.(root) || []) {
    pendentes.push({ tela: Number(campo.closest('.screen').dataset.screen), rotulo, campo });
  }
  return pendentes;
}

function documentoValido(valor, tipo) {
  const id = valor.toUpperCase().replace(/[.\/\s-]/g, '');
  const cpf = tipo === 'cpf';
  if (!(cpf ? /^\d{11}$/ : /^[A-Z0-9]{12}\d{2}$/).test(id) || /^(.)(\1)+$/.test(id)) return false;
  const base = id.length - 2;
  return [0, 1].every(passo => {
    const tamanho = base + passo;
    let soma = 0;
    for (let i = 0; i < tamanho; i++) {
      const peso = cpf ? tamanho + 1 - i : (tamanho - 1 - i) % 8 + 2;
      soma += (id.charCodeAt(i) - 48) * peso;
    }
    const resto = soma % 11;
    return Number(id[tamanho]) === (resto < 2 ? 0 : 11 - resto);
  });
}

const seletorDocumentos = '[data-key="cpf"], [data-key="cnpj"], [data-key="cnpjPrincipal"], [data-key="cnpjPrinc"]';

function documentosPendentes() {
  const pendentes = [];
  const campos = root.querySelectorAll(seletorDocumentos);
  for (const campo of campos) {
    const valor = campo.value.trim();
    if (!valor || campo.closest('[hidden]')) continue;
    const chave = campo.dataset.key;
    const permiteCpf = chave === 'cpf' || chave === 'cnpj';
    const digitos = valor.replace(/[.\/\s-]/g, '');
    const tipo = chave === 'cpf' || (permiteCpf && /^\d{11}$/.test(digitos)) ? 'cpf' : 'cnpj';
    if (documentoValido(valor, tipo)) continue;
    const nome = chave === 'cpf' ? 'CPF da pessoa notificada'
      : chave === 'cnpj' ? 'CPF ou CNPJ do empregador' : 'CNPJ da empresa principal';
    pendentes.push({
      tela: Number(campo.closest('.screen').dataset.screen),
      rotulo: nome + ' inválido. Corrija ou deixe em branco.',
      campo
    });
  }
  return pendentes;
}

function campoPorChave(chave) { return root.querySelector('[data-key="' + chave + '"]'); }

// Datas incoerentes entre si impedem o PDF final.
function datasIncoerentes() {
  const erros = [];
  const nascimento = campoPorChave('nascimento');
  const notificacao = campoPorChave('dataNotificacao') || campoPorChave('dataNotif');
  const evento = config.event && campoPorChave(config.event);
  const fechamento = ['dataFechamento', 'dataFinal', 'data'].map(campoPorChave).find(campo => campo?.type === 'date');
  const obito = campoPorChave('dataObito');
  if (fechamento?.value && notificacao?.value && fechamento.value < notificacao.value) {
    erros.push({ campo: fechamento, mensagem: 'A data de encerramento está antes da notificação' });
  }
  if (obito?.value && [nascimento, config.event === 'dataAcidente' ? evento : null]
      .some(campo => campo?.value && obito.value < campo.value)) {
    erros.push({ campo: obito, mensagem: 'A data do óbito está antes do nascimento ou do acidente' });
  }
  return erros;
}

function checarDadosDigitados() {
  const avisos = [];
  const input = campoPorChave;
  const fechamento = ['dataFechamento', 'dataFinal', 'data'].map(input).find(campo => campo?.type === 'date');
  const obito = input('dataObito');
  if (obito?.value && fechamento?.value && fechamento.value < obito.value &&
      /^óbito/i.test(String(state.values.evolucao || ''))) {
    avisos.push({ campo: fechamento, mensagem: 'Confira o encerramento: a evolução por óbito foi registrada com data posterior ao encerramento.' });
  }
  return avisos;
}

let avisosCoerencia = [];
let conferindoCoerencia = false;
async function verificarCoerencia() {
  const avisos = checarDadosDigitados().concat(window.visatConferirEmpresas?.(root) || [], window.visatAvisosCid?.(root) || []);
  if (!window.visatConferirTabelas) return avisos;
  let temporizador;
  try {
    const conferencias = await Promise.race([
      window.visatConferirTabelas(root),
      new Promise(resolve => {
        temporizador = setTimeout(() => resolve([{ mensagem: 'A consulta às tabelas ainda não respondeu. Confira os códigos antes do envio.' }]), 2500);
      })
    ]);
    return avisos.concat(conferencias);
  } catch {
    return avisos.concat({ mensagem: 'A conferência automática dos códigos ficou indisponível.' });
  } finally {
    clearTimeout(temporizador);
  }
}

function mostrarCoerencia(ancora) {
  root.querySelector('[data-visat-coerencia]')?.remove();
  if (!avisosCoerencia.length) return;
  const painel = document.createElement('section');
  painel.dataset.visatCoerencia = '1';
  painel.className = 'highlight-box';
  const titulo = document.createElement('h2');
  titulo.textContent = 'Confira possíveis divergências';
  const lista = document.createElement('ul');
  avisosCoerencia.forEach(({ campo, mensagem }) => {
    const linha = document.createElement('li');
    if (campo) {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'btn';
      botao.dataset.variant = 'outline';
      botao.textContent = mensagem;
      botao.addEventListener('click', () => {
        emCorrecao = true;
        showScreen(Number(campo.closest('.screen').dataset.screen));
        (campo.matches('input, select, textarea') ? campo : campo.querySelector('button'))?.focus();
      });
      linha.append(botao);
    } else linha.textContent = mensagem;
    lista.append(linha);
  });
  painel.append(titulo, lista);
  ancora.before(painel);
}

let emCorrecao = false;
async function finalizarFicha() {
  if (conferindoCoerencia) return;
  persistInputs();
  const pendentes = camposBasicosPendentes().concat(documentosPendentes());
  if (!pendentes.length) {
    conferindoCoerencia = true;
    btnContinuar.disabled = true;
    btnVoltar.disabled = true;
    btnPdfConferencia.disabled = true;
    area.inert = true;
    try {
      avisosCoerencia = await verificarCoerencia();
      if (!root.isConnected) return;
      emCorrecao = false;
      showScreen(TOTAL + 1);
    } finally {
      conferindoCoerencia = false;
      btnContinuar.disabled = false;
      btnVoltar.disabled = false;
      btnPdfConferencia.disabled = false;
      area.inert = false;
    }
    return;
  }
  emCorrecao = true;
  mostrarPendencias(pendentes, 'Revise as pendências para gerar o PDF final');
}

function mostrarPendencias(pendentes, mensagem) {
  root.querySelector('[data-visat-pendencias]')?.remove();
  const caixa = document.createElement('section');
  caixa.className = 'highlight-box';
  caixa.dataset.visatPendencias = '1';
  const titulo = document.createElement('h2');
  titulo.textContent = mensagem;
  titulo.tabIndex = -1;
  const lista = document.createElement('ul');
  pendentes.forEach(({ tela, rotulo, campo }) => {
    const item = document.createElement('li');
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'btn';
    botao.dataset.variant = 'outline';
    botao.textContent = rotulo;
    botao.addEventListener('click', () => {
      showScreen(tela);
      (campo.matches('input, select, textarea') ? campo : campo.querySelector('button'))?.focus();
    });
    item.append(botao);
    lista.append(item);
  });
  caixa.append(titulo, lista);
  getScreens()[state.screen - 1].prepend(caixa);
  titulo.focus();
}

function renderProgress() {
progSegs.forEach((seg, i) => {
seg.classList.toggle('done', i < state.screen);
});
}

function showScreen(n) {
root.querySelector('[data-visat-pendencias]')?.remove();
state.screen = n;
getScreens().forEach(s => s.classList.toggle('active', Number(s.dataset.screen) === n));
const isDone = n === TOTAL + 1;
bottomBar.style.display = isDone ? 'none' : 'block';
counter.textContent = isDone ? 'Concluído' : 'Tela ' + n + ' de ' + TOTAL;
btnVoltar.style.visibility = n === 1 ? 'hidden' : 'visible';
btnContinuar.textContent = n === TOTAL || emCorrecao ? 'Finalizar ficha' : 'Seguinte';
renderProgress();
area.scrollTop = 0;
if (isDone) buildSummary();
}

function buildPrint(paraConferencia = false) {
const tituloAgravo = options.obito ? 'Óbito por acidente de trabalho' : config.agravo;
const area_impressao = root.querySelector('#printArea');
area_impressao.classList.toggle('pf-preliminar', paraConferencia);
area_impressao.classList.toggle('pf-homologacao', VISAT_HOMOLOGACAO);
area_impressao.dataset.marca = paraConferencia ? 'PRÉVIA — NÃO ENCAMINHAR' : VISAT_HOMOLOGACAO ? 'HOMOLOGAÇÃO' : '';
const tituloImpressao = root.querySelector('.pf-title');
if (tituloImpressao) tituloImpressao.textContent = (VISAT_HOMOLOGACAO ? 'HOMOLOGAÇÃO — ' : '') + (paraConferencia
  ? 'PRÉVIA PARA CONFERÊNCIA — ' + tituloAgravo
  : 'NOTIFICAÇÃO INDIVIDUAL — ' + tituloAgravo.toUpperCase() + ' (CID-10 ' + config.cid + ')');
root.querySelector('.pf-note').textContent = paraConferencia
  ? 'Prévia da ficha em preenchimento, sem validade como notificação. Não encaminhe este arquivo: finalize a ficha e gere o PDF final.'
  : (VISAT_HOMOLOGACAO ? 'Teste de homologação com dados fictícios. ' : '') +
    'Cada campo mostra somente o valor informado. Encaminhar este PDF ao e-mail institucional ' + VISAT_EMAIL + '.';
root.querySelector('.pf-sign').hidden = paraConferencia;
root.querySelector('#pfDataImpressao').textContent = formatDate(today) + ' · ' + VISAT_MODELO;
const blocks = root.querySelector('#pfBlocks');
blocks.replaceChildren();

function addField(block, labelText) {
  const field = document.createElement('div');
  field.className = 'pf-field';
  const label = document.createElement('h4');
  label.textContent = labelText;
  field.appendChild(label);
  block.appendChild(field);
  return field;
}

function addChoices(field, choices, selectedValues) {
  const labels = choices
    .filter((choice) => selectedValues.includes(choice.value))
    .map((choice) => choice.label);
  addAnswer(field, labels.join('; '));
}

function addAnswer(field, value) {
  const answer = document.createElement('p');
  answer.className = 'pf-answer';
  answer.textContent = value || '________________________________';
  field.appendChild(answer);
}

root.querySelectorAll('.screen[data-screen]').forEach((screen) => {
  if (Number(screen.dataset.screen) > TOTAL) return;

  const block = document.createElement('section');
  block.className = 'pf-block';
  const title = document.createElement('h3');
  title.textContent = screen.querySelector('.screen-title').textContent;
  block.appendChild(title);

  screen.querySelectorAll('.field-label').forEach((fieldLabel) => {
    if (fieldLabel.closest('[hidden]') || (screen === endereco && fieldLabel.htmlFor === 'sinan-pais')) return;
    const labelText = fieldLabel.textContent.trim();
    const following = fieldLabel.nextElementSibling;
    if (!following) return;

    if (following.matches('[data-chips]')) {
      const field = addField(block, labelText);
      const choices = Array.from(following.querySelectorAll('.chip')).map((chip) => ({
        value: chip.dataset.value,
        label: chip.textContent.trim()
      }));
      const selected = choices.filter((choice) =>
        following.dataset.multi
          ? Array.isArray(state.values[following.dataset.chips]) && state.values[following.dataset.chips].includes(choice.value)
          : state.values[following.dataset.chips] === choice.value
      ).map((choice) => choice.value);
      addChoices(field, choices, selected);
      return;
    }

    if (following.matches('.unit-row')) {
      const quantity = following.querySelector('[data-key]');
      const unit = following.querySelector('select[data-key]');
      const field = addField(block, labelText);
      addAnswer(field, quantity.value ? `${quantity.value} ${unit.value}` : '');
      return;
    }

    if (fieldLabel instanceof HTMLLabelElement && fieldLabel.htmlFor) {
      const control = root.querySelector(`#${fieldLabel.htmlFor}`);
      if (!control || (control.matches(seletorDocumentos) && control.closest('[hidden]'))) return;
      const field = addField(block, labelText);
      if (control === residencia && residencia.value === 'exterior') {
        addAnswer(field, state.values.paisExterior);
        return;
      }
      if (control instanceof HTMLSelectElement) {
        const selected = control.value
          ? Array.from(control.selectedOptions).map((option) => option.textContent.trim())
          : [];
        addAnswer(field, selected.join('; '));
      } else {
        const value = control.type === 'date' && control.value
          ? formatDate(control.value)
          : control.value;
        addAnswer(field, value);
      }
    }
  });

  blocks.appendChild(block);
});
}

root.querySelector('#btnImprimir').addEventListener('click', () => {
  persistInputs();
  const pendentes = camposBasicosPendentes().concat(documentosPendentes());
  if (pendentes.length) {
    emCorrecao = true;
    mostrarPendencias(pendentes, 'Revise as pendências para gerar o PDF final');
    return;
  }
  buildPrint();
  window.print();
});

btnPdfConferencia.addEventListener('click', () => {
  const nome = root.querySelector('#sinan-nome');
  if (!preenchidoComLetras(nome)) {
    showScreen(2);
    mostrarPendencias([{ tela: 2, rotulo: 'Nome completo', campo: nome }],
      'Informe o nome completo para gerar o PDF');
    return;
  }
  persistInputs();
  buildPrint(true);
  window.print();
});

function rotuloResumo(el) {
  return el.dataset.summary;
}

function valorResumo(el) {
  const key = el.dataset.key || el.dataset.chips;
  let valor = state.values[key];
  if (Array.isArray(valor)) return valor.join('; ');
  if (el.type === 'date' && valor) return formatDate(valor);
  if (el.classList && el.classList.contains('unit-row')) {
    const quantidade = el.querySelector('input[data-key]');
    const unidade = el.querySelector('select[data-key]');
    return quantidade && quantidade.value ? `${quantidade.value} ${unidade.value}` : '';
  }
  return valor || '';
}

function mostrarRevisaoDeCampos() {
  const resumo = root.querySelector('#summaryGrid');
  root.querySelector('[data-visat-revisao]')?.remove();
  const grupos = [
    { tela: 1, campos: [
      [['codUnidNotif'], 'Código CNES']
    ] },
    { tela: 2, campos: [
      [['raca'], 'Raça/cor'],
      [['escolaridade'], 'Escolaridade']
    ] }
  ];
  const secaoEvolucao = root.querySelector('[data-chips="evolucao"]')?.closest('.screen');
  if (secaoEvolucao) grupos.push({ tela: Number(secaoEvolucao.dataset.screen), campos: [[['evolucao'], 'Evolução do caso']] });
  const secaoOcupacao = root.querySelector('[data-key="ocupacao"]')?.closest('.screen');
  if (secaoOcupacao) grupos.push({ tela: Number(secaoOcupacao.dataset.screen), campos: [[['ocupacao'], 'Ocupação / CBO']] });

  const caixa = document.createElement('details');
  caixa.dataset.visatRevisao = '1';
  caixa.className = 'highlight-box';
  const titulo = document.createElement('summary');
  titulo.textContent = 'Conferir campos complementares';
  const texto = document.createElement('p');
  const lista = document.createElement('ul');
  let total = 0;
  let preenchidos = 0;
  let revisar = 0;
  const semInformacao = /^(ignorado|não informado|desconhecido)$/i;
  for (const grupo of grupos) {
    for (const [chaves, rotulo] of grupo.campos) {
      const secao = getScreens()[grupo.tela - 1];
      const valores = chaves.filter(chave => secao.querySelector(
        '[data-key="' + chave + '"], [data-chips="' + chave + '"]'
      )).map(chave => String(state.values[chave] ?? '').trim());
      if (!valores.length) continue;
      total++;
      if (valores.some(v => v && !semInformacao.test(v))) {
        preenchidos++;
        continue;
      }
      revisar++;
      const item = document.createElement('li');
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'btn';
      botao.dataset.variant = 'outline';
      botao.textContent = rotulo + (valores.some(v => semInformacao.test(v)) ? ' · ignorado' : ' · em branco');
      botao.addEventListener('click', () => showScreen(grupo.tela));
      item.append(botao);
      lista.append(item);
    }
  }
  texto.textContent = preenchidos + ' de ' + total + ' itens prioritários com informação. ' +
    (revisar ? 'Selecione um item para conferir na etapa correspondente.' : 'Confira também os dados específicos do agravo.');
  caixa.append(titulo, texto);
  if (revisar) caixa.append(lista);
  resumo.before(caixa);
}

function buildSummary() {
mostrarRevisaoDeCampos();
const imprimir = root.querySelector('#btnImprimir');
const acoes = imprimir.parentElement;
imprimir.textContent = 'Imprimir / salvar PDF';
const email = root.querySelector('.hospital-alert a[href^="mailto:"]');
if (email && !acoes.querySelector('[data-visat-email]')) {
  const link = document.createElement('a');
  link.className = 'btn';
  link.dataset.variant = 'outline';
  link.dataset.visatEmail = '1';
  const assunto = (VISAT_HOMOLOGACAO ? '[HOMOLOGAÇÃO] ' : '') + 'Notificação — ' +
    (options.obito ? 'Óbito por acidente de trabalho' : config.agravo) + ' — ' + formatDate(state.values[config.aliases.dataNotificacao || 'dataNotificacao'] || today);
  const corpo = 'Segue em anexo o PDF final da ficha de notificação (' + VISAT_MODELO + ').';
  link.href = 'mailto:' + VISAT_EMAIL + '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo);
  link.textContent = 'Abrir e-mail';
  acoes.append(link);
  const instrucao = document.createElement('p');
  instrucao.className = 'field-help';
  instrucao.dataset.visatPdfInstrucao = '1';
  instrucao.textContent = 'Para enviar por e-mail, escolha Salvar como PDF na janela de impressão e anexe o arquivo à mensagem.';
  acoes.after(instrucao);
}
const revisao = root.querySelector('[data-visat-revisao]');
revisao.before(acoes);
mostrarCoerencia(acoes);
if (acoes.querySelector('[data-visat-email]')) {
  const instrucao = root.querySelector('[data-visat-pdf-instrucao]');
  if (instrucao) acoes.after(instrucao);
}
const marcados = root.querySelectorAll('[data-summary]');
const items = marcados.length
  ? Array.from(marcados).map((el) => [rotuloResumo(el), valorResumo(el)])
  : [
['Nome', state.values.nome],
['Data do acidente', state.values.dataAcidente ? formatDate(state.values.dataAcidente) : ''],
['Tipo de acidente', state.values.tipoAcidente],
['Parte do corpo', state.values.parteCorpo],
['Evolução', state.values.evolucao],
['CAT emitida', state.values.cat]
];
root.querySelector('#summaryGrid').innerHTML = items.map(([k, val]) =>
'<div class="summary-item"><span>' + k + '</span><strong>' + escapeHtml(val || '—') + '</strong></div>'
).join('');
}

function formatDate(iso) {
const [y, m, d] = iso.split('-');
return d + '/' + m + '/' + y;
}

function escapeHtml(s) {
return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

btnVoltar.addEventListener('click', () => {
if (state.screen > 1) showScreen(state.screen - 1);
});

btnContinuar.addEventListener('click', () => {
if (emCorrecao || state.screen === TOTAL) {
  finalizarFicha();
} else {
  persistInputs();
  showScreen(state.screen + 1);
}
});

root.querySelector('#btnRevisar').addEventListener('click', () => {
showScreen(1);
});

const dlg = root.querySelector('#dlgNova');
root.querySelector('[data-dialog-close]').addEventListener('click', () => dlg.close());
root.querySelector('[data-voltar-consulta]').addEventListener('click', onVoltar);
root.querySelector('#btnNova').addEventListener('click', () => dlg.showModal());
root.querySelector('#btnConfirmaNova').addEventListener('click', () => {
  dlg.close();
  window.montarFormulario(container, onVoltar, options);
});

// Init
restoreInputs();
showScreen(1);
const activeHeading = root.querySelector('.screen.active h1');
if (activeHeading) {
  activeHeading.tabIndex = -1;
  activeHeading.focus({ preventScroll: true });
}
return root;
};
