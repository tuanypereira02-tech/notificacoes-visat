(() => {
  'use strict';

  const aplicacao = document.querySelector('#aplicacao-notificacao');
  let observadorConteudo;
  let observadorAlteracoes;
  let formularioEstavaAberto = false;

  function formularioAberto(documento) {
    return Boolean(documento && documento.body && documento.body.classList.contains('modo-formulario-acidente'));
  }

  function ajustarAlturaAplicacao() {
    const documento = aplicacao.contentDocument;
    if (!documento || !documento.body) return;

    if (formularioAberto(documento)) {
      if (!formularioEstavaAberto) {
        const destino = aplicacao.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: Math.max(0, destino), behavior: 'auto' });
        documento.defaultView?.scrollTo(0, 0);
      }
      formularioEstavaAberto = true;
      const topo = Math.max(0, aplicacao.getBoundingClientRect().top);
      const altura = Math.max(480, window.innerHeight - topo);
      aplicacao.style.height = `${Math.round(altura)}px`;
      aplicacao.setAttribute('scrolling', 'no');
      return;
    }

    formularioEstavaAberto = false;
    aplicacao.setAttribute('scrolling', 'no');
    const altura = Math.max(
      documento.documentElement.scrollHeight,
      documento.body.scrollHeight,
      documento.body.offsetHeight
    );
    if (Math.abs(aplicacao.getBoundingClientRect().height - altura) > 1) {
      aplicacao.style.height = `${altura}px`;
    }
  }

  aplicacao.addEventListener('load', () => {
    const documento = aplicacao.contentDocument;
    if (!documento || !documento.body) return;

    ajustarAlturaAplicacao();
    if (window.MutationObserver) {
      observadorAlteracoes?.disconnect();
      observadorAlteracoes = new window.MutationObserver(ajustarAlturaAplicacao);
      observadorAlteracoes.observe(documento.body, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        characterData: true,
        subtree: true
      });
    }
    if (window.ResizeObserver) {
      observadorConteudo?.disconnect();
      observadorConteudo = new window.ResizeObserver(ajustarAlturaAplicacao);
      const conteudo = documento.querySelector('#principal');
      if (conteudo) observadorConteudo.observe(conteudo);
      const rodape = documento.querySelector('.rodape');
      if (rodape) observadorConteudo.observe(rodape);
    }
  });
  window.addEventListener('resize', ajustarAlturaAplicacao);
  ajustarAlturaAplicacao();
})();
