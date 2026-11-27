// Regras de conferência das fichas da réplica privada.
const revisaoVisat = (() => {
  const diaMs = 86400000;
  function tempoEntre(inicio, fim, unidade) {
    const dias = (fim - inicio) / diaMs;
    if (unidade === 'Dia') return dias;
    if (unidade === 'Hora') return (dias + 1) * 24 - 1; // Os campos de data não informam a hora.
    const anos = fim.getUTCFullYear() - inicio.getUTCFullYear();
    const meses = anos * 12 + fim.getUTCMonth() - inicio.getUTCMonth()
      - Number(fim.getUTCDate() < inicio.getUTCDate());
    return unidade === 'Mês' ? meses : Math.floor(meses / 12);
  }

  // Sem nascimento, a idade manual representa unidades completas. Use o
  // limite superior desse intervalo para evitar um bloqueio por arredondamento.
  function limiteManual(idade, origem, unidade, referencia) {
    if (origem === unidade) return idade;
    const fim = new Date(referencia);
    if (!Number.isFinite(fim.getTime())) return undefined;
    let primeiroDia;
    if (origem === 'Ano' || origem === 'Mês') {
      const meses = (idade + 1) * (origem === 'Ano' ? 12 : 1);
      const mesLimite = fim.getUTCMonth() - meses;
      const ultimoDia = new Date(Date.UTC(fim.getUTCFullYear(), mesLimite + 1, 0)).getUTCDate();
      primeiroDia = new Date(Date.UTC(fim.getUTCFullYear(), mesLimite,
        Math.min(fim.getUTCDate(), ultimoDia) + 1));
    } else {
      const dias = origem === 'Hora' ? Math.floor(idade / 24) : idade;
      primeiroDia = new Date(fim.getTime() - dias * diaMs);
    }
    return tempoEntre(primeiroDia, fim, unidade);
  }

  function exposicoes(root, referencia) {
    const nascimento = root.querySelector('#sinan-nasc').value;
    const idade = root.querySelector('#sinan-idade');
    const unidadeIdade = root.querySelector('#sinan-idade-un').value;
    const erros = [];
    const avisos = [];
    const campos = root.querySelectorAll('input:is([data-key="tempoTabaco"], [data-key="tabacoValor"], [data-key="expTempo"], [data-key="tempoExp"], [data-key="agenteValor"], [data-key="tempoExposicao"])');
    for (const campo of campos) {
      const tabaco = /tabaco/i.test(campo.dataset.key);
      const nome = tabaco ? 'Tempo de exposição ao tabaco' : 'Tempo de exposição ao fator de risco no trabalho';
      const unidade = campo.closest('.unit-row')?.querySelector('select')?.value;
      if (!unidade) continue;
      const temDatas = nascimento >= '1900-01-01' && referencia >= nascimento;
      let max;
      if (temDatas) {
        max = tempoEntre(new Date(nascimento), new Date(referencia), unidade);
      } else if (!nascimento && idade.value && idade.validity.valid) {
        max = limiteManual(Number(idade.value), unidadeIdade, unidade, referencia);
      }
      if (max === undefined) campo.removeAttribute('max');
      else campo.max = max;
      let mensagem = '';
      const n = campo.valueAsNumber;
      if (!campo.closest('[hidden]') && (campo.value || campo.validity.badInput)) {
        if (!Number.isInteger(n) || n < 0) mensagem = nome + ' deve ser um número inteiro igual ou superior a zero.';
        else if (n > max) mensagem = nome + ' ultrapassa a idade da pessoa. Confira o valor e a unidade.';
        else if (temDatas && max > 0 && n > 0 && n === max) avisos.push({campo, mensagem: nome + ' corresponde à idade inteira da pessoa. Confira o início da exposição e a unidade.'});
      }
      campo.setCustomValidity(mensagem);
      campo.setAttribute('aria-invalid', String(Boolean(mensagem)));
      let ajuda = campo.parentElement.parentElement.querySelector('[data-aviso-exposicao]');
      if (!ajuda && mensagem) {
        ajuda = document.createElement('small');
        ajuda.dataset.avisoExposicao = '';
        ajuda.className = 'field-help';
        ajuda.setAttribute('role','status');
        campo.parentElement.after(ajuda);
      }
      if (ajuda && ajuda.textContent !== mensagem) ajuda.textContent = mensagem;
      if (mensagem) erros.push({campo, rotulo: mensagem, tela: Number(campo.closest('.screen').dataset.screen)});
    }
    return {erros, avisos};
  }

  function avisosCaso(root, valores) {
    const avisos = [];
    const ocupacao = root.querySelector('[data-key="ocupacao"]');
    // Famílias selecionadas de profissões de nível superior da CBO.
    const graduacao = /^(?:223[2456789]|225[123]|214[1-9]|2410|234[1-9]|2515|2516)\s*-?\s*\d{2}\b/;
    if (graduacao.test(ocupacao?.value.trim() || '') &&
        /^(Analfabeto|[145]ª|Ensino fundamental|Ensino médio|Ensino superior incompleto)/i.test(valores.escolaridade || '')) {
      avisos.push({campo: ocupacao, mensagem: 'Confira a ocupação (CBO) e a escolaridade. A família ocupacional indicada é de nível superior.'});
    }
    if (!root.querySelector('[data-chips="parteCorpo"]')) return avisos;
    const cid = root.querySelector('[data-key="cid"]');
    const codigo = cid?.value.toUpperCase().trim().match(/^([ST]\d{2})/);
    if (!codigo) return avisos;
    const grupos = { S0:'cabeça', S1:'pescoço', S2:'tórax', S3:'abdome', S4:'superior', S5:'superior',
      S6:'superior', S7:'inferior', S8:'inferior', S9:'inferior', T15:'cabeça', T26:'cabeça' };
    const regiao = grupos[codigo[1]] || grupos[codigo[1].slice(0,2)];
    if (!regiao) return avisos;
    const partes = { 'Olho':'cabeça', 'Cabeça':'cabeça', 'Pescoço':'pescoço', 'Tórax':'tórax', 'Abdome':'abdome',
      'Mão':'superior', 'Membro superior':'superior', 'Pé':'inferior', 'Membro inferior':'inferior' };
    const selecionada = partes[valores.parteCorpo];
    if (selecionada && selecionada !== regiao)
      avisos.push({campo: cid, mensagem: 'Confira o CID da lesão ' + codigo[1] + ' e a parte do corpo indicada (' + valores.parteCorpo + '). As regiões registradas são diferentes.'});
    if (valores.comoOcorreu === 'Corpo estranho no olho' && (regiao !== 'cabeça' || selecionada && selecionada !== 'cabeça'))
      avisos.push({campo: root.querySelector('[data-chips="comoOcorreu"]'), mensagem: 'A forma de ocorrência indica corpo estranho no olho. Confira o CID e a parte do corpo atingida.'});
    // Somente expressões inequívocas de lesão num único segmento.
    const texto = (valores.atividade || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const locais = {pe:'inferior', tornozelo:'inferior', joelho:'inferior', perna:'inferior', mao:'superior',
      punho:'superior', braco:'superior', cotovelo:'superior', olho:'cabeça', cabeca:'cabeça'};
    const exp = /\b(?:fratura|ferimento|corte|queimadura|contusao|lesao|amputacao) (?:d[ao]|n[ao]) (pe|tornozelo|joelho|perna|mao|punho|braco|cotovelo|olho|cabeca)\b/g;
    const descritas = new Set(Array.from(texto.matchAll(exp), m => locais[m[1]]));
    if (descritas.size === 1 && !descritas.has(regiao) && !/\b(sem|nao|nega|descartad\w*)\b/.test(texto))
      avisos.push({campo: root.querySelector('[data-key="atividade"]'), mensagem: 'A descrição menciona uma lesão em região diferente daquela indicada pelo CID. Confira os dois campos.'});
    return avisos;
  }
  return {exposicoes, avisosCaso};
})();
