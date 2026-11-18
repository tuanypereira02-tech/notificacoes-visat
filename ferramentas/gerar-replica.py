"""Gera replica-como-notificar.html a partir de notificacao.html (página do Google Sites).
A réplica carrega js/teste/ajustes-replica.js e mostra a faixa de teste. Rodar de novo após mudar notificacao.html."""
import pathlib, re
raiz = pathlib.Path(__file__).resolve().parent.parent
s = (raiz / 'notificacao.html').read_text(encoding='utf-8')
s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <script src="js/teste/replica-parametros.js"></script>', 1)
s = s.replace('<title>Notificação Compulsória', '<title>RÉPLICA PARA TESTES · Notificação Compulsória', 1)
s = s.replace('<a class="pular" href="#principal">Pular para o conteúdo</a>',
  '<a class="pular" href="#principal">Pular para o conteúdo</a>\n'
  '  <div class="aviso" role="note" style="background:#fff3e0;border-bottom:2px solid #CC6A00">\n'
  '    <div class="wrap"><strong>RÉPLICA PARA TESTES.</strong> Versão qualificada das fichas (17/11/2026). Use somente dados fictícios. '
  'O PDF e o e-mail saem marcados como HOMOLOGAÇÃO. A página oficial do Google Sites não muda.</div>\n  </div>', 1)
s = re.sub(r'(<script src="js/teste/formulario-acidente\.js[^"]*" defer></script>)',
           r'\1\n  <script src="js/teste/ajustes-replica.js?v=20261117-app" defer></script>', s, count=1)
assert 'ajustes-replica.js' in s
(raiz / 'replica-como-notificar.html').write_text(s, encoding='utf-8')
print('ok')
