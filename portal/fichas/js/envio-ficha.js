/* Gerado de site-visat/js/envio-ficha.js: somente PDF local; envio indisponível. */
(function () {
  'use strict';
  const DESTINO_EXIBIDO = 'Envio desativado na réplica';
  const PREFIXO_ASSUNTO = '[HOMOLOGAÇÃO VISAT]';
  async function gerarPdf(area, rodape) {
    rodape = 'HOMOLOGAÇÃO — RÉPLICA PARA TESTES';
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
    pdf.setTitle('HOMOLOGAÇÃO — ' + titulo);
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

  function montarAssunto(agravo, unidade, cnes) {
    const nomeUnidade = String(unidade || '').replace(/\s+/g, ' ').trim();
    const codigo = String(cnes || '').replace(/\D/g, '');
    const origem = nomeUnidade
      ? ' — ' + nomeUnidade + (codigo ? ' (CNES ' + codigo + ')' : '')
      : (codigo ? ' — CNES ' + codigo : '');
    return (PREFIXO_ASSUNTO + ' ' + agravo + origem).slice(0, 200);
  }

  function abrirJanela({ retorno } = {}) {
    const mensagem = "Esta réplica não envia fichas por e-mail. Use somente dados fictícios; o PDF é de homologação.";
    if (retorno) { retorno.textContent = mensagem; retorno.hidden = false; }
    return false;
  }
  window.VisatEnvio = { gerarPdf, baixar, abrirJanela, montarAssunto, DESTINO_EXIBIDO, PREFIXO_ASSUNTO };
})();
