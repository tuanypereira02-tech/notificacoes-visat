/*
 * ajustes-replica.js — Réplica para testes da página "Como notificar" (VISAT Florianópolis).
 * Carregado só por replica-como-notificar.html. A página usada no Google Sites (notificacao.html) não muda.
 * Aplica os ajustes da "versão qualificada" das 10 fichas (17/11/2026), depois de cada ficha ser montada:
 *  - 1b: subtítulo da etapa; retira distrito, unidade investigadora e Anti-HBs do paciente-fonte (ficha oficial);
 *        vírus da conversão e data do óbito só quando cabem.
 *  - 1c: lista de agentes só com "Sim"; data do óbito só com evolução = óbito.
 *  - 1c, 1h, 1i: tempo de exposição ao tabaco só com "Sim" ou "Ex-fumante".
 *  - 1b a 1i: texto final "Descrição do caso".
 * Reduções aprovadas pela usuária em 17/11/2026 (todas as fichas):
 *  - Tipo de notificação, agravo e CID-10 do agravo viram uma linha de título (continuam no PDF).
 *  - Município e UF no mesmo quadro, com o código IBGE dentro; CNES dentro do quadro da unidade (continuam no PDF).
 *  - Situação cadastral e matriz/filial viram um aviso curto embaixo do CNPJ (só na tela).
 *  - Local de atuação do servidor sem CEP e endereço.
 *  - Sem "Data do preenchimento" (repete a data da notificação).
 *  - "Descrição do caso" e "Outras informações" num campo só.
 *  - Gestante só com sexo feminino; dois espaços no CID da lesão abrem os grupos da CID-10 (cid-qualificado.js).
 *  - 1a e 1j: sem "Horas após o início da jornada"; "Fatores que contribuíram" mantido.
 *  - 1e: sinais e sintomas com orientação; sem texto livre repetido no meio da ficha.
 *  - 1h: agravos associados sem "Nenhum" (ficha oficial); resultado da prova funcional só com "Sim".
 */
(function () {
  'use strict';
  if (typeof window.montarFormulario !== 'function') return;
  const original = window.montarFormulario;

  const hoje = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  function caixa(el) {
    if (!el) return null;
    let c = el.closest('.unit-row')?.parentElement || el;
    while (c.parentElement && !c.parentElement.matches('.field-group, .draft-row, .visat-linha-campos, .pair-row')) c = c.parentElement;
    return c;
  }
  const campo = (root, chave) => root.querySelector('[data-key="' + chave + '"], [data-chips="' + chave + '"]');
  function condicao(root, chave, atributo, valor) {
    const c = caixa(campo(root, chave));
    if (!c) return;
    c.setAttribute(atributo, valor);
    c.hidden = true; // começa vazio: a condição ainda não se aplica
  }
  function remover(root, chave) {
    const c = caixa(campo(root, chave));
    if (!c) return;
    const linha = c.parentElement;
    c.remove();
    if (linha && linha.matches('.draft-row, .visat-linha-campos, .pair-row') && !linha.querySelector('[data-key], [data-chips]')) linha.remove();
  }
  function rotulo(root, chave, texto, dica) {
    const el = campo(root, chave);
    const c = caixa(el);
    const l = c?.querySelector('.field-label');
    if (l) l.textContent = texto;
    if (dica !== undefined && el && 'placeholder' in el) el.placeholder = dica;
  }
  function tirarOpcao(root, chave, valor) {
    root.querySelector('[data-chips="' + chave + '"] .chip[data-value="' + valor + '"]')?.remove();
    // Lista suspensa equivalente (quando o grupo é exibido como lista)
    const grupo = root.querySelector('[data-chips="' + chave + '"]');
    const lista = grupo?.nextElementSibling;
    if (lista && lista.tagName === 'SELECT') [...lista.options].filter(o => o.value === valor).forEach(o => o.remove());
  }


  // ---------- Reduções comuns (aprovadas em 17/11/2026) ----------
  // Some da tela, mas continua no PDF (o PDF ignora só blocos com o atributo hidden).
  function soNoPdf(el) {
    const c = caixa(el);
    if (!c) return null;
    c.dataset.visatSoPdf = '';
    c.style.setProperty('display', 'none', 'important');
    return c;
  }
  // codigo: campo (ou lista de campos) que alimenta o texto; prefixo: texto fixo ou função que monta o texto.
  function textoDoCodigo(codigo, ancora, prefixo, dentro) {
    if (!codigo || !ancora) return;
    const fontes = Array.isArray(codigo) ? codigo.filter(Boolean) : [codigo];
    const montar = typeof prefixo === 'function' ? prefixo
      : () => { const v = String(fontes[0].value || '').trim(); return v ? prefixo + ' ' + v : ''; };
    const caixaAncora = caixa(ancora) || ancora.parentElement;
    const nota = document.createElement(dentro ? 'span' : 'small');
    nota.dataset.visatCodigoTexto = '';
    let posicionar = () => {};
    if (dentro) {
      // Código dentro do quadro do campo, à direita (ex.: "CNES 0019658").
      caixaAncora.style.position = 'relative';
      Object.assign(nota.style, {
        position: 'absolute', transform: 'translateY(-50%)', pointerEvents: 'none', whiteSpace: 'nowrap',
        fontSize: '12px', fontWeight: '600', color: '#41526a', background: '#eef3f8', border: '1px solid #d5dee8',
        borderRadius: '999px', padding: '2px 8px', lineHeight: '1.3'
      });
      nota.setAttribute('aria-hidden', 'true');
      const padraoPadding = getComputedStyle(ancora).paddingRight;
      posicionar = () => {
        if (nota.hidden) { ancora.style.paddingRight = padraoPadding; return; }
        nota.style.top = (ancora.offsetTop + ancora.offsetHeight / 2) + 'px';
        nota.style.right = (caixaAncora.clientWidth - ancora.offsetLeft - ancora.offsetWidth + 10) + 'px';
        ancora.style.paddingRight = (nota.offsetWidth + 20) + 'px';
      };
      if ('ResizeObserver' in window) new ResizeObserver(() => posicionar()).observe(ancora);
    } else {
      nota.className = 'field-help';
    }
    const atualizar = () => {
      const t = montar();
      nota.textContent = t;
      nota.hidden = !t;
      if (dentro) ancora.setAttribute('aria-description', t);
      posicionar();
    };
    fontes.forEach(f => ['input', 'change'].forEach(t => f.addEventListener(t, atualizar)));
    // O preenchimento automático pode gravar o código sem disparar evento: confere também ao sair do campo.
    ancora.addEventListener('blur', () => setTimeout(atualizar, 300));
    ancora.addEventListener('change', () => setTimeout(atualizar, 300));
    ancora.addEventListener('input', () => setTimeout(atualizar, 300));
    caixaAncora.append(nota);
    atualizar();
  }
  function reducoesComuns(root, options) {
    const porId = id => root.querySelector('#' + id);
    // 1. Linha de título no lugar de tipo, agravo e CID-10 do agravo.
    const tipo = porId('sinan-tipo'), agravo = porId('sinan-agravo'), cid = porId('sinan-cidAgravo');
    const gerais = (agravo || tipo)?.closest('.screen');
    if (gerais && !gerais.querySelector('[data-visat-titulo-agravo]')) {
      const linha = document.createElement('p');
      linha.className = 'visat-titulo-agravo';
      linha.dataset.visatTituloAgravo = '';
      linha.textContent = [tipo?.value.replace(/^2 – Individual/, 'Notificação individual'), agravo?.value, cid?.value ? 'CID-10 ' + cid.value : '']
        .filter(Boolean).join(' · ');
      Object.assign(linha.style, { margin: '0 0 12px', padding: '8px 12px', borderRadius: '8px', background: '#f3f8fc',
        border: '1px solid #c9dcec', fontWeight: '700', color: '#112C45', fontSize: '14px' });
      const grade = gerais.querySelector('.field-group');
      (grade || gerais).before(linha);
    }
    [tipo, agravo, cid].forEach(soNoPdf);
    // 2. Município e UF no mesmo quadro, com o código IBGE dentro (UF e código continuam no PDF).
    //    A UF aparece separada só se ficar vazia com o município preenchido (digitado sem escolher na lista).
    const juntar = (uf, mun, ibge) => {
      if (!uf || !mun) return;
      const caixaUf = soNoPdf(uf);
      if (ibge) soNoPdf(ibge);
      const rot = caixa(mun)?.querySelector('.field-label');
      if (rot && !/UF/.test(rot.textContent)) rot.textContent = rot.textContent.replace(/^Município/, 'Município / UF');
      textoDoCodigo([uf, ibge, mun], mun, () => {
        const partes = [String(uf.value || '').trim(), ibge && String(ibge.value || '').trim() ? 'IBGE ' + ibge.value.trim() : ''];
        return String(mun.value || '').trim() ? partes.filter(Boolean).join(' · ') : '';
      }, true);
      const reserva = () => {
        const mostrar = !!String(mun.value || '').trim() && !String(uf.value || '').trim();
        if (caixaUf) caixaUf.style.setProperty('display', mostrar ? '' : 'none', mostrar ? '' : 'important');
        window.visatBalancearLinhas?.();
      };
      ['input', 'change', 'blur'].forEach(t => { mun.addEventListener(t, () => setTimeout(reserva, 350)); uf.addEventListener(t, reserva); });
    };
    juntar(porId('sinan-uf-notif'), porId('sinan-mun-notif'), porId('sinan-ibge-notif'));
    juntar(porId('sinan-uf-res'), porId('sinan-mun-res'), porId('sinan-ibge-res'));
    [['ufEmp', 'munEmp', 'ibgeEmp'], ['ufOcorrencia', 'munOcorrencia', 'ibgeOcorrencia'], ['ufAtendimento', 'munAtendimento', 'ibgeAtendimento']]
      .forEach(([u, m, c]) => juntar(campo(root, u), campo(root, m), campo(root, c)));
    [['sinan-cod-unid', 'sinan-unid', true], ['cnesAtendimento', 'unidAtendimento', false]].forEach(([cod, uni, id]) => {
      const c = id ? porId(cod) : campo(root, cod), u = id ? porId(uni) : campo(root, uni);
      if (c && u && soNoPdf(c)) textoDoCodigo(c, u, 'CNES', true);
    });
    // Dados gerais (grade de 12 colunas): linha vazia some; a coluna que sobrou vai para o campo mais largo.
    root.querySelectorAll('.draft-grid-12').forEach(linha => {
      const visiveis = [...linha.children].filter(c => !c.hidden && c.style.display !== 'none');
      if (!visiveis.length) { linha.style.setProperty('display', 'none', 'important'); return; }
      const span = c => Number(([...c.classList].find(x => /^draft-span-\d+$/.test(x)) || 'draft-span-0').split('-').pop());
      const sobra = 12 - visiveis.reduce((t, c) => t + span(c), 0);
      if (sobra <= 0 || sobra >= 12) return;
      const maior = visiveis.reduce((a, b) => (span(b) > span(a) ? b : a));
      const atual = span(maior);
      maior.classList.remove('draft-span-' + atual);
      maior.classList.add('draft-span-' + (atual + sobra));
    });
    // Gestante só aparece com sexo feminino (masculino segue "Não se aplica" no registro, fora da tela).
    const gestante = root.querySelector('[data-chips="gestante"]');
    const caixaGestante = gestante && caixa(gestante);
    if (caixaGestante) {
      const sexo = root.querySelector('[data-chips="sexo"]');
      const aplicar = () => {
        const fem = sexo?.querySelector('.chip.selected')?.dataset.value === 'Feminino';
        if (caixaGestante.hidden === !fem) return;
        caixaGestante.hidden = !fem;
        window.visatBalancearLinhas?.();
      };
      aplicar();
      if (sexo) new MutationObserver(aplicar).observe(sexo, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    // Número e complemento no mesmo quadro (cada valor continua em seu campo no PDF).
    const combinar = (a, b, titulo, larguraA) => {
      const ca = caixa(a), cb = caixa(b);
      if (!ca || !cb || ca.closest('[data-visat-combo]')) return;
      const combo = document.createElement('div');
      combo.dataset.visatCombo = '';
      const rot = document.createElement('label');
      rot.className = 'field-label';
      rot.htmlFor = a.id;
      rot.dataset.visatSomenteTela = '';
      rot.textContent = titulo;
      const linha = document.createElement('div');
      linha.style.display = 'flex';
      ca.before(combo);
      combo.append(rot, linha);
      linha.append(ca, cb);
      [ca, cb].forEach(c => { const l = c.querySelector('.field-label'); if (l) l.style.setProperty('display', 'none', 'important'); });
      ca.style.flex = '0 0 ' + larguraA;
      cb.style.flex = '1 1 auto';
      cb.style.minWidth = '0';
      Object.assign(a.style, { borderTopRightRadius: '0', borderBottomRightRadius: '0' });
      Object.assign(b.style, { borderTopLeftRadius: '0', borderBottomLeftRadius: '0', marginLeft: '-1px' });
      if (!a.placeholder) a.placeholder = 'Nº';
      if (!b.placeholder) b.placeholder = 'Complemento (apto., bloco…)';
      setTimeout(() => window.visatBalancearLinhas?.(), 0);
    };
    combinar(porId('sinan-num'), porId('sinan-comp'), 'Número e complemento', '32%');
    // Aplicativo: sem "Tipo de aplicativo"; fica só "Qual aplicativo?" (texto), quando a resposta é Sim.
    remover(root, 'tipoAplicativo');
    // Link do CADSUS com texto curto.
    root.querySelectorAll('a[href*="cadastro.saude.gov.br"]').forEach(a => {
      a.textContent = 'Consultar CADSUS';
      a.title = 'Acesso restrito a operadores autorizados';
    });
    // 3. Situação cadastral e matriz/filial: aviso curto embaixo do CNPJ (só na tela).
    const situacao = campo(root, 'situacaoCadastral'), matriz = campo(root, 'matrizFilial'), cnpj = campo(root, 'cnpj');
    if (situacao && matriz && cnpj) {
      [situacao, matriz].forEach(el => { const c = caixa(el); if (c) c.hidden = true; });
      const aviso = document.createElement('small');
      aviso.className = 'field-help';
      aviso.dataset.visatSituacaoCnpj = '';
      const atualizar = () => {
        const sit = situacao.value.trim(), tip = matriz.value.trim();
        aviso.textContent = [sit && 'Situação cadastral: ' + sit, tip].filter(Boolean).join(' · ');
        aviso.style.color = sit && !/^ativa$/i.test(sit) ? '#B3261E' : '';
        aviso.hidden = !aviso.textContent;
      };
      [situacao, matriz].forEach(el => ['input', 'change'].forEach(t => el.addEventListener(t, atualizar)));
      caixa(cnpj).append(aviso);
      atualizar();
    }
    // 4. Local de atuação do servidor sem CEP e endereço.
    remover(root, 'cepAtuacao');
    remover(root, 'enderecoAtuacao');
    // 5. Sem data do preenchimento (repete a data da notificação).
    ['dataFechamento', 'data', 'dataFinal'].forEach(k => {
      const el = campo(root, k);
      if (el && el.type === 'date') remover(root, k);
    });
    setTimeout(() => window.visatBalancearLinhas?.(), 0);
    // 7. Sem "Horas após o início da jornada" (decisão da usuária em 17/11/2026; campo 51 da ficha do Sinan).
    remover(root, 'tempoJornada');
    // 6. Descrição e outras informações num campo só.
    remover(root, 'observacoesRascunho');
    const acidente = options && options.templateId === 'form-acidente-template';
    if (acidente) rotulo(root, 'atividade', 'Descrição sumária do acidente e observações');
    else rotulo(root, 'descricaoRascunho', 'Descrição do caso e observações');
  }

  const AJUSTES = {
    'form-biologico-template'(root) {
      const etapa = campo(root, 'evolucao')?.closest('.screen');
      const sub = etapa?.querySelector('.screen-sub');
      if (sub) sub.textContent = 'Exposição, situação sorológica, conduta e conclusão.';
      ['distEmp', 'munInvestigadora', 'codUnidInv', 'fonteAntiHBs'].forEach(k => remover(root, k));
      condicao(root, 'virusConversao', 'data-show-when', 'evolucao=Alta com conversão sorológica');
      rotulo(root, 'virusConversao', 'Vírus da conversão sorológica');
      condicao(root, 'dataObito', 'data-show-contains', 'evolucao=Óbito');
      const d = campo(root, 'descricaoRascunho'); if (d) d.placeholder = 'Circunstâncias do acidente, da exposição e do atendimento, e outras informações.';
    },
    'form-cancer-template'(root) {
      condicao(root, 'agentes', 'data-show-when', 'exposicao=Sim');
      condicao(root, 'dataObito', 'data-show-contains', 'evolucao=Óbito');
      condicao(root, 'tempoTabaco', 'data-show-in', 'fumo=Sim|Ex-fumante');
      
    },
    'form-pneumo-template'(root) {
      tirarOpcao(root, 'agravosAssoc', 'Nenhum');
      condicao(root, 'resultadoFunc', 'data-show-when', 'funcional=Sim');
      condicao(root, 'tempoTabaco', 'data-show-in', 'fumo=Sim|Ex-fumante');
      
    },
    'form-mental-template'(root) {
      condicao(root, 'tabacoValor', 'data-show-in', 'fumar=Sim|Ex-fumante');
      
    },
    'form-voz-template'(root) {
      rotulo(root, 'sintomas', 'Sinais e sintomas vocais', 'Ex.: disfonia, rouquidão, cansaço vocal, dor ao falar, perda de voz');
      remover(root, 'observacoes');
    }
  };

  window.montarFormulario = function montarFormularioReplica(container, onVoltar, options) {
    const resultado = original.apply(this, arguments);
    const root = container.querySelector('.acidente-inline') || container;
    const ajuste = AJUSTES[options && options.templateId];
    try {
      if (ajuste) ajuste(root);
      // Doenças: orientação do texto final.
      if (options && options.templateId !== 'form-acidente-template' && options.templateId !== 'form-biologico-template') {
        const d = campo(root, 'descricaoRascunho');
        if (d) d.placeholder = 'História ocupacional e clínica, exposição, relação com o trabalho e outras informações.';
      }
      reducoesComuns(root, options);
    } catch (erro) {
      console.warn('[VISAT réplica] ajuste não aplicado:', erro);
    }
    return resultado;
  };
  window.VISAT_REPLICA = true;
})();
