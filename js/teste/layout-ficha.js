/* Página de teste VISAT (notificacao-teste.html): versão do rascunho v22 levada ao repositório. */
window.aplicarLayoutRascunho = function(root) {
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
    // Ordem da ficha do SINAN: Nº, 1 tipo, 2 agravo/CID, 3 data, 4 UF, 5 município, 6 unidade, 7 data do evento.
    const linhas = [
      // Caixas do mesmo tamanho: 4 por linha (3 colunas cada) ou 3 por linha (4 colunas cada).
      linha([[caixa('sinan-numeroNotificacao'), 3], [caixa('sinan-tipo'), 3], [caixa('sinan-agravo'), 3], [caixa('sinan-cidAgravo'), 3]]),
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
    ['sinan-esc', 'sinan-sus', 'sinan-cpf'],
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
  // Geo campo 1 e 2 (campos 24 e 25 do SINAN) entre Complemento e Ponto de referência.
  ['#sinan-geo1', '#sinan-geo2'].forEach(id => { const geo = root.querySelector(id); if (geo) gradeEndereco.append(geo.parentElement); });
  organizar(gradeEndereco, [
    ['sinan-uf-res', 'sinan-mun-res', 'sinan-ibge-res'],
    ['sinan-bairro', 'sinan-logr', 'sinan-num'],
    ['sinan-comp', 'sinan-geo1', 'sinan-geo2'],
    ['sinan-ref', 'sinan-cep', 'sinan-tel'],
    ['zona']
  ]);
  if (linhaPais && gradeEndereco) gradeEndereco.prepend(linhaPais);

  const emprego = [...root.querySelectorAll('.screen')].find(tela =>
    tela.querySelector('.screen-title')?.textContent === 'Trabalho e empregador');
  const [trabalho, empregador, endereco] = emprego.querySelectorAll(':scope > .field-group > .visat-sequencia > .field-group');
  emprego.querySelector('.screen-title').insertAdjacentHTML('afterend', '<p class="screen-sub">Ocupação, identificação do empregador e local de trabalho.</p>');
  organizar(trabalho, [
    ['ocupacao', 'situacao'],
    ['tempoNum|tempoValor|tempoOcupacao|tempoOcup', 'ocupacaoAnterior']
  ]);
  // Ordem da ficha do SINAN: 35 CNPJ/CPF, 36 nome, 37 CNAE, 38 UF, 39 município; 46 terceirizada; 47 CNAE, 48 CNPJ e 49 razão social da principal.
  organizar(empregador, [
    ['cnpj', 'empresa|empresaNome|razao', 'cnae'],
    ['ufEmp', 'munEmp', 'ibgeEmp'],
    ['terceirizada']
  ]);
  const contratante = [];
  if (campoDaGrade(empregador, 'cnaePrincipal|cnaePrinc')) contratante.push('cnaePrincipal|cnaePrinc');
  contratante.push('cnpjPrincipal|cnpjPrinc', 'empresaPrincipal|razaoPrincipal|razaoPrinc');
  organizar(empregador, [contratante]);
  const linhaContratante = empregador.firstElementChild;
  empregador.querySelector('[data-key="terceirizada"], [data-chips="terceirizada"]').closest('.draft-row').after(linhaContratante);
  // Ordem da ficha do SINAN: 40 distrito, 41 bairro, 42 endereço, 43 número, 44 referência, 45 telefone.
  organizar(endereco, [
    ['bairroEmp|bairro', 'endEmp|endereco', 'numEmp|numero'],
    ['compEmp', 'refEmp', 'cepEmp'],
    ['telEmp|telefone']
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

// Reuse original chip events and state while presenting the approved dropdowns.
// Também em lista: "Há ou houve outros trabalhadores com a mesma doença no local de trabalho?" (rótulo longo, opções curtas).
const gruposEmLista = ['sexo','gestante','raca'].map(key => root.querySelector('[data-chips="'+key+'"]')).filter(Boolean);
root.querySelectorAll('[data-chips]').forEach(grupo => {
  const rotulo = grupo.previousElementSibling;
  if (rotulo && /^Há ou houve outros trabalhadores/i.test(rotulo.textContent.trim()) && !gruposEmLista.includes(grupo)) gruposEmLista.push(grupo);
});
for(const group of gruposEmLista){const key=group.dataset.chips;
 const select=document.createElement('select');select.className='input';select.setAttribute('aria-label',{sexo:'Sexo',gestante:'Gestante',raca:'Raça/cor'}[key]||group.previousElementSibling?.textContent.trim()||key);select.add(new Option('Selecione',''));select.options[0].disabled=true;
 const chips=[...group.querySelectorAll('.chip')];chips.forEach(c=>select.add(new Option(c.textContent.trim(),c.dataset.value)));
 select.addEventListener('change',()=>{const chip=chips.find(c=>c.dataset.value===select.value);if(chip)chip.click();});
 group.after(select);group.style.display='none';
 function sync(){select.value=chips.find(c=>c.classList.contains('selected'))?.dataset.value||'';select.disabled=chips.every(c=>c.disabled);}
 new MutationObserver(sync).observe(group,{attributes:true,subtree:true,attributeFilter:['class','disabled','aria-pressed']});sync();
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
