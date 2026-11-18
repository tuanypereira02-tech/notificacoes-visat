/*
 * ajustes-replica.js — Réplica para testes da página "Como notificar" (VISAT Florianópolis).
 * Carregado só por replica-como-notificar.html. A página usada no Google Sites (notificacao.html) não muda.
 * Aplica os ajustes da "versão qualificada" das 10 fichas (17/11/2026), depois de cada ficha ser montada:
 *  - 1b: subtítulo da etapa; retira distrito, unidade investigadora e Anti-HBs do paciente-fonte (ficha oficial);
 *        vírus da conversão e data do óbito só quando cabem.
 *  - 1c: lista de agentes só com "Sim"; data do óbito só com evolução = óbito.
 *  - 1c, 1h, 1i: tempo de exposição ao tabaco só com "Sim" ou "Ex-fumante".
 *  - 1c a 1i: a "Data" solta da etapa vai para o bloco do responsável (data do preenchimento, já com o dia).
 *  - 1b a 1i: texto final "Descrição do caso".
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
  function dataParaResponsavel(root, chave) {
    const el = campo(root, chave);
    const destino = root.querySelector('[data-visat-responsavel] .field-group');
    if (!el || !destino) return;
    const c = caixa(el);
    const linha = c.parentElement;
    const nova = document.createElement('div');
    nova.className = 'draft-row draft-cols-3';
    nova.append(c);
    destino.append(nova);
    if (linha && linha.matches('.draft-row, .visat-linha-campos, .pair-row') && !linha.querySelector('[data-key], [data-chips]')) linha.remove();
    const l = c.querySelector('.field-label');
    if (l) l.textContent = 'Data do preenchimento';
    if (!el.value) {
      el.value = hoje();
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  function tirarOpcao(root, chave, valor) {
    root.querySelector('[data-chips="' + chave + '"] .chip[data-value="' + valor + '"]')?.remove();
    // Lista suspensa equivalente (quando o grupo é exibido como lista)
    const grupo = root.querySelector('[data-chips="' + chave + '"]');
    const lista = grupo?.nextElementSibling;
    if (lista && lista.tagName === 'SELECT') [...lista.options].filter(o => o.value === valor).forEach(o => o.remove());
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
      rotulo(root, 'descricaoRascunho', 'Descrição do caso', 'Circunstâncias do acidente, da exposição e do atendimento.');
    },
    'form-cancer-template'(root) {
      condicao(root, 'agentes', 'data-show-when', 'exposicao=Sim');
      condicao(root, 'dataObito', 'data-show-contains', 'evolucao=Óbito');
      condicao(root, 'tempoTabaco', 'data-show-in', 'fumo=Sim|Ex-fumante');
      dataParaResponsavel(root, 'data');
    },
    'form-dermatose-template'(root) { dataParaResponsavel(root, 'dataFinal'); },
    'form-lerdort-template'(root) { dataParaResponsavel(root, 'dataFinal'); },
    'form-pair-template'(root) { dataParaResponsavel(root, 'dataFinal'); },
    'form-pneumo-template'(root) {
      tirarOpcao(root, 'agravosAssoc', 'Nenhum');
      condicao(root, 'resultadoFunc', 'data-show-when', 'funcional=Sim');
      condicao(root, 'tempoTabaco', 'data-show-in', 'fumo=Sim|Ex-fumante');
      dataParaResponsavel(root, 'dataFinal');
    },
    'form-mental-template'(root) {
      condicao(root, 'tabacoValor', 'data-show-in', 'fumar=Sim|Ex-fumante');
      dataParaResponsavel(root, 'dataFinal');
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
      // Doenças e material biológico: texto final "Descrição do caso".
      if (options && options.templateId !== 'form-acidente-template' && options.templateId !== 'form-biologico-template') {
        rotulo(root, 'descricaoRascunho', 'Descrição do caso', 'História ocupacional e clínica, exposição e relação com o trabalho.');
      }
    } catch (erro) {
      console.warn('[VISAT réplica] ajuste não aplicado:', erro);
    }
    return resultado;
  };
  window.VISAT_REPLICA = true;
})();
