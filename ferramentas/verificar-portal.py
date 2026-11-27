#!/usr/bin/env python3
"""Verifica a publicação estática e registra uma versão igual nos dois hosts.

Uso: python3 ferramentas/verificar-portal.py [--atualizar-versao]
Só usa a biblioteca padrão; não abre páginas, envia fichas ou acessa a rede.
"""
import argparse
import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

RAIZ = Path(__file__).resolve().parent.parent
PORTAL = RAIZ / 'portal'
PAGINAS = ('index', 'como-notificar', 'acidentes', 'doencas', 'denuncias',
           'inspecoes', 'legislacao', 'materiais', 'contatos', 'dados', 'conheca')
PRIVADOS = re.compile(r'(?:observacoes\.js|qualificacao-observacoes|melhorias\.html|fichas-revisao-)')


class Referencias(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.urls = []
        self.noindex = False
        self.documento = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'html':
            self.documento = True
        for name in ('href', 'src', 'poster', 'data-so-replica-src', 'action'):
            if attrs.get(name):
                self.urls.append(attrs[name])
        if tag == 'meta' and attrs.get('name', '').lower() == 'robots':
            self.noindex = 'noindex' in attrs.get('content', '').lower()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verificar():
    erros = []
    referencias = 0
    for pagina in PAGINAS:
        if not (PORTAL / 'conteudo' / f'{pagina}.html').is_file():
            erros.append(f'Página ausente: conteudo/{pagina}.html')
    for rel in ('index.html', 'assets/modo-visat.js', 'assets/pesquisa-visat.js',
                'assets/ponte.png', 'fichas/consulta-sites.html'):
        if not (PORTAL / rel).is_file():
            erros.append(f'Recurso ausente: {rel}')
    arquivos = sorted(p for p in PORTAL.rglob('*') if p.is_file())
    for path in arquivos:
        rel = path.relative_to(PORTAL).as_posix()
        if path.is_symlink():
            erros.append(f'Link simbólico não permitido no pacote: {rel}')
        if PRIVADOS.search(rel):
            erros.append(f'Ferramenta interna no pacote: {rel}')
        if path.suffix not in ('.html', '.css', '.js'):
            continue
        texto = path.read_text(encoding='utf-8')
        if PRIVADOS.search(texto):
            erros.append(f'Referência interna não publicável em {rel}')
        urls = []
        if path.suffix == '.html':
            parser = Referencias()
            parser.feed(texto)
            urls = parser.urls
            if parser.documento and not parser.noindex:
                erros.append(f'Página sem noindex: {rel}')
        elif path.suffix == '.css':
            urls = [m.strip(" \"'") for m in re.findall(r'url\(([^)]+)\)', texto)]
        for url in urls:
            if not url or url.startswith('#'):
                continue
            partes = urlsplit(url)
            if partes.scheme or partes.netloc:
                continue
            if not partes.path:
                continue
            referencias += 1
            target = (path.parent / unquote(partes.path)).resolve()
            if not target.is_relative_to(PORTAL.resolve()):
                erros.append(f'Caminho sai do pacote: {rel} → {partes.path}')
            elif not target.is_file():
                erros.append(f'Link local ausente: {rel} → {partes.path}')
    envio = PORTAL / 'fichas/js/envio-ficha.js'
    if envio.exists():
        texto = envio.read_text(encoding='utf-8')
        if re.search(r'script\.google\.com/macros|ENVIO_CHAVE|fetch\s*\(', texto):
            erros.append('A cópia de teste ainda contém o canal de envio de e-mail.')
    return erros, referencias, arquivos


def manifesto(arquivos):
    hashes = {p.relative_to(PORTAL).as_posix(): digest(p) for p in arquivos
              if p.name != 'versao.json' and '__pycache__' not in p.parts}
    agregado = hashlib.sha256(json.dumps(hashes, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    return {'formato': 1, 'versao': agregado[:16], 'sha256': agregado,
            'paginas': list(PAGINAS), 'arquivos': hashes}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--atualizar-versao', action='store_true')
    args = parser.parse_args()
    erros, referencias, arquivos = verificar()
    if erros:
        for erro in erros:
            print('ERRO:', erro, file=sys.stderr)
        return 1
    atual = manifesto(arquivos)
    path = PORTAL / 'versao.json'
    if args.atualizar_versao:
        path.write_text(json.dumps(atual, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    elif not path.is_file() or json.loads(path.read_text(encoding='utf-8')) != atual:
        print('ERRO: versão desatualizada. Rode com --atualizar-versao após as alterações.', file=sys.stderr)
        return 1
    print(f'OK: {len(PAGINAS)} páginas, {referencias} referências locais, versão {atual["versao"]}.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
