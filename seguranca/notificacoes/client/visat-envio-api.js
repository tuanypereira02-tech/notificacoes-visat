/*
 * VISAT — cliente de envio sem segredo compartilhado.
 * Não integrar à página oficial até a implantação e validação do servidor.
 * A chave Turnstile secreta nunca é enviada ao navegador.
 */
(function () {
  'use strict';

  function base64(bytes) {
    var binario = '';
    for (var i = 0; i < bytes.length; i += 8192) {
      binario += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(binario);
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    throw new Error('Este navegador não oferece geração segura de identificador. Atualize o navegador.');
  }

  async function enviar(options) {
    options = options || {};
    var endpoint = String(options.endpoint || '').trim();

    if (!endpoint || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(endpoint)) {
      throw new Error('Serviço de recebimento ainda não configurado.');
    }
    if (!options.pdf || !options.agravo || !options.unidade || !options.emailRecibo || !options.turnstileToken) {
      throw new Error('Dados necessários para o recebimento incompletos.');
    }

    var pdfBytes = options.pdf instanceof Uint8Array
      ? options.pdf
      : new Uint8Array(options.pdf);

    var payload = {
      versao: 1,
      idempotencia: options.idempotencia || uuid(),
      agravo: String(options.agravo),
      unidade: String(options.unidade),
      cnes: String(options.cnes || ''),
      emailRecibo: String(options.emailRecibo),
      pdfBase64: base64(pdfBytes),
      turnstileToken: String(options.turnstileToken)
    };

    var resposta = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer'
    });

    var resultado;
    try {
      resultado = await resposta.json();
    } catch (erro) {
      throw new Error('O serviço não retornou uma confirmação válida.');
    }

    if (!resultado || resultado.ok !== true) {
      throw new Error(
        resultado && resultado.mensagem
          ? resultado.mensagem
          : 'Recebimento não confirmado. Não envie novamente sem verificar o protocolo.'
      );
    }

    return resultado;
  }

  window.VisatEnvioSeguro = Object.freeze({ enviar: enviar });
})();
