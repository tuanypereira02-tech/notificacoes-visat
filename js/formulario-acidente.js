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
    storageKey: obito ? 'notificacao-obito-v1-inline' : 'notificacao-acidente-v1-inline',
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
const STORAGE_KEY = options.storageKey;
const config = blocosSinan[options.templateId];
const defaults = {
  [config.aliases.dataNotificacao || 'dataNotificacao']: new Date().toISOString().slice(0, 10),
  ...options.defaults
};
const defaultState = () => ({ screen: 1, values: {}, calcManual: false });
const status = root.querySelector('#form-status');
const setStatus = (message) => { status.textContent = message; };
let state = defaultState();
try {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved) state = JSON.parse(saved);
} catch (error) {
  console.error('Nao foi possivel carregar o rascunho do formulario.', error);
  setStatus('O rascunho nao pode ser carregado do armazenamento deste navegador.');
}
if (!state || typeof state !== 'object') state = defaultState();
if (!state.values) state.values = {};
if (state.sinanLayout !== 1) {
  state.screen = 1;
  state.sinanLayout = 1;
}
if (!state.screen) state.screen = 1;

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


function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Nao foi possivel salvar o rascunho do formulario.', error);
    setStatus('O rascunho nao pode ser salvo neste navegador.');
  }
}

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
save();
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
  let d = String(valor).replace(/\D/g, '');
  if (d.length <= 11) return mascaraCpf(d);
  d = d.slice(0, 14);
  return d.replace(/^(\d{2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2}).*/, (m, a, b, c, e, f) =>
    [a, b, c].filter(Boolean).join('.') + (e ? '/' + e : '') + (f ? '-' + f : ''));
}
root.querySelectorAll('[data-mask="cpf"], #cpf').forEach((campo) => {
  campo.addEventListener('input', () => {
    campo.value = mascaraCpf(campo.value);
  });
});
root.querySelectorAll('[data-mask="cnpj"], #cnpj').forEach((campo) => {
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

function isFilled(key) {
const v = state.values[key];
if (Array.isArray(v)) return v.length > 0;
return v !== undefined && String(v).trim() !== '';
}

function validateCurrent() {
const screen = getScreens().find(s => s.dataset.screen == state.screen);
const missing = [];
return missing;
}

function showErrors(missing) {
missing.forEach(key => {
const err = root.querySelector('[data-err="' + key + '"]');
if (err) err.classList.add('show');
const input = root.querySelector('[data-key="' + key + '"]');
if (input) input.classList.add('invalid');
});
}

function renderProgress() {
progSegs.forEach((seg, i) => {
seg.classList.toggle('done', i < state.screen);
});
}

function showScreen(n) {
state.screen = n;
getScreens().forEach(s => s.classList.toggle('active', Number(s.dataset.screen) === n));
const isDone = n === TOTAL + 1;
bottomBar.style.display = isDone ? 'none' : 'block';
counter.textContent = isDone ? 'Concluído' : 'Tela ' + n + ' de ' + TOTAL;
btnVoltar.style.visibility = n === 1 ? 'hidden' : 'visible';
btnContinuar.textContent = n === TOTAL ? 'Concluir notificação' : 'Seguinte';
renderProgress();
save();
area.scrollTop = 0;
if (isDone) buildSummary();
}

function buildPrint() {
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

function buildSummary() {
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
persistInputs();
if (state.screen < TOTAL) {
showScreen(state.screen + 1);
} else {
showScreen(TOTAL + 1);
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
state = { screen: 1, values: { ...defaults }, calcManual: false, sinanLayout: 1 };
if (root.querySelector('[data-key="dataFechamento"]')) state.values.dataFechamento = today;
save();
root.querySelectorAll('[data-key]').forEach(el => {
  el.value = state.values[el.dataset.key] || '';
  el.classList.remove('invalid');
});
root.querySelectorAll('.chip.selected').forEach(c => c.classList.remove('selected'));
root.querySelectorAll('.field-error').forEach(e => e.classList.remove('show'));
dlg.close();
showScreen(1);
setStatus('Novo formulario pronto para preenchimento.');
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
