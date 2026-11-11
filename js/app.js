(() => {
  'use strict';

  // Perfis definidos pelo usuário. Não alterar sem nova validação.
  const PERFIS = [
    {
      id: 'municipal',
      rotulo: 'Profissional de saúde da rede municipal de Florianópolis',
      descricao: 'Rede municipal de Florianópolis'
    },
    {
      id: 'nao_municipal',
      rotulo: 'Profissional de saúde externo à rede municipal',
      descricao: 'Outros serviços e municípios'
    },
    {
      id: 'nao_profissional',
      rotulo: 'Pessoa sem vínculo profissional com a área da saúde',
      descricao: 'Cidadão em geral'
    }
  ];

  const TOTAL_PREVISTO = 60;

  const hojeIso = new Date().toISOString().slice(0, 10);

  const FORMULARIOS_INLINE = {
    '1-a-acidente-de-trabalho': {
      titulo: '1.a - Acidente de trabalho',
      montar: (caixa, voltar) => window.montarFormularioAcidente(caixa, voltar)
    },
    '1-b-acidente-de-trabalho-com-exposicao-a-material-biologico': {
      titulo: '1.b - Acidente de trabalho com exposição a material biológico',
      montar: (caixa, voltar) => window.montarFormulario(caixa, voltar, {
        templateId: 'form-biologico-template',
        storageKey: 'notificacao-biologico-v1-inline',
        total: 8,
        defaults: { tipoNotif: 'Individual', idadeUnidade: 'Ano', tempoUnidade: 'Ano', dataNotificacao: hojeIso }
      })
    },
    '1-c-cancer-relacionado-ao-trabalho': {
      titulo: '1.c - Câncer relacionado ao trabalho',
      montar: (caixa, voltar) => window.montarFormulario(caixa, voltar, {
        templateId: 'form-cancer-template',
        storageKey: 'notificacao-cancer-v1-inline',
        total: 8,
        defaults: {
          dataNotificacao: hojeIso,
          data: hojeIso,
          tempoOcupacaoUn: 'Ano',
          tempoExposicaoUn: 'Ano',
          tempoTabacoUn: 'Ano'
        }
      })
    },
    '1-d-dermatose-ocupacionais': {
      titulo: '1.d - Dermatose ocupacionais',
      montar: (caixa, voltar) => window.montarFormulario(caixa, voltar, {
        templateId: 'form-dermatose-template',
        storageKey: 'notificacao-dermatose-v1-inline',
        total: 7,
        defaults: { dataNotif: hojeIso, dataFinal: hojeIso, tempoOcupUnid: 'Ano', expUnid: 'Ano', afastUnid: 'Ano' }
      })
    },
    '1-f-lesoes-por-esforcos-repetitivos-dort': {
      titulo: '1.f - Lesões por Esforços Repetitivos/Distúrbios Osteomusculares Relacionados ao Trabalho (LER/DORT)',
      montar: (caixa, voltar) => window.montarFormulario(caixa, voltar, {
        templateId: 'form-lerdort-template',
        storageKey: 'notificacao-lerdort-v1-inline',
        total: 7,
        defaults: { dataNotif: hojeIso, dataFinal: hojeIso, tempoOcupUnid: 'Ano', tempoExpUnid: 'Ano', tempoAfastUnid: 'Ano' }
      })
    },
    '1-g-perda-auditiva-relacionada-ao-trabalho': {
      titulo: '1.g - Perda Auditiva relacionada ao trabalho',
      montar: (caixa, voltar) => window.montarFormulario(caixa, voltar, {
        templateId: 'form-pair-template',
        storageKey: 'notificacao-pair-v1-inline',
        total: 7,
        defaults: { dataNotif: hojeIso, dataFinal: hojeIso, tempoOcupUnid: 'Ano', tempoExpUnid: 'Ano', tempoAfastUnid: 'Ano' }
      })
    },
    '1-h-pneumoconioses-relacionadas-ao-trabalho': {
      titulo: '1.h - Pneumoconioses relacionadas ao trabalho',
      montar: (caixa, voltar) => window.montarFormulario(caixa, voltar, {
        templateId: 'form-pneumo-template',
        storageKey: 'notificacao-pneumo-v1-inline',
        total: 8,
        defaults: { dataNotif: hojeIso, dataFinal: hojeIso, tempoOcupUnid: 'Ano', tempoExpUnid: 'Ano', tempoTabacoUnid: 'Ano' }
      })
    },
    '1-i-transtornos-mentais-relacionados-ao-trabalho': {
      titulo: '1.i - Transtornos mentais relacionados ao trabalho',
      montar: (caixa, voltar) => window.montarFormulario(caixa, voltar, {
        templateId: 'form-mental-template',
        storageKey: 'notificacao-mental-v1-inline',
        total: 7,
        defaults: { dataNotif: hojeIso, dataFinal: hojeIso, tempoOcupUnid: 'Ano', tabacoUnidade: 'Ano', agenteUnidade: 'Ano' }
      })
    }
  };

  const estado = {
    agravos: [],
    direcionamentos: {},
    agravoId: null,
    perfilId: null,
    termo: ''
  };
  let formularioAcidenteAberto = false;

  const $ = (seletor) => document.querySelector(seletor);

  const normalizar = (texto) =>
    String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  function numeroDoAgravo(texto) {
    const valor = String(texto || '').match(/(\d+)/);
    return valor ? Number(valor[1]) : Number.MAX_SAFE_INTEGER;
  }

  // Lista vazia => placeholders explícitos, nunca nomes inventados.
  function montarAgravos(dados) {
    if (Array.isArray(dados) && dados.length > 0) {
      const itens = [];

      dados.forEach((item) => {
        if (!item || !item.id) return;

        const subitens = Array.isArray(item.subitens)
          ? item.subitens.filter((sub) => sub && sub.id && sub.nome)
          : [];

        if (subitens.length > 0) {
          const grupo = {
            id: String(item.id),
            nome: String(item.nome || item.id),
            conceito: typeof item.conceito === 'string' ? item.conceito.trim() : '',
            tipo: 'grupo',
            selecionavel: false,
            subitens: subitens.map((sub) => ({
              id: String(sub.id),
              nome: String(sub.nome),
              conceito: typeof sub.conceito === 'string' ? sub.conceito.trim() : '',
              tipo: 'subitem',
              selecionavel: true,
              grupoId: String(item.id),
              grupoNome: String(item.nome || item.id)
            }))
          };
          itens.push(grupo, ...grupo.subitens);
          return;
        }

        if (item.nome) {
          itens.push({
            id: String(item.id),
            nome: String(item.nome),
            conceito: typeof item.conceito === 'string' ? item.conceito.trim() : '',
            tipo: 'item',
            selecionavel: true,
            placeholder: false
          });
        }
      });

      if (itens.length > 0) {
        return itens.sort((a, b) => {
          const numeroA = numeroDoAgravo(a.nome);
          const numeroB = numeroDoAgravo(b.nome);
          if (numeroA !== numeroB) return numeroA - numeroB;
          return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
        });
      }
    }

    return Array.from({ length: TOTAL_PREVISTO }, (_, i) => {
      const n = String(i + 1).padStart(2, '0');
      return {
        id: `PLACEHOLDER-${n}`,
        nome: `PLACEHOLDER — agravo ${n} — nome oficial pendente`,
        tipo: 'item',
        selecionavel: true,
        placeholder: true
      };
    });
  }

  async function carregarJSON(caminho) {
    const resposta = await fetch(caminho, { cache: 'no-store', credentials: 'omit' });
    if (!resposta.ok) throw new Error(`Falha ao carregar ${caminho}`);
    return resposta.json();
  }

  let tituloComConceito = null;
  let posicaoDoMouse = null;

  function ocultarConceito() {
    const balão = $('#conceito-agravo');
    balão.hidden = true;
    tituloComConceito?.removeAttribute('aria-describedby');
    tituloComConceito = null;
    posicaoDoMouse = null;
  }

  function posicionarConceito() {
    if (!tituloComConceito) return;

    const balão = $('#conceito-agravo');
    const margem = 12;
    const limiteLargura = window.innerWidth;
    const limiteAltura = window.innerHeight;
    const caixa = balão.getBoundingClientRect();
    let esquerda;
    let topo;

    if (posicaoDoMouse) {
      const espacamento = 12;
      esquerda = posicaoDoMouse.x + espacamento;
      if (esquerda + caixa.width > limiteLargura - margem) {
        esquerda = posicaoDoMouse.x - caixa.width - espacamento;
      }
      topo = posicaoDoMouse.y + espacamento;
      if (topo + caixa.height > limiteAltura - margem) {
        topo = posicaoDoMouse.y - caixa.height - espacamento;
      }
      esquerda = Math.max(margem, Math.min(esquerda, limiteLargura - caixa.width - margem));
      topo = Math.max(margem, Math.min(topo, limiteAltura - caixa.height - margem));
    } else {
      const titulo = tituloComConceito.getBoundingClientRect();
      esquerda = Math.max(margem, Math.min(
        titulo.left,
        limiteLargura - caixa.width - margem
      ));
      const abaixo = titulo.bottom + margem;
      const acima = titulo.top - caixa.height - margem;
      topo = abaixo + caixa.height <= limiteAltura - margem
        ? abaixo
        : Math.max(margem, acima);
    }

    balão.style.left = `${esquerda}px`;
    balão.style.top = `${topo}px`;
  }

  function mostrarConceito(titulo, evento) {
    const balão = $('#conceito-agravo');
    if (tituloComConceito && tituloComConceito !== titulo) {
      tituloComConceito.removeAttribute('aria-describedby');
    }
    tituloComConceito = titulo;
    posicaoDoMouse = evento && evento.pointerType === 'mouse'
      ? { x: evento.clientX, y: evento.clientY }
      : null;
    balão.textContent = titulo.dataset.conceito || 'Definição não disponível na lista enviada.';
    balão.hidden = false;
    titulo.setAttribute('aria-describedby', balão.id);
    posicionarConceito();
  }

  function configurarConceito(titulo, conceito) {
    titulo.dataset.conceito = conceito || '';
    titulo.addEventListener('pointerenter', (evento) => {
      if (evento.pointerType === 'mouse') mostrarConceito(titulo, evento);
    });
    titulo.addEventListener('pointerleave', (evento) => {
      if (evento.pointerType === 'mouse' && tituloComConceito === titulo) ocultarConceito();
    });
    titulo.addEventListener('focus', () => mostrarConceito(titulo));
    titulo.addEventListener('blur', ocultarConceito);
  }

  function renderizarListaAgravos() {
    const termo = normalizar(estado.termo);
    const lista = $('#lista-agravos');
    ocultarConceito();
    lista.textContent = '';

    const grupos = estado.agravos.filter((a) => a.tipo === 'grupo')
      .sort((a, b) => numeroDoAgravo(a.nome) - numeroDoAgravo(b.nome));
    const itensSimples = estado.agravos.filter((a) => a.tipo === 'item' && (!termo || normalizar(a.nome).includes(termo)))
      .sort((a, b) => numeroDoAgravo(a.nome) - numeroDoAgravo(b.nome));

    const gruposVisiveis = grupos
      .map((grupo) => ({
        ...grupo,
        subitens: (grupo.subitens || [])
          .filter((sub) => !termo || normalizar(sub.nome).includes(termo))
          .sort((a, b) => numeroDoAgravo(a.nome) - numeroDoAgravo(b.nome))
      }))
      .filter((grupo) => grupo.subitens.length > 0);

    const totalExibidos = itensSimples.length + gruposVisiveis.reduce((total, grupo) => total + grupo.subitens.length, 0);

    if (totalExibidos === 0) {
      const li = document.createElement('li');
      li.className = 'vazio';
      li.textContent = 'Nenhum agravo encontrado para esta busca. Revise o termo digitado.';
      lista.appendChild(li);
      $('#busca-status').textContent = '';
      return;
    }

    const blocos = [];

    itensSimples.forEach((agravo) => {
      blocos.push({ tipo: 'item', agravo });
    });

    gruposVisiveis.forEach((grupo) => {
      blocos.push({ tipo: 'grupo', grupo });
    });

    blocos.sort((a, b) => {
      const numeroA = numeroDoAgravo(a.tipo === 'item' ? a.agravo.nome : a.grupo.nome);
      const numeroB = numeroDoAgravo(b.tipo === 'item' ? b.agravo.nome : b.grupo.nome);
      if (numeroA !== numeroB) return numeroA - numeroB;
      return String(a.tipo === 'item' ? a.agravo.nome : a.grupo.nome).localeCompare(
        String(b.tipo === 'item' ? b.agravo.nome : b.grupo.nome),
        'pt-BR'
      );
    });

    blocos.forEach((bloco) => {
      if (bloco.tipo === 'item') {
        const li = document.createElement('li');
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'item-agravo';
        botao.dataset.id = bloco.agravo.id;
        botao.textContent = bloco.agravo.nome;
        botao.setAttribute('aria-pressed', String(bloco.agravo.id === estado.agravoId));
        configurarConceito(botao, bloco.agravo.conceito);
        li.appendChild(botao);
        lista.appendChild(li);
        return;
      }

      const liGrupo = document.createElement('li');
      liGrupo.className = 'grupo-agravo';

      const titulo = document.createElement('div');
      titulo.className = 'grupo-agravo-titulo';
      titulo.textContent = bloco.grupo.nome;
      titulo.tabIndex = 0;
      configurarConceito(titulo, bloco.grupo.conceito);
      liGrupo.appendChild(titulo);

      const subLista = document.createElement('ul');
      subLista.className = 'sublista-agravos';

      bloco.grupo.subitens.forEach((subitem) => {
        const itemLi = document.createElement('li');
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'item-agravo item-subitem';
        botao.dataset.id = subitem.id;
        botao.textContent = subitem.nome;
        botao.setAttribute('aria-pressed', String(subitem.id === estado.agravoId));
        configurarConceito(botao, subitem.conceito);
        itemLi.appendChild(botao);
        subLista.appendChild(itemLi);
      });

      liGrupo.appendChild(subLista);
      lista.appendChild(liGrupo);
    });

    const totalSelecionavel = estado.agravos.filter((a) => a.selecionavel !== false).length;
    $('#busca-status').textContent = `${totalExibidos} agravo(s) exibido(s) de ${totalSelecionavel}.`;
  }

  function renderizarPerfis() {
    const container = $('#perfis');
    PERFIS.forEach((perfil) => {
      const rotulo = document.createElement('label');
      rotulo.className = 'opcao';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'perfil';
      radio.value = perfil.id;
      radio.id = `perfil-${perfil.id}`;
      const texto = document.createElement('span');
      texto.className = 'opcao-texto';
      const titulo = document.createElement('strong');
      titulo.className = 'opcao-titulo';
      titulo.textContent = perfil.rotulo;
      const descricao = document.createElement('small');
      descricao.className = 'opcao-descricao';
      descricao.textContent = perfil.descricao;
      rotulo.setAttribute('for', radio.id);
      rotulo.appendChild(radio);
      texto.appendChild(titulo);
      texto.appendChild(descricao);
      rotulo.appendChild(texto);
      container.appendChild(rotulo);
    });
  }

  function criarLinha(tag, texto, classe) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    el.textContent = texto;
    return el;
  }

  function criarCampoResultado(rotulo, valor) {
    const campo = document.createElement('div');
    campo.className = 'resultado-campo';
    campo.appendChild(criarLinha('span', rotulo, 'resultado-rotulo'));
    campo.appendChild(criarLinha('strong', valor, 'resultado-valor'));
    return campo;
  }

  function renderizarResultado() {
    const caixa = $('#resultado');
    caixa.textContent = '';

    const agravo = estado.agravos.find((a) => a.id === estado.agravoId);
    const perfil = PERFIS.find((p) => p.id === estado.perfilId);

    const formularioInline = agravo && FORMULARIOS_INLINE[agravo.id];
    if (perfil && perfil.id === 'nao_municipal' && formularioInline && formularioAcidenteAberto) {
      document.body.classList.add('modo-formulario-acidente');
      formularioInline.montar(caixa, () => {
        formularioAcidenteAberto = false;
        document.body.classList.remove('modo-formulario-acidente');
        renderizarResultado();
        const botoesAgravos = $('#lista-agravos').querySelectorAll('button[data-id]');
        const botaoSelecionado = Array.from(botoesAgravos).find((botao) => botao.dataset.id === estado.agravoId);
        if (botaoSelecionado) botaoSelecionado.focus();
      });
      return;
    }

    document.body.classList.remove('modo-formulario-acidente');

    const contexto = document.createElement('div');
    contexto.className = 'resultado-contexto';
    contexto.appendChild(criarCampoResultado('Agravo', agravo ? agravo.nome : 'Selecione um agravo'));
    contexto.appendChild(criarCampoResultado('Perfil', perfil ? perfil.rotulo : 'Selecione um perfil'));
    caixa.appendChild(contexto);

    const conteudo = document.createElement('div');
    conteudo.className = 'resultado-conteudo';
    caixa.appendChild(conteudo);

    if (!agravo) {
      conteudo.appendChild(criarLinha('p', 'Selecione um agravo para ver o direcionamento.', 'resultado-mensagem'));
      return;
    }

    if (!perfil) {
      conteudo.appendChild(criarLinha('p', 'Selecione um perfil para ver o direcionamento.', 'resultado-mensagem'));
      return;
    }

    if (perfil && perfil.id === 'municipal') {
      const painel = document.createElement('section');
      painel.className = 'resultado-contato resultado-celk';
      painel.setAttribute('aria-labelledby', 'resultado-celk-titulo');
      painel.appendChild(criarLinha('p', 'Acesse o sistema de registro de agravos', 'resultado-contato-rotulo'));
      const tituloCelk = criarLinha('h3', 'Celk Saúde', 'resultado-contato-titulo');
      tituloCelk.id = 'resultado-celk-titulo';
      painel.appendChild(tituloCelk);

      const linkCelk = document.createElement('a');
      linkCelk.className = 'botao-celk';
      linkCelk.href = 'https://florianopolis.celk.com.br/vigilancia/registroagravo/cadastroRegistroAgravo';
      linkCelk.target = '_blank';
      linkCelk.rel = 'noopener noreferrer';
      linkCelk.appendChild(document.createTextNode('Acessar Celk Saúde'));
      const iconeCelk = criarLinha('span', '↗', 'botao-celk-icone');
      iconeCelk.setAttribute('aria-hidden', 'true');
      linkCelk.appendChild(iconeCelk);
      painel.appendChild(linkCelk);
      conteudo.appendChild(painel);
      return;
    }

    const item1 = /^1(?:-|$)/.test(agravo.grupoId || agravo.id);
    if (perfil.id === 'nao_profissional') {
      const contato = document.createElement('section');
      contato.className = 'resultado-contato';
      contato.setAttribute('aria-labelledby', 'resultado-cievs-titulo');
      contato.appendChild(criarLinha('p', 'Entre em contato com o', 'resultado-contato-rotulo'));
      const tituloContato = criarLinha('h3', 'CIEVS Florianópolis', 'resultado-contato-titulo');
      tituloContato.id = 'resultado-cievs-titulo';
      contato.appendChild(tituloContato);

      const acoes = document.createElement('div');
      acoes.className = 'resultado-contato-acoes';
      const telefone = document.createElement('a');
      telefone.className = 'resultado-telefone';
      telefone.href = 'tel:+5548933009983';
      telefone.textContent = '+55 (48) 93300-9983';
      telefone.setAttribute('aria-label', 'Ligar para CIEVS Florianópolis no número +55 (48) 93300-9983');
      acoes.appendChild(telefone);

      const ligar = document.createElement('a');
      ligar.className = 'botao-ligar';
      ligar.href = 'tel:+5548933009983';
      ligar.appendChild(criarLinha('span', '☎', 'botao-ligar-icone'));
      ligar.appendChild(document.createTextNode('Ligar agora'));
      acoes.appendChild(ligar);
      contato.appendChild(acoes);

      const copiar = document.createElement('button');
      copiar.className = 'botao-copiar';
      copiar.type = 'button';
      copiar.dataset.copiarTelefone = '+5548933009983';
      copiar.textContent = 'Copiar número';
      contato.appendChild(copiar);
      contato.appendChild(criarLinha('p', '', 'resultado-status-copia'));
      conteudo.appendChild(contato);
      return;
    }

    if (perfil.id === 'nao_municipal' && agravo.grupoId === '1-doencas-relacionadas-ao-trabalho') {
      const painel = document.createElement('section');
      painel.className = 'resultado-painel';
      painel.appendChild(criarLinha('p', `Direcionamento para ${agravo.nome}`, 'resultado-painel-titulo'));
      const instrucao = document.createElement('p');
      instrucao.className = 'resultado-painel-texto';
      instrucao.append(document.createTextNode('Para registrar a notificação, preencha o formulário abaixo. Ao concluir, baixe o arquivo em PDF e encaminhe-o para o e-mail '));
      const email = document.createElement('a');
      email.href = 'mailto:saudetrab.sms@floripa.sc.gov.br';
      email.textContent = 'saudetrab.sms@floripa.sc.gov.br';
      instrucao.append(email, document.createTextNode('.'));
      painel.appendChild(instrucao);
      if (formularioInline) {
        const botaoFormulario = document.createElement('button');
        botaoFormulario.type = 'button';
        botaoFormulario.className = 'botao-celk';
        botaoFormulario.dataset.formAcidente = 'abrir';
        botaoFormulario.textContent = 'Abrir formulário';
        painel.appendChild(botaoFormulario);
        if (agravo.id === '1-a-acidente-de-trabalho') {
          painel.appendChild(criarLinha('p', 'Se você estiver em Hospital com Núcleo de Vigilância Hospitalar, comunique-o imediatamente:\nHospital Florianópolis – (48) 3380-8700\nHospital Governador Celso Ramos – (48) 3664-3600\nHospital Infantil Joana de Gusmão – (48) 3664-3200\nHospital Nereu Ramos – (48) 3665-9401\nHospital Universitário – (48) 3721-2067', 'resultado-painel-texto'));
        }
      }
      conteudo.appendChild(painel);
      return;
    }

    if (perfil.id === 'nao_municipal' && !item1) {
      const painel = document.createElement('section');
      painel.className = 'resultado-contato resultado-vigilancia';
      painel.setAttribute('aria-labelledby', 'resultado-vigilancia-titulo');
      painel.appendChild(criarLinha('p', 'Acesse o site da', 'resultado-contato-rotulo'));
      const tituloVigilancia = criarLinha(
        'h3',
        'Vigilância Epidemiológica',
        'resultado-contato-titulo'
      );
      tituloVigilancia.id = 'resultado-vigilancia-titulo';
      painel.appendChild(tituloVigilancia);

      const linkVigilancia = document.createElement('a');
      linkVigilancia.className = 'botao-celk';
      linkVigilancia.href = 'https://sites.google.com/view/gerve/notifica%C3%A7%C3%A3o-compuls%C3%B3ria';
      linkVigilancia.target = '_blank';
      linkVigilancia.rel = 'noopener noreferrer';
      linkVigilancia.appendChild(document.createTextNode('Acessar Vigilância Epidemiológica'));
      const iconeVigilancia = criarLinha('span', '↗', 'botao-celk-icone');
      iconeVigilancia.setAttribute('aria-hidden', 'true');
      linkVigilancia.appendChild(iconeVigilancia);
      painel.appendChild(linkVigilancia);
      conteudo.appendChild(painel);
      return;
    }

    const dados = estado.direcionamentos[agravo.id] && estado.direcionamentos[agravo.id][perfil.id];
    const valido = dados && typeof dados.texto === 'string' && dados.texto.trim() !== '';

    if (!valido) {
      conteudo.appendChild(criarLinha('p', 'Não há direcionamento oficial confirmado para esta combinação.', 'resultado-mensagem'));
      return;
    }

    const painel = document.createElement('section');
    painel.className = 'resultado-painel';
    painel.appendChild(criarLinha('p', dados.titulo || 'Direcionamento', 'resultado-painel-titulo'));
    painel.appendChild(criarLinha('p', dados.texto, 'resultado-painel-texto'));
    if (dados.orgao) painel.appendChild(criarLinha('p', `Órgão: ${dados.orgao}`, 'resultado-painel-orgao'));
    // Somente links https são aceitos.
    if (typeof dados.link === 'string' && /^https:\/\//.test(dados.link)) {
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.href = dados.link;
      a.rel = 'noopener noreferrer';
      a.textContent = 'Acessar a referência oficial';
      p.appendChild(a);
      painel.appendChild(p);
    }
    conteudo.appendChild(painel);
  }

  function configurarEventos() {
    window.addEventListener('resize', posicionarConceito);
    window.addEventListener('scroll', posicionarConceito, true);

    $('#resultado').addEventListener('click', async (evento) => {
      const botaoFormulario = evento.target.closest('button[data-form-acidente]');
      if (botaoFormulario) {
        carregarFormulariosInline()
          .then(() => {
            formularioAcidenteAberto = true;
            renderizarResultado();
          })
          .catch(() => {
            $('#resultado .resultado-conteudo').textContent = '';
            const aviso = document.createElement('p');
            aviso.className = 'resultado-mensagem';
            aviso.textContent = 'Não foi possível abrir o formulário. Atualize a página e tente novamente.';
            $('#resultado').appendChild(aviso);
          });
        return;
      }

      const botao = evento.target.closest('button[data-copiar-telefone]');
      if (!botao) return;

      const status = $('#resultado .resultado-status-copia');
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
          status.textContent = 'A cópia automática não está disponível neste navegador. Selecione o número para copiá-lo.';
          return;
        }
        await navigator.clipboard.writeText(botao.dataset.copiarTelefone);
        status.textContent = 'Número copiado.';
      } catch (erro) {
        status.textContent = 'Não foi possível copiar o número. Selecione o telefone e copie manualmente.';
      }
    });

    $('#busca').addEventListener('input', (evento) => {
      estado.termo = evento.target.value;
      renderizarListaAgravos();
    });

    $('#lista-agravos').addEventListener('click', (evento) => {
      const botao = evento.target.closest('button[data-id]');
      if (!botao) return;
      estado.agravoId = botao.dataset.id;
      formularioAcidenteAberto = false;
      renderizarListaAgravos();
      renderizarResultado();
    });

    $('#perfis').addEventListener('change', (evento) => {
      if (evento.target.name === 'perfil') {
        estado.perfilId = evento.target.value;
        formularioAcidenteAberto = false;
        renderizarResultado();
      }
    });
  }

  let formulariosExtraProntos = null;

  function carregarFormulariosInline() {
    if (document.getElementById('form-dermatose-template') && document.getElementById('form-mental-template')) {
      return Promise.resolve();
    }
    if (!formulariosExtraProntos) {
      formulariosExtraProntos = fetch('formularios-inline.html', { cache: 'no-store', credentials: 'omit' })
        .then((resposta) => {
          if (!resposta.ok) throw new Error('Falha ao carregar os formulários.');
          return resposta.text();
        })
        .then((html) => {
          const suporte = document.createElement('div');
          suporte.innerHTML = html;
          document.body.append(suporte);
        })
        .catch((erro) => {
          formulariosExtraProntos = null;
          throw erro;
        });
    }
    return formulariosExtraProntos;
  }

  async function iniciar() {
    renderizarPerfis();
    configurarEventos();
    try {
      const [agravos, direcionamentos] = await Promise.all([
        carregarJSON('data/agravos.json'),
        carregarJSON('data/direcionamentos.json')
      ]);
      estado.agravos = montarAgravos(agravos);
      estado.direcionamentos = direcionamentos && typeof direcionamentos === 'object' ? direcionamentos : {};
      renderizarListaAgravos();
      renderizarResultado();
      if (estado.agravos.length !== TOTAL_PREVISTO) {
        $('#busca-status').textContent += ` Atenção: a lista tem ${estado.agravos.length} itens; o previsto são ${TOTAL_PREVISTO}.`;
      }
    } catch (erro) {
      $('#busca-status').textContent = 'Não foi possível carregar os dados. Tente novamente mais tarde.';
    }
  }

  iniciar();
})();
