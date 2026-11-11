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
  if (options.templateId === 'form-acidente-template') {
    const campos = { nome: 'Informe o nome completo', nascimento: 'Informe a data de nascimento', cpf: 'Informe o CPF', sexo: 'Selecione o sexo' };
    for (const [key, message] of Object.entries(campos)) {
      const control = bloco.querySelector('[data-key="' + key + '"], [data-chips="' + key + '"]');
      control.dataset.required = message;
      const error = document.createElement('div');
      error.className = 'field-error';
      error.dataset.err = key;
      error.textContent = message;
      control.after(error);
    }
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
const defaults = {
  [config.aliases.dataNotificacao || 'dataNotificacao']: new Date().toISOString().slice(0, 10),
  ...options.defaults
};
const state = { screen: 1, values: { ...defaults } };
root.querySelectorAll('input[data-key], textarea[data-key]').forEach(campo => {
  campo.setAttribute('autocomplete', 'off');
});
const today = new Date().toISOString().slice(0, 10);
Object.entries(defaults).forEach(([key, value]) => {
  if (!state.values[key]) state.values[key] = value;
});
if (root.querySelector('[data-key="dataFechamento"]') && !state.values.dataFechamento) {
  state.values.dataFechamento = today;
}

const area = root.querySelector('#mainArea');
const counter = root.querySelector('#stepCounter');
const btnVoltar = root.querySelector('#btnVoltar');
const btnContinuar = root.querySelector('#btnContinuar');
const bottomBar = root.querySelector('#bottomBar');
const progSegs = root.querySelectorAll('.progress-seg');


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



// Chip interactions
root.querySelectorAll('[data-chips]').forEach(group => {
group.querySelectorAll('.chip').forEach(chip => {
chip.addEventListener('click', () => {
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

function camposBasicosPendentes() {
  const grupos = [
    [1, ['dataNotificacao', 'dataNotif'], 'Data da notificação'],
    [1, ['ufNotif', 'ufNotificacao', 'uf'], 'UF notificadora'],
    [1, ['munNotif', 'municipioNotif', 'municipioNotificacao', 'municipio', 'ibgeNotif'], 'Município notificador ou código IBGE'],
    [1, ['unidNotif', 'unidadeNotificadora', 'unidade', 'codUnidNotif'], 'Unidade notificadora ou código CNES'],
    [2, ['nome'], 'Nome completo'],
    [2, ['nascimento', 'idade'], 'Data de nascimento ou idade'],
    [2, ['sexo'], 'Sexo']
  ];
  if (!String(state.values.paisExterior || '').trim()) {
    grupos.push([3, ['ufRes'], 'UF de residência'],
      [3, ['munRes', 'ibgeRes'], 'Município de residência ou código IBGE']);
  }
  if (options.templateId !== 'form-voz-template' && state.values.sexo === 'Feminino') {
    grupos.push([2, ['gestante'], 'Situação gestacional']);
  }
  return grupos.flatMap(([tela, chaves, rotulo]) => {
    const secao = getScreens()[tela - 1];
    const campos = chaves.map(chave => secao.querySelector(
      '[data-key="' + chave + '"], [data-chips="' + chave + '"]'
    )).filter(Boolean);
    if (!campos.length || campos.some(campo => {
      const valor = String(state.values[campo.dataset.key || campo.dataset.chips] ?? '').trim();
      if (campo.dataset.key === 'codUnidNotif') return /^\d{7}$/.test(valor);
      if (campo.dataset.key === 'ibgeNotif' || campo.dataset.key === 'ibgeRes') return /^\d{6,7}$/.test(valor);
      return valor !== '';
    })) return [];
    return [{ tela, rotulo, campo: campos[0] }];
  });
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

function checarDadosDigitados() {
  const avisos = [];
  const input = chave => root.querySelector('[data-key="' + chave + '"]');
  const nascimento = input('nascimento');
  const notificacao = input('dataNotificacao') || input('dataNotif');
  const evento = config.event && input(config.event);
  const cpf = input('cpf');
  const nome = input('nome');
  if (nome?.value && !/\p{L}/u.test(nome.value)) {
    avisos.push({ campo: nome, mensagem: 'Confira o nome da pessoa notificada.' });
  }
  if (cpf?.value && !documentoValido(cpf.value, 'cpf')) {
    avisos.push({ campo: cpf, mensagem: 'Confira os dígitos do CPF da pessoa notificada.' });
  }
  for (const chave of ['cnpj', 'cnpjPrincipal', 'cnpjPrinc']) {
    const campo = input(chave);
    if (!campo?.value) continue;
    const valor = campo.value.replace(/[.\/\s-]/g, '');
    const tipo = chave === 'cnpj' && /^\d{11}$/.test(valor) ? 'cpf' : 'cnpj';
    if (!documentoValido(valor, tipo)) {
      avisos.push({ campo, mensagem: 'Confira o documento do empregador ou da empresa principal.' });
    }
  }
  if (nascimento?.value && [notificacao, evento].some(campo => campo?.value && nascimento.value > campo.value)) {
    avisos.push({ campo: nascimento, mensagem: 'A data de nascimento está depois da data da notificação ou do evento. Confira as datas.' });
  }
  const idade = input('idade');
  const unidade = input('idadeUnidade');
  if (nascimento?.value && notificacao?.value && idade?.value && /^anos?$/i.test(unidade?.value || '') &&
      nascimento.value <= notificacao.value) {
    const [anoNasc, mesNasc, diaNasc] = nascimento.value.split('-').map(Number);
    const [anoNotif, mesNotif, diaNotif] = notificacao.value.split('-').map(Number);
    const antesDoAniversario = mesNotif < mesNasc || (mesNotif === mesNasc && diaNotif < diaNasc);
    const anos = anoNotif - anoNasc - Number(antesDoAniversario);
    if (Number(idade.value) !== anos) {
      avisos.push({ campo: idade, mensagem: 'Confira a idade em anos em relação ao nascimento e à data da notificação.' });
    }
  }
  return avisos;
}

let avisosCoerencia = [];
let conferindoCoerencia = false;
async function verificarCoerencia() {
  const avisos = checarDadosDigitados().concat(window.visatConferirEmpresas?.(root) || []);
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
        campo.focus();
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
  const pendentes = camposBasicosPendentes();
  if (!pendentes.length) {
    conferindoCoerencia = true;
    btnContinuar.disabled = true;
    btnVoltar.disabled = true;
    try {
      avisosCoerencia = await verificarCoerencia();
      if (!root.isConnected) return;
      emCorrecao = false;
      showScreen(TOTAL + 1);
    } finally {
      conferindoCoerencia = false;
      btnContinuar.disabled = false;
      btnVoltar.disabled = false;
    }
    return;
  }
  emCorrecao = true;
  root.querySelector('[data-visat-pendencias]')?.remove();
  const caixa = document.createElement('section');
  caixa.className = 'highlight-box';
  caixa.dataset.visatPendencias = '1';
  const titulo = document.createElement('h2');
  titulo.textContent = 'Complete os dados básicos para finalizar';
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

function buildPrint() {
const tituloImpressao = root.querySelector('.pf-title');
if (tituloImpressao) tituloImpressao.textContent = options.obito
  ? 'Óbito por acidente de trabalho' : config.agravo;
root.querySelector('#pfDataImpressao').textContent = formatDate(new Date().toISOString().slice(0, 10));
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
      if (!control) return;
      const field = addField(block, labelText);
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
buildPrint();
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
      [['dataNotificacao', 'dataNotif'], 'Data da notificação'],
      [['ufNotif', 'ufNotificacao', 'uf'], 'UF notificadora'],
      [['munNotif', 'municipioNotif', 'municipioNotificacao', 'municipio'], 'Município notificador'],
      [['unidNotif', 'unidadeNotificadora', 'unidade'], 'Unidade notificadora'],
      [['codUnidNotif'], 'Código CNES']
    ] },
    { tela: 2, campos: [
      [['nome'], 'Nome completo'],
      [['nascimento', 'idade'], 'Data de nascimento ou idade'],
      [['sexo'], 'Sexo'],
      [['raca'], 'Raça/cor'],
      [['escolaridade'], 'Escolaridade']
    ] },
    { tela: 3, campos: [
      [['ufRes'], 'UF de residência'],
      [['munRes'], 'Município de residência']
    ] }
  ];
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
  link.href = email.href;
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
