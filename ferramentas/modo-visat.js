/* VISAT Florianópolis — um só arquivo para o Google Sites e para a réplica.
 * Dentro do Google Sites (quadro incorporado) -> modo "oficial":
 *   esconde o cabeçalho e o menu da réplica e faz os links abrirem as páginas do Sites.
 * Aberto direto (Posit Connect ou GitHub Pages) -> modo "replica":
 *   mostra o cabeçalho com o aviso de réplica e carrega o menu lateral.
 * Teste manual: acrescentar ?modo=oficial ou ?modo=replica ao endereço.
 */
(function () {
  'use strict';

  var SITES = 'https://sites.google.com/view/visat-sms-pmf/';
  var PAGINAS = {
    'index.html': 'inicio',
    'como-notificar.html': 'como-notificar',
    'consulta-sites.html': 'como-notificar',
    'notificacao.html': 'como-notificar',
    'acidentes.html': 'acidentes-de-trabalho',
    'doencas.html': 'doencas-do-trabalho',
    'denuncias.html': 'den%C3%BAncias',
    'inspecoes.html': 'inspecoes',
    'legislacao.html': 'legislacao',
    'materiais.html': 'materiais-e-cursos',
    'contatos.html': 'contatos',
    'dados.html': 'dados-e-indicadores',
    'conheca.html': 'conhe%C3%A7a-a-visat'
  };

  var forcado = null;
  try { forcado = new URLSearchParams(window.location.search).get('modo'); } catch (e) { /* sem suporte */ }
  var embutido;
  try { embutido = window.self !== window.top; } catch (e) { embutido = true; }
  var modo = (forcado === 'oficial' || forcado === 'replica') ? forcado : (embutido ? 'oficial' : 'replica');
  document.documentElement.setAttribute('data-modo', modo);

  var estilo = document.createElement('style');
  estilo.textContent =
    'html[data-modo="oficial"] [data-visat-moldura="cabecalho"],' +
    'html[data-modo="oficial"] .so-replica{display:none!important}' +
    'html[data-modo="replica"] .so-oficial{display:none!important}';
  (document.head || document.documentElement).appendChild(estilo);

  function destinoSites(href) {
    if (!href || /^(https?:|mailto:|tel:|#|data:)/i.test(href)) return null;
    var arquivo = href.split('#')[0].split('?')[0].split('/').pop();
    return Object.prototype.hasOwnProperty.call(PAGINAS, arquivo) ? SITES + PAGINAS[arquivo] : null;
  }

  function preparar() {
    if (modo === 'replica') {
      var scripts = document.querySelectorAll('script[data-so-replica-src]');
      for (var i = 0; i < scripts.length; i++) {
        var s = document.createElement('script');
        s.src = scripts[i].getAttribute('data-so-replica-src');
        document.body.appendChild(s);
      }
      return;
    }
    var links = document.querySelectorAll('a[href]');
    for (var j = 0; j < links.length; j++) {
      var destino = destinoSites(links[j].getAttribute('href'));
      if (destino) {
        links[j].href = destino;
        links[j].target = '_top';
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', preparar);
  else preparar();

  window.VisatModo = modo;
})();
