/* Página de teste VISAT (notificacao-teste.html): versão do rascunho v22 levada ao repositório. */
const parametrosLayoutVisat = new URLSearchParams(window.location.search);
if (parametrosLayoutVisat.get('rodapeInterno') === '0') {
  document.querySelector('[data-visat-moldura="rodape"]')?.remove();
}
// Apenas quadros de altura fixa precisam de rolagem no contêiner da ficha.
if (window.self !== window.top) {
  const paginaInteira = parametrosLayoutVisat.get('paginaInteira') === '1';
  document.documentElement.classList.add(paginaInteira ? 'visat-incorporacao-integral' : 'visat-em-quadro');
}
// Guarda a altura (no quadro) do botão "Abrir formulário" clicado, para a ficha abrir nessa altura.
document.addEventListener('click', evento => {
  const botao = evento.target instanceof Element && evento.target.closest('button, a');
  if (botao && /Abrir formul/i.test(botao.textContent || '')) window.visatAlturaAbertura = botao.getBoundingClientRect().top;
}, true);
// Sem preenchimento automático do navegador (Edge/Chrome: "As informações foram salvas", "Usado pela última vez").
// O valor "off" é ignorado pelo navegador nos campos de nome e endereço; um valor não reconhecido suprime as sugestões.
// As listas próprias da ficha (CBO, CNAE, município, rua) continuam funcionando.
window.VISAT_SEM_PREENCHIMENTO = 'visat-sem-preenchimento';
window.visatSemPreenchimento = function(raiz) {
  (raiz || document).querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="date"]):not([type="time"]), textarea, select')
    .forEach(campo => {
      campo.setAttribute('autocomplete', window.VISAT_SEM_PREENCHIMENTO);
      campo.setAttribute('data-form-type', 'other');
      campo.setAttribute('data-lpignore', 'true');
    });
};
document.addEventListener('focusin', evento => {
  const campo = evento.target;
  if (campo instanceof Element && campo.matches('input, textarea, select') && campo.getAttribute('autocomplete') !== window.VISAT_SEM_PREENCHIMENTO
      && !campo.matches('[type="hidden"], [type="checkbox"], [type="radio"], [type="date"], [type="time"]')) {
    campo.setAttribute('autocomplete', window.VISAT_SEM_PREENCHIMENTO);
  }
}, true);
// Nome completo e nome da mãe sempre em CAIXA ALTA (também no PDF e no e-mail), mantendo a posição do cursor.
const VISAT_CAMPOS_MAIUSCULOS = '[data-key="nome"], [data-key="nomeMae"]';
function visatMaiusculas(campo) {
  const maiusculo = campo.value.toLocaleUpperCase('pt-BR');
  if (maiusculo === campo.value) return;
  const inicio = campo.selectionStart, fim = campo.selectionEnd;
  campo.value = maiusculo;
  try { campo.setSelectionRange(inicio, fim); } catch (erro) { /* campo sem seleção */ }
}
['input', 'change', 'blur'].forEach(tipo => document.addEventListener(tipo, evento => {
  if (evento.target instanceof Element && evento.target.matches(VISAT_CAMPOS_MAIUSCULOS)) visatMaiusculas(evento.target);
}, true));
// Caixas do tamanho do conteúdo, sem diminuir a letra: numa linha em que algum texto (rótulo, opção escolhida
// ou valor) não cabe na caixa, as larguras da linha são redistribuídas conforme o que cada campo precisa
// (ex.: Agravo maior e CID-10 menor). Linhas em que tudo cabe ficam como estão.
(function () {
  const regua = document.createElement('canvas').getContext('2d');
  function medir(texto, el) {
    const e = getComputedStyle(el);
    regua.font = e.fontWeight + ' ' + e.fontSize + ' ' + e.fontFamily;
    return regua.measureText(texto || '').width;
  }
  function campoDe(item) { return item.querySelector('select, input:not([type="hidden"]), textarea'); }
  function precisa(item) {
    const rotulo = item.querySelector(':scope > .field-label, :scope > label');
    const campo = campoDe(item);
    let largura = rotulo ? medir(rotulo.textContent.replace(/\s+/g, ' ').trim(), rotulo) + 4 : 0;
    if (campo && !campo.closest('[data-chips]')) {
      const e = getComputedStyle(campo);
      const folga = parseFloat(e.paddingLeft) + parseFloat(e.paddingRight) + (campo.tagName === 'SELECT' ? 26 : 6);
      let texto = '';
      if (campo.tagName === 'SELECT') texto = [...campo.options].reduce((m, o) => o.text.length > m.length ? o.text : m, '');
      else if (/^(date|time)$/.test(campo.type)) texto = '00/00/0000';
      else texto = campo.value || campo.placeholder || '0000';
      const unidade = item.querySelector('.unit-row select');
      const extra = unidade && unidade !== campo ? 100 : 0;
      largura = Math.max(largura, medir(texto, campo) + folga + extra);
    }
    return Math.ceil(largura);
  }
  function transborda(item) {
    const campo = campoDe(item);
    const rotulo = item.querySelector(':scope > .field-label, :scope > label');
    if (rotulo && rotulo.scrollWidth > rotulo.clientWidth + 1) return true;
    if (!campo || campo.closest('[data-chips]') || campo.tagName === 'TEXTAREA') return false;
    return precisa(item) > item.getBoundingClientRect().width + 1;
  }
  // Linha própria (Dados gerais): colunas proporcionais ao conteúdo.
  function ajustarGradePropria(linha) {
    const itens = [...linha.children].filter(el => el.offsetParent);
    if (itens.length < 2) return;
    if (!linha.dataset.visatConteudo && !itens.some(transborda)) return;
    const gap = parseFloat(getComputedStyle(linha).columnGap) || 0;
    const total = linha.clientWidth - gap * (itens.length - 1);
    const necessidades = itens.map(precisa);
    const soma = necessidades.reduce((a, b) => a + b, 0);
    // Sobra repartida igualmente, para nenhuma caixa ficar justa demais.
    const sobra = Math.max(0, total - soma) / itens.length;
    const colunas = necessidades.map(n => 'minmax(0, ' + Math.round(n + sobra) + 'fr)').join(' ');
    linha.dataset.visatConteudo = '1';
    if (linha.style.gridTemplateColumns !== colunas) {
      linha.style.gridTemplateColumns = colunas;
      itens.forEach(el => { el.style.gridColumn = 'auto'; });
    }
  }
  // Linhas da grade comum (12 colunas): spans conforme o conteúdo, somando 12.
  function ajustarLinhaComum(itens, grade) {
    if (itens.length < 2 || !itens.some(transborda)) return;
    const gap = parseFloat(getComputedStyle(grade).columnGap) || 0;
    const coluna = (grade.clientWidth - 11 * gap) / 12;
    const necessidades = itens.map(precisa);
    const minimos = necessidades.map(n => Math.max(2, Math.ceil((n + gap) / (coluna + gap))));
    let soma = minimos.reduce((a, b) => a + b, 0);
    if (soma > 12) return; // não cabe em uma linha: mantém a distribuição atual
    const spans = minimos.slice();
    while (soma < 12) {
      // Coluna extra para o campo que fica mais apertado em relação ao que precisa.
      let k = 0;
      spans.forEach((s, i) => { if (necessidades[i] / s > necessidades[k] / spans[k]) k = i; });
      spans[k]++; soma++;
    }
    itens.forEach((el, i) => {
      if (el.style.getPropertyValue('--visat-span') !== String(spans[i])) {
        el.setAttribute('data-visat-span', String(spans[i]));
        el.style.setProperty('--visat-span', String(spans[i]));
      }
    });
  }
  function ajustarTodos() {
    if (window.innerWidth < 561) return;
    document.querySelectorAll('.acidente-inline .draft-row.draft-grid-12').forEach(ajustarGradePropria);
    document.querySelectorAll('.acidente-inline .field-group').forEach(grade => {
      const itens = [...grade.querySelectorAll('[data-visat-span]')].filter(el => el.offsetParent && el.closest('.field-group') === grade);
      const linhas = new Map();
      itens.forEach(el => {
        const topo = Math.round(el.getBoundingClientRect().top);
        if (!linhas.has(topo)) linhas.set(topo, []);
        linhas.get(topo).push(el);
      });
      linhas.forEach(linha => ajustarLinhaComum(linha, grade));
    });
  }
  // Valores preenchidos automaticamente (CNPJ, CEP, CBO) não disparam eventos: revisão leve enquanto a ficha está aberta.
  setInterval(() => { if (document.body.classList.contains('modo-formulario-acidente')) { window.visatRotulosCurtos(); ajustarTodos(); } }, 700);
  window.addEventListener('resize', () => setTimeout(ajustarTodos, 300));
})();
// Rótulos curtos em todas as fichas (sem "da/do/de" quando o sentido se mantém).
const VISAT_ROTULOS = {
"Data da notificação": "Data notificação",
"Data de nascimento": "Data nascimento",
"Data do acidente": "Data acidente",
"Data do atendimento": "Data atendimento",
"Data do diagnóstico": "Data diagnóstico",
"Data do óbito": "Data óbito",
"Data de início dos sintomas": "Início sintomas",
"Hora do acidente": "Hora acidente",
"Tipo de notificação": "Tipo notificação",
"Tipo de acidente": "Tipo acidente",
"Tipo de exposição": "Tipo exposição",
"Tipo de ruído predominante": "Ruído predominante",
"Município de notificação": "Município notificação",
"Município de residência": "Município residência",
"Município de ocorrência do acidente": "Município ocorrência",
"Município do atendimento": "Município atendimento",
"Município do local de trabalho": "Município local trabalho",
"UF de notificação": "UF notificação",
"UF de residência": "UF residência",
"UF da ocorrência": "UF ocorrência",
"UF do atendimento": "UF atendimento",
"UF do local de trabalho": "UF local trabalho",
"UF da empresa": "UF empresa",
"Município da empresa": "Município empresa",
"Código IBGE da empresa": "Código IBGE empresa",
"Bairro da empresa": "Bairro empresa",
"Endereço da empresa": "Endereço empresa",
"(DDD) Telefone da empresa": "Telefone empresa",
"Código IBGE da ocorrência": "Código IBGE ocorrência",
"Código IBGE do atendimento": "Código IBGE atendimento",
"Código IBGE do local de trabalho": "Código IBGE local trabalho",
"Código CNES do estabelecimento": "Código CNES estabelecimento",
"Código da unidade": "Código unidade",
"País de residência": "País residência",
"Nome do país de residência": "Nome país residência",
"CEP do local de trabalho": "CEP local trabalho",
"Logradouro do local de trabalho": "Logradouro local trabalho",
"CNPJ ou CPF do empregador": "CNPJ ou CPF empregador",
"Telefone do empregador": "Telefone empregador",
"Empresa ou empregador (nome)": "Empresa ou empregador",
"CNAE da empresa principal": "CNAE empresa principal",
"CNPJ da empresa principal (contratante)": "CNPJ empresa principal (contratante)",
"Nome da empresa principal (contratante)": "Nome empresa principal (contratante)",
"O empregador é empresa terceirizada?": "Empregador terceirizado?",
"Trabalha com plataformas digitais (aplicativos)?": "Trabalha por aplicativo?",
"Unidade de saúde ou fonte notificadora": "Unidade ou fonte notificadora",
"Estabelecimento de saúde do atendimento": "Estabelecimento atendimento",
"Tempo de trabalho na ocupação": "Tempo na ocupação",
"Tempo de exercício na ocupação": "Tempo na ocupação",
"Situação no mercado de trabalho": "Situação mercado de trabalho",
"Tempo de afastamento do trabalho para tratamento": "Tempo afastamento para tratamento",
"Houve afastamento do trabalho para tratamento?": "Houve afastamento para tratamento?",
"Tempo de exposição ao agente de risco": "Tempo exposição ao agente",
"Tempo de exposição ao tabaco": "Tempo exposição ao tabaco",
"Tempo de exposição às situações de risco": "Tempo exposição às situações de risco",
"Tempo desde o início da jornada (horas e minutos)": "Horas após início da jornada",
"Evolução do caso": "Evolução",
"Regime de tratamento": "Regime tratamento",
"Hábito de fumar": "Tabagismo",
"Uso de EPI no momento do acidente": "Uso EPI no acidente",
"Conduta no momento do acidente": "Conduta no acidente",
"Circunstância do acidente": "Circunstância",
"Localização da lesão (parte do corpo atingida)": "Localização lesão",
"Especifique a parte do corpo atingida": "Outra parte do corpo",
"Principal agente causador da dermatose": "Agente causador principal",
"Resultado da avaliação funcional": "Resultado avaliação funcional",
"Avaliação funcional (prova de função pulmonar)": "Prova de função pulmonar",
"Situação vacinal do acidentado para hepatite B (3 doses)": "Vacina hepatite B (3 doses)",
"Município/Unidade de saúde investigadora": "Município/unidade investigadora",
"Nome do investigador": "Nome investigador",
"Número da Declaração de Óbito, se disponível": "Número DO, se disponível",
"Descrição do acidente / exposição": "Descrição acidente/exposição",
"Há ou houve outros trabalhadores com a mesma doença no local de trabalho?": "Outros trabalhadores com a mesma doença?",
"Houve exposição, durante toda a vida profissional, a algum dos agentes abaixo?": "Exposição na vida profissional a algum agente abaixo?",
"A exposição a poeiras e minerais ocorreu em um ou mais vínculos distintos da empresa?": "Exposição em mais de um vínculo?",
"O paciente foi encaminhado a um Centro de Atenção Psicossocial (CAPS) no SUS ou outro serviço especializado em tratamento de transtornos mentais?": "Encaminhado ao CAPS ou serviço especializado?",
"O paciente está exposto em seu local de trabalho a": "Exposto no trabalho a",
"Limitação e incapacidade para o exercício de tarefas": "Limitação para tarefas",
"Com afastamento do trabalho, o quadro": "Com afastamento, o quadro",
"Com afastamento do trabalho": "Com afastamento, o quadro",
"Histórico de saúde vocal e tratamentos": "Histórico vocal e tratamentos",
"Agentes aos quais houve exposição": "Agentes de exposição",
"Se alta com conversão sorológica, qual vírus": "Vírus da soroconversão",
"Local onde ocorreu": "Local ocorrência",
"Diagnóstico específico — CID-10": "CID-10 diagnóstico",
"CID da causa externa (cap. XX — V01 a Y98)": "CID causa externa (V01–Y98)",
"CID da lesão (cap. XIX — S00 a T98)": "CID lesão (S00–T98)"
};
window.visatRotulosCurtos = function (raiz) {
  (raiz || document).querySelectorAll('.acidente-inline .field-label, .acidente-inline label').forEach(rotulo => {
    for (const no of rotulo.childNodes) {
      if (no.nodeType !== 3 || !no.textContent.trim()) continue;
      const texto = no.textContent.replace(/\s+/g, ' ').trim().replace(/\s*\*$/, '');
      const novo = VISAT_ROTULOS[texto];
      if (novo) no.textContent = no.textContent.replace(/\S[\s\S]*?(?=\s*\*?\s*$)/, novo);
      break;
    }
  });
};
window.aplicarLayoutRascunho = function(root) {
  window.visatRotulosCurtos(root);
  window.visatSemPreenchimento(root);
  // CNAE: descrição longa ("72400 – Atividades de banco de dados...") ocupa meia linha, como os nomes de empresa.
  root.querySelectorAll('[data-key="cnae"], [data-key="cnaePrincipal"], #visat-cnae').forEach(campo => {
    let caixa = campo;
    while (caixa.parentElement && !caixa.parentElement.matches('.field-group, .draft-row, .visat-linha-campos, .pair-row')) caixa = caixa.parentElement;
    caixa.setAttribute('data-visat-peso', '2');
  });
  root.querySelectorAll(VISAT_CAMPOS_MAIUSCULOS).forEach(visatMaiusculas);
  function campoDaGrade(grade, chaves) {
    if (!chaves) return null;
    for (const chave of chaves.split('|')) {
      const campo = grade.querySelector('#' + chave + ', [data-key="' + chave + '"], [data-chips="' + chave + '"]');
      if (campo) return campo;
    }
    return null;
  }

  function organizar(grade, linhas) {
    if (!grade) return;
    const novasLinhas = document.createDocumentFragment();
    for (const chaves of linhas) {
      const campos = chaves.map(chave => campoDaGrade(grade, chave));
      const linha = document.createElement('div');
      linha.className = 'draft-row draft-cols-' + chaves.length;
      for (const campo of campos) {
        if (!campo) continue;
        const caixa = campo.closest('.unit-row')?.parentElement || campo.parentElement;
        linha.append(caixa);
      }
      if (linha.childElementCount) novasLinhas.append(linha);
    }
    grade.prepend(novasLinhas);
    grade.querySelectorAll('.visat-linha-campos').forEach(linha => {
      if (!linha.childElementCount && !linha.textContent.trim()) linha.remove();
    });
  }

  const gerais = root.querySelector('.screen[data-screen="1"]');
  // Dados gerais em grade de 12 colunas: largura de cada campo proporcional ao conteúdo esperado.
  (function organizarDadosGerais(grade) {
    if (!grade) return;
    const caixa = id => {
      const campo = grade.querySelector('#' + id);
      return campo ? (campo.closest('.unit-row')?.parentElement || campo.parentElement) : null;
    };
    const datasEvento = [...grade.querySelectorAll(':scope > div > input[type="date"]')]
      .filter(campo => campo.id !== 'sinan-data-notif' && !['dataObito'].includes(campo.dataset.key))
      .map(campo => campo.parentElement);
    const linha = itens => {
      const elemento = document.createElement('div');
      elemento.className = 'draft-row draft-grid-12';
      for (const [bloco, colunas] of itens) {
        if (!bloco) continue;
        bloco.classList.add('draft-span-' + colunas);
        elemento.append(bloco);
      }
      return elemento;
    };
    // Ordem da ficha do SINAN: 1 tipo, 2 agravo/CID, 3 data, 4 UF, 5 município, 6 unidade, 7 data do evento.
    const linhas = [
      // Caixas do mesmo tamanho: 4 por linha (3 colunas cada) ou 3 por linha (4 colunas cada).
      linha([[caixa('sinan-tipo'), 4], [caixa('sinan-agravo'), 4], [caixa('sinan-cidAgravo'), 4]]),
      linha([[caixa('sinan-data-notif'), 3], [caixa('sinan-uf-notif'), 3], [caixa('sinan-mun-notif'), 3], [caixa('sinan-ibge-notif'), 3]])
    ];
    const unidade = caixa('sinan-unid');
    const cnes = caixa('sinan-cod-unid');
    // A orientação sobre a lista de unidades refere-se ao nome da unidade, não ao código.
    const ajudaCnes = cnes?.querySelector(':scope > .field-help');
    if (unidade && ajudaCnes) unidade.append(ajudaCnes);
    // Ficha com um único CID do caso: o campo entra na grade, sem seção própria com um campo sozinho.
    const blocoCid = gerais.querySelector('.draft-cid');
    const camposCid = blocoCid ? [...blocoCid.querySelectorAll(':scope > .field-group > div')] : [];
    const extras = datasEvento.concat(camposCid.length === 1 ? camposCid : []);
    if (camposCid.length === 1) blocoCid.remove();
    // Linha da unidade na mesma grade de 4 colunas: unidade e CID ocupam metade; código e datas, um quarto.
    if (unidade) unidade.setAttribute('data-visat-peso', '2');
    camposCid.forEach(bloco => bloco.setAttribute('data-visat-peso', '2'));
    const itensUnidade = [unidade, cnes, ...extras].filter(Boolean);
    const empacotadas = window.visatEmpacotarLinhas ? window.visatEmpacotarLinhas(itensUnidade)
      : [{ itens: itensUnidade, celulas: itensUnidade.map(() => 4 / itensUnidade.length) }];
    empacotadas.forEach(({ itens, celulas }) => linhas.push(linha(itens.map((bloco, k) => [bloco, celulas[k] * 3]))));
    grade.prepend(...linhas);
    grade.querySelectorAll('input[readonly]').forEach(campo => { campo.title = campo.title || 'Preenchido automaticamente'; });
  })(gerais.querySelector('.field-group'));
  // Etapa do acidente na ordem do SINAN: 34 local, 50 hora, 51 horas após a jornada, 52 UF, 53 município,
  // 55 tipo, 56 e 57 outros trabalhadores atingidos, 58 atendimento médico.
  (function ordenarAcidente() {
    const tipo = root.querySelector('[data-chips="tipoAcidente"]');
    const grade = tipo?.closest('.field-group');
    if (!grade) return;
    const bloco = seletor => {
      const el = grade.querySelector(seletor);
      if (!el) return null;
      let caixa = el;
      while (caixa.parentElement && caixa.parentElement !== grade) caixa = caixa.parentElement;
      return caixa.parentElement === grade ? caixa : null;
    };
    const ordem = ['[data-chips="local"]', '[data-key="horaAcidente"]', '[data-key="tempoJornada"]', '[data-key="ufOcorrencia"]',
      '[data-key="munOcorrencia"]', '[data-key="ibgeOcorrencia"]', '[data-chips="tipoAcidente"]', '[data-key="outrosAtingidos"], [data-chips="outrosAtingidos"]']
      .map(bloco).filter((caixa, i, todos) => caixa && todos.indexOf(caixa) === i);
    if (ordem.length < 2) return;
    const primeiro = ordem.slice().sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)[0];
    const marca = document.createComment('ordem SINAN');
    primeiro.before(marca);
    marca.replaceWith(...ordem);
    // "Quantos trabalhadores?" logo depois de "Houve outros trabalhadores atingidos?".
    const quantos = grade.querySelector('[data-key="outrosAtingidosQuantidade"]')?.parentElement;
    const outros = grade.querySelector('[data-key="outrosAtingidos"], [data-chips="outrosAtingidos"]');
    let caixaOutros = outros;
    while (caixaOutros && caixaOutros.parentElement && !caixaOutros.parentElement.matches('.visat-linha-campos, .field-group')) caixaOutros = caixaOutros.parentElement;
    if (quantos && caixaOutros && caixaOutros !== quantos) caixaOutros.after(quantos);
  })();
  // Painel "Como ocorreu" (rascunho VISAT aprovado em 17/11/2026): forma, detalhe, local onde ocorreu e CID-10 da causa
  // (campo 54) juntos, logo depois do tipo de acidente.
  (function painelComoOcorreu() {
    const como = root.querySelector('[data-chips="comoOcorreu"]');
    const causa = root.querySelector('[data-key="cidCausa"]');
    const tipo = root.querySelector('[data-chips="tipoAcidente"]');
    if (!como || !causa || !tipo) return;
    const caixaDe = el => {
      let caixa = el;
      while (caixa?.parentElement && !caixa.parentElement.matches('.field-group, .draft-row, .visat-linha-campos')) caixa = caixa.parentElement;
      return caixa;
    };
    const painel = document.createElement('section');
    painel.className = 'visat-painel-causa';
    painel.setAttribute('aria-labelledby', 'visat-painel-causa-titulo');
    painel.innerHTML = '<div class="visat-painel-causa-cabecalho"><h3 id="visat-painel-causa-titulo">Como ocorreu <span class="visat-obrigatorio" aria-hidden="true">*</span></h3>' +
      '<span class="visat-etiqueta">Gera o CID da causa</span></div>' +
      '<div class="visat-painel-causa-grade"></div>';
    const grade = painel.querySelector('.visat-painel-causa-grade');
    const caixaComo = como.parentElement;
    const rotuloComo = caixaComo.querySelector('.field-label');
    if (rotuloComo) rotuloComo.textContent = 'Forma';
    const pegar = seletor => { const el = root.querySelector(seletor); return el ? caixaDe(el) : null; };
    const itens = [caixaComo, pegar('[data-key="detalheCausa"]'), pegar('[data-chips="local"]'),
      pegar('[data-key="tipoLocalInstalacoes"]'), pegar('[data-key="vitimaVeiculo"]')].filter(Boolean);
    const caixaCausa = caixaDe(causa);
    const rotuloCausa = caixaCausa.querySelector('.field-label');
    if (rotuloCausa) rotuloCausa.textContent = 'CID-10 da causa';
    caixaCausa.classList.add('visat-painel-causa-resultado');
    const destino = caixaDe(tipo);
    const linhaTipo = destino.closest('.draft-row, .visat-linha-campos') || destino;
    const atendimento = root.querySelector('[data-key="dataAtendimento"]')?.closest('[data-show-when="atendimentoMedico=Sim"]');
    (atendimento || linhaTipo).after(painel);
    grade.append(...itens);
    painel.append(caixaCausa);
  })();
  // CAT emitida? fica na Conclusão, logo depois de Evolução do caso, como na ficha do SINAN.
  (function moverCat() {
    const caixaDe = el => {
      let caixa = el;
      while (caixa?.parentElement && !caixa.parentElement.matches('.field-group, .draft-row, .visat-linha-campos')) caixa = caixa.parentElement;
      return caixa;
    };
    const cat = root.querySelector('[data-chips="cat"]');
    const evolucao = root.querySelector('[data-chips="evolucao"]');
    if (!cat || !evolucao) return;
    const caixaCat = caixaDe(cat), caixaEvolucao = caixaDe(evolucao);
    if (caixaCat && caixaEvolucao && !caixaCat.contains(evolucao)) caixaEvolucao.after(caixaCat);
  })();
  // Pesos de largura: campos de texto longo ganham mais espaço na linha.
  [['[data-key="ocupacao"]', 2], ['[data-key="ocupacaoAnterior"]', 2], ['#sinan-nome', 2], ['#sinan-mae', 2], ['#sinan-logr', 2],
   ['[data-key="endEmp"], [data-key="endereco"]', 2], ['[data-key="empresa"], [data-key="empresaNome"], [data-key="razao"]', 2],
   ['[data-key="munEmp"]', 2], ['#sinan-mun-res', 2], ['[data-key="munOcorrencia"]', 2], ['[data-key="munAtendimento"]', 2],
   ['[data-key="unidAtendimento"]', 2], ['#profissional, #can-prof, #der-profissional, [id$="-prof"], [id$="-profissional"]', 2],
   ['[data-key="empresaPrincipal"], [data-key="razaoPrincipal"], [data-key="razaoPrinc"]', 2]]
    .forEach(([seletor, peso]) => root.querySelectorAll(seletor).forEach(campo => {
      let caixa = campo;
      while (caixa.parentElement && !caixa.parentElement.matches('.field-group, .draft-row, .visat-linha-campos, .pair-row')) caixa = caixa.parentElement;
      caixa.setAttribute('data-visat-peso', String(peso));
    }));
  const agravo = gerais.querySelector('#sinan-agravo');
  agravo.title = agravo.value;

  const pessoa = root.querySelector('.screen[data-screen="2"]');
  pessoa.querySelector('.screen-title').textContent = 'Pessoa notificada';
  // Ordem da ficha do SINAN (campos 8 a 16). O telefone (campo 28) fica nos dados de residência.
  organizar(pessoa.querySelector('.field-group'), [
    ['sinan-nome', 'sinan-nasc', 'sinan-idade'],
    ['sexo', 'gestante', 'raca'],
    ['sinan-esc', 'sinan-cpf', 'sinan-sus'],
    ['sinan-mae']
  ]);

  const residencia = root.querySelector('#sinan-residencia');
  organizar(residencia.querySelector(':scope > .field-group'), [
    ['sinan-residencia-pais', 'sinan-pais']
  ]);
  const gradeEndereco = residencia.querySelector('.visat-endereco-residencia');
  // País de residência entra na grade do endereço, para não ficar sozinho numa linha.
  const linhaPais = residencia.querySelector('#sinan-residencia-pais')?.closest('.draft-row');
  gradeEndereco.append(residencia.querySelector('[data-chips="zona"]').parentElement);
  // Ordem da ficha do SINAN (campos 17 a 29). O país fica no início porque define quais campos aparecem.
  const telefone = root.querySelector('#sinan-tel');
  if (telefone) gradeEndereco.append(telefone.closest('.unit-row')?.parentElement || telefone.parentElement);
  // Geo campo 1 e 2 retirados da ficha (decisão VISAT 17/11/2026: uso interno da digitação).
  organizar(gradeEndereco, [
    ['sinan-uf-res', 'sinan-mun-res', 'sinan-ibge-res'],
    ['sinan-bairro', 'sinan-logr', 'sinan-num'],
    ['sinan-comp', 'sinan-cep', 'sinan-tel'],
    ['zona']
  ]);
  if (linhaPais && gradeEndereco) gradeEndereco.prepend(linhaPais);

  const emprego = [...root.querySelectorAll('.screen')].find(tela =>
    tela.querySelector('.screen-title')?.textContent === 'Trabalho e empregador');
  const [trabalho, empregador, endereco] = emprego.querySelectorAll(':scope > .field-group > .visat-sequencia > .field-group');
  emprego.querySelector('.screen-title').insertAdjacentHTML('afterend', '<p class="screen-sub">Ocupação, empresa ou empregador e endereço da empresa, como na ficha do Sinan.</p>');
  organizar(trabalho, [
    ['ocupacao', 'situacao'],
    ['tempoNum|tempoValor|tempoOcupacao|tempoOcup', 'ocupacaoAnterior']
  ]);
  // Ordem da ficha do SINAN: 35 CNPJ/CPF, 36 nome, 37 CNAE, 38 UF, 39 município; 46 terceirizada; 47 CNAE, 48 CNPJ e 49 razão social da principal.
  organizar(empregador, [
    ['cnpj', 'empresa|empresaNome|razao', 'cnae'],
    ['situacaoCadastral', 'matrizFilial', 'cnaeSecundario'],
    ['ufEmp', 'munEmp', 'ibgeEmp'],
    ['terceirizada']
  ]);
  const contratante = [];
  if (campoDaGrade(empregador, 'cnaePrincipal|cnaePrinc')) contratante.push('cnaePrincipal|cnaePrinc');
  contratante.push('cnpjPrincipal|cnpjPrinc', 'empresaPrincipal|razaoPrincipal|razaoPrinc');
  organizar(empregador, [contratante]);
  const linhaContratante = empregador.firstElementChild;
  empregador.querySelector('[data-key="terceirizada"], [data-chips="terceirizada"]').closest('.draft-row').after(linhaContratante);
  // Ordem da ficha do SINAN: 40 distrito, 41 bairro, 42 endereço, 43 número, 45 telefone.
  organizar(endereco, [
    ['bairroEmp|bairro', 'endEmp|endereco', 'numEmp|numero'],
    ['telEmp|telefone', 'cepEmp']
  ]);
  // 46 terceirizada e 47 a 49 empresa principal vêm depois do telefone (45), como na ficha do SINAN.
  const linhaTerceirizada = empregador.querySelector('[data-key="terceirizada"], [data-chips="terceirizada"]')?.closest('.draft-row');
  if (linhaTerceirizada && endereco) {
    const seguinte = linhaTerceirizada.nextElementSibling;
    endereco.append(linhaTerceirizada);
    if (seguinte && seguinte.classList.contains('draft-row') && seguinte.querySelector('[data-key*="rincipal"], [data-key*="rinc"]')) endereco.append(seguinte);
  }
  // Distrito do local de trabalho (ficha de material biológico) junto ao endereço do empregador.
  const distrito = root.querySelector('[data-key="distEmp"]');
  if (distrito && endereco && !endereco.contains(distrito)) {
    const grupoAntigo = distrito.closest('.field-group');
    const bairro = endereco.querySelector('[data-key="bairroEmp"], [data-key="bairro"]');
    if (bairro) bairro.parentElement.before(distrito.parentElement);
    else endereco.prepend(distrito.parentElement);
    if (grupoAntigo && !grupoAntigo.querySelector('[data-key], [data-chips]')) {
      const secao = grupoAntigo.closest('[data-visat-secao-complementar], section');
      if (secao && secao !== grupoAntigo) secao.hidden = true;
    }
  }

  // Responsável pela notificação (rascunho VISAT): nome, função, e-mail e data juntos, no fim da ficha.
  (function grupoResponsavel() {
    const nome = root.querySelector('[data-key="profissional"], [data-key="investigador"]');
    if (!nome) return;
    const caixa = el => el ? (el.closest('.unit-row')?.parentElement || el.parentElement) : null;
    // Última etapa preenchível (a tela de conclusão, com o resumo, fica de fora).
    const telas = [...root.querySelectorAll('.screen[data-screen]')].filter(t => !t.querySelector('#summaryGrid'));
    const ultima = telas[telas.length - 1];
    const grade = ultima?.querySelector(':scope > .field-group') || ultima;
    if (!grade) return;
    const secao = document.createElement('section');
    secao.className = 'visat-sequencia';
    secao.dataset.visatResponsavel = '';
    secao.innerHTML = '<h3 class="visat-sequencia-titulo">Responsável pela notificação</h3><div class="field-group"></div>';
    const campos = secao.querySelector('.field-group');
    const origens = new Set();
    const linha = document.createElement('div');
    linha.className = 'draft-row draft-cols-3';
    [nome, root.querySelector('[data-key="funcaoProfissional"], [data-key="funcao"], [data-key="funcaoInvestigador"]'),
      root.querySelector('[data-key="emailProfissional"]')].forEach(el => {
      const c = caixa(el);
      if (!c) return;
      origens.add(c.parentElement);
      linha.append(c);
    });
    campos.append(linha);
    const data = root.querySelector('[data-key="dataFechamento"]');
    if (data && caixa(data)) {
      const c = caixa(data);
      origens.add(c.parentElement);
      const rotulo = c.querySelector('.field-label');
      if (rotulo && rotulo.textContent.trim() === 'Data') rotulo.textContent = 'Data do preenchimento';
      const linhaData = document.createElement('div');
      linhaData.className = 'draft-row draft-cols-3';
      linhaData.append(c);
      campos.append(linhaData);
    }
    grade.append(secao);
    origens.forEach(o => {
      if (o && o !== linha && o.matches('.pair-row, .draft-row, .visat-linha-campos') && !o.querySelector('input, select, textarea, [data-chips]')) o.remove();
    });
  })();

// Reuse original chip events and state while presenting the approved dropdowns.
// Também em lista: "Há ou houve outros trabalhadores com a mesma doença no local de trabalho?" (rótulo longo, opções curtas).
const chavesEmLista = new Set(['sexo', 'gestante', 'raca', 'comoOcorreu', 'local', 'tipoRuido', 'regime']);
const resultadosExame = new Set(['sorAntiHIV', 'sorHBsAg', 'sorAntiHBs', 'sorAntiHCV',
  'fonteHBsAg', 'fonteAntiHBc', 'fonteAntiHBs', 'fonteAntiHIV', 'fonteAntiHCV']);
const respostasPadrao = new Set(['sim', 'não', 'ignorado', 'não se aplica']);
for (const grupo of root.querySelectorAll('[data-chips]')) {
  const chave = grupo.dataset.chips;
  const rotulo = grupo.previousElementSibling?.textContent.trim();
  const chips = [...grupo.querySelectorAll('.chip')];
  const respostas = [...new Set(chips.map(chip => chip.dataset.value?.trim().toLowerCase()))];
  const listaPadrao = grupo.dataset.single === 'true' && respostas.length >= 2 &&
    (respostas.length <= 3 || respostas.every(resposta => respostasPadrao.has(resposta)));
  if (!chavesEmLista.has(chave) && !resultadosExame.has(chave) && !/^Há ou houve outros trabalhadores/i.test(rotulo || '') && !listaPadrao) continue;

  const select = document.createElement('select');
  select.className = 'input';
  select.setAttribute('aria-label', { sexo: 'Sexo', gestante: 'Gestante', raca: 'Raça/cor' }[chave] || rotulo || chave);
  select.add(new Option('Selecione', ''));
  select.options[0].disabled = true;
  const opcoes = new Map();
  for (const chip of chips) {
    if (opcoes.has(chip.dataset.value)) continue;
    opcoes.set(chip.dataset.value, chip);
    select.add(new Option(chip.textContent.trim(), chip.dataset.value));
  }
  select.addEventListener('change', () => opcoes.get(select.value)?.click());
  grupo.after(select);
  grupo.style.display = 'none';

  function sincronizar() {
    select.value = chips.find(chip => chip.classList.contains('selected'))?.dataset.value || '';
    for (const opcao of [...select.options].slice(1)) {
      opcao.disabled = opcoes.get(opcao.value).disabled;
    }
    select.disabled = chips.every(chip => chip.disabled);
  }
  new MutationObserver(sincronizar).observe(grupo, {
    attributes: true, subtree: true, attributeFilter: ['class', 'disabled', 'aria-pressed']
  });
  sincronizar();
}
for (const secao of root.querySelectorAll('[data-visat-secao-complementar]')) {
  const titulo = secao.querySelector(':scope > .screen-title');
  if (!titulo) continue;
  const subtitulo = document.createElement('h3');
  subtitulo.className = 'screen-title draft-subtitulo';
  subtitulo.textContent = titulo.textContent;
  titulo.replaceWith(subtitulo);
}
for (const [indice, opcoes] of [...root.querySelectorAll('[data-chips]')].entries()) {
  if (opcoes.querySelectorAll('.chip').length > 4) opcoes.classList.add('draft-opcoes');
  const rotulo = opcoes.previousElementSibling;
  if (rotulo?.classList.contains('field-label')) {
    if (!rotulo.id) rotulo.id = 'opcoes-visat-' + indice;
    opcoes.setAttribute('role', 'group');
    opcoes.setAttribute('aria-labelledby', rotulo.id);
  }
}
root.querySelectorAll('details').forEach(d=>d.open=true);
for (const tela of root.querySelectorAll('.screen:not(.visat-tela-final)')) {
  const titulo = tela.querySelector(':scope > .screen-title');
  if (!titulo) continue;
  const cabecalho = document.createElement('header');
  cabecalho.className = 'draft-card-head';
  const numero = document.createElement('span');
  numero.className = 'draft-card-number';
  numero.setAttribute('aria-hidden', 'true');
  numero.textContent = tela.dataset.screen.padStart(2, '0');
  const texto = document.createElement('div');
  const subtitulo = tela.querySelector(':scope > .screen-sub');
  titulo.before(cabecalho);
  cabecalho.append(numero, texto);
  texto.append(titulo);
  if (subtitulo) texto.append(subtitulo);
}
};
(function () {
  const original = window.aplicarLayoutRascunho;
  window.aplicarLayoutRascunho = function (root) {
    original(root);
    for (const aviso of root.querySelectorAll('.top-bar .hospital-alert-container')) {
      if (aviso.textContent.trim().startsWith('Ao concluir,')) aviso.remove();
    }
  };
})();

// ===== Fim da ficha "congelado" no Google Sites =====
// Ao chegar ao fim da ficha, ela não se move mais: a rolagem passa para a página do Sites (só o rodapé sobe e desce).
// Na volta, a página desce primeiro até a borda inferior do quadro sair da tela; só então a ficha volta a rolar.
// O quadro é de outro domínio: a posição do quadro na tela vem de um IntersectionObserver em uma marca fixa
// na borda inferior do quadro (visível = rodapé do Sites aparecendo abaixo da ficha).
(function congelarFimDaFicha() {
  if (!document.documentElement.classList.contains('visat-em-quadro') || !('IntersectionObserver' in window)) return;
  let bordaVisivel = false;
  let marca;
  function rolagem() {
    return document.body && document.body.classList.contains('modo-formulario-acidente') ? document.getElementById('principal') : null;
  }
  function atualizar() {
    const el = rolagem();
    if (!el) return;
    const noFim = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    el.classList.toggle('visat-fim-congelado', bordaVisivel && noFim);
  }
  function iniciar() {
    if (marca) return;
    marca = document.createElement('div');
    marca.setAttribute('aria-hidden', 'true');
    marca.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:2px;pointer-events:none;opacity:0;';
    document.body.appendChild(marca);
    new IntersectionObserver(entradas => {
      bordaVisivel = entradas.some(e => e.isIntersecting && e.intersectionRatio > 0);
      atualizar();
    }, { threshold: [0, 0.5, 1] }).observe(marca);
    document.addEventListener('scroll', atualizar, true);
    ['click', 'change', 'input', 'keyup'].forEach(tipo => document.addEventListener(tipo, () => requestAnimationFrame(atualizar), true));
    window.addEventListener('resize', atualizar);
    if ('ResizeObserver' in window) {
      new ResizeObserver(atualizar).observe(document.body);
    }
    if ('MutationObserver' in window) {
      new MutationObserver(atualizar).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  }
  if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
})();
