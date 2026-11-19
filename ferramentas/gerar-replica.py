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
  'O PDF e o e-mail saem marcados como HOMOLOGAÇÃO. Na página oficial do Google Sites, este modelo vale por enquanto só para a ficha 1a (Acidente de trabalho).</div>\n  </div>', 1)
# Localizador cruzado da empresa (em teste só na réplica).
s = re.sub(r'(<link rel="stylesheet" href="css/teste/modelo-final.css[^"]*">)',
  r'\1\n  <link rel="stylesheet" href="css/teste/localizador-empregador.css?v=20261119-localizador">', s, count=1)
s = re.sub(r'(  <script src="js/teste/autopreenchimento-listas.js)',
  r'  <script src="js/teste/localizador-empregador.js?v=20261119-localizador" defer></script>\n\1', s, count=1)
assert 'localizador-empregador.js' in s
assert 'ajustes-replica.js' in s and 'modelo-final.css' in s and 'replica-parametros.js' in s
(raiz / 'replica-como-notificar.html').write_text(s, encoding='utf-8')
print('ok')
