/*
 * VISAT — recebimento seguro de notificações (rascunho técnico)
 *
 * NÃO IMPLANTAR AINDA.
 * Este código não substitui o Apps Script atual até que:
 * 1) a TI/PMF autorize a conta e o ambiente de execução;
 * 2) sejam criados recursos separados para HOMOLOGACAO e PRODUCAO;
 * 3) as propriedades e permissões sejam configuradas;
 * 4) o encarregado de dados e a gestão validem o fluxo;
 * 5) os testes de integração sejam aprovados.
 *
 * Não registrar payload, PDF, nome, CPF, CNS, diagnóstico ou e-mail em logs.
 */

var VISAT_RECEBIMENTO = {
  VERSAO: '0.1.0-draft',
  MAX_REQUEST_CHARS: 7200000,
  MAX_PDF_BYTES: 5 * 1024 * 1024,
  MAX_ENVIO_EMAIL_DIA: 10,
  ABA_CONTROLE: 'Recebimentos',
  CABECALHO: [
    'protocolo', 'recebido_em', 'agravo', 'unidade', 'cnes',
    'situacao', 'arquivo_id', 'idempotencia_sha256',
    'comprovante', 'correlacao'
  ],
  AGRAVOS: [
    '1-a-acidente-de-trabalho',
    '1-b-acidente-de-trabalho-com-exposicao-a-material-biologico',
    '1-c-cancer-relacionado-ao-trabalho',
    '1-d-dermatose-ocupacionais',
    '1-e-disturbio-de-voz-relacionado-ao-trabalho',
    '1-f-lesoes-por-esforcos-repetitivos-dort',
    '1-g-perda-auditiva-relacionada-ao-trabalho',
    '1-h-pneumoconioses-relacionadas-ao-trabalho',
    '1-i-transtornos-mentais-relacionados-ao-trabalho',
    '1-j-obito-por-acidente-de-trabalho'
  ]
};

/** Endpoint de saúde: não retorna configuração, credenciais ou dados. */
function doGet() {
  return resposta_({
    ok: true,
    servico: 'VISAT_RECEBIMENTO',
    versao: VISAT_RECEBIMENTO.VERSAO
  });
}

/**
 * Contrato POST:
 * {
 *   versao: 1,
 *   idempotencia: UUID,
 *   agravo: slug do catálogo,
 *   unidade: texto,
 *   cnes: 7 dígitos ou vazio,
 *   emailRecibo: e-mail para comprovante sem PDF,
 *   pdfBase64: PDF final codificado em Base64,
 *   turnstileToken: token de uso único
 * }
 */
function doPost(e) {
  var correlacao = Utilities.getUuid();
  var trava = null;
  var arquivo = null;
  var registroGravado = false;

  try {
    var bruto = e && e.postData && e.postData.contents;
    if (!bruto || bruto.length > VISAT_RECEBIMENTO.MAX_REQUEST_CHARS) {
      return erro_('REQUISICAO_INVALIDA', correlacao);
    }

    var entrada;
    try {
      entrada = JSON.parse(bruto);
    } catch (parseError) {
      return erro_('REQUISICAO_INVALIDA', correlacao);
    }

    var cfg = configuracao_();
    if (cfg.ambiente === 'PRODUCAO' && cfg.producaoLiberada !== 'true') {
      return erro_('PRODUCAO_NAO_LIBERADA', correlacao);
    }

    var dados = validarEntrada_(entrada);
    if (!validarTurnstile_(dados.turnstileToken, cfg)) {
      return erro_('VALIDACAO_ANTIROBO_FALHOU', correlacao);
    }

    var bytesPdf = decodificarPdf_(dados.pdfBase64);
    var hashIdempotencia = sha256_(dados.idempotencia);

    trava = LockService.getScriptLock();
    trava.waitLock(15000);

    if (cfg.ambiente === 'HOMOLOGACAO') {
      return respostaHomologacao_(hashIdempotencia, correlacao);
    }

    var planilha = SpreadsheetApp.openById(cfg.planilhaControleId);
    var aba = planilha.getSheetByName(VISAT_RECEBIMENTO.ABA_CONTROLE);
    if (!aba) return erro_('CONTROLE_NAO_CONFIGURADO', correlacao);

    conferirCabecalho_(aba);

    var existente = localizarIdempotencia_(aba, hashIdempotencia);
    if (existente) {
      return resposta_({
        ok: true,
        duplicado: true,
        protocolo: existente.protocolo,
        recebidoEm: existente.recebidoEm,
        correlacao: correlacao
      });
    }

    if (!consumirLimiteEmail_(dados.emailRecibo)) {
      return erro_('LIMITE_DE_ENVIO_ATINGIDO', correlacao);
    }

    var pasta = DriveApp.getFolderById(cfg.pastaPdfId);
    conferirAcessoRestrito_(pasta);

    var protocolo = novoProtocolo_('PRODUCAO');
    var nomeArquivo = protocolo + '.pdf';
    arquivo = pasta.createFile(
      Utilities.newBlob(bytesPdf, 'application/pdf', nomeArquivo)
    );

    var recebidoEm = new Date();
    var linha = aba.getLastRow() + 1;
    aba.getRange(linha, 1, 1, VISAT_RECEBIMENTO.CABECALHO.length).setValues([[
      protocolo,
      recebidoEm,
      dados.agravo,
      dados.unidade,
      dados.cnes,
      'RECEBIDA',
      arquivo.getId(),
      hashIdempotencia,
      'PENDENTE',
      correlacao
    ]]);
    registroGravado = true;
    SpreadsheetApp.flush();

    var comprovante = 'PENDENTE';
    try {
      MailApp.sendEmail({
        to: dados.emailRecibo,
        subject: 'Comprovante de recebimento VISAT — ' + protocolo,
        body:
          'A VISAT recebeu uma notificação.\n\n' +
          'Protocolo: ' + protocolo + '\n' +
          'Data e hora do recebimento: ' +
          Utilities.formatDate(recebidoEm, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss') +
          '\n\nEste comprovante não contém a ficha nem dados clínicos. ' +
          'Guarde o número do protocolo para acompanhamento.'
      });
      comprovante = 'ENVIADO';
    } catch (emailError) {
      // Não registrar a mensagem de erro: pode conter dados de destinatário.
      comprovante = 'PENDENTE';
    }

    aba.getRange(linha, 9).setValue(comprovante);
    SpreadsheetApp.flush();

    return resposta_({
      ok: true,
      protocolo: protocolo,
      recebidoEm: recebidoEm.toISOString(),
      comprovante: comprovante,
      correlacao: correlacao
    });

  } catch (error) {
    if (arquivo && !registroGravado) {
      try { arquivo.setTrashed(true); } catch (ignore) {}
    }
    // Não usar Logger.log(error), pois mensagens futuras podem conter dados.
    return erro_('NAO_FOI_POSSIVEL_PROCESSAR', correlacao);

  } finally {
    if (trava) {
      try { trava.releaseLock(); } catch (ignoreRelease) {}
    }
  }
}

function configuracao_() {
  var p = PropertiesService.getScriptProperties();
  var ambiente = String(p.getProperty('AMBIENTE') || '');

  if (ambiente !== 'HOMOLOGACAO' && ambiente !== 'PRODUCAO') {
    throw new Error('AMBIENTE_NAO_CONFIGURADO');
  }

  var cfg = {
    ambiente: ambiente,
    producaoLiberada: p.getProperty('PRODUCAO_LIBERADA') || 'false',
    turnstileSecret: p.getProperty('TURNSTILE_SECRET') || '',
    turnstileHostname: p.getProperty('TURNSTILE_HOSTNAME') || '',
    pastaPdfId: p.getProperty('PASTA_PDF_ID') || '',
    planilhaControleId: p.getProperty('PLANILHA_CONTROLE_ID') || ''
  };

  if (!cfg.turnstileSecret || !cfg.turnstileHostname) {
    throw new Error('TURNSTILE_NAO_CONFIGURADO');
  }

  if (ambiente === 'PRODUCAO' &&
      (!cfg.pastaPdfId || !cfg.planilhaControleId)) {
    throw new Error('ARMAZENAMENTO_NAO_CONFIGURADO');
  }

  return cfg;
}

function validarEntrada_(p) {
  if (!p || p.versao !== 1) throw new Error('VERSAO_INVALIDA');

  var agravo = texto_(p.agravo, 120);
  if (VISAT_RECEBIMENTO.AGRAVOS.indexOf(agravo) === -1) {
    throw new Error('AGRAVO_INVALIDO');
  }

  var unidade = texto_(p.unidade, 160);
  if (unidade.length < 2) throw new Error('UNIDADE_INVALIDA');

  var cnes = String(p.cnes || '').replace(/\D/g, '');
  if (cnes && !/^\d{7}$/.test(cnes)) throw new Error('CNES_INVALIDO');

  var email = String(p.emailRecibo || '').trim();
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(email) || email.length > 254) {
    throw new Error('EMAIL_INVALIDO');
  }

  var idempotencia = String(p.idempotencia || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencia)) {
    throw new Error('IDEMPOTENCIA_INVALIDA');
  }

  var token = String(p.turnstileToken || '');
  if (!token || token.length > 2048) throw new Error('TOKEN_INVALIDO');

  var pdfBase64 = String(p.pdfBase64 || '');
  if (!pdfBase64 || pdfBase64.length > Math.ceil(VISAT_RECEBIMENTO.MAX_PDF_BYTES * 4 / 3) + 8) {
    throw new Error('PDF_INVALIDO');
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(pdfBase64)) throw new Error('PDF_INVALIDO');

  return {
    agravo: agravo,
    unidade: unidade,
    cnes: cnes,
    emailRecibo: email,
    idempotencia: idempotencia,
    turnstileToken: token,
    pdfBase64: pdfBase64
  };
}

function decodificarPdf_(base64) {
  var bytes = Utilities.base64Decode(base64);
  if (!bytes || !bytes.length || bytes.length > VISAT_RECEBIMENTO.MAX_PDF_BYTES) {
    throw new Error('TAMANHO_PDF_INVALIDO');
  }
  var assinatura = Utilities.newBlob(bytes).getDataAsString().slice(0, 5);
  if (assinatura !== '%PDF-') throw new Error('ARQUIVO_NAO_E_PDF');
  return bytes;
}

function validarTurnstile_(token, cfg) {
  var resposta = UrlFetchApp.fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        secret: cfg.turnstileSecret,
        response: token
      }),
      muteHttpExceptions: true
    }
  );

  if (resposta.getResponseCode() !== 200) return false;

  var resultado;
  try {
    resultado = JSON.parse(resposta.getContentText());
  } catch (parseError) {
    return false;
  }

  return resultado.success === true &&
    resultado.hostname === cfg.turnstileHostname &&
    resultado.action === 'visat_submit';
}

function respostaHomologacao_(hashIdempotencia, correlacao) {
  var cache = CacheService.getScriptCache();
  var chave = 'hom:' + hashIdempotencia;
  var anterior = cache.get(chave);

  if (anterior) {
    var dado = JSON.parse(anterior);
    return resposta_({
      ok: true,
      homologacao: true,
      simulacao: true,
      duplicado: true,
      protocolo: dado.protocolo,
      recebidoEm: dado.recebidoEm,
      armazenamento: 'NAO_REALIZADO',
      email: 'NAO_ENVIADO',
      correlacao: correlacao
    });
  }

  var recebidoEm = new Date();
  var protocolo = novoProtocolo_('HOMOLOGACAO');
  cache.put(chave, JSON.stringify({
    protocolo: protocolo,
    recebidoEm: recebidoEm.toISOString()
  }), 21600);

  return resposta_({
    ok: true,
    homologacao: true,
    simulacao: true,
    duplicado: false,
    protocolo: protocolo,
    recebidoEm: recebidoEm.toISOString(),
    armazenamento: 'NAO_REALIZADO',
    email: 'NAO_ENVIADO',
    correlacao: correlacao
  });
}

function novoProtocolo_(ambiente) {
  var propriedades = PropertiesService.getScriptProperties();
  var ano = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy');
  var chave = 'SEQUENCIA_' + ambiente + '_' + ano;
  var atual = Number(propriedades.getProperty(chave) || 0) + 1;
  propriedades.setProperty(chave, String(atual));

  var numero = String(atual);
  while (numero.length < 6) numero = '0' + numero;

  return ambiente === 'HOMOLOGACAO'
    ? 'HOM-VISAT-' + ano + '-' + numero
    : 'VISAT-' + ano + '-' + numero;
}

function conferirCabecalho_(aba) {
  if (aba.getLastRow() === 0) {
    aba.getRange(1, 1, 1, VISAT_RECEBIMENTO.CABECALHO.length)
      .setValues([VISAT_RECEBIMENTO.CABECALHO]);
    aba.setFrozenRows(1);
    return;
  }

  var atual = aba.getRange(1, 1, 1, VISAT_RECEBIMENTO.CABECALHO.length).getValues()[0];
  for (var i = 0; i < VISAT_RECEBIMENTO.CABECALHO.length; i++) {
    if (String(atual[i]) !== VISAT_RECEBIMENTO.CABECALHO[i]) {
      throw new Error('ESTRUTURA_CONTROLE_DIVERGENTE');
    }
  }
}

function localizarIdempotencia_(aba, hash) {
  var ultima = aba.getLastRow();
  if (ultima < 2) return null;

  var celula = aba.getRange(2, 8, ultima - 1, 1)
    .createTextFinder(hash)
    .matchEntireCell(true)
    .findNext();

  if (!celula) return null;

  var linha = celula.getRow();
  return {
    protocolo: String(aba.getRange(linha, 1).getValue()),
    recebidoEm: new Date(aba.getRange(linha, 2).getValue()).toISOString()
  };
}

function consumirLimiteEmail_(email) {
  var hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  var chave = 'lim:' + hoje + ':' + sha256_(email.toLowerCase());
  var cache = CacheService.getScriptCache();
  var atual = Number(cache.get(chave) || 0);

  if (atual >= VISAT_RECEBIMENTO.MAX_ENVIO_EMAIL_DIA) return false;

  cache.put(chave, String(atual + 1), 86400);
  return true;
}

function conferirAcessoRestrito_(pasta) {
  if (pasta.getSharingAccess() !== DriveApp.Access.PRIVATE) {
    throw new Error('PASTA_COM_COMPARTILHAMENTO_AMplo');
  }

  var arquivoPlanilha = DriveApp.getFileById(
    PropertiesService.getScriptProperties().getProperty('PLANILHA_CONTROLE_ID')
  );
  if (arquivoPlanilha.getSharingAccess() !== DriveApp.Access.PRIVATE) {
    throw new Error('PLANILHA_COM_COMPARTILHAMENTO_AMplo');
  }
}

function sha256_(valor) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(valor),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function (b) {
    var hex = (b & 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function texto_(valor, limite) {
  return String(valor == null ? '' : valor)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limite);
}

function erro_(codigo, correlacao) {
  return resposta_({
    ok: false,
    codigo: codigo,
    correlacao: correlacao,
    mensagem: 'Não foi possível concluir o recebimento. Informe o código de referência à VISAT.'
  });
}

function resposta_(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
