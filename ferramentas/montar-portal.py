"""Monta a pasta portal/ (fonte única do Google Sites e da réplica) a partir do projeto
"VISAT — RÉPLICA DO PORTAL" (pasta site/) e dos ajustes que existiam só no Google Sites.

Uso:  python3 ferramentas/montar-portal.py CAMINHO/DA/PASTA/site

O que fica de fora (uso interno da equipe): observações, plano de melhorias,
cópia antiga das fichas (fichas-revisao-*), backups e registros do rsconnect.
"""
import pathlib
import re
import shutil
import sys

ORIGEM = pathlib.Path(sys.argv[1]).resolve()
RAIZ = pathlib.Path(__file__).resolve().parent.parent
DESTINO = RAIZ / 'portal'
AJUSTES = RAIZ / 'ferramentas' / 'ajustes-sites'

FICHAS = '../../site-visat/consulta-sites.html?escopo=visat&amp;homologacao=1&amp;paginaInteira=1&amp;rotulosExames=1'
ASSETS = ['pagina-visat.css', 'padrao-visat.css', 'moldura-visat.css', 'moldura-visat.js',
          'pesquisa-visat.js', 'ponte.png', 'rotulos-de-duracao.js', 'entrada-visat.js']

# Ajustes de estilo que existiam só no Google Sites (27/11/2026), na ordem em que o Sites os aplicava.
COMUM = ['padrao-visual.css']
SECOES = ['padrao-secoes.css']
FINAL = ['rodape.css', 'faixa.css', 'padrao-unificado.css']
POR_PAGINA = {
    'acidentes': COMUM + ['unificado.css'] + FINAL,
    'legislacao': ['legislacao.css'] + COMUM + ['unificado-v2.css'] + FINAL,
}
PADRAO = COMUM + SECOES + ['unificado-v2.css'] + FINAL
NAO_ALTERAR = {'index', 'rodape'}  # Início fica como está no Sites até a decisão da equipe

LEGISLACAO_MAIN = (AJUSTES / 'legislacao-main.html')


def copiar_base():
    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    (DESTINO / 'conteudo').mkdir(parents=True)
    (DESTINO / 'assets').mkdir()
    for nome in ASSETS:
        shutil.copy2(ORIGEM / 'assets' / nome, DESTINO / 'assets' / nome)
    shutil.copy2(RAIZ / 'ferramentas' / 'modo-visat.js', DESTINO / 'assets' / 'modo-visat.js')


def montar_css(pagina):
    lista = POR_PAGINA.get(pagina, PADRAO)
    partes = [f'/* {nome} — ajuste do Google Sites, 27/11/2026 */\n' + (AJUSTES / nome).read_text(encoding='utf-8').strip()
              for nome in lista]
    nome_css = f'ajustes-sites-{pagina}.css'
    (DESTINO / 'assets' / nome_css).write_text('\n\n'.join(partes) + '\n', encoding='utf-8')
    return nome_css


def tratar(pagina, html):
    # 1. modo oficial/réplica antes de tudo
    html = html.replace('<head>', '<head><script src="../assets/modo-visat.js"></script>', 1)
    # 2. ferramentas internas fora
    html = re.sub(r'<script[^>]*observacoes\.js[^>]*></script>', '', html)
    html = re.sub(r'<a href="\.\./melhorias\.html">[^<]*</a>', '', html)
    # 3. menu lateral da réplica: só carrega no modo réplica
    html = html.replace('<script defer src="../assets/moldura-visat.js"></script>',
                        '<script data-so-replica-src="../assets/moldura-visat.js"></script>')
    # 4. Como notificar: fichas oficiais do GitHub Pages
    html = re.sub(r'\.\./fichas-revisao-[0-9a-f]+/notificacao\.html\?[^"]*', FICHAS, html)
    html = html.replace('href="../como-notificar.html"', f'href="{FICHAS}"')
    # 5. ajustes do Sites
    if pagina == 'legislacao':
        novo = LEGISLACAO_MAIN.read_text(encoding='utf-8').strip()
        html = re.sub(r'<div class="replica-conteudo">.*?</div>(?=<div data-visat-moldura="rodape")',
                      lambda m: novo, html, count=1, flags=re.S)
    if pagina == 'dados':
        html = html.replace('<div class="replica-conteudo"><main><details>',
                            '<div class="replica-conteudo"><main><h1>Dados e indicadores</h1><details>', 1)
    css = montar_css(pagina)
    html = html.replace('</body>', f'<link rel="stylesheet" href="../assets/{css}"></body>', 1)
    return html


def main():
    copiar_base()
    for arquivo in sorted((ORIGEM / 'conteudo').glob('*.html')):
        pagina = arquivo.stem
        if pagina in NAO_ALTERAR:
            continue
        html = arquivo.read_text(encoding='utf-8')
        (DESTINO / 'conteudo' / arquivo.name).write_text(tratar(pagina, html), encoding='utf-8')
        print('ok', pagina)
    # Página de entrada da réplica no Posit Connect
    links = ''.join(f'<li><a href="conteudo/{p.name}">{p.stem}</a></li>'
                    for p in sorted((DESTINO / 'conteudo').glob('*.html')))
    (DESTINO / 'index.html').write_text(
        '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="robots" content="noindex,nofollow"><title>VISAT — réplica (testes)</title></head>'
        '<body style="font-family:Roboto,Arial,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem">'
        '<h1>VISAT — réplica para testes</h1><p>Mesmos arquivos exibidos no Google Sites.</p>'
        f'<ul>{links}</ul></body></html>', encoding='utf-8')


if __name__ == '__main__':
    main()
