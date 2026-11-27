(() => {
  const cabecalho = document.querySelector('[data-visat-moldura="cabecalho"]');
  const raiz = cabecalho?.shadowRoot;
  if (!raiz) return;
  const abrir = raiz.querySelector('.nav-toggle');
  const menu = raiz.querySelector('.nav');
  const marca = raiz.querySelector('.site-link');
  const estilos = raiz.querySelector('link[rel="stylesheet"]');
  const barra = abrir?.closest('.bar');
  if (!barra || !menu || !marca || !estilos) return;

  for (const link of menu.querySelectorAll('a')) {
    if (link.textContent.trim() === 'Plano de melhorias') link.remove();
  }

  const coluna = document.createElement('div');
  coluna.setAttribute('data-visat-navegacao', '');
  const lado = coluna.attachShadow({ mode: 'open' });
  const painel = document.createElement('div');
  painel.className = 'menu-fixo';
  const identidade = document.createElement('div');
  identidade.className = 'menu-identidade';
  identidade.append(marca.cloneNode(true));
  painel.append(identidade);
  lado.append(estilos.cloneNode(true), painel);
  cabecalho.after(coluna);
  document.body.classList.add('visat-com-menu');

  if (!menu.id) menu.id = 'menu-portal-visat';
  abrir.setAttribute('aria-controls', menu.id);
  abrir.removeAttribute('aria-haspopup');
  const desktop = matchMedia('(min-width: 800px)');

  function mostrarMenuMovel(visivel) {
    menu.hidden = !visivel;
    abrir.setAttribute('aria-expanded', String(visivel));
    abrir.setAttribute('aria-label', visivel ? 'Ocultar barra lateral' : 'Mostrar barra lateral');
  }

  function ajustarFixacao() {
    const cabe = desktop.matches && painel.offsetHeight <= document.documentElement.clientHeight;
    coluna.toggleAttribute('data-menu-cabe', cabe);
  }

  function adaptar() {
    if (desktop.matches) {
      painel.append(menu);
      menu.hidden = false;
      abrir.setAttribute('aria-expanded', 'false');
    } else {
      barra.append(menu);
      mostrarMenuMovel(false);
    }
    ajustarFixacao();
  }

  abrir.addEventListener('click', () => mostrarMenuMovel(menu.hidden));
  document.addEventListener('keydown', evento => {
    if (evento.key !== 'Escape') return;
    if (!desktop.matches && !menu.hidden) {
      mostrarMenuMovel(false);
      abrir.focus();
      return;
    }
    const creditos = document.querySelector('[data-visat-moldura="rodape"]')?.shadowRoot?.querySelector('details[open]');
    if (creditos) {
      creditos.open = false;
      creditos.querySelector('summary').focus();
    }
  });

  desktop.addEventListener('change', adaptar);
  window.addEventListener('resize', ajustarFixacao);
  new ResizeObserver(ajustarFixacao).observe(painel);
  adaptar();
})();
