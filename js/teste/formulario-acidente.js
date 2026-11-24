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

const VISAT_MODELO = 'Modelo VISAT 2026.11-2';
const VISAT_EMAIL = 'saudetrab.sms.pmf@floripa.sc.gov.br';
const VISAT_HOMOLOGACAO = (() => {
  try { return new URLSearchParams(window.location.search).has('homologacao'); } catch { return false; }
})();

function criarCampo(chave, rotulo, tipo = 'text', opcoes = []) {
  const caixa = document.createElement('div');
  const label = document.createElement('label');
  const campo = document.createElement(opcoes.length ? 'select' : 'input');
  campo.className = 'input input-lg';
  campo.id = 'visat-' + chave;
  campo.dataset.key = chave;
  if (opcoes.length) campo.add(new Option('Selecione', ''));
  opcoes.forEach(opcao => campo.add(new Option(opcao)));
  if (!opcoes.length) campo.type = tipo;
  label.className = 'field-label';
  label.htmlFor = campo.id;
  label.textContent = rotulo;
  caixa.append(label, campo);
  return caixa;
}

// Ajustes do modelo único VISAT (decisões de 17/11/2026), comuns a todas as fichas.
function aplicarAjustesVisat(root, options) {
  const caixaDe = el => el ? (el.closest('.unit-row')?.parentElement || el.parentElement) : null;
  function novoBloco(html) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstElementChild;
  }
  // 1. Aplicativo: só em Acidente de trabalho (inclui óbito), LER/DORT e Transtornos mentais.
  const comAplicativo = ['form-acidente-template', 'form-lerdort-template', 'form-mental-template'];
  const plataforma = root.querySelector('[data-key="plataformaDigital"]');
  if (plataforma) {
    const caixa = caixaDe(plataforma);
    if (!comAplicativo.includes(options.templateId)) {
      caixa.remove();
    } else if (!root.querySelector('[data-chips="tipoAplicativo"]')) {
      caixa.querySelector('.field-label').textContent = 'Trabalha por aplicativo?';
      const tipo = novoBloco(`<div data-show-when="plataformaDigital=Sim" data-visat-peso="4" hidden>
        <span class="field-label">Tipo de aplicativo</span>
        <div class="chip-grid" data-chips="tipoAplicativo" data-multi="true" data-summary="Tipo de aplicativo">
          <button type="button" class="chip" data-value="Transporte de passageiros">Transporte de passageiros</button>
          <button type="button" class="chip" data-value="Táxi por aplicativo">Táxi por aplicativo</button>
          <button type="button" class="chip" data-value="Entrega de comida ou produtos">Entrega de comida ou produtos</button>
          <button type="button" class="chip" data-value="Serviços gerais ou profissionais">Serviços gerais ou profissionais</button>
        </div>
      </div>`);
      const qual = novoBloco(`<div data-show-when="plataformaDigital=Sim" data-visat-peso="2" hidden data-visat-opcional>
        <label class="field-label" for="visat-qualAplicativo">Qual aplicativo?</label>
        <input class="input input-lg" id="visat-qualAplicativo" type="text" data-key="qualAplicativo" placeholder="Ex.: Uber, 99, iFood, Rappi, Keeta, Lalamove, Loggi">
      </div>`);
      caixa.after(tipo, qual);
    }
  }
  // 2. Servidor público: local de atuação, com CEP e endereço (o CNPJ e o endereço da empresa continuam os do órgão).
  const situacao = root.querySelector('[data-key="situacao"]');
  if (situacao && !root.querySelector('[data-key="localAtuacao"]')) {
    const servidor = 'situacao=Servidor público estatutário|Servidor público celetista';
    caixaDe(situacao).after(
      novoBloco(`<div data-show-in="${servidor}" hidden data-visat-opcional>
        <label class="field-label" for="visat-localAtuacao">Local de atuação (unidade, setor ou órgão)</label>
        <input class="input input-lg" id="visat-localAtuacao" type="text" data-key="localAtuacao" placeholder="Ex.: CS Tapera – sala de vacina">
      </div>`),
      novoBloco(`<div data-show-in="${servidor}" hidden data-visat-opcional>
        <label class="field-label" for="visat-cepAtuacao">CEP do local de atuação</label>
        <input class="input input-lg" id="visat-cepAtuacao" type="text" inputmode="numeric" maxlength="9" data-key="cepAtuacao" placeholder="00000-000">
      </div>`),
      novoBloco(`<div data-show-in="${servidor}" hidden data-visat-opcional>
        <label class="field-label" for="visat-enderecoAtuacao">Endereço do local de atuação</label>
        <input class="input input-lg" id="visat-enderecoAtuacao" type="text" data-key="enderecoAtuacao" placeholder="Rua, número, bairro, município">
      </div>`)
    );
    // CEP do local de atuação completa o endereço (ViaCEP).
    const cepAtuacao = root.querySelector('#visat-cepAtuacao');
    const endAtuacao = root.querySelector('#visat-enderecoAtuacao');
    let consultaCep = 0;
    cepAtuacao.addEventListener('input', async () => {
      const numero = cepAtuacao.value.replace(/\D/g, '').slice(0, 8);
      cepAtuacao.value = numero.length > 5 ? numero.slice(0, 5) + '-' + numero.slice(5) : numero;
      const atual = ++consultaCep;
      if (numero.length !== 8) return;
      try {
        const resposta = await fetch('https://viacep.com.br/ws/' + numero + '/json/', { credentials: 'omit', referrerPolicy: 'no-referrer' });
        const d = await resposta.json();
        if (atual !== consultaCep || d.erro) return;
        endAtuacao.value = [d.logradouro, d.bairro, [d.localidade, d.uf].filter(Boolean).join('/')].filter(Boolean).join(', ');
        endAtuacao.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (erro) { /* preenchimento manual */ }
    });
  }
  // 3a. Ficha de distúrbio de voz: CAT emitida? (decisão VISAT 17/11/2026), antes das informações complementares.
  if (options.templateId === 'form-voz-template' && !root.querySelector('[data-chips="cat"]')) {
    const catVoz = novoBloco(`<div>
      <span class="field-label">CAT emitida?</span>
      <div class="chip-grid" data-chips="cat" data-single="true" data-summary="CAT emitida?">
        <button type="button" class="chip" data-value="Sim">Sim</button>
        <button type="button" class="chip" data-value="Não">Não</button>
        <button type="button" class="chip" data-value="Não se aplica">Não se aplica</button>
        <button type="button" class="chip" data-value="Ignorado">Ignorado</button>
      </div>
    </div>`);
    const referencia = caixaDe(root.querySelector('[data-key="observacoes"]')) || caixaDe(root.querySelector('[data-key="relacaoTrabalho"]'));
    if (referencia) referencia.before(catVoz);
  }
  // 3. CAT = Não: orientação com o caminho oficial.
  root.querySelectorAll('[data-chips="cat"]').forEach(grupo => {
    const caixa = grupo.parentElement;
    if (caixa.nextElementSibling?.matches('[data-visat-aviso-cat]')) return;
    caixa.after(novoBloco(`<div data-show-when="cat=Não" hidden data-visat-aviso-cat class="highlight-box">
      <p><strong>A CAT ainda pode ser feita.</strong> Se a empresa não registrou, o próprio trabalhador, um familiar, o sindicato, o médico ou uma autoridade pública podem registrar. Nesses casos não há prazo, e o serviço é gratuito.</p>
      <details><summary>Saiba mais</summary><p>A CAT registra o acidente ou a doença do trabalho no INSS. A empresa deve comunicar até o dia útil seguinte (imediatamente em caso de óbito). Na falta da empresa, outras pessoas podem registrar, sem prazo (Lei 8.213/1991, art. 22, § 2º). Canais: Meu INSS (gov.br/meuinss) e telefone 135. Vale para segurados do INSS (empregado, avulso, doméstico); servidor estatutário segue o regime próprio (“Não se aplica”).</p></details>
    </div>`));
  });
  // 5. "Como ocorreu" sugere o CID-10 da causa (campo 54), com 4 caracteres (decisão VISAT 17/11/2026).
  //    Forma → detalhe → código de 3 caracteres (tabela VISAT); 4º caractere pelo local (W, X, Y) ou,
  //    em transporte (V), pela condição da vítima e por ser ou não acidente de trânsito. Sempre editável.
  const grupoComo = root.querySelector('[data-chips="comoOcorreu"]');
  const cidCausa = root.querySelector('[data-key="cidCausa"]');
  if (grupoComo && cidCausa && Array.isArray(window.VISAT_CAUSAS) && !root.querySelector('[data-key="detalheCausa"]')) {
    const CAUSAS = window.VISAT_CAUSAS;
    const selecao = (chave, rotulo, opcoes) => {
      const caixa = criarCampo(chave, rotulo, 'text');
      const antigo = caixa.querySelector('input');
      const sel = document.createElement('select');
      sel.className = 'input input-lg';
      sel.id = antigo.id;
      sel.dataset.key = chave;
      antigo.replaceWith(sel);
      const preencher = lista => {
        sel.replaceChildren(new Option('Selecione', ''));
        lista.forEach(([valor, texto]) => sel.add(new Option(texto, valor)));
      };
      preencher(opcoes);
      sel.visatPreencher = preencher;
      caixa.hidden = true;
      return caixa;
    };
    const caixaDetalhe = selecao('detalheCausa', 'Detalhe de como ocorreu', []);
    const caixaPapel = selecao('vitimaVeiculo', 'Na hora do acidente, a pessoa era', [
      ['Condutor', 'Condutor'], ['Passageiro', 'Passageiro'],
      ['Subindo ou descendo do veículo', 'Subindo ou descendo do veículo'], ['Não informado', 'Não informado']]);
    // Local de ocorrência da CID-10 (4º caractere dos códigos W, X e Y).
    const TIPOS_LOCAL = {
      'Escola, hospital, unidade de saúde ou órgão público': '2', 'Comércio ou serviços': '5',
      'Indústria ou construção': '6', 'Fazenda ou área rural produtiva': '7',
      'Condomínio, alojamento ou habitação coletiva': '1', 'Área esportiva': '3', 'Outro': '8'
    };
    const caixaTipoLocal = selecao('tipoLocalInstalacoes', 'Tipo de local', Object.keys(TIPOS_LOCAL).map(t => [t, t]));
    const detalhe = caixaDetalhe.querySelector('select');
    const papel = caixaPapel.querySelector('select');
    const tipoLocal = caixaTipoLocal.querySelector('select');
    grupoComo.parentElement.after(caixaDetalhe, caixaPapel);
    const grupoLocal = root.querySelector('[data-chips="local"]');
    grupoLocal?.parentElement.after(caixaTipoLocal);
    const ajudaCausa = document.createElement('p');
    ajudaCausa.className = 'field-help';
    ajudaCausa.dataset.visatCausaSugerida = '';
    ajudaCausa.setAttribute('role', 'status');
    cidCausa.insertAdjacentElement('afterend', ajudaCausa);

    const valorChip = grupo => grupo?.querySelector('.chip.selected')?.dataset.value || '';
    // 4º caractere dos códigos V01–V89 (CID-10, cap. XX). transito: true, false ou null (não informado).
    function quartoV(codigo, condicao, transito) {
      const n = Number(codigo.slice(1));
      const t = transito !== false;
      const c = { Condutor: 'c', Passageiro: 'p', 'Subindo ou descendo do veículo': 's' }[condicao] || 'n';
      if (n <= 9) return transito === null ? '9' : (t ? '1' : '0');
      if (n <= 29) return c === 's' ? '3' : c === 'c' ? (t ? '4' : '0') : c === 'p' ? (t ? '5' : '1') : (t ? '9' : '2');
      if (n <= 79) return c === 's' ? '4' : c === 'c' ? (t ? '5' : '0') : c === 'p' ? (t ? '6' : '1') : (t ? '9' : '3');
      if (n >= 83 && n <= 86) return c === 's' ? '4' : c === 'c' ? (t ? '0' : '5') : c === 'p' ? (t ? '1' : '6') : (t ? '3' : '9');
      if (n === 89) return transito === null ? '9' : (t ? '2' : '0');
      return '9';
    }
    let ultimaSugestao = '';
    function mostrar(caixa, visivel) {
      if (caixa.hidden === !visivel) return;
      caixa.hidden = !visivel;
      if (!visivel) {
        const sel = caixa.querySelector('select');
        if (sel.value) { sel.value = ''; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    }
    function sugerir() {
      const forma = valorChip(grupoComo);
      const local = valorChip(grupoLocal);
      const instalacoes = local.startsWith('Instalações');
      mostrar(caixaTipoLocal, instalacoes);
      const linhas = CAUSAS.filter(linha => linha[0] === forma).map(linha => [linha[1], linha]);
      const chaveDetalhes = forma;
      if (detalhe.dataset.forma !== chaveDetalhes) {
        detalhe.dataset.forma = chaveDetalhes;
        const anterior = detalhe.value;
        detalhe.visatPreencher(linhas.map(([texto]) => [texto, texto]));
        detalhe.value = linhas.some(([i]) => i === anterior) ? anterior : '';
        if (detalhe.value !== anterior) detalhe.dispatchEvent(new Event('change', { bubbles: true }));
      }
      mostrar(caixaDetalhe, !!forma && forma !== 'Outro' && linhas.length > 1);
      if (linhas.length === 1 && detalhe.value !== linhas[0][0]) detalhe.value = linhas[0][0];
      const linha = (linhas.find(([texto]) => texto === detalhe.value) || (linhas.length === 1 ? linhas[0] : null))?.[1] || null;
      const codigo3 = linha ? linha[2] : '';
      const n = Number(codigo3.slice(1));
      const ehV = codigo3[0] === 'V';
      mostrar(caixaPapel, ehV && n >= 10 && n <= 86);
      let sugestao = '';
      let texto = '';
      if (forma === 'Outro') {
        sugestao = 'A revisar';
        texto = 'A revisar: descreva como ocorreu nas informações complementares. A VISAT atribui o código na revisão.';
      } else if (linha) {
        let quarto;
        let nota = '';
        if (ehV) {
          const transito = local === 'Via pública' ? true : (local && local !== 'Ignorado' ? false : null);
          quarto = quartoV(codigo3, papel.value, transito);
          nota = transito === false ? ' · acidente não de trânsito' : ' · acidente de trânsito';
          if (transito === null || (caixaPapel.hidden === false && (!papel.value || papel.value === 'Não informado'))) nota += ' · a conferir';
        } else {
          quarto = local === 'Via pública' ? '4' : local === 'Domicílio próprio' ? '0' : instalacoes ? (TIPOS_LOCAL[tipoLocal.value] || '9') : '9';
          if (quarto === '9') nota = ' · local não especificado, a conferir';
        }
        sugestao = codigo3 + '.' + quarto;
        texto = 'Código sugerido pela forma, pelo detalhe e pelo local' + nota + '. Pode ser corrigido.';
      }
      ajudaCausa.textContent = texto;
      // Só substitui o CID quando ele está vazio ou ainda é a sugestão anterior (correção manual é mantida).
      const atual = cidCausa.value.trim();
      if (sugestao && (atual === '' || atual === ultimaSugestao || atual.startsWith(ultimaSugestao + ' '))) {
        if (atual !== sugestao) {
          cidCausa.value = sugestao;
          cidCausa.dispatchEvent(new Event('input', { bubbles: true }));
          cidCausa.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else if (!sugestao && ultimaSugestao && (atual === ultimaSugestao || atual.startsWith(ultimaSugestao + ' '))) {
        cidCausa.value = '';
        cidCausa.dispatchEvent(new Event('input', { bubbles: true }));
        cidCausa.dispatchEvent(new Event('change', { bubbles: true }));
      }
      ultimaSugestao = sugestao;
    }
    // Depois do clique do próprio botão (bolha): a seleção já está aplicada.
    [grupoComo, grupoLocal].filter(Boolean).forEach(grupo => grupo.addEventListener('click', () => setTimeout(sugerir)));
    [detalhe, papel, tipoLocal].forEach(sel => sel.addEventListener('change', () => setTimeout(sugerir)));
    root.addEventListener('visat:restaurado', () => setTimeout(sugerir));
  }
  // 4. Responsável pela notificação em todas as fichas: nome, função e e-mail (o e-mail preenche "Seu e-mail" no envio).
  //    Ficha de voz (e-SUS Sinan) não tem o campo: entra depois das observações. Material biológico usa o investigador.
  let profissional = root.querySelector('[data-key="profissional"], [data-key="investigador"]');
  if (!profissional) {
    const observacoes = caixaDe(root.querySelector('[data-key="observacoes"]'));
    const nome = criarCampo('profissional', 'Profissional responsável');
    nome.dataset.visatResponsavel = '';
    if (observacoes) observacoes.after(nome);
    else root.querySelector('.screen:last-of-type .field-group')?.append(nome);
    profissional = nome.querySelector('input');
  }
  if (profissional && profissional.isConnected) {
    const caixa = caixaDe(profissional);
    const extras = [];
    if (!root.querySelector('[data-key="funcaoProfissional"], [data-key="funcao"], [data-key="funcaoInvestigador"]')) {
      extras.push(novoBloco(`<div><label class="field-label" for="visat-funcaoProfissional">Função</label>
        <input class="input input-lg" id="visat-funcaoProfissional" type="text" data-key="funcaoProfissional" placeholder="Ex.: enfermeira, médico"></div>`));
    }
    if (!root.querySelector('[data-key="emailProfissional"]')) {
      extras.push(novoBloco(`<div><label class="field-label" for="visat-emailProfissional">E-mail do profissional</label>
        <input class="input input-lg" id="visat-emailProfissional" type="email" data-key="emailProfissional" placeholder="nome@exemplo.com"></div>`));
    }
    const linha = caixa.parentElement?.classList.contains('pair-row') ? caixa.parentElement : caixa;
    linha.after(...extras);
  }
}

function criarEtapa(titulo) {
  const etapa = document.createElement('section');
  etapa.className = 'screen';
  const cabecalho = document.createElement('h1');
  cabecalho.className = 'screen-title';
  cabecalho.textContent = titulo;
  const campos = document.createElement('div');
  campos.className = 'field-group';
  campos.dataset.visatComplementares = '';
  etapa.append(cabecalho, campos);
  return etapa;
}

function montarEmpregador(area) {
  const etapa = criarEtapa('Trabalho e empregador');
  const grupo = etapa.querySelector('.field-group');
  const opcoes = ['Sim', 'Não', 'Não se aplica', 'Ignorado'];

  // Três blocos: trabalho da pessoa, empresa ou empregador e endereço da empresa.
  function bloco(titulo) {
    const secao = document.createElement('section');
    secao.className = 'visat-sequencia';
    const cabecalho = document.createElement('h3');
    cabecalho.className = 'visat-sequencia-titulo';
    cabecalho.textContent = titulo;
    secao.append(cabecalho);
    const campos = document.createElement('div');
    campos.className = 'field-group';
    secao.append(campos);
    grupo.append(secao);
    return campos;
  }
  function incluir(destino, [chaves, rotulo, tipo, lista]) {
    const campo = area.querySelector(chaves.map(chave => '[data-key="' + chave + '"], [data-chips="' + chave + '"]').join(', '));
    const caixa = campo?.closest('.unit-row')?.parentElement || campo?.parentElement ||
      criarCampo(chaves[0], rotulo, tipo, lista);
    if (campo && ['uf', 'municipio', 'telefone'].includes(campo.dataset.key)) campo.dataset.key = chaves[0];
    caixa.querySelector('.field-label').textContent = rotulo;
    destino.append(caixa);
    return caixa;
  }

  const trabalho = bloco('Trabalho da pessoa notificada');
  [
    [['ocupacao'], 'Ocupação (CBO)'],
    [['situacao'], 'Situação no mercado de trabalho'],
    [['tempoNum', 'tempoValor', 'tempoOcupacao', 'tempoOcup'], 'Tempo de trabalho na ocupação'],
    [['ocupacaoAnterior'], 'Ocupação anterior (CBO)'],
    [['plataformaDigital'], 'Trabalha com plataformas digitais (aplicativos)?', 'text', opcoes]
  ].forEach(item => incluir(trabalho, item));
  const avisoSemVinculo = document.createElement('p');
  avisoSemVinculo.className = 'field-help';
  avisoSemVinculo.dataset.visatSemVinculo = '';
  avisoSemVinculo.hidden = true;
  avisoSemVinculo.textContent = 'Sem vínculo atual: informe o empregador da época do agravo, se conhecido.';
  trabalho.append(avisoSemVinculo);

  // Ficha oficial do Sinan, "Dados da empresa contratante": 34 CNPJ/CPF, 35 nome, 36 CNAE, 37 UF, 38 município (IBGE),
  // 40 bairro, 41 endereço, 42 número, 44 telefone, 45 terceirizada. O endereço é o da empresa (decisão VISAT 17/11/2026),
  // preenchido pelo CNPJ; não há valor inicial (Florianópolis não vem marcado).
  const empregador = bloco('Empresa ou empregador');
  [
    [['empresa', 'empresaNome', 'razao'], 'Empresa ou empregador (nome)'],
    [['cnpj'], 'CNPJ ou CPF do empregador'],
    [['cnae'], 'Atividade econômica (CNAE)']
  ].forEach(item => incluir(empregador, item));
  // Apoio à conferência (não são campos do Sinan): vêm do CNPJ consultado.
  const auxiliar = (chave, rotulo) => {
    const caixa = criarCampo(chave, rotulo);
    const campo = caixa.querySelector('input');
    campo.readOnly = true;
    campo.placeholder = 'Preenchido pelo CNPJ';
    caixa.dataset.visatOpcional = '';
    empregador.append(caixa);
    return caixa;
  };
  auxiliar('situacaoCadastral', 'Situação cadastral');
  auxiliar('matrizFilial', 'Matriz ou filial');
  const secundario = criarCampo('cnaeSecundario', 'CNAE secundário', 'text', ['x']);
  secundario.querySelector('select').replaceChildren(new Option('Usar só se a atividade da pessoa for outra', ''));
  secundario.dataset.visatOpcional = '';
  secundario.dataset.visatSomenteTela = ''; // ferramenta de escolha: o CNAE escolhido sai no campo CNAE
  empregador.append(secundario);
  const uf = incluir(empregador, [['ufEmp', 'uf'], 'UF da empresa']);
  const municipio = incluir(empregador, [['munEmp', 'municipio'], 'Município da empresa']);
  const codigo = area.querySelector('[data-key="ibgeEmp"]')?.parentElement ||
    criarCampo('ibgeEmp', 'Código IBGE da empresa');
  codigo.querySelector('.field-label').textContent = 'Código IBGE da empresa';
  codigo.classList.add('visat-codigo-derivado');
  municipio.after(codigo);
  const terceirizadaAnterior = area.querySelector('[data-key="terceirizada"], [data-chips="terceirizada"]');
  terceirizadaAnterior?.parentElement.remove();
  empregador.append(criarCampo('terceirizada', 'Empregador terceirizado?', 'text', opcoes));
  const dadosContratante = [
    [['empresaPrincipal', 'razaoPrincipal', 'razaoPrinc'], 'Nome da empresa principal (contratante)'],
    [['cnpjPrincipal', 'cnpjPrinc'], 'CNPJ da empresa principal (contratante)']
  ];
  if (area.querySelector('[data-key="cnaePrincipal"], [data-key="cnaePrinc"]')) {
    dadosContratante.push([['cnaePrincipal', 'cnaePrinc'], 'CNAE da empresa principal']);
  }
  for (const campo of dadosContratante) {
    const caixa = incluir(empregador, campo);
    caixa.dataset.showWhen = 'terceirizada=Sim';
    caixa.hidden = true;
  }

  const endereco = bloco('Endereço da empresa');
  const cep = area.querySelector('[data-key="cepEmp"]')?.parentElement || criarCampo('cepEmp', 'CEP da empresa');
  cep.dataset.visatSomenteBusca = '';
  endereco.append(cep);
  [
    [['bairroEmp', 'bairro'], 'Bairro da empresa'],
    [['endEmp', 'endereco'], 'Endereço da empresa'],
    [['numEmp', 'numero'], 'Número'],
    [['telEmp', 'telefone'], '(DDD) Telefone da empresa', 'tel']
  ].forEach(item => incluir(endereco, item));

  const cat = area.querySelector('[data-chips="cat"]');
  if (cat) grupo.append(cat.parentElement);
  return etapa;
}

function criarLinhaCampos(...campos) {
  const linha = document.createElement('div');
  linha.className = 'visat-linha-campos';
  linha.append(...campos);
  return linha;
}

function montarAtendimentoAcidente(detalhes) {
  const ocorrencia = detalhes.querySelector('[data-chips="tipoAcidente"]').closest('[data-visat-secao-complementar]');
  const campos = ocorrencia.querySelector('.field-group');
  const opcoes = ['Sim', 'Não', 'Ignorado'];
  const codigoLocal = criarCampo('ibgeOcorrencia', 'Código IBGE da ocorrência');
  codigoLocal.classList.add('visat-codigo-derivado');
  const quantidade = criarCampo('outrosAtingidosQuantidade', 'Quantos trabalhadores?', 'number');
  quantidade.dataset.showWhen = 'outrosAtingidos=Sim';
  quantidade.querySelector('input').min = 1;
  campos.append(
    criarCampo('tempoJornada', 'Tempo desde o início da jornada (horas e minutos)'),
    criarCampo('munOcorrencia', 'Município de ocorrência do acidente'), codigoLocal,
    criarCampo('ufOcorrencia', 'UF da ocorrência'),
    criarLinhaCampos(
      criarCampo('outrosAtingidos', 'Outros trabalhadores atingidos?', 'text', opcoes),
      quantidade,
      criarCampo('atendimentoMedico', 'Atendimento médico?', 'text', opcoes)
    )
  );
  const atendimento = document.createElement('div');
  atendimento.className = 'field-group';
  atendimento.dataset.showWhen = 'atendimentoMedico=Sim';
  atendimento.hidden = true;
  const codigoAtendimento = criarCampo('ibgeAtendimento', 'Código IBGE do atendimento');
  codigoAtendimento.classList.add('visat-codigo-derivado');
  const localAtendimento = criarLinhaCampos(
    criarCampo('ufAtendimento', 'UF do atendimento'),
    criarCampo('munAtendimento', 'Município do atendimento'),
    codigoAtendimento
  );
  localAtendimento.classList.add('draft-cols-3');
  const estabelecimento = criarLinhaCampos(
    criarCampo('unidAtendimento', 'Estabelecimento atendimento'),
    criarCampo('cnesAtendimento', 'Código CNES do estabelecimento')
  );
  const parteCorpo = detalhes.querySelector('[data-chips="parteCorpo"]').parentElement;
  const regime = detalhes.querySelector('[data-chips="regime"]').parentElement;
  const lesao = parteCorpo.closest('[data-visat-secao-complementar]');
  const outraParte = criarCampo('parteCorpoOutra', 'Especifique a parte do corpo atingida');
  outraParte.dataset.showWhen = 'parteCorpo=Outro';
  lesao.querySelector('.field-group').append(outraParte);
  const dataAtendimento = criarCampo('dataAtendimento', 'Data atendimento médico', 'date');
  atendimento.append(dataAtendimento, localAtendimento, estabelecimento);
  // Sequência do SINAN: 58 atendimento médico; 59 a 62 dados do atendimento; 63 partes do corpo; 65 regime de tratamento.
  regime.dataset.showWhen = 'atendimentoMedico=Sim';
  lesao.querySelector('.field-group').append(regime);
  campos.append(atendimento);
}

const blocosSinan = {
  "form-acidente-template": {
    "aliases": {},
    "agravo": "Acidente de trabalho",
    "cid": "Y96",
    "event": "dataAcidente"
  },
  "form-biologico-template": {
    "aliases": {},
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

function criarComplementares(titulo, recolhivel = true) {
  const secao = document.createElement(recolhivel ? 'details' : 'section');
  secao.className = 'visat-sequencia';
  secao.dataset.visatComplementares = '';
  const cabecalho = document.createElement(recolhivel ? 'summary' : 'h3');
  cabecalho.className = 'visat-sequencia-titulo';
  cabecalho.textContent = titulo;
  secao.append(cabecalho);
  return secao;
}

function organizarCamposComplementares(secao, obrigatorios) { /* Campos visíveis na grade do rascunho. */ }

function montarEnderecoResidencial(residencia) {
  const campo = id => residencia.querySelector('#sinan-' + id).parentElement;
  const municipioUf = criarLinhaCampos(campo('mun-res'), campo('uf-res'));
  municipioUf.dataset.showWhen = 'residencia=BR';
  const logradouro = campo('logr');
  const bairro = campo('bairro');
  const numero = campo('num');
  const complemento = campo('comp');
  [logradouro, bairro, numero, complemento].forEach(bloco => { bloco.dataset.visatOpcional = ''; });
  const endereco = document.createElement('div');
  endereco.className = 'field-group visat-endereco-residencia';
  endereco.append(municipioUf, criarLinhaCampos(logradouro, campo('cep')),
    criarLinhaCampos(bairro, numero), complemento, campo('ibge-res'));
  residencia.querySelector('.field-group').append(endereco);
}

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
  const [gerais, individual, residencia] = bloco.querySelectorAll('.screen');
  if (options.obito) {
    root.querySelector('.pill').textContent = 'Óbito por acidente de trabalho';
    const evolucao = root.querySelector('[data-chips="evolucao"]');
    evolucao.querySelectorAll('.chip').forEach(chip => {
      if (chip.dataset.value !== 'Óbito por acidente de trabalho') chip.remove();
    });
    const grupoGeral = gerais.querySelector('.field-group');
    grupoGeral.append(evolucao.parentElement);
    grupoGeral.insertAdjacentHTML('beforeend',
      '<div><label class="field-label" for="dataObito">Data do óbito</label><input class="input" id="dataObito" data-key="dataObito" type="date"></div>' +
      '<div><label class="field-label" for="numeroDO">Número da Declaração de Óbito, se disponível</label><input class="input" id="numeroDO" data-key="numeroDO" type="text"></div>');
  }

  const etapasDoAgravo = [...area.querySelectorAll('.screen')].slice(0, -1);
  const empregador = montarEmpregador(area);
  if (options.templateId === 'form-voz-template') {
    etapasDoAgravo[0].querySelector('.field-group').append(criarCampo('cid', 'Diagnóstico específico — CID-10'));
  }
  const cidDoCaso = [...area.querySelectorAll('[data-key="cid"], [data-key="cid10"], [data-key="cidCod"], [data-key="cidDiag"], [data-key="cidCausa"]')];
  if (cidDoCaso.length) {
    const blocoCid = criarComplementares('CID-10 do caso', false);
    blocoCid.classList.add('draft-cid');
    const gradeCid = document.createElement('div');
    gradeCid.className = 'field-group';
    cidDoCaso.forEach(campo => gradeCid.append(campo.parentElement));
    blocoCid.append(gradeCid);

    gerais.append(blocoCid);
  }
  if (data && !['dataAcidente', 'inicioSintomas'].includes(config.event)) {
    data.parentElement.before(criarCampo('inicioSintomas', 'Data primeiros sintomas', 'date'));
  }
  const detalhesAgravo = document.createDocumentFragment();
  for (const etapa of etapasDoAgravo) {
    if (!etapa.querySelector('[data-key], [data-chips]')) {
      etapa.remove();
      continue;
    }
    etapa.classList.remove('screen', 'active');
    etapa.removeAttribute('data-screen');
    etapa.dataset.visatSecaoComplementar = '';
    detalhesAgravo.append(etapa);
  }

  // O código segue no PDF como dado derivado do município.
  bloco.querySelectorAll('[data-key="ibgeNotif"], [data-key="ibgeRes"]').forEach(codigo => {
    codigo.parentElement.classList.add('visat-codigo-derivado');
  });
  organizarCamposComplementares(gerais, [
    'sinan-tipo', 'sinan-agravo', 'sinan-cidAgravo', 'sinan-data-notif', 'sinan-uf-notif',
    'sinan-mun-notif', 'sinan-unid', 'sinan-cod-unid', 'visat-inicioSintomas', data?.id, 'dataObito', 'evolucao'
  ]);
  organizarCamposComplementares(individual, ['sinan-nome', 'sinan-tel', 'sinan-nasc', 'sinan-idade', 'sexo', 'gestante']);
  montarEnderecoResidencial(residencia);
  organizarCamposComplementares(residencia, ['sinan-residencia-pais', 'sinan-pais', 'sinan-mun-res']);
  if (options.templateId === 'form-acidente-template') montarAtendimentoAcidente(detalhesAgravo);
  bloco.append(empregador);
  if (detalhesAgravo.childElementCount) {
    const dadosDoAgravo = criarEtapa('Dados do agravo');
    const complemento = document.createElement('div');
    complemento.className = 'draft-detalhes';
    complemento.append(detalhesAgravo);
    dadosDoAgravo.querySelector('.field-group').append(complemento);
    bloco.append(dadosDoAgravo);
  }
  const orientacao = document.createElement('p');
  orientacao.className = 'field-help';
  orientacao.textContent = 'Ficha de notificação inicial. Investigação e encerramento: no instrumento oficial.';
  bloco.lastElementChild.append(orientacao);
  area.prepend(bloco);
  // Fim da ficha como no SINAN: "Informações complementares e observações", com dois espaços —
  // a descrição sumária de como ocorreu e as outras informações.
  const acidenteComDescricaoEspecifica = options.templateId === 'form-acidente-template';
  const textos = criarEtapa('Informações complementares e observações');
  const textosGrupo = textos.querySelector('.field-group');
  const caixaTexto = (chave, rotulo, dica, linhas) => {
    const caixa = criarCampo(chave, rotulo);
    const entrada = caixa.querySelector('input');
    const texto = document.createElement('textarea');
    texto.id = entrada.id; texto.dataset.key = chave; texto.className = 'input'; texto.rows = linhas; texto.placeholder = dica;
    entrada.replaceWith(texto);
    return caixa;
  };
  const atividade = acidenteComDescricaoEspecifica && area.querySelector('#atividade');
  if (atividade) {
    // A atividade, a máquina/equipamento/substância e as causas entram na descrição sumária, como no SINAN.
    const caixaAtividade = atividade.parentElement;
    const etapaOrigem = caixaAtividade.closest('section, [data-visat-secao-complementar]');
    caixaAtividade.querySelector('label').textContent = 'Descrição sumária do acidente';
    atividade.rows = 3;
    atividade.placeholder = 'Atividade, causas, objeto ou agente.';
    atividade.dataset.required = 'Descreva como ocorreu o acidente';
    const erro = caixaAtividade.querySelector('[data-err="atividade"]');
    if (erro) erro.textContent = 'Descreva como ocorreu o acidente';
    area.querySelector('#maquina')?.parentElement.remove();
    textosGrupo.append(caixaAtividade);
    // O bloco de origem fica só com os fatores que contribuíram.
    if (etapaOrigem) {
      const titulo = etapaOrigem.querySelector('h1, h2, h3');
      if (titulo) titulo.textContent = 'Fatores que contribuíram';
      etapaOrigem.querySelector('.screen-sub')?.remove();
      const rotuloFatores = etapaOrigem.querySelector('[data-chips="fatores"]')?.parentElement.querySelector(':scope > .field-label');
      if (rotuloFatores && titulo) rotuloFatores.remove();
    }
  } else if (!acidenteComDescricaoEspecifica) {
    textosGrupo.append(caixaTexto('descricaoRascunho', 'Descrição do acidente / exposição',
      'Circunstâncias, atividade e exposição.', 3));
  }
  textosGrupo.append(caixaTexto('observacoesRascunho', 'Outras informações', '', 3));
  area.insertBefore(textos,area.querySelector('.screen:last-child'));
  const screens = area.querySelectorAll('.screen');
  const total = screens.length - 1;
  screens.forEach((screen, index) => {
    screen.dataset.screen = index + 1;
    screen.classList.toggle('active', index === 0);
    screen.classList.toggle('visat-tela-final', index === total);
  });
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
root.querySelectorAll('[data-key="refEmp"], [data-key="refRes"]').forEach(campo => campo.parentElement.remove());
const TOTAL = montarBlocoSinan(root, options);
for (const grupo of root.querySelectorAll('[data-chips="regime"]')) {
  for (const valor of ['Ambulatorial', 'Hospitalar', 'Ambos']) {
    const opcao = [...grupo.querySelectorAll('.chip')].find(chip => chip.dataset.value === valor) ||
      grupo.querySelector('.chip').cloneNode(false);
    opcao.dataset.value = valor;
    opcao.textContent = valor;
    grupo.append(opcao);
  }
}
if (root.querySelector('[data-chips="afastamento"], [data-key="afastamento"]')) {
  const tempo = root.querySelector('[data-key="afastTempo"], [data-key="tempoAfast"]');
  const quadro = root.querySelector('[data-chips="comAfast"], [data-chips="evolAfast"]');
  [tempo?.closest('.unit-row')?.parentElement, quadro?.parentElement].filter(Boolean).forEach(caixa => {
    caixa.dataset.showWhen = 'afastamento=Sim';
    caixa.hidden = true;
  });
}
// Os modelos trazem textos fixos junto aos campos. Preserve os atalhos de consulta.
root.querySelectorAll('p.field-help, p.hint-line').forEach(aviso => {
  if (aviso.querySelector('a')) return;
  if (aviso.id) root.querySelectorAll('[aria-describedby]').forEach(campo => {
    const ids = campo.getAttribute('aria-describedby').split(/\s+/).filter(id => id !== aviso.id);
    if (ids.length) campo.setAttribute('aria-describedby', ids.join(' '));
    else campo.removeAttribute('aria-describedby');
  });
  aviso.remove();
});
const config = blocosSinan[options.templateId];
aplicarAjustesVisat(root, options);
const today = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());
const defaults = {
  residencia: 'BR',
  [config.aliases.dataNotificacao || 'dataNotificacao']: today,
  ...options.defaults
};
const state = { screen: 1, values: { ...defaults } };
root.querySelectorAll('input[data-key], textarea[data-key]').forEach(campo => {
  campo.setAttribute('autocomplete', 'visat-sem-preenchimento');
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
  root.querySelector('#mainArea')?.before(faixa);
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
campoEvento.dataset.visatDataReferencia = '';
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
group.querySelectorAll('.chip').forEach(chip => chip.setAttribute('aria-pressed', String(chip.classList.contains('selected'))));
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
chip.setAttribute('aria-pressed', String(!!on));
});
});
aplicarCondicoes();
}

// Campo que some perde o valor (decisão VISAT 17/11/2026): resposta de pergunta oculta nunca vai para a ficha.
function limparBlocoOculto(bloco) {
  let mudou = false;
  bloco.querySelectorAll('[data-key]').forEach(el => {
    // Lista de unidade (Anos, Meses…) volta à opção padrão, não fica em branco.
    const padrao = el.tagName === 'SELECT' ? ([...el.options].find(o => o.defaultSelected)?.value ?? '') : '';
    const unidade = el.tagName === 'SELECT' && el.closest('.unit-row');
    const alvo = unidade ? padrao : '';
    if (el.value !== alvo) { el.value = alvo; mudou = true; }
    if (state.values[el.dataset.key] !== undefined && state.values[el.dataset.key] !== alvo) { state.values[el.dataset.key] = alvo; mudou = true; }
  });
  bloco.querySelectorAll('[data-chips]').forEach(grupo => {
    grupo.querySelectorAll('.chip.selected').forEach(chip => {
      chip.classList.remove('selected');
      chip.setAttribute('aria-pressed', 'false');
      mudou = true;
    });
    const chave = grupo.dataset.chips;
    const vazio = grupo.dataset.multi ? [] : '';
    const atual = state.values[chave];
    if (atual !== undefined && (Array.isArray(atual) ? atual.length : atual !== '')) { state.values[chave] = vazio; mudou = true; }
  });
  if (mudou) {
    bloco.querySelectorAll('select[data-visat-lista-chips], select').forEach(sel => {
      if (!sel.dataset.key && sel.selectedIndex > 0) sel.selectedIndex = 0;
    });
  }
  return mudou;
}

let profundidadeCondicoes = 0;
function aplicarCondicoes() {
  let limpou = false;
  function atualizarVisibilidade(bloco, oculto) {
    if (bloco.hidden === oculto) return;
    bloco.hidden = oculto;
    if (oculto && limparBlocoOculto(bloco)) limpou = true;
  }
  atualizarGestante();
  const semVinculo = root.querySelector('[data-visat-sem-vinculo]');
  if (semVinculo) atualizarVisibilidade(semVinculo, !['Aposentado', 'Desempregado'].includes(state.values.situacao));
  const noBrasil = residencia.value === 'BR';
  marcarObrigatorio(root.querySelector('#sinan-uf-res'), noBrasil);
  marcarObrigatorio(root.querySelector('#sinan-mun-res'), noBrasil);
  marcarObrigatorio(root.querySelector('#sinan-pais'), !noBrasil);

  root.querySelectorAll('[data-show-when]').forEach((el) => {
    const separador = el.dataset.showWhen.indexOf('=');
    const key = el.dataset.showWhen.slice(0, separador);
    const esperado = el.dataset.showWhen.slice(separador + 1);
    atualizarVisibilidade(el, state.values[key] !== esperado);
  });
  root.querySelectorAll('[data-show-in]').forEach((el) => {
    const separador = el.dataset.showIn.indexOf('=');
    const key = el.dataset.showIn.slice(0, separador);
    const esperados = el.dataset.showIn.slice(separador + 1).split('|');
    atualizarVisibilidade(el, !esperados.includes(state.values[key]));
  });
  root.querySelectorAll('[data-show-includes]').forEach((el) => {
    const separador = el.dataset.showIncludes.indexOf('=');
    const key = el.dataset.showIncludes.slice(0, separador);
    const esperado = el.dataset.showIncludes.slice(separador + 1);
    const valor = state.values[key];
    atualizarVisibilidade(el, !(Array.isArray(valor) && valor.includes(esperado)));
  });
  root.querySelectorAll('[data-show-contains]').forEach((el) => {
    const separador = el.dataset.showContains.indexOf('=');
    const key = el.dataset.showContains.slice(0, separador);
    const esperado = el.dataset.showContains.slice(separador + 1);
    const valor = state.values[key];
    const texto = Array.isArray(valor) ? valor.join(' ') : String(valor || '');
    atualizarVisibilidade(el, !texto.includes(esperado));
  });
  // Uma limpeza pode ocultar outros blocos que dependiam do valor apagado.
  if (limpou && profundidadeCondicoes < 3) {
    profundidadeCondicoes++;
    try { aplicarCondicoes(); } finally { profundidadeCondicoes--; }
  }
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
    if (campo.dataset.key !== 'residencia') campo.value = '';
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
if (options.obito) marcarObrigatorio(root.querySelector('#dataObito'));


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

// Cartão SUS só quando não há CPF (o valor já digitado é mantido e o campo continua visível).
{
  const cpf = root.querySelector('#sinan-cpf');
  const sus = root.querySelector('#sinan-sus');
  const caixaSus = sus?.parentElement;
  const atualizarSus = () => {
    if (!cpf || !caixaSus) return;
    caixaSus.hidden = cpf.value.replace(/\D/g, '').length === 11 && !sus.value.trim();
  };
  cpf?.addEventListener('input', atualizarSus);
  sus?.addEventListener('input', atualizarSus);
  root.addEventListener('visat:restaurado', atualizarSus);
  atualizarSus();
}

// P16: retorno imediato no campo de nome, ao sair do campo.
{
  const campoNome = root.querySelector('#sinan-nome');
  const retorno = document.createElement('p');
  retorno.className = 'field-help';
  retorno.dataset.visatNome = '1';
  retorno.setAttribute('role', 'status');
  (root.querySelector('#sinan-nome-ajuda') || campoNome).insertAdjacentElement('afterend', retorno);
  const conferirNome = () => {
    const valor = campoNome.value.trim();
    const problema = valor ? problemaNome(valor) : '';
    const aviso = valor ? avisoNome(valor) : '';
    retorno.textContent = problema ? problema + '.' : aviso;
    retorno.style.color = problema ? '#B3261E' : '#7d4000';
    campoNome.toggleAttribute('aria-invalid', !!problema);
  };
  campoNome.addEventListener('blur', conferirNome);
  campoNome.addEventListener('input', () => { if (retorno.textContent) conferirNome(); });
}

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

// P16: nome da pessoa notificada. Bloqueia apenas entradas sem conteúdo útil; nomes curtos,
// compostos, com partículas, apóstrofo, hífen ou acentos de outras línguas continuam aceitos.
const NOMES_GENERICOS = /^(teste|testes|ignorado|ignorada|nao informado|nao informada|desconhecido|desconhecida|paciente|fulano|fulana|fulano de tal|sem nome|nome|nenhum|xxx+|n ?a|n ?d|s ?n|anonimo|anonima)$/;
function problemaNome(valor) {
  const texto = String(valor || '').trim().replace(/\s+/g, ' ');
  if (!/\p{L}/u.test(texto)) return 'Nome completo: informe o nome da pessoa notificada';
  if (/[^\p{L}\p{M} '’.-]/u.test(texto)) return 'Nome completo: retire números e símbolos';
  const letras = texto.replace(/[^\p{L}]/gu, '');
  if (letras.length < 2) return 'Nome completo: "' + texto + '" é uma abreviação. Informe o nome sem abreviações';
  const partes = texto.split(' ').map(parte => parte.replace(/[^\p{L}]/gu, '')).filter(Boolean);
  if (partes.every(parte => parte.length === 1)) return 'Nome completo: informe o nome por extenso, não apenas as iniciais';
  if (/^(.)\1+$/u.test(letras.toLowerCase())) return 'Nome completo: o texto informado não é um nome';
  const normal = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.'’-]/g, '');
  if (NOMES_GENERICOS.test(normal)) return 'Nome completo: informe o nome da pessoa, não um termo genérico';
  return '';
}
function avisoNome(valor) {
  const texto = String(valor || '').trim().replace(/\s+/g, ' ');
  if (!texto || problemaNome(texto)) return '';
  if (texto.split(' ').length === 1) return 'O nome tem uma só palavra. Confirme se é o nome completo da pessoa, sem abreviações.';
  if (/(^|\s)\p{L}\.(\s|$)/u.test(texto)) return 'O nome parece conter abreviação (letra seguida de ponto). Confirme se é possível escrevê-lo por extenso.';
  return '';
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
    ['#sinan-nome', problemaNome(root.querySelector('#sinan-nome').value) || 'Nome completo, sem abreviações',
      !!problemaNome(root.querySelector('#sinan-nome').value)],
    ['#sinan-nasc', 'Data de nascimento ou idade com unidade', !nascimento.value && idadeEmAnos() === null],
    ['#sinan-nasc', 'A data de nascimento deve ser igual ou anterior à data de referência do agravo', nascimento.value && dataEvento && nascimento.value > dataEvento],
    ['[data-chips="sexo"]', 'Sexo', !state.values.sexo],
    ['[data-chips="gestante"]', 'Situação gestacional', state.values.sexo === 'Feminino' && !state.values.gestante]
  ];
  if (options.obito) {
    regras.push(['#dataObito', 'Data do óbito', !root.querySelector('#dataObito').value]);
  }
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
  const sintomas = campoPorChave('inicioSintomas');
  if (sintomas?.value && (nascimento?.value && sintomas.value < nascimento.value ||
      evento?.value && sintomas.value > evento.value)) {
    erros.push({ campo: sintomas, mensagem: 'Confira a data dos primeiros sintomas em relação ao nascimento e à data de referência do agravo' });
  }
  const atendimento = campoPorChave('dataAtendimento');
  if (atendimento?.value && !atendimento.closest('[hidden]') && evento?.value && atendimento.value < evento.value) {
    erros.push({ campo: atendimento, mensagem: 'A data do atendimento está antes da data do acidente' });
  }
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
  const campoNome = root.querySelector('#sinan-nome');
  const aviso = avisoNome(campoNome.value);
  if (aviso) avisos.push({ campo: campoNome, mensagem: aviso });
  const fechamento = ['dataFechamento', 'dataFinal', 'data'].map(input).find(campo => campo?.type === 'date');
  const obito = input('dataObito');
  if (obito?.value && fechamento?.value && fechamento.value < obito.value &&
      /^óbito/i.test(String(state.values.evolucao || ''))) {
    avisos.push({ campo: fechamento, mensagem: 'Confira o encerramento: a evolução por óbito foi registrada com data posterior ao encerramento.' });
  }
  return avisos;
}

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

function focarCampo(campo) {
  const municipioPorCodigo = {
    ibgeNotif: '#sinan-mun-notif',
    ibgeRes: '#sinan-mun-res',
    ibgeEmp: '[data-key="munEmp"]',
    ibgeOcorrencia: '[data-key="munOcorrencia"]',
    ibgeAtendimento: '[data-key="munAtendimento"]'
  };
  const seletor = municipioPorCodigo[campo.dataset.key];
  if (seletor) campo = root.querySelector(seletor) || campo;
  for (let grupo = campo.closest('details'); grupo; grupo = grupo.parentElement.closest('details')) {
    grupo.open = true;
  }
  const seguinte = campo.nextElementSibling;
  const controle = campo.matches('input:not([type="hidden"]), select, textarea') ? campo
    : campo.matches('[data-chips]') && seguinte?.matches('select') ? seguinte
    : campo.querySelector('button') || seguinte?.querySelector('button');
  controle?.focus();
}

function mostrarRevisaoAntesDoPdf(pendencias, avisos) {
  root.querySelector('[data-visat-pendencias]')?.remove();
  const caixa = document.createElement('section');
  caixa.className = 'highlight-box';
  caixa.dataset.visatPendencias = '1';
  const titulo = document.createElement('h2');
  titulo.textContent = 'Revisão antes do PDF';
  titulo.tabIndex = -1;
  caixa.append(titulo);

  const camposListados = new Set();
  const mensagensGerais = new Set();
  function listar(rotulo, itens) {
    const lista = document.createElement('ul');
    for (const { campo, mensagem } of itens) {
      if (campo ? camposListados.has(campo) : mensagensGerais.has(mensagem)) continue;
      if (campo) camposListados.add(campo);
      else mensagensGerais.add(mensagem);
      const item = document.createElement('li');
      item.textContent = mensagem;
      if (campo?.closest('.screen') && !campo.closest('[hidden]') && !campo.readOnly && !campo.disabled) {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'btn';
        botao.dataset.variant = 'outline';
        botao.textContent = 'Ir ao campo';
        botao.setAttribute('aria-label', 'Ir ao campo: ' + mensagem);
        botao.addEventListener('click', () => {
          showScreen(Number(campo.closest('.screen').dataset.screen));
          focarCampo(campo);
        });
        item.append(' ', botao);
      }
      lista.append(item);
    }
    if (!lista.childElementCount) return;
    const cabecalho = document.createElement('h3');
    cabecalho.textContent = rotulo;
    caixa.append(cabecalho, lista);
  }
  listar('Corrigir', pendencias.map(({ campo, rotulo }) => ({ campo, mensagem: rotulo })));
  listar('Conferir', avisos);

  if (!pendencias.length) {
    const continuar = document.createElement('button');
    continuar.type = 'button';
    continuar.className = 'btn';
    continuar.textContent = 'Conferi os avisos e quero continuar';
    continuar.addEventListener('click', () => finalizarFicha(true));
    caixa.append(continuar);
  }
  getScreens()[state.screen - 1].prepend(caixa);
  titulo.focus();
}

async function finalizarFicha(confirmou = false) {
  if (conferindoCoerencia) return;
  persistInputs();
  const pendencias = camposBasicosPendentes().concat(documentosPendentes());
  if (confirmou && !pendencias.length) {
    showScreen(TOTAL + 1);
    return;
  }
  conferindoCoerencia = true;
  btnContinuar.disabled = true;
  btnVoltar.disabled = true;
  btnPdfConferencia.disabled = true;
  area.inert = true;
  let avisos;
  try {
    avisos = await verificarCoerencia();
  } finally {
    conferindoCoerencia = false;
    btnContinuar.disabled = false;
    btnVoltar.disabled = false;
    btnPdfConferencia.disabled = false;
    area.inert = false;
  }
  if (!root.isConnected) return;
  if (pendencias.length || avisos.length) mostrarRevisaoAntesDoPdf(pendencias, avisos);
  else showScreen(TOTAL + 1);
}

function renderProgress() {
progSegs.forEach((seg, i) => {
seg.classList.toggle('done', i < state.screen);
});
}

// No rascunho, todas as seções de preenchimento fazem parte da mesma página.
let indiceFicha;
function showScreen(n) {
  root.querySelector('[data-visat-pendencias]')?.remove();
  const revisao = n === TOTAL + 1;
  state.screen = revisao ? n : 1;
  bottomBar.style.display = revisao ? 'none' : 'block';
  for (const tela of getScreens()) {
    const final = Number(tela.dataset.screen) === TOTAL + 1;
    tela.classList.toggle('active', final === revisao);
  }
  renderProgress();
  counter.textContent = revisao ? 'Ficha concluída' : 'Ficha de notificação';
  btnVoltar.hidden = true;
  btnContinuar.textContent = 'Finalizar ficha';
  if (indiceFicha) indiceFicha.hidden = revisao;
  if (revisao) buildSummary();
  const destino = revisao
    ? root.querySelector('.visat-tela-final')
    : root.querySelector('.screen[data-screen="' + n + '"]');
  if (n !== 1) destino?.scrollIntoView({ block: 'start' });
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

function addField(block, labelText, opcional) {
  const field = document.createElement('div');
  field.className = 'pf-field';
  field.toggleAttribute('data-visat-opcional', opcional);
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
  // Regra única (decisão VISAT 17/11/2026): campo sem valor não sai na ficha.
  if (!String(value || '').trim()) {
    field.remove();
    return;
  }
  const answer = document.createElement('p');
  answer.className = 'pf-answer';
  answer.textContent = value;
  field.appendChild(answer);
}

root.querySelectorAll('.screen[data-screen], [data-visat-secao-complementar]').forEach((screen) => {
  if (Number(screen.dataset.screen) > TOTAL) return;

  const block = document.createElement('section');
  block.className = 'pf-block';
  const title = document.createElement('h3');
  title.textContent = screen.querySelector('.screen-title').textContent;
  block.appendChild(title);

  screen.querySelectorAll('.field-label').forEach((fieldLabel) => {
    const secaoComplementar = fieldLabel.closest('[data-visat-secao-complementar]');
    if ((secaoComplementar && secaoComplementar !== screen) ||
        fieldLabel.closest('[hidden], [data-visat-somente-tela]')) return;
    const opcional = Boolean(fieldLabel.closest('[data-visat-complementares], [data-visat-opcional]')) ||
      ['visat-inicioSintomas', 'sinan-cep', 'sinan-cod-unid'].includes(fieldLabel.htmlFor);
    const labelText = fieldLabel.dataset.visatRotuloPdf || fieldLabel.textContent.trim();
    const following = fieldLabel.nextElementSibling;
    if (!following) return;

    if (following.matches('[data-chips]')) {
      const field = addField(block, labelText, opcional);
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
      const field = addField(block, labelText, opcional);
      addAnswer(field, quantity.value ? quantidadeComUnidade(quantity.value, unit.value) : '');
      return;
    }

    if (fieldLabel instanceof HTMLLabelElement && fieldLabel.htmlFor) {
      const control = root.querySelector(`#${fieldLabel.htmlFor}`);
      if (!control || (control.matches(seletorDocumentos) && control.closest('[hidden]'))) return;
      const field = addField(block, labelText, opcional);
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

  if (block.children.length > 1) blocks.appendChild(block);
});
}

// Unidade de tempo por extenso e no plural correto: "37 anos", "1 ano", "11 meses".
function quantidadeComUnidade(quantidade, unidade) {
  // "1 ano", "37 anos", "1 mês", "11 meses" (aceita Hora/Dia/Mês/Ano no singular ou no plural).
  const formas = { hora: ['hora', 'horas'], horas: ['hora', 'horas'], dia: ['dia', 'dias'], dias: ['dia', 'dias'],
    mes: ['mês', 'meses'], meses: ['mês', 'meses'], ano: ['ano', 'anos'], anos: ['ano', 'anos'] };
  const chave = String(unidade || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const forma = formas[chave];
  if (!forma) return [quantidade, unidade].filter(v => v !== null && v !== undefined && v !== '').join(' ');
  return quantidade + ' ' + forma[Number(quantidade) === 1 ? 0 : 1];
}

// PDF final da ficha (pdf-lib), usado para baixar e para anexar ao e-mail.
function agravoDaFicha() {
  return options.obito ? 'Óbito por acidente de trabalho' : config.agravo;
}

function nomePdfFinal() {
  const slug = agravoDaFicha().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
  return 'VISAT_' + slug + '_' + today + (VISAT_HOMOLOGACAO ? '_HOMOLOGACAO' : '') + '.pdf';
}

let retornoEnvio;
async function prepararPdfFinal(botao) {
  persistInputs();
  const pendentes = camposBasicosPendentes().concat(documentosPendentes());
  if (pendentes.length) {
      mostrarPendencias(pendentes, pendentes.length === 1 ? '1 pendência para gerar o PDF final' : pendentes.length + ' pendências para gerar o PDF final');
    return null;
  }
  buildPrint();
  botao.disabled = true;
  if (retornoEnvio && !retornoEnvio.dataset.enviado) retornoEnvio.textContent = 'Gerando o PDF…';
  try {
    const rodape = 'VISAT Florianópolis | ' + VISAT_MODELO + (VISAT_HOMOLOGACAO ? ' | HOMOLOGAÇÃO — DADOS FICTÍCIOS' : '');
    const pdf = await window.VisatEnvio.gerarPdf(root.querySelector('#printArea'), rodape);
    if (retornoEnvio && !retornoEnvio.dataset.enviado) retornoEnvio.textContent = '';
    return pdf;
  } catch (erro) {
    if (retornoEnvio) retornoEnvio.textContent = 'Não foi possível gerar o PDF. Use Imprimir / salvar PDF do navegador (Ctrl+P).';
    return null;
  } finally {
    botao.disabled = false;
  }
}

root.querySelector('#btnImprimir').addEventListener('click', async evento => {
  const botao = evento.currentTarget;
  const pdf = await prepararPdfFinal(botao);
  if (!pdf) return;
  window.VisatEnvio.baixar(pdf, nomePdfFinal());
  if (retornoEnvio && !retornoEnvio.dataset.enviado) retornoEnvio.textContent = 'PDF baixado: ' + nomePdfFinal() + '.';
});

btnPdfConferencia.addEventListener('click', () => {
  const nome = root.querySelector('#sinan-nome');
  const problema = problemaNome(nome.value);
  if (problema) {
    showScreen(Number(nome.closest('.screen').dataset.screen));
    mostrarPendencias([{ tela: Number(nome.closest('.screen').dataset.screen), rotulo: problema, campo: nome }],
      'Corrija o nome para gerar o PDF');
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
    return quantidade && quantidade.value ? quantidadeComUnidade(quantidade.value, unidade.value) : '';
  }
  return valor || '';
}

function mostrarRevisaoDeCampos() {
  const resumo = root.querySelector('#summaryGrid');
  root.querySelector('[data-visat-revisao]')?.remove();
  const grupos = [
    { tela: 1, campos: [
      [['codUnidNotif'], 'Código CNES'],
      [['cid', 'cid10', 'cidCod', 'cidDiag'], 'CID-10 do caso'],
      [['cidCausa'], 'Causa do acidente — CID-10']
    ] },
    { tela: 2, campos: [
      [['raca'], 'Raça/cor'],
      [['escolaridade'], 'Escolaridade']
    ] }
  ];
  const secaoEvolucao = root.querySelector('[data-chips="evolucao"]')?.closest('.screen');
  if (secaoEvolucao) grupos.push({ tela: Number(secaoEvolucao.dataset.screen), campos: [[['evolucao'], 'Evolução do caso']] });
  const secaoOcupacao = root.querySelector('[data-key="ocupacao"]')?.closest('.screen');
  if (secaoOcupacao) grupos.push({
    tela: Number(secaoOcupacao.dataset.screen),
    campos: [[['ocupacao'], 'Ocupação (CBO)'], [['cnae'], 'Atividade econômica (CNAE)']]
  });

  const caixa = document.createElement('section');
  caixa.dataset.visatRevisao = '1';
  caixa.className = 'highlight-box';
  const titulo = document.createElement('h3');
  titulo.className = 'visat-sequencia-titulo';
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
      botao.addEventListener('click', () => {
        showScreen(grupo.tela);
        const campo = chaves.map(chave => secao.querySelector(
          '[data-key="' + chave + '"], [data-chips="' + chave + '"]'
        )).find(Boolean);
        if (campo) focarCampo(campo);
      });
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
imprimir.textContent = 'Baixar PDF';
imprimir.classList.remove('btn-print');
imprimir.dataset.variant = 'outline';
if (!acoes.querySelector('[data-visat-email]')) {
  const enviarEmail = document.createElement('button');
  enviarEmail.type = 'button';
  enviarEmail.className = 'btn';
  enviarEmail.dataset.visatEmail = '1';
  enviarEmail.textContent = 'Enviar por e-mail';
  acoes.prepend(enviarEmail);
  const painel = document.createElement('section');
  painel.className = 'visat-entrega';
  painel.setAttribute('aria-labelledby', 'visat-entrega-titulo');
  const titulo = document.createElement('h2');
  titulo.id = 'visat-entrega-titulo';
  titulo.textContent = 'Enviar ou baixar a ficha';
  const instrucao = document.createElement('p');
  instrucao.className = 'field-help';
  instrucao.textContent = 'O PDF é anexado automaticamente ao abrir a janela de e-mail.';
  retornoEnvio = document.createElement('p');
  retornoEnvio.setAttribute('role', 'status');
  retornoEnvio.dataset.visatRetornoEnvio = '1';
  acoes.before(painel);
  painel.append(titulo, instrucao, acoes, retornoEnvio);
  enviarEmail.addEventListener('click', async () => {
    const pdf = await prepararPdfFinal(enviarEmail);
    if (!pdf) return;
    const agravo = agravoDaFicha();
    const assunto = window.VisatEnvio.montarAssunto(agravo, state.values.unidNotif, state.values.codUnidNotif);
    const corpo = 'Olá,\n\nSegue em anexo o PDF da ficha de notificação: ' + agravo + '.' +
      (VISAT_HOMOLOGACAO ? '\nTeste de homologação com dados fictícios.' : '') + '\n\n' + VISAT_MODELO;
    window.VisatEnvio.abrirJanela({
      raiz: root, botao: enviarEmail, assunto, corpo, nomePdf: nomePdfFinal(), pdf,
      retorno: retornoEnvio, aoEnviar: () => { retornoEnvio.dataset.enviado = '1'; }
    });
  });
}
const cartao = imprimir.closest('.success-card');
root.querySelector('[data-visat-revisao]').before(cartao.querySelector('.visat-entrega'));
cartao.querySelector('.success-icon')?.setAttribute('aria-hidden', 'true');
const subtitulo = cartao.querySelector('.screen-sub');
if (subtitulo) subtitulo.textContent = 'Confira os dados da notificação antes de enviar.';
const marcados = root.querySelectorAll('[data-summary]');
const items = marcados.length
  ? Array.from(marcados).filter(el => !el.closest('[hidden]')).map((el) => [rotuloResumo(el), valorResumo(el)])
  : [
['Nome', state.values.nome],
['Data do acidente', state.values.dataAcidente ? formatDate(state.values.dataAcidente) : ''],
['Tipo de acidente', state.values.tipoAcidente],
['Parte do corpo', state.values.parteCorpo],
['Evolução', state.values.evolucao],
['CAT emitida', state.values.cat]
];
// Mesma regra do PDF: campo vazio ou oculto não aparece no resumo.
root.querySelector('#summaryGrid').innerHTML = items
  .filter(([, val]) => String(val ?? '').trim())
  .map(([k, val]) => '<div class="summary-item"><span>' + escapeHtml(k) + '</span><strong>' + escapeHtml(val) + '</strong></div>')
  .join('');
}

function formatDate(iso) {
const [y, m, d] = iso.split('-');
return d + '/' + m + '/' + y;
}

function escapeHtml(s) {
return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

btnContinuar.addEventListener('click', () => finalizarFicha());
area.addEventListener('input', evento => {
  if (evento.isTrusted) root.querySelector('[data-visat-pendencias]')?.remove();
});
area.addEventListener('change', evento => {
  if (evento.isTrusted) root.querySelector('[data-visat-pendencias]')?.remove();
});


root.querySelector('#btnRevisar').addEventListener('click', () => {
showScreen(1);
root.querySelector('.top-bar')?.scrollIntoView({ block: 'start' });
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
window.aplicarLayoutRascunho(root);
indiceFicha = document.createElement('nav');
indiceFicha.className = 'visat-indice-ficha';
indiceFicha.setAttribute('aria-label', 'Seções da ficha');
const nomesSecoes = ['Dados gerais', 'Pessoa', 'Residência', 'Trabalho'];
function adicionarAtalho(rotulo, destino) {
  const atalho = document.createElement('button');
  atalho.type = 'button';
  atalho.className = 'btn';
  atalho.dataset.variant = 'ghost';
  atalho.textContent = rotulo;
  atalho.addEventListener('click', () => {
    if (!destino.matches('button')) destino.tabIndex = -1;
    destino.focus({ preventScroll: true });
    destino.scrollIntoView({ block: 'start' });
  });
  indiceFicha.append(atalho);
}
getScreens().slice(0, TOTAL).forEach((tela, indice) => {
  const titulo = tela.querySelector('h1');
  if (titulo) adicionarAtalho(nomesSecoes[indice] || titulo.textContent.trim(), titulo);
});
adicionarAtalho('Conclusão', btnContinuar);
area.before(indiceFicha);
restoreInputs();
showScreen(1);
const activeHeading = root.querySelector('.screen.active h1');
if (activeHeading) {
  activeHeading.tabIndex = -1;
  activeHeading.focus({ preventScroll: true });
}
// Ao abrir a ficha, a tela começa no início do formulário, com "Dados gerais" visível.
// No Google Sites o quadro é alto e quem rola é a página do Sites: scrollIntoView rola também a página que incorpora a ficha.
requestAnimationFrame(() => {
  const topo = root.getBoundingClientRect().top + window.scrollY - 8;
  window.scrollTo({ top: Math.max(0, topo), behavior: 'auto' });
  try { root.scrollIntoView({ block: 'start', behavior: 'auto' }); } catch (erro) { /* navegador sem suporte */ }
  const rolagem = document.querySelector('html.visat-em-quadro #principal');
  if (rolagem) {
    rolagem.style.removeProperty('--visat-espaco-topo');
    rolagem.scrollTop = 0;
  }
});
return root;
};

