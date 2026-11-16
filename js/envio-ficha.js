/* VISAT Florianópolis — envio da ficha por e-mail com o PDF anexado.
 * O PDF é gerado no navegador (pdf-lib) a partir da área de impressão da ficha
 * e enviado pelo app da Web do Google Apps Script "VISAT - Envio de fichas por e-mail".
 * O destinatário fica fixo no Apps Script; aqui ele só é exibido.
 *
 * Troca para o e-mail oficial, após os testes:
 *   1. no Apps Script, DESTINO = 'saudetrab.sms.pmf@floripa.sc.gov.br' e nova versão da implantação;
 *   2. aqui, DESTINO_EXIBIDO = o mesmo endereço e PREFIXO_ASSUNTO = '[VISAT]'.
 */
(function () {
  'use strict';

  const ENVIO_URL = 'https://script.google.com/macros/s/AKfycby5gKHYYkkTcNVHKATtZlWmLGXMaoGw9qJ9V44gLaJMPYwawZs4GXIG2zXPYaUaxLxvIw/exec';
  const ENVIO_CHAVE = 'visat-F6Ar-bk8Re4my_CPSd76x_pl';
  const DESTINO_EXIBIDO = 'saudetrab.sms.pmf@gmail.com';
  const PREFIXO_ASSUNTO = '[TESTE VISAT]';

  function codificarBase64(bytes) {
    let binario = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(binario);
  }

  async function gerarPdf(area, rodape) {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const pdf = await PDFDocument.create();
    const normal = await pdf.embedFont(StandardFonts.Helvetica);
    const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
    const margem = 44;
    const largura = 595.28;
    const altura = 841.89;
    const maximo = largura - margem * 2;
    let pagina;
    let y;

    function novaPagina() {
      pagina = pdf.addPage([largura, altura]);
      y = altura - margem;
      escreverEm(rodape, margem, 27, 8, negrito);
    }

    function seguro(texto, fonte) {
      const caracteres = new Set(fonte.getCharacterSet());
      return Array.from(String(texto).normalize('NFC'), letra =>
        letra === '\n' || caracteres.has(letra.codePointAt(0)) ? letra : '?').join('');
    }

    function escreverEm(texto, x, posY, tamanho, fonte) {
      pagina.drawText(seguro(texto, fonte), { x, y: posY, size: tamanho, font: fonte, color: rgb(0.07, 0.17, 0.27) });
    }

    function paragrafo(texto, tamanho, fonte) {
      for (const trecho of seguro(texto, fonte).split('\n')) {
        let linha = '';
        for (const palavra of trecho.trim().split(/\s+/)) {
          const proposta = linha ? linha + ' ' + palavra : palavra;
          if (fonte.widthOfTextAtSize(proposta, tamanho) <= maximo) {
            linha = proposta;
            continue;
          }
          if (linha) escrever(linha);
          linha = '';
          for (const letra of palavra) {
            if (fonte.widthOfTextAtSize(linha + letra, tamanho) > maximo) {
              escrever(linha);
              linha = '';
            }
            linha += letra;
          }
        }
        escrever(linha);
      }
      function escrever(linha) {
        if (y < margem) novaPagina();
        escreverEm(linha, margem, y, tamanho, fonte);
        y -= tamanho + 4;
      }
    }

    novaPagina();
    const titulo = area.querySelector('.pf-title')?.textContent || 'Ficha de notificação';
    pdf.setTitle(titulo);
    paragrafo(titulo, 16, negrito);
    if (area.dataset.marca) paragrafo(area.dataset.marca, 11, negrito);
    const nota = area.querySelector('.pf-note');
    if (nota) paragrafo(nota.textContent, 10, normal);
    const data = area.querySelector('#pfDataImpressao');
    if (data) paragrafo('Data de impressão: ' + data.textContent, 9, normal);
    for (const bloco of area.querySelectorAll('.pf-block')) {
      y -= 10;
      if (y < margem + 44) novaPagina();
      paragrafo(bloco.querySelector('h3')?.textContent || '', 13, negrito);
      for (const campo of bloco.querySelectorAll('.pf-field')) {
        if (y < margem + 28) novaPagina();
        paragrafo(campo.querySelector('h4')?.textContent || '', 10, negrito);
        paragrafo(campo.querySelector('.pf-answer')?.textContent || '', 10, normal);
      }
    }
    y -= 18;
    const assinatura = area.querySelector('.pf-sign');
    if (assinatura && !assinatura.hidden) {
      paragrafo('Assinatura do profissional responsável __________________    Data __________', 10, normal);
    }
    return pdf.save();
  }

  function baixar(bytes, nome) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function enviar(assunto, corpo, nomeArquivo, pdf, emailProfissional) {
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), 60000);
    try {
      const resposta = await fetch(ENVIO_URL, {
        method: 'POST',
        // text/plain evita a verificação prévia de CORS no Apps Script.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ chave: ENVIO_CHAVE, assunto, corpo, nomeArquivo, emailProfissional, pdf: codificarBase64(pdf) }),
        signal: controle.signal
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok || !dados.ok) throw new Error(dados.erro || 'Envio não confirmado.');
    } finally {
      clearTimeout(limite);
    }
  }

  function montarAssunto(agravo, unidade, cnes) {
    const nomeUnidade = String(unidade || '').replace(/\s+/g, ' ').trim();
    const codigo = String(cnes || '').replace(/\D/g, '');
    const origem = nomeUnidade
      ? ' — ' + nomeUnidade + (codigo ? ' (CNES ' + codigo + ')' : '')
      : (codigo ? ' — CNES ' + codigo : '');
    return (PREFIXO_ASSUNTO + ' ' + agravo + origem).slice(0, 200);
  }

  let janela;
  function abrirJanela({ raiz, botao, assunto, corpo, nomePdf, pdf, retorno, aoEnviar }) {
    if (!janela || !raiz.contains(janela)) {
      janela = document.createElement('dialog');
      janela.className = 'dialog visat-janela-email';
      janela.setAttribute('aria-labelledby', 'visat-email-titulo');
      janela.innerHTML = `
        <form method="dialog" novalidate>
          <header><h2 id="visat-email-titulo">Nova mensagem</h2>
            <p>Confira os dados e clique em Enviar.</p></header>
          <dl>
            <div><dt>Para</dt><dd data-email-destino></dd></div>
            <div><dt><label for="visat-email-de">Seu e-mail</label></dt>
              <dd><input class="input" id="visat-email-de" type="email" autocomplete="email" required
                aria-describedby="visat-email-de-ajuda">
                <span class="field-help" id="visat-email-de-ajuda">Recebe uma cópia da mensagem e as respostas da VISAT.</span></dd></div>
            <div><dt>Assunto</dt><dd data-email-assunto></dd></div>
            <div><dt>Anexo</dt><dd><a href="#" data-email-anexo></a></dd></div>
          </dl>
          <label class="field-label" for="visat-email-texto">Mensagem</label>
          <textarea class="input" id="visat-email-texto" rows="6" maxlength="4000"></textarea>
          <p role="status" class="field-help" data-email-status></p>
          <div class="visat-email-acoes">
            <button type="button" class="btn" data-variant="outline" data-email-cancelar>Cancelar</button>
            <button type="submit" class="btn" data-email-enviar>Enviar</button>
          </div>
        </form>`;
      raiz.append(janela);
    }
    const campo = seletor => janela.querySelector(seletor);
    const de = campo('#visat-email-de');
    const texto = campo('#visat-email-texto');
    const status = campo('[data-email-status]');
    const enviarBotao = campo('[data-email-enviar]');
    const cancelar = campo('[data-email-cancelar]');
    const anexo = campo('[data-email-anexo]');
    campo('[data-email-destino]').textContent = DESTINO_EXIBIDO;
    campo('[data-email-assunto]').textContent = assunto;
    anexo.textContent = '📎 ' + nomePdf + ' (' + Math.max(1, Math.round(pdf.length / 1024)) + ' KB)';
    anexo.title = 'Baixar o PDF anexado para conferir';
    anexo.onclick = evento => {
      evento.preventDefault();
      baixar(pdf, nomePdf);
    };
    de.value = '';
    de.removeAttribute('aria-invalid');
    texto.value = corpo;
    status.textContent = '';
    enviarBotao.disabled = false;
    cancelar.disabled = false;
    cancelar.onclick = () => janela.close();
    janela.oncancel = evento => { if (enviarBotao.disabled) evento.preventDefault(); };
    janela.onclose = () => botao.focus();
    campo('form').onsubmit = async evento => {
      evento.preventDefault();
      const email = de.value.trim();
      if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(email)) {
        status.textContent = 'Informe o seu e-mail para receber a cópia.';
        de.setAttribute('aria-invalid', 'true');
        de.focus();
        return;
      }
      de.removeAttribute('aria-invalid');
      enviarBotao.disabled = true;
      cancelar.disabled = true;
      status.textContent = 'Enviando…';
      try {
        await enviar(assunto, texto.value.trim() || corpo, nomePdf, pdf, email);
      } catch {
        status.textContent = 'Não foi possível enviar. Envie manualmente: feche esta janela, clique em 2. Baixar ficha em PDF e envie o arquivo para ' + DESTINO_EXIBIDO + '.';
        enviarBotao.disabled = false;
        cancelar.disabled = false;
        return;
      }
      botao.disabled = true;
      retorno.textContent = 'Ficha enviada para ' + DESTINO_EXIBIDO + ' com o PDF anexado. Cópia enviada para ' + email + '.';
      if (aoEnviar) aoEnviar();
      janela.close();
    };
    janela.showModal();
    de.focus();
  }

  window.VisatEnvio = { gerarPdf, baixar, abrirJanela, montarAssunto, DESTINO_EXIBIDO, PREFIXO_ASSUNTO };
})();
