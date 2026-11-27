"""Importa uma cópia da réplica para uma pasta NOVA, para conferência pontual.

Uso: python3 ferramentas/montar-portal.py --origem CAMINHO/site --output CAMINHO/novo
O caminho da origem também pode ser informado como primeiro argumento posicional.

A fonte cotidiana do portal é portal/. Este importador não participa da publicação,
não substitui portal/ e recusa qualquer destino já existente. A importação inteira
é validada em memória e montada em uma pasta temporária antes de entregar a saída.
Observações da equipe, melhorias.html, rodapé isolado, fichas antigas, backups e
registros do rsconnect não são importados.
"""

import argparse
import html as html_lib
from html.parser import HTMLParser
import pathlib
import re
import sys
import tempfile
from urllib.parse import unquote, urlsplit, urlunsplit


RAIZ = pathlib.Path(__file__).resolve().parent.parent
CANONICO = RAIZ / 'portal'
AJUSTES = RAIZ / 'ferramentas' / 'ajustes-sites'
ASSETS = (
    'pagina-visat.css', 'padrao-visat.css', 'moldura-visat.css', 'moldura-visat.js',
    'pesquisa-visat.js', 'ponte.png', 'rotulos-de-duracao.js', 'entrada-visat.js',
)
PAGINAS = (
    'index', 'acidentes', 'conheca', 'contatos', 'dados', 'denuncias', 'doencas',
    'inspecoes', 'legislacao', 'materiais',
)
HOST_REPLICA = '01a21622-b3d6-40e8-d434-347e3a615066.share.connect.posit.cloud'
ROTAS_SITES = {
    'inicio': 'index', 'início': 'index',
    'como-notificar': 'como-notificar',
    'acidentes-de-trabalho': 'acidentes', 'doencas-do-trabalho': 'doencas',
    'doenças-do-trabalho': 'doencas', 'denuncias': 'denuncias',
    'denúncias': 'denuncias', 'inspecoes': 'inspecoes', 'inspeções': 'inspecoes',
    'legislacao': 'legislacao', 'legislação': 'legislacao',
    'materiais-e-cursos': 'materiais', 'contatos': 'contatos',
    'dados-e-indicadores': 'dados', 'conheca-a-visat': 'conheca',
    'conheça-a-visat': 'conheca',
}


def nome_url(valor):
    """Ignora query e fragmento ao identificar um arquivo referenciado."""
    return pathlib.PurePosixPath(unquote(urlsplit(valor or '').path)).name.lower()


def link_local(valor):
    """Normaliza somente rotas conhecidas do VISAT; preserva links externos."""
    url = urlsplit(valor)
    if url.scheme and url.scheme.lower() not in ('http', 'https'):
        return valor
    if not url.path or valor.startswith('#'):
        return valor
    caminho = unquote(url.path)
    if url.netloc:
        host = (url.hostname or '').lower()
        if host == 'sites.google.com':
            bases = ('/view/visat-sms-pmf/', '/view/visat-pmf-sms/')
            base = next((b for b in bases if caminho.startswith(b)), None)
            if base is None:
                return valor
            pagina = ROTAS_SITES.get(caminho[len(base):].strip('/'))
            if pagina is None:
                return valor
            return urlunsplit(('', '', pagina + '.html', url.query, url.fragment))
        if host == 'tuanypereira02-tech.github.io':
            if not caminho.startswith('/notificacoes-visat/'):
                return valor
        elif host != HOST_REPLICA:
            return valor
    nome = pathlib.PurePosixPath(caminho).name.lower()
    if nome in ('consulta-sites.html', 'notificacao.html', 'como-notificar.html'):
        nome = 'como-notificar.html'
    elif nome not in {pagina + '.html' for pagina in PAGINAS}:
        return valor
    # O arquivo que contém estes links está em conteudo/.
    return urlunsplit(('', '', nome, url.query, url.fragment))


class ImportarHTML(HTMLParser):
    """Altera tags por posição, preservando scripts, estilos e imagens embutidas."""

    def __init__(self, texto, css):
        super().__init__(convert_charrefs=False)
        self.texto = texto
        self.css = css
        self.linhas = [0]
        self.linhas.extend(m.end() for m in re.finditer('\n', texto))
        self.edicoes = []
        self.removendo = None
        self.tem_head = False
        self.tem_body_final = False

    def posicao(self):
        linha, coluna = self.getpos()
        return self.linhas[linha - 1] + coluna

    def handle_starttag(self, tag, attrs):
        inicio = self.posicao()
        original = self.get_starttag_text()
        fim = inicio + len(original)
        if self.removendo:
            if tag == self.removendo[0]:
                self.removendo[2] += 1
            return
        atributos = dict(attrs)
        fonte = atributos.get('src') or atributos.get('data-so-replica-src')
        remover = (
            tag == 'script' and nome_url(fonte) in ('observacoes.js', 'modo-visat.js')
        ) or (
            tag == 'a' and nome_url(atributos.get('href')) == 'melhorias.html'
        )
        if remover:
            self.removendo = [tag, inicio, 1]
            return
        if tag == 'link':
            nome = nome_url(atributos.get('href'))
            if nome == 'observacoes.css' or (self.css and nome.startswith('ajustes-sites-')):
                self.edicoes.append((inicio, fim, ''))
                return
        if tag == 'head' and not self.tem_head:
            self.tem_head = True
            self.edicoes.append((fim, fim, '<script src="../assets/modo-visat.js"></script>'))
        novos = []
        for nome, valor in attrs:
            if tag == 'a' and nome == 'href' and valor is not None:
                valor = link_local(valor)
            if tag == 'script' and nome == 'src' and nome_url(valor) == 'moldura-visat.js':
                nome = 'data-so-replica-src'
            novos.append((nome, valor))
        if novos != attrs:
            sufixo = ' />' if original.rstrip().endswith('/>') else '>'
            atributos_html = ''.join(
                ' ' + nome if valor is None else
                ' ' + nome + '="' + html_lib.escape(valor, quote=True) + '"'
                for nome, valor in novos
            )
            self.edicoes.append((inicio, fim, '<' + tag + atributos_html + sufixo))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if self.removendo and self.removendo[1] == self.posicao():
            self.edicoes.append((self.posicao(), self.posicao() + len(self.get_starttag_text()), ''))
            self.removendo = None

    def handle_endtag(self, tag):
        inicio = self.posicao()
        if self.removendo:
            if tag == self.removendo[0]:
                self.removendo[2] -= 1
                if self.removendo[2] == 0:
                    fim = self.texto.index('>', inicio) + 1
                    self.edicoes.append((self.removendo[1], fim, ''))
                    self.removendo = None
            return
        if tag == 'body' and not self.tem_body_final:
            self.tem_body_final = True
            if self.css:
                self.edicoes.append((inicio, inicio,
                    '<link rel="stylesheet" href="../assets/' + self.css + '">'))

    def resultado(self):
        self.feed(self.texto)
        self.close()
        if not self.tem_head or not self.tem_body_final or self.removendo:
            raise ValueError('HTML incompleto: confira head, body e fechamento das ferramentas internas.')
        texto = self.texto
        for inicio, fim, substituto in sorted(self.edicoes, reverse=True):
            texto = texto[:inicio] + substituto + texto[fim:]
        return texto


def ler_arquivo(caminho, texto=False):
    if not caminho.is_file() or caminho.is_symlink():
        raise ValueError(f'Arquivo obrigatório ausente ou link simbólico: {caminho}')
    dados = caminho.read_bytes()
    if not dados:
        raise ValueError(f'Arquivo obrigatório vazio: {caminho}')
    return dados.decode('utf-8') if texto else dados


def preparar_importacao(origem):
    """Lê e valida todas as entradas antes de criar qualquer arquivo de saída."""
    if not (origem / 'assets').is_dir() or not (origem / 'conteudo').is_dir():
        raise ValueError('A origem deve conter as pastas assets/ e conteudo/.')
    arquivos = {pathlib.Path('assets') / nome: ler_arquivo(origem / 'assets' / nome)
                for nome in ASSETS}
    arquivos[pathlib.Path('assets/modo-visat.js')] = ler_arquivo(CANONICO / 'assets/modo-visat.js')
    for pagina in PAGINAS:
        texto = ler_arquivo(origem / 'conteudo' / (pagina + '.html'), texto=True)
        # Preserva exatamente os nove ajustes já conferidos, sem regenerar o CSS.
        css = None if pagina == 'index' else 'ajustes-sites-' + pagina + '.css'
        if css:
            arquivos[pathlib.Path('assets') / css] = ler_arquivo(CANONICO / 'assets' / css)
        if pagina == 'legislacao':
            novo = ler_arquivo(AJUSTES / 'legislacao-main.html', texto=True).strip()
            padrao = r'<div\s+class=[\"\']replica-conteudo[\"\']>.*?</div>(?=\s*<div\s+data-visat-moldura=[\"\']rodape)'
            texto, quantidade = re.subn(padrao, lambda _: novo, texto, count=1, flags=re.S | re.I)
            if quantidade != 1:
                raise ValueError('Legislação: bloco de conteúdo não reconhecido; confira a origem antes de importar.')
        if pagina == 'dados':
            texto = texto.replace('<div class="replica-conteudo"><main><details>',
                                  '<div class="replica-conteudo"><main><h1>Dados e indicadores</h1><details>', 1)
        try:
            tratado = ImportarHTML(texto, css).resultado()
        except ValueError as erro:
            raise ValueError(f'{pagina}.html: {erro}') from erro
        arquivos[pathlib.Path('conteudo') / (pagina + '.html')] = tratado.encode('utf-8')
    # Esta rota é mantida em portal/ e usa as fichas oficiais; não importa a cópia antiga.
    rota_fichas = CANONICO / 'conteudo/como-notificar.html'
    if rota_fichas.is_file():
        arquivos[pathlib.Path('conteudo/como-notificar.html')] = ler_arquivo(rota_fichas)
    arquivos[pathlib.Path('index.html')] = (
        '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="robots" content="noindex,nofollow"><title>Portal VISAT</title>'
        '<meta http-equiv="refresh" content="0;url=conteudo/index.html"></head>'
        '<body><a href="conteudo/index.html">Abrir Portal VISAT</a></body></html>\n'
    ).encode('utf-8')
    return arquivos


def importar(origem, destino):
    if destino.exists() or destino.is_symlink():
        raise ValueError(f'O destino já existe e será preservado: {destino}')
    if destino == CANONICO or CANONICO in destino.parents:
        raise ValueError('Escolha uma pasta nova fora de portal/; portal/ é a fonte cotidiana.')
    if destino == origem or origem in destino.parents:
        raise ValueError('A saída deve ficar fora da pasta de origem.')
    if not destino.parent.is_dir():
        raise ValueError(f'A pasta pai do destino não existe: {destino.parent}')
    arquivos = preparar_importacao(origem)
    with tempfile.TemporaryDirectory(prefix='.visat-importacao-', dir=destino.parent) as temporario:
        staging = pathlib.Path(temporario) / 'resultado'
        staging.mkdir()
        for relativo, conteudo in arquivos.items():
            arquivo = staging / relativo
            arquivo.parent.mkdir(parents=True, exist_ok=True)
            arquivo.write_bytes(conteudo)
        if destino.exists() or destino.is_symlink():
            raise ValueError(f'O destino foi criado durante a importação e será preservado: {destino}')
        staging.rename(destino)
    return len(arquivos)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('origem_posicional', nargs='?', type=pathlib.Path, help='pasta site/ da réplica (compatibilidade)')
    parser.add_argument('--origem', type=pathlib.Path, help='pasta site/ da réplica')
    parser.add_argument('--output', required=True, type=pathlib.Path, help='pasta NOVA para conferir a importação')
    args = parser.parse_args(argv)
    if bool(args.origem) == bool(args.origem_posicional):
        parser.error('Informe a origem por --origem OU como argumento posicional.')
    origem = (args.origem or args.origem_posicional).expanduser().resolve()
    destino_informado = args.output.expanduser()
    if destino_informado.is_symlink():
        parser.error('O destino não pode ser um link simbólico.')
    destino = destino_informado.resolve()
    try:
        quantidade = importar(origem, destino)
    except (OSError, UnicodeError, ValueError) as erro:
        print(f'Importação cancelada: {erro}', file=sys.stderr)
        return 1
    print(f'Importação pronta para conferência: {destino} ({quantidade} arquivos).')
    print('Edite e publique a partir de portal/. Esta importação não substituiu o portal atual.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
