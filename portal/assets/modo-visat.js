/* VISAT — navegação compartilhada entre a réplica e a incorporação no Sites.
 * O modo oficial depende de ?modo=oficial. Estar num iframe não identifica o Sites.
 * O modo controla a apresentação; não é autenticação nem proteção de dados.
 *
 * API: VisatPortal.mode, pages, url(arquivoOuSlug, fragmento), resolve(href, base),
 * prepareLink(elemento), refresh(raiz) e ready (Promise após preparar o documento).
 * A navegação na mesma aba depende do sandbox do contêiner. Apenas num clique
 * genuíno, primário e sem modificadores, tenta-se navegar no topo. Se o Sites
 * bloquear essa ação, abre-se uma nova aba dentro do mesmo gesto. Se ela também
 * for bloqueada, aparece um link explícito. Nunca há navegação no carregamento.
 */
(function () {
  'use strict';
  if (window.VisatPortal) return;

  var SITES = new URL('https://sites.google.com/view/visat-sms-pmf/');
  var PAGES_BASE = new URL('https://tuanypereira02-tech.github.io/notificacoes-visat/');
  var pages = [
    ['index.html', 'inicio', 'Início', 'portal saúde trabalhador'],
    ['como-notificar.html', 'como-notificar', 'Como notificar', 'notificação ficha sinan celk cievs formulário'],
    ['acidentes.html', 'acidentes-de-trabalho', 'Acidentes de trabalho', 'acidente material biológico perfurocortante pep pack cat óbito'],
    ['doencas.html', 'doencas-do-trabalho', 'Doenças do trabalho', 'doença câncer dermatose voz ler dort pair pneumoconiose transtorno mental'],
    ['denuncias.html', 'denúncias', 'Denúncias', 'denúncia risco lixo esgoto alimentos zoonoses'],
    ['inspecoes.html', 'inspecoes', 'Inspeções', 'inspeção fiscalização risco ambiente'],
    ['legislacao.html', 'legislacao', 'Legislação', 'lei norma portaria protocolo'],
    ['materiais.html', 'materiais-e-cursos', 'Materiais e cursos', 'material curso capacitação guia'],
    ['contatos.html', 'contatos', 'Contatos', 'contato telefone email equipe'],
    ['dados.html', 'dados-e-indicadores', 'Dados e indicadores', 'dado indicador observatório estatística'],
    ['conheca.html', 'conheça-a-visat', 'Conheça a VISAT', 'visat vigilância missão atuação']
  ].map(function (p) {
    return Object.freeze({ file: p[0], slug: p[1], title: p[2], terms: p[3] });
  });
  Object.freeze(pages);

  var mode = new URLSearchParams(window.location.search).get('modo') === 'oficial' ? 'oficial' : 'replica';
  var ownScript = document.currentScript;
  var scriptURL = ownScript && ownScript.src ? new URL(ownScript.src, window.location.href) : null;
  // A raiz do próprio asset preserva subdiretórios do Pages e a raiz do Connect.
  var fallbackBase = new URL('./', window.location.href);
  if (/\/conteudo\/$/.test(fallbackBase.pathname)) fallbackBase = new URL('../', fallbackBase);
  var portalBase = scriptURL ? new URL('../', scriptURL) : fallbackBase;
  var localPaths = new Map();
  var officialPaths = new Map();
  var pageKeys = new Map();
  var legacyForms = new Set([
    new URL('../site-visat/consulta-sites.html', portalBase).href,
    new URL('site-visat/consulta-sites.html', PAGES_BASE).href
  ]);
  pages.forEach(function (page) {
    localPaths.set(new URL('conteudo/' + page.file, portalBase).pathname, page);
    officialPaths.set(SITES.pathname + page.slug, page);
    pageKeys.set(page.file, page);
    pageKeys.set(page.slug, page);
  });
  localPaths.set(new URL('index.html', portalBase).pathname, pages[0]);
  localPaths.set(portalBase.pathname, pages[0]);
  officialPaths.set(SITES.pathname.slice(0, -1), pages[0]);
  document.documentElement.setAttribute('data-modo', mode);
  window.VisatModo = mode; // Compatibilidade com os estilos e integrações existentes.

  function decodedPath(path) {
    try { return decodeURIComponent(path); } catch (e) { return path; }
  }

  function destination(page, hash, search) {
    var url = mode === 'oficial'
      ? new URL(encodeURIComponent(page.slug), SITES)
      : new URL('conteudo/' + page.file, portalBase);
    var params = new URLSearchParams(search || '');
    params.delete('modo');
    // Parâmetros da ficha legada não pertencem às páginas do portal.
    ['escopo', 'homologacao', 'paginaInteira', 'rotulosExames', 'authuser'].forEach(function (key) {
      params.delete(key);
    });
    url.search = params.toString();
    url.hash = hash || '';
    return url.href;
  }

  function pageURL(key, hash) {
    var page = pageKeys.get(key);
    return page ? destination(page, hash) : null;
  }

  function resolve(href, base) {
    if (typeof href !== 'string' || !href.trim() || href.trim().charAt(0) === '#') return null;
    var url;
    try { url = new URL(href, base || window.location.href); } catch (e) { return null; }
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    var page = null;
    if (url.origin === portalBase.origin) page = localPaths.get(url.pathname);
    if (!page && url.origin === SITES.origin) {
      page = officialPaths.get(decodedPath(url.pathname).replace(/\/$/, ''));
    }
    // Caminhos completos, nunca apenas o nome final de uma URL externa.
    if (!page && legacyForms.has(url.origin + url.pathname)) page = pageKeys.get('como-notificar.html');
    if (!page) return null;
    return { page: page, href: destination(page, url.hash, url.search), target: mode === 'oficial' ? '_top' : '_self' };
  }

  function prepareLink(anchor) {
    if (!anchor || !anchor.getAttribute || anchor.hasAttribute('download')) return false;
    if (!anchor.matches || !anchor.matches('a[href]')) return false;
    // As saídas operacionais da rota Como notificar não podem voltar para ela.
    if (anchor.hasAttribute('data-visat-destino-direto') ||
        anchor.hasAttribute('data-fichas-replica') || anchor.hasAttribute('data-fichas-oficial') ||
        anchor.hasAttribute('data-fichas-operacionais')) return false;
    var result = resolve(anchor.getAttribute('href'));
    if (!result) return false;
    if (anchor.getAttribute('href') !== result.href) anchor.setAttribute('href', result.href);
    if (anchor.getAttribute('target') !== result.target) anchor.setAttribute('target', result.target);
    return true;
  }

  var observedRoots = new WeakSet();
  var styledRoots = new WeakSet();
  var loadedScripts = new Set();
  var pendingRoots = new Set();
  var refreshQueued = false;
  var resolveReady;
  var ready = new Promise(function (resolvePromise) { resolveReady = resolvePromise; });

  function styleRoot(root) {
    if (styledRoots.has(root)) return;
    styledRoots.add(root);
    var style = document.createElement('style');
    style.setAttribute('data-visat-modo-style', '');
    style.textContent = mode === 'oficial'
      ? '[data-visat-moldura="cabecalho"],[data-visat-navegacao],.so-replica{display:none!important}'
      : '.so-oficial{display:none!important}';
    (root === document ? (document.head || document.documentElement) : root).appendChild(style);
  }

  function queueRefresh(root) {
    pendingRoots.add(root);
    if (refreshQueued) return;
    refreshQueued = true;
    Promise.resolve().then(function () {
      refreshQueued = false;
      var roots = Array.from(pendingRoots);
      pendingRoots.clear();
      roots.forEach(refresh);
    });
  }

  function observe(root) {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    if (typeof MutationObserver !== 'function') return;
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === 'attributes') {
          prepareLink(mutation.target);
          return;
        }
        Array.prototype.forEach.call(mutation.addedNodes, function (node) {
          if (node.nodeType === 1) queueRefresh(node);
        });
      });
    }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  }

  function hydrateTemplates(root) {
    if (!root.querySelectorAll) return;
    var templates = Array.from(root.querySelectorAll('template[shadowrootmode="open"]'));
    if (root.matches && root.matches('template[shadowrootmode="open"]')) templates.unshift(root);
    templates.forEach(function (template) {
      var host = template.parentElement;
      if (!host || host.shadowRoot || typeof host.attachShadow !== 'function') return;
      try {
        var shadow = host.attachShadow({ mode: 'open' });
        shadow.appendChild(template.content);
        template.remove();
      } catch (e) { /* Um elemento não compatível não impede os demais links. */ }
    });
  }

  function loadReplicaScripts(root) {
    if (mode !== 'replica' || !document.body || !root.querySelectorAll) return;
    var placeholders = Array.from(root.querySelectorAll('script[data-so-replica-src]'));
    if (root.matches && root.matches('script[data-so-replica-src]')) placeholders.unshift(root);
    placeholders.forEach(function (placeholder) {
      var source;
      try { source = new URL(placeholder.getAttribute('data-so-replica-src'), window.location.href); } catch (e) { return; }
      // Os scripts da réplica são assets locais conhecidos do portal.
      if (source.origin !== portalBase.origin || source.pathname.indexOf(portalBase.pathname + 'assets/') !== 0) return;
      if (loadedScripts.has(source.href)) return;
      loadedScripts.add(source.href);
      var alreadyLoaded = Array.from(document.querySelectorAll('script[src]')).some(function (script) {
        return script.src === source.href;
      });
      if (alreadyLoaded) return;
      var script = document.createElement('script');
      script.src = source.href;
      script.async = false;
      script.setAttribute('data-visat-replica-script', '');
      script.addEventListener('load', function () {
        refresh(document);
        document.dispatchEvent(new CustomEvent('visat:menu-ready', { detail: { mode: mode } }));
      }, { once: true });
      script.addEventListener('error', function () {
        placeholder.setAttribute('data-visat-load-error', '');
        document.dispatchEvent(new CustomEvent('visat:menu-error', { detail: { source: source.href } }));
      }, { once: true });
      document.body.appendChild(script);
    });
  }

  function refresh(root) {
    root = root || document;
    if (!root.querySelectorAll) return;
    hydrateTemplates(root);
    if (root === document || root.nodeType === 11) {
      styleRoot(root);
      observe(root);
    }
    if (root.matches && root.matches('a[href]')) prepareLink(root);
    Array.prototype.forEach.call(root.querySelectorAll('a[href]'), prepareLink);
    if (root.shadowRoot) refresh(root.shadowRoot);
    Array.prototype.forEach.call(root.querySelectorAll('*'), function (element) {
      if (element.shadowRoot) refresh(element.shadowRoot);
    });
    loadReplicaScripts(root);
  }

  window.VisatPortal = Object.freeze({
    mode: mode, pages: pages, url: pageURL, resolve: resolve,
    prepareLink: prepareLink, refresh: refresh, ready: ready
  });

  function showNavigationFallback(href) {
    var previous = document.querySelector('.visat-navegacao-aviso');
    if (previous) previous.remove();
    var notice = document.createElement('div');
    notice.className = 'visat-navegacao-aviso';
    notice.setAttribute('role', 'alert');
    notice.setAttribute('style', 'position:fixed;z-index:10000;bottom:16px;left:16px;right:16px;' +
      'max-width:40rem;margin:auto;padding:16px;background:#FFF0DF;color:#112C45;' +
      'border:1px solid #CC6A00;border-radius:6px;box-shadow:0 2px 12px #112c4533');
    var message = document.createElement('p');
    message.textContent = 'O navegador bloqueou a abertura da nova aba. Use o link abaixo para continuar.';
    var link = document.createElement('a');
    link.href = href;
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
    link.setAttribute('data-visat-destino-direto', '');
    link.textContent = 'Abrir página em nova aba';
    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Fechar aviso';
    close.setAttribute('style', 'margin-left:16px');
    close.addEventListener('click', function () { notice.remove(); });
    notice.append(message, link, close);
    document.body.appendChild(notice);
    link.focus();
  }

  function navigateFromClick(event, anchor) {
    if (mode !== 'oficial' || !event.isTrusted || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.shiftKey || event.metaKey || event.altKey) return;
    if (window.self === window.top) return; // Fora de um quadro, a navegação nativa basta.
    event.preventDefault();
    var href = anchor.href;
    try {
      window.top.location.href = href;
      return;
    } catch (error) { /* O sandbox do Sites pode impedir a navegação do quadro pai. */ }
    var popup;
    try {
      // Com noopener em window.open, o retorno também é null quando a abertura
      // funciona. Abrir vazio e remover opener antes de navegar permite detectar
      // bloqueio sem conceder à página de destino acesso à janela original.
      popup = window.open('about:blank', '_blank');
      if (popup) {
        popup.opener = null;
        popup.location.href = href;
        return;
      }
    } catch (error) {
      if (popup) popup.close();
    }
    showNavigationFallback(href);
  }

  // Inclui links acrescentados depois do carregamento e dentro de shadow roots.
  // A fase de propagação respeita preventDefault dos controles da própria página.
  document.addEventListener('click', function (event) {
    var path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
    for (var i = 0; i < path.length; i++) {
      var node = path[i];
      if (node && node.matches && node.matches('a[href]')) {
        if (prepareLink(node)) navigateFromClick(event, node);
        break;
      }
    }
  });

  function start() {
    refresh(document);
    resolveReady(window.VisatPortal);
    document.dispatchEvent(new CustomEvent('visat:ready', { detail: { mode: mode } }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
