/*
 * ajustes-replica.js — Modelo final das fichas da página "Como notificar" (VISAT Florianópolis).
 * Página oficial do Google Sites (notificacao.html): itens comuns e ajustes específicos em todas as fichas (18/11/2026).
 * Réplica para testes (replica-como-notificar.html): aplicado às 10 fichas.
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
 *  - Sem o bloco "Responsável pela notificação" (nome, função e e-mail).
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
      // Texto dentro do quadro, logo depois do que foi digitado (ex.: "Florianópolis – SC · 420540").
      caixaAncora.style.position = 'relative';
      const cs = getComputedStyle(ancora);
      Object.assign(nota.style, {
        position: 'absolute', transform: 'translateY(-50%)', pointerEvents: 'none', whiteSpace: 'nowrap',
        font: cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily, color: '#5b6b80', overflow: 'hidden', textOverflow: 'ellipsis'
      });
      nota.setAttribute('aria-hidden', 'true');
      const medidor = document.createElement('canvas').getContext('2d');
      const padraoPadding = cs.paddingRight;
      posicionar = () => {
        if (nota.hidden || !ancora.value) { nota.hidden = true; ancora.style.paddingRight = padraoPadding; return; }
        const st = getComputedStyle(ancora);
        medidor.font = st.fontWeight + ' ' + st.fontSize + ' ' + st.fontFamily;
        const esquerda = ancora.offsetLeft + parseFloat(st.paddingLeft) + parseFloat(st.borderLeftWidth) + medidor.measureText(ancora.value).width + 4;
        const limite = ancora.offsetLeft + ancora.offsetWidth - 10;
        nota.style.top = (ancora.offsetTop + ancora.offsetHeight / 2) + 'px';
        nota.style.left = esquerda + 'px';
        nota.style.maxWidth = Math.max(0, limite - esquerda) + 'px';
        ancora.style.paddingRight = Math.min(nota.offsetWidth + 14, ancora.offsetWidth / 2) + 'px';
      };
      if ('ResizeObserver' in window) new ResizeObserver(() => posicionar()).observe(ancora);
      ancora.addEventListener('input', () => posicionar());
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
        const u = String(uf.value || '').trim(), c = ibge ? String(ibge.value || '').trim() : '';
        if (!String(mun.value || '').trim() || (!u && !c)) return '';
        return (u ? '– ' + u : '') + (c ? ' · ' + c : '');
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
      if (c && u && soNoPdf(c)) textoDoCodigo(c, u, () => (String(c.value || '').trim() ? '· CNES ' + c.value.trim() : ''), true);
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
    // Sem "CNAE secundário" (decisão da usuária em 17/11/2026): o CNAE pode ser corrigido no próprio campo.
    remover(root, 'cnaeSecundario');
    // Link do CADSUS com texto curto.
    root.querySelectorAll('a[href*="cadastro.saude.gov.br"]').forEach(a => {
      a.textContent = 'Consultar CADSUS';
      a.title = 'Acesso restrito a operadores autorizados';
    });
    // Confirmações ("Unidade identificada.", "Município identificado.") aparecem e somem depois de 2,5 s.
    const temporizadores = new WeakMap();
    const avisarESair = el => {
      clearTimeout(temporizadores.get(el));
      el.style.removeProperty('display');
      el.style.opacity = '1';
      el.style.transition = 'opacity .4s';
      if (el.dataset.estado !== 'validado' || !el.textContent.trim()) return;
      temporizadores.set(el, setTimeout(() => {
        el.style.opacity = '0';
        temporizadores.set(el, setTimeout(() => el.style.setProperty('display', 'none'), 420));
      }, 2500));
    };
    new MutationObserver(mudancas => {
      const vistos = new Set();
      mudancas.forEach(m => {
        const alvo = (m.target.nodeType === 1 ? m.target : m.target.parentElement)?.closest?.('.visat-estado-codigo');
        if (alvo && !vistos.has(alvo)) { vistos.add(alvo); avisarESair(alvo); }
        m.addedNodes?.forEach(n => { if (n.nodeType === 1 && n.matches('.visat-estado-codigo')) avisarESair(n); });
      });
    }).observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-estado'] });
    // Opção repetida no mesmo grupo (ex.: "Ignorado" duas vezes em Agente, ficha 1b) aparece uma vez só.
    root.querySelectorAll('[data-chips]').forEach(g => {
      const vistos = new Set();
      g.querySelectorAll('.chip').forEach(c => { if (vistos.has(c.dataset.value)) c.remove(); else vistos.add(c.dataset.value); });
    });
    // Empresa e endereço da empresa num bloco só, sem subtítulo nem traço entre eles (dados da mesma empresa).
    const seqEmpresa = campo(root, 'cnpj')?.closest('.visat-sequencia');
    const seqEndereco = campo(root, 'cepEmp')?.closest('.visat-sequencia') || campo(root, 'endEmp')?.closest('.visat-sequencia');
    if (seqEmpresa && seqEndereco && seqEmpresa !== seqEndereco) {
      const destino = seqEmpresa.querySelector(':scope > .field-group') || seqEmpresa;
      const origem = seqEndereco.querySelector(':scope > .field-group');
      if (origem) [...origem.children].forEach(filho => destino.append(filho));
      if (!seqEndereco.querySelector('[data-key], [data-chips]')) seqEndereco.remove();
    }
    // CEP no padrão 00000-000.
    root.querySelectorAll('#sinan-cep, [data-key="cepEmp"]').forEach(cep => {
      if (cep.dataset.visatMascaraCep) return;
      cep.dataset.visatMascaraCep = '1';
      cep.setAttribute('inputmode', 'numeric');
      cep.maxLength = 9;
      const aplicar = () => {
        const d = cep.value.replace(/\D/g, '').slice(0, 8);
        const f = d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
        if (f !== cep.value) cep.value = f;
      };
      cep.addEventListener('input', aplicar);
      cep.addEventListener('change', aplicar);
      aplicar();
    });
    // Unidades de tempo conforme o número: 1 → Hora, Dia, Mês, Ano; demais → Horas, Dias, Meses, Anos.
    // O valor gravado continua o mesmo.
    const UNIDADES = {
      hora: ['Hora', 'Horas'], horas: ['Hora', 'Horas'], dia: ['Dia', 'Dias'], dias: ['Dia', 'Dias'],
      'mês': ['Mês', 'Meses'], mes: ['Mês', 'Meses'], meses: ['Mês', 'Meses'], ano: ['Ano', 'Anos'], anos: ['Ano', 'Anos']
    };
    const camposNumero = [...root.querySelectorAll('input[data-key]')];
    root.querySelectorAll('.unit-row select, select[data-key$="Unidade"], select[data-key$="Un"], select[data-key$="Unid"]').forEach(sel => {
      const opcoes = [...sel.options].filter(o => UNIDADES[o.text.trim().toLowerCase()]);
      if (!opcoes.length) return;
      opcoes.forEach(o => {
        const formas = UNIDADES[o.text.trim().toLowerCase()];
        if (!o.hasAttribute('value')) o.value = o.text.trim();
        o.dataset.visatFormas = formas.join('|');
      });
      // Tempo na ocupação: Meses e Anos. Tempo de exposição ao agente: Dias, Meses e Anos.
      const chave = sel.dataset.key || '';
      const tirar = /^tempoOcup|^tempoUnidade$/.test(chave) ? /^(Hora|Dia)/
        : /^(tempoExposicao|tempoExp|exp|agente)Un/.test(chave) ? /^Hora/ : null;
      if (tirar) {
        opcoes.filter(o => tirar.test(o.dataset.visatFormas)).forEach(o => {
          if (o.selected) { const ano = opcoes.find(x => /^Ano/.test(x.dataset.visatFormas)); if (ano) ano.selected = true; }
          o.remove();
        });
      }
      const numero = camposNumero.filter(i => i.compareDocumentPosition(sel) & Node.DOCUMENT_POSITION_FOLLOWING).pop();
      const atualizar = () => {
        const n = Number(String(numero?.value || '').replace(',', '.'));
        const singular = n === 1;
        [...sel.options].forEach(o => {
          if (!o.dataset.visatFormas) return;
          const [um, varios] = o.dataset.visatFormas.split('|');
          o.text = singular ? um : varios;
        });
      };
      if (numero) { numero.addEventListener('input', atualizar); numero.addEventListener('change', atualizar); }
      atualizar();
    });
    // Telefone no padrão (DD) 99999-9999 ou (DD) 9999-9999: só números, DDD de 2 dígitos sem o zero,
    // no máximo 11 dígitos. Incompleto: aviso ao sair do campo.
    const formatarTelefone = v => {
      let d = String(v || '').replace(/\D/g, '').replace(/^0+/, '').slice(0, 11);
      if (!d) return '';
      if (d.length <= 2) return '(' + d;
      const ddd = d.slice(0, 2), n = d.slice(2);
      if (n.length <= 4) return '(' + ddd + ') ' + n;
      const corte = n.length === 9 ? 5 : 4;
      return '(' + ddd + ') ' + n.slice(0, corte) + '-' + n.slice(corte);
    };
    root.querySelectorAll('#sinan-tel, input[type="tel"], [data-key="telEmp"], [data-key="telefone"], [data-key="telefoneRes"]').forEach(tel => {
      if (tel.dataset.visatMascaraTel || tel.tagName !== 'INPUT') return;
      tel.dataset.visatMascaraTel = '1';
      tel.setAttribute('inputmode', 'tel');
      tel.maxLength = 15;
      tel.placeholder = '(48) 99999-9999';
      const aviso = document.createElement('small');
      aviso.className = 'field-help';
      aviso.style.color = '#B3261E';
      aviso.hidden = true;
      (caixa(tel) || tel.parentElement).append(aviso);
      const aplicar = () => {
        const f = formatarTelefone(tel.value);
        if (f !== tel.value) tel.value = f;
      };
      tel.addEventListener('input', aplicar);
      tel.addEventListener('change', aplicar);
      tel.addEventListener('blur', () => {
        aplicar();
        const n = tel.value.replace(/\D/g, '').length;
        const ruim = n > 0 && n < 10;
        aviso.textContent = ruim ? 'Telefone incompleto: informe DDD + número, ex.: (48) 99142-6513.' : '';
        aviso.hidden = !ruim;
        tel.toggleAttribute('aria-invalid', ruim);
      });
      aplicar();
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
    // 8. Sem o bloco "Responsável pela notificação" (decisão da usuária em 17/11/2026):
    //    quem notifica fica identificado pelo "Seu e-mail" da janela de envio e pela assinatura no PDF.
    root.querySelectorAll('[data-visat-responsavel]').forEach(secao => secao.remove());
    ['profissional', 'investigador', 'funcao', 'funcaoProfissional', 'funcaoInvestigador', 'emailProfissional'].forEach(k => remover(root, k));
    // 7. Sem "Horas após o início da jornada" (decisão da usuária em 17/11/2026; campo 51 da ficha do Sinan).
    remover(root, 'tempoJornada');
    // 6. Descrição e outras informações num campo só.
    remover(root, 'observacoesRascunho');
    const acidente = options && options.templateId === 'form-acidente-template';
    if (acidente) rotulo(root, 'atividade', 'Descrição sumária do acidente e observações');
    else rotulo(root, 'descricaoRascunho', 'Descrição do caso e observações');
  }


  // ---------- Layout da ficha 1a: grade de 4 colunas, caixas do mesmo tamanho ----------
  // Cada linha: [chave, colunas]. Campos condicionais ficam na mesma linha e só ocupam espaço quando aparecem.
  // Blocos comuns a todas as fichas (mesma posição e tamanho em todas).
  const LAYOUT_COMUM = [
    [['#sinan-nome', 2], ['#sinan-nasc', 1], ['#sinan-idade', 1]],
    [['sexo', 1], ['gestante', 1], ['raca', 1], ['#sinan-esc', 1]],
    [['#sinan-cpf', 1], ['#sinan-sus', 1], ['#sinan-mae', 3]],
    [['#sinan-residencia-pais', 1], ['#sinan-pais', 3], ['#sinan-mun-res', 3]],
    [['#sinan-cep', 1], ['#sinan-logr', 2], ['#sinan-num', 1]],
    [['#sinan-bairro', 1], ['#sinan-tel', 1], ['zona', 2]],
    [['ocupacao', 2], ['situacao', 2]],
    [['tempoNum|tempoValor|tempoOcupacao|tempoOcup', 1], ['plataformaDigital', 1], ['qualAplicativo', 2]],
    [['ocupacaoAnterior', 2], ['localAtuacao', 2]],
    [['cnpj', 2], ['empresa|empresaNome|razao', 2]],
    [['cnae', 2], ['telEmp|telefone', 1], ['terceirizada', 1]],
    [['cepEmp', 1], ['munEmp', 2], ['bairroEmp|bairro', 1]],
    [['endEmp|endereco', 3], ['numEmp|numero', 1]],
    [['cnpjPrincipal|cnpjPrinc', 2], ['empresaPrincipal|razaoPrincipal|razaoPrinc', 2]],
    [['cnaePrincipal|cnaePrinc', 2]]
  ];
  const LAYOUT_ACIDENTE = [
    [['horaAcidente', 1], ['tipoAcidente', 1], ['munOcorrencia', 2]],
    [['outrosAtingidos', 1], ['outrosAtingidosQuantidade', 1], ['atendimentoMedico', 1]],
    [['dataAtendimento', 1], ['munAtendimento', 1], ['unidAtendimento', 2]],
    [['parteCorpo', 4]],
    [['parteCorpoOutra', 2], ['regime', 2]],
    [['fatores', 4]],
    [['evolucao', 4]],
    [['cat', 4]],
    [['atividade', 4]]
  ];
  // Demais campos (dados do agravo das doenças, 1b, 1e, 1j): grade de 4 colunas na ordem da ficha,
  // com largura padronizada pelo tipo de campo.
  function larguraPadrao(c) {
    if (c.querySelector('[data-chips="sintomas"], [data-chips="agravos"], [data-chips="condutas"]')) return 4;
    if (c.querySelector('[data-chips="afastamento"], [data-chips="outrosTrab"], [data-chips="caps"], [data-chips="outrosTrabalhadores"]')) return 2;
    if (c.querySelector('textarea') || c.matches('.highlight-box, [data-visat-aviso-cat]')) return 4;
    const chips = [...c.querySelectorAll('[data-chips]:not([style*="display: none"]) .chip')];
    if (chips.length) {
      const texto = chips.reduce((t, x) => t + x.textContent.trim().length, 0);
      if (chips.length > 6 || texto > 70) return 4;
      if (chips.length <= 3 && texto <= 26) return 1;
      return 2;
    }
    const sel = c.querySelector('select');
    if (sel && !c.querySelector('.unit-row')) {
      const maior = Math.max(0, ...[...sel.options].map(o => o.text.trim().length));
      if (maior > 34) return 4;
      return maior > 18 ? 2 : 1;
    }
    if (c.querySelector('.unit-row, input[type="date"], input[type="time"], input[type="number"]')) return 1;
    const rotulo = c.querySelector('.field-label')?.textContent.trim() || '';
    const chave = c.querySelector('[data-key]')?.dataset.key || '';
    if (/nome|endere|logr|empresa|ocupa|mun|unid|estabelec|descr|especif|outr|qual|cid|agente|vínculo|vinculo/i.test(chave + ' ' + rotulo) || rotulo.length > 30) return 2;
    return 1;
  }
  function larguraNaGrade(caixa, colunas) {
    if (document.documentElement.classList.contains('visat-teste-compacto')) {
      caixa.dataset.visatColunas = String(colunas);
      caixa.style.setProperty('--visat-colunas-previstas', String(colunas));
      return;
    }
    caixa.style.setProperty('grid-column', 'span ' + colunas, 'important');
  }
  function gradeAutomatica(root) {
    const ESTRUTURA = 'section, details, .field-group, .draft-detalhes, .visat-sequencia, [data-visat-secao-complementar], .visat-painel-causa';
    const ehCampo = el => el.nodeType === 1 && !el.matches(ESTRUTURA + ', .visat-titulo-agravo, h1, h2, h3, p, .screen-title, .screen-sub')
      && !el.querySelector(ESTRUTURA) && !!el.querySelector('.field-label, [data-chips]');
    const ehLinha = el => el.matches('.draft-row, .visat-linha-campos, .pair-row');
    root.querySelectorAll('.screen .field-group').forEach(grupo => {
      if (grupo.closest('section.visat-r, .visat-painel-causa')) return;
      let secao = null;
      [...grupo.children].forEach(filho => {
        const caixas = ehLinha(filho) ? [...filho.children].filter(ehCampo) : (ehCampo(filho) ? [filho] : []);
        if (!caixas.length) { if (!filho.matches('section.visat-r')) secao = null; return; }
        if (!secao) {
          secao = document.createElement('section');
          secao.className = 'visat-r';
          secao.style.setProperty('grid-column', '1 / -1', 'important');
          filho.before(secao);
        }
        caixas.forEach(c => {
          larguraNaGrade(c, larguraPadrao(c));
          c.removeAttribute('data-visat-span');
          secao.append(c);
        });
        if (ehLinha(filho) && !filho.querySelector('[data-key], [data-chips]')) filho.remove();
      });
    });
  }

  function caixaLayout(root, chave) {
    const el = /^[#\[]/.test(chave) ? root.querySelector(chave)
      : chave.split('|').map(k => campo(root, k)).find(Boolean);
    if (!el) return null;
    const combo = el.closest('[data-visat-combo]');
    if (combo) return combo;
    return caixa(el);
  }
  function aplicarLayout(root, linhas) {
    const antigas = new Set();
    let anterior = null;
    const grupoDe = el => el.closest('.field-group');
    linhas.forEach(linha => {
      const itens = linha.map(([k, n]) => [caixaLayout(root, k), n]).filter(([c]) => c && !c.closest('section.visat-r'));
      if (!itens.length) return;
      let ref = itens[0][0];
      while (ref.parentElement && ref.parentElement.matches('.draft-row, .visat-linha-campos, .pair-row')) ref = ref.parentElement;
      // Linhas do mesmo bloco ficam numa só grade: campo oculto não deixa buraco, os seguintes sobem.
      let secao;
      if (anterior && grupoDe(anterior) && grupoDe(anterior) === grupoDe(ref)) secao = anterior;
      else {
        secao = document.createElement('section'); // <section>: o balanceador de linhas não mexe nela
        secao.className = 'visat-r';
        secao.style.setProperty('grid-column', '1 / -1', 'important');
        ref.before(secao);
      }
      anterior = secao;
      itens.forEach(([c, n]) => {
        const pai = c.parentElement;
        if (pai && pai.matches('.draft-row, .visat-linha-campos, .pair-row')) antigas.add(pai);
        larguraNaGrade(c, n);
        c.removeAttribute('data-visat-span');
        c.style.removeProperty('--visat-span');
        secao.append(c);
      });
    });
    // Linhas antigas que ficaram só com campos fora da tela (UF, códigos) não ocupam espaço.
    antigas.forEach(l => {
      const restam = [...l.children].some(c => !c.hidden && c.style.display !== 'none');
      if (!restam) l.style.setProperty('display', 'none', 'important');
    });
    root.querySelectorAll('.draft-row, .visat-linha-campos, .pair-row').forEach(l => {
      if (l.closest('section.visat-r')) return;
      const visiveis = [...l.children].filter(c => !c.hidden && c.style.display !== 'none' && !c.hasAttribute('data-visat-so-pdf'));
      if (!visiveis.length && !l.querySelector('[data-show-when],[data-show-in],[data-show-includes],[data-show-contains]')) l.style.setProperty('display', 'none', 'important');
    });
    root.dataset.visatLayoutReplica = '1';
    // Índice de etapas: destaca a etapa que está na tela (útil no quadro do Sites, onde a ficha rola por dentro).
    const indice = root.querySelector('.visat-indice-ficha');
    if (indice && 'IntersectionObserver' in window && !indice.dataset.visatEtapaAtual) {
      indice.dataset.visatEtapaAtual = '1';
      const botoes = [...indice.querySelectorAll('.btn')];
      const telas = [...root.querySelectorAll('.screen[data-screen]')].filter(t => !t.querySelector('#summaryGrid'));
      const marcar = i => botoes.forEach((b, k) => { if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      const visiveis = new Map();
      const obs = new IntersectionObserver(entradas => {
        entradas.forEach(e => visiveis.set(e.target, e.isIntersecting ? e.intersectionRatio : 0));
        let melhor = -1, maior = 0;
        telas.forEach((t, i) => { const r = visiveis.get(t) || 0; if (r > maior) { maior = r; melhor = i; } });
        if (melhor >= 0) marcar(melhor);
      }, { threshold: [0, .15, .35, .6, .9] });
      telas.forEach(t => obs.observe(t));
    }
    // Primeiro bloco de cada etapa sem linha separadora nem espaço vazio no topo.
    root.querySelectorAll('.screen').forEach(tela => {
      const primeiro = tela.querySelector('[data-visat-secao-complementar], .visat-sequencia');
      if (!primeiro) return;
      const antes = [...tela.querySelectorAll('section.visat-r, .visat-titulo-agravo')].some(el =>
        (el.compareDocumentPosition(primeiro) & Node.DOCUMENT_POSITION_FOLLOWING) && !primeiro.contains(el));
      if (antes) return;
      ['border-top', 'margin-top', 'padding-top'].forEach(p => primeiro.style.setProperty(p, p === 'border-top' ? '0' : '0', 'important'));
    });
    setTimeout(() => window.visatBalancearLinhas?.(), 0);
  }

  function organizarResultadosBiologico(root) {
    const referencia = caixa(campo(root, 'fonte'));
    if (!referencia) return;
    const mostrarPessoaNoRotulo = new URLSearchParams(location.search).get('rotulosExames') === '1';
    const resultados = document.createElement('section');
    resultados.className = 'visat-resultados-biologico';
    const grupos = [
      ['Resultados da pessoa acidentada (data zero)', 'Acidentado', [
        ['sorAntiHIV', 'Anti-HIV'], ['sorHBsAg', 'HBsAg'],
        ['sorAntiHBs', 'Anti-HBs'], ['sorAntiHCV', 'Anti-HCV']
      ]],
      ['Resultados da pessoa-fonte', 'Pessoa-fonte', [
        ['fonteAntiHIV', 'Anti-HIV'], ['fonteHBsAg', 'HBsAg'],
        ['fonteAntiHBc', 'Anti-HBc'], ['fonteAntiHCV', 'Anti-HCV']
      ]]
    ];
    for (const [titulo, pessoa, exames] of grupos) {
      const coluna = document.createElement('div');
      coluna.className = 'visat-coluna-resultados';
      const cabecalho = document.createElement('h4');
      cabecalho.textContent = titulo;
      coluna.append(cabecalho);
      for (const [chave, exame] of exames) {
        const grupo = campo(root, chave);
        const bloco = caixa(grupo);
        if (!bloco) continue;
        const rotulo = bloco.querySelector('.field-label');
        const rotuloCompleto = titulo + ' — ' + exame;
        rotulo.textContent = mostrarPessoaNoRotulo ? exame + ' (' + pessoa + ')' : exame;
        rotulo.dataset.visatRotuloPdf = rotuloCompleto;
        grupo.dataset.summary = rotuloCompleto;
        bloco.querySelector('select')?.setAttribute('aria-label', mostrarPessoaNoRotulo ? rotulo.textContent : rotuloCompleto);
        coluna.append(bloco);
      }
      resultados.append(coluna);
    }
    referencia.after(resultados);
  }

  const AJUSTES = {
    'form-biologico-template'(root) {
      const etapa = campo(root, 'evolucao')?.closest('.screen');
      const sub = etapa?.querySelector('.screen-sub');
      if (sub) sub.textContent = 'Exposição, situação sorológica, conduta e conclusão.';
      ['distEmp', 'munInvestigadora', 'codUnidInv', 'fonteAntiHBs'].forEach(k => remover(root, k));
      root.querySelectorAll('[data-show-when="terceirizada=Sim"]').forEach(bloco => {
        if (!bloco.querySelector('[data-key], [data-chips], button, a')) bloco.remove();
      });
      organizarResultadosBiologico(root);
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
      rotulo(root, 'agenteValor', 'Tempo de exposição ao fator de risco no trabalho');
      condicao(root, 'tabacoValor', 'data-show-in', 'fumar=Sim|Ex-fumante');
      
    },
    'form-voz-template'(root) {
      rotulo(root, 'sintomas', 'Sinais e sintomas vocais', 'Ex.: disfonia, rouquidão, cansaço vocal, dor ao falar, perda de voz');
      remover(root, 'observacoes');
    }
  };

  window.montarFormulario = function montarFormularioReplica(container, onVoltar, options) {
    const resultado = original.apply(this, arguments);
    // Itens comuns (dados gerais, pessoa, residência, trabalho, empresa, máscaras, unidades de tempo, grade e margens):
    // todas as fichas, na página oficial e na réplica, desde 18/11/2026 — padrão da ficha 1a.
    // Ajustes específicos de cada agravo (AJUSTES): todas as fichas, na página oficial e na réplica (18/11/2026).
    const especificos = true;
    const root = container.querySelector('.acidente-inline') || container;
    root.classList.add('visat-modelo-final');
    const ajuste = especificos ? AJUSTES[options && options.templateId] : null;
    try {
      if (ajuste) ajuste(root);
      // Doenças: orientação do texto final.
      if (options && options.templateId !== 'form-acidente-template' && options.templateId !== 'form-biologico-template') {
        const d = campo(root, 'descricaoRascunho');
        if (d) d.placeholder = 'História ocupacional e clínica, exposição, relação com o trabalho e outras informações.';
      }
      reducoesComuns(root, options);
      // Layout em grade de 4 colunas: blocos comuns, 1a e, nos demais campos, largura padronizada.
      const inicioSintomas = root.querySelector('[data-key="inicioSintomas"]:not([data-visat-data-referencia])');
      const datas = [['#sinan-data-notif', 1], ['[data-visat-data-referencia]', 1]];
      if (inicioSintomas) datas.splice(1, 0, ['[data-key="inicioSintomas"]:not([data-visat-data-referencia])', 1]);
      const local = ['#sinan-mun-notif', inicioSintomas ? 1 : 2];
      aplicarLayout(root, [
        [...datas, local],
        [['#sinan-unid', 4]],
        [['cid|cid10|cidCod|cidDiag', 4]],
        ...LAYOUT_COMUM
      ]);
      if (options && options.templateId === 'form-acidente-template') aplicarLayout(root, LAYOUT_ACIDENTE);
      if (options?.templateId === 'form-biologico-template') aplicarLayout(root, [
        [['tipoExposicao', 4], ['tipoExposicaoOutro', 4]],
        [['horaAcidente', 1], ['local', 3]],
        [['fonte', 4]]
      ]);
      if (options?.templateId === 'form-cancer-template') aplicarLayout(root, [
        [['regime', 2], ['tempoExposicao', 2]],
        [['exposicao', 2], ['agentes', 4]]
      ]);
      gradeAutomatica(root);
    } catch (erro) {
      console.warn('[VISAT réplica] ajuste não aplicado:', erro);
    }
    return resultado;
  };
  window.VISAT_REPLICA = window.VISAT_MODELO_FINAL_TODAS === true;
})();
