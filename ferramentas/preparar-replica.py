#!/usr/bin/env python3
"""Gera portal/fichas/ a partir de site-visat/, com PDF de teste e sem envio.

Uso: python3 ferramentas/preparar-replica.py [--check]
Só copia a lista explícita de arquivos rastreados abaixo. Não edite a saída:
as fichas continuam tendo site-visat/ como fonte. --check não escreve arquivos.
"""
from __future__ import annotations

import argparse
import hashlib
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import unquote, urlsplit
import uuid


ROOT = Path(__file__).resolve().parent.parent
FILES = (
    "consulta-sites.html", "formularios-inline-teste.html",
    "assets/moldura-visat.css", "assets/pagina-visat.css", "assets/ponte.png",
    "assets/portal-search.css", "assets/portal-search.js", "assets/rotulos-de-duracao.js",
    "css/teste/compacto-homologacao.css", "css/teste/ficha.css",
    "css/teste/localizador-empregador.css", "css/teste/modelo-final.css",
    "data/agravos.json", "data/cbo-datasus-adicional.json", "data/cid-at.json",
    "data/cid-dart.json", "data/cnae-correspondencias.json", "data/cnae-sinan.json",
    "data/cnes-atendimento.json", "data/cnes-florianopolis.json", "data/direcionamentos.json",
    "data/empresas-visat.json", "data/municipios.json",
    "js/envio-ficha.js", "js/vendor/pdf-lib.min.js",
    "js/teste/ajustes-replica.js", "js/teste/app.js",
    "js/teste/autopreenchimento-listas.js", "js/teste/autopreenchimento.js",
    "js/teste/balanceador-linhas.js", "js/teste/causas-acidente-dados.js",
    "js/teste/cid-qualificado.js", "js/teste/coerencia-ficha.js", "js/teste/datas-limite.js",
    "js/teste/formulario-acidente.js", "js/teste/layout-ficha.js",
    "js/teste/localizador-empregador.js", "js/teste/teclado-listas.js",
)
ROUTES = {
    "inicio": "index.html", "como-notificar": "como-notificar.html",
    "acidentes-de-trabalho": "acidentes.html", "doencas-do-trabalho": "doencas.html",
    "denúncias": "denuncias.html", "inspecoes": "inspecoes.html",
    "legislacao": "legislacao.html", "materiais-e-cursos": "materiais.html",
    "contatos": "contatos.html", "dados-e-indicadores": "dados.html",
    "conheça-a-visat": "conheca.html",
}
EXTERNAL = [
    "Google Fonts: tipografia, com fallback Roboto/Arial/sans-serif.",
    "raw.githubusercontent.com: CSV de CBO e consulta genérica de CID-10.",
    "ViaCEP: consulta opcional de CEP/endereço.",
    "BrasilAPI, publica.cnpj.ws e fichario.app: consultas cadastrais opcionais de empresas.",
    "Links de referência (SINAN, CELK e demais serviços) abrem serviços externos.",
]
FORBIDDEN = re.compile(
    rb"script\.google\.com|(?:apps-script\.)?script\.googleusercontent\.com|"
    rb"apps-script\.googleusercontent\.com|ENVIO_(?:URL|CHAVE)|"
    rb"observacoes\.js|melhorias\.html", re.I
)
CPF_IN_NAME = re.compile(r"(?<!\d)\d{3}[. ]?\d{3}[. ]?\d{3}[- ]?\d{2}(?!\d)")
MESSAGE = "Esta réplica não envia fichas por e-mail. Use somente dados fictícios; o PDF é de homologação."
BOOTSTRAP = """/* Gerado: modo de teste obrigatório, antes dos demais scripts. */
(function () {
  'use strict';
  window.VISAT_REPLICA_SEM_ENVIO = true;
  window.VISAT_MODELO_FINAL_TODAS = true;
  var url = new URL(window.location.href);
  url.searchParams.set('escopo', 'visat');
  url.searchParams.set('homologacao', '1');
  if (url.href === window.location.href) return;
  try { window.history.replaceState(null, '', url.href); }
  catch (erro) { window.location.replace(url.href); }
})();
"""
REPLICA_CSS = """.visat-aviso-replica{box-sizing:border-box;padding:12px 18px;background:#fff0df;color:#283747;border-bottom:2px solid #cc6a00;font:16px/1.45 Roboto,Arial,sans-serif}
.visat-aviso-replica p{margin:4px 0}.visat-aviso-replica a{color:#112c45;font-weight:700}
@media print{.visat-aviso-replica{display:none}}
"""


class ReplicaError(RuntimeError):
    pass


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise ReplicaError(f"A fonte mudou em {label}; revise a transformação antes de publicar.")
    return text.replace(old, new, 1)


def read_sources(root: Path) -> dict[str, bytes]:
    tracked = set(subprocess.check_output(
        ["git", "ls-files", "-z", "--", "site-visat/"], cwd=root
    ).decode().split("\0"))
    result = {}
    source = root / "site-visat"
    for name in FILES:
        file = source / name
        if f"site-visat/{name}" not in tracked or not file.is_file():
            raise ReplicaError(f"Fonte obrigatória ausente ou não rastreada: site-visat/{name}")
        if file.is_symlink() or file.resolve() != source.resolve() / name:
            raise ReplicaError(f"Link simbólico não permitido na fonte: {name}")
        result[name] = file.read_bytes()
    # Não misturar versões caso outro processo edite as fontes durante a leitura.
    if any((source / name).read_bytes() != data for name, data in result.items()):
        raise ReplicaError("A fonte mudou durante a leitura. Execute novamente após concluir a edição.")
    validate_company_data(result["data/empresas-visat.json"])
    for name, data in result.items():
        if name.endswith(".json"):
            json.loads(data)
    return result


def validate_company_data(data: bytes) -> None:
    records = json.loads(data)
    if not isinstance(records, list) or any(not isinstance(row, list) or len(row) < 13 for row in records):
        raise ReplicaError("Formato inesperado da tabela empresarial; a cópia foi interrompida.")
    if any(CPF_IN_NAME.search(str(row[col])) for row in records for col in (1, 2, 3)):
        raise ReplicaError("A tabela empresarial contém padrão de CPF no nome/razão social; nenhuma cópia foi publicada.")


def safe_pdf_module(source: str) -> str:
    # Só dois trechos com responsabilidade local são reaproveitados. Nunca copiar
    # o cabeçalho, a função enviar() nem a janela de envio da implementação oficial.
    pdf = re.search(r"  async function gerarPdf\(area, rodape\) \{.*?(?=  async function enviar\()", source, re.S)
    subject = re.search(r"  function montarAssunto\(agravo, unidade, cnes\) \{.*?(?=  let janela;)", source, re.S)
    if not pdf or not subject:
        raise ReplicaError("A estrutura de envio-ficha.js mudou; revise a extração segura do PDF.")
    local = replace_once(pdf.group(), "  async function gerarPdf(area, rodape) {",
                         "  async function gerarPdf(area, rodape) {\n    rodape = 'HOMOLOGAÇÃO — RÉPLICA PARA TESTES';", "gerarPdf")
    local = replace_once(local, "pdf.setTitle(titulo);", "pdf.setTitle('HOMOLOGAÇÃO — ' + titulo);", "título do PDF")
    code = (
        "/* Gerado de site-visat/js/envio-ficha.js: somente PDF local; envio indisponível. */\n"
        "(function () {\n  'use strict';\n"
        "  const DESTINO_EXIBIDO = 'Envio desativado na réplica';\n"
        "  const PREFIXO_ASSUNTO = '[HOMOLOGAÇÃO VISAT]';\n" + local + subject.group() +
        "  function abrirJanela({ retorno } = {}) {\n"
        f"    const mensagem = {json.dumps(MESSAGE, ensure_ascii=False)};\n"
        "    if (retorno) { retorno.textContent = mensagem; retorno.hidden = false; }\n"
        "    return false;\n  }\n"
        "  window.VisatEnvio = { gerarPdf, baixar, abrirJanela, montarAssunto, DESTINO_EXIBIDO, PREFIXO_ASSUNTO };\n"
        "})();\n"
    )
    if re.search(r"\b(fetch|XMLHttpRequest|sendBeacon|WebSocket)\b|https?://", code):
        raise ReplicaError("O módulo local de PDF contém acesso de rede inesperado.")
    return code


def local_search(source: str) -> str:
    old = "a.href='https://sites.google.com/view/visat-sms-pmf/'+encodeURIComponent(slug);a.target='_top';"
    new = "a.href='../conteudo/'+" + json.dumps(ROUTES, ensure_ascii=False, separators=(",", ":")) + "[slug];a.target='_self';"
    return replace_once(source, old, new, "navegação da pesquisa")


def test_only_copy(text: str) -> str:
    text = re.sub(r'<a\b[^>]*href=[\"\']mailto:[^\"\']+[\"\'][^>]*>.*?</a>',
                  'envio desativado na réplica', text, flags=re.I | re.S)
    text = re.sub(r'<p>Ao concluir, baixe o arquivo em PDF e encaminhe-o para o e-mail .*?</p>',
                  '<p>Ao concluir, baixe o PDF de homologação. Esta réplica não envia fichas.</p>', text, flags=re.S)
    replacements = {
        "Os dados ficam neste navegador. Baixe o PDF e encaminhe para o e-mail indicado.":
            "Use dados fictícios. O PDF é de homologação e não deve ser encaminhado como notificação.",
        "Os dados ficam somente neste navegador · O encaminhamento é feito pelo e-mail institucional da VISAT":
            "Réplica para testes · PDF de homologação · Envio desativado",
        "O PDF e o e-mail saem marcados como HOMOLOGAÇÃO.":
            "O PDF sai marcado como HOMOLOGAÇÃO. O envio por e-mail está desativado.",
        "enviarEmail.textContent = 'Enviar por e-mail';":
            "enviarEmail.textContent = 'Envio desativado na réplica';",
        "titulo.textContent = 'Enviar ou baixar a ficha';":
            "titulo.textContent = 'Baixar ficha de homologação';",
        "O PDF é anexado automaticamente ao abrir a janela de e-mail.": MESSAGE,
        "'Cada campo mostra somente o valor informado. Encaminhar este PDF ao e-mail institucional ' + VISAT_EMAIL + '.'":
            "'Cada campo mostra somente o valor informado. PDF de homologação; não encaminhar como notificação.'",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


class Resources(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "script":
            self.scripts.append(values)
        if tag in {"script", "img", "iframe", "source", "video", "audio", "object", "link"}:
            value = values.get("src") or values.get("data") or (values.get("href") if tag == "link" else None)
            if value:
                self.refs.append(value)


def assert_local_resource(bundle: dict[str, bytes], origin: str, value: str) -> None:
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or not parsed.path:
        return
    path = PurePosixPath(origin).parent / unquote(parsed.path)
    # Recursos executáveis/mídia nunca devem sair da cópia; links de navegação
    # são verificados pelo portal, não entram nesta lista de recursos.
    if path.is_absolute() or ".." in path.parts or str(path) not in bundle:
        raise ReplicaError(f"Recurso local ausente ou fora da cópia: {origin} → {value}")


def validate_bundle(bundle: dict[str, bytes]) -> None:
    for name, data in bundle.items():
        if name.endswith((".js", ".html", ".css", ".json", ".md")):
            if FORBIDDEN.search(data):
                raise ReplicaError(f"Destino de envio ou recurso interno proibido na réplica: {name}")
        if name.endswith(".html"):
            parser = Resources()
            parser.feed(data.decode())
            if any(not item.get("src") for item in parser.scripts):
                raise ReplicaError(f"Script inline inesperado: {name}")
            if any(urlsplit(item["src"]).scheme or urlsplit(item["src"]).netloc for item in parser.scripts):
                raise ReplicaError(f"Script externo inesperado: {name}")
            for value in parser.refs:
                assert_local_resource(bundle, name, value)
        if name.endswith(".css"):
            for value in re.findall(r"url\(\s*['\"]?([^)'\"]+)", data.decode()):
                assert_local_resource(bundle, name, value)
        if name.endswith(".js") and "vendor/" not in name:
            # fetch/carregarJSON resolvem relativamente à página, não ao arquivo JS.
            for _, value in re.findall(r"(?:fetch|carregarJSON)\(\s*(['\"])(.*?)\1", data.decode()):
                if value.startswith(("data/", "formularios-")):
                    if value == "data/cid-":  # concatenação controlada: at e dart
                        for variant in ("data/cid-at.json", "data/cid-dart.json"):
                            assert_local_resource(bundle, "consulta-sites.html", variant)
                    else:
                        assert_local_resource(bundle, "consulta-sites.html", value)
    validate_company_data(bundle["data/empresas-visat.json"])
    parser = Resources()
    parser.feed(bundle["consulta-sites.html"].decode())
    if not parser.scripts or parser.scripts[0] != {"src": "assets/replica-fichas.js"}:
        raise ReplicaError("O modo de teste deve executar antes de todos os demais scripts.")
    module = bundle["js/envio-ficha.js"].decode()
    if re.search(r"\b(fetch|XMLHttpRequest|sendBeacon|WebSocket)\b|https?://", module):
        raise ReplicaError("O módulo de PDF da réplica não pode enviar dados pela rede.")


def prepare_bundle(root: Path = ROOT) -> dict[str, bytes]:
    sources = read_sources(root)
    bundle = dict(sources)
    bundle["js/envio-ficha.js"] = safe_pdf_module(sources["js/envio-ficha.js"].decode()).encode()
    bundle["assets/portal-search.js"] = local_search(sources["assets/portal-search.js"].decode()).encode()
    for name in ("consulta-sites.html", "formularios-inline-teste.html", "js/teste/formulario-acidente.js"):
        bundle[name] = test_only_copy(bundle[name].decode()).encode()
    html = bundle["consulta-sites.html"].decode()
    # Mantém as APIs cadastrais, remove todos os destinos de envio da CSP.
    html = re.sub(r"https://(?:script\.google\.com|(?:apps-script\.)?script\.googleusercontent\.com|apps-script\.googleusercontent\.com)/?[^\s;\"]*\s*", "", html)
    csp = re.search(r'<meta\s+http-equiv="Content-Security-Policy"[^>]*>', html, re.I)
    if not csp:
        raise ReplicaError("A fonte não contém a política de segurança esperada.")
    html = html[:csp.end()] + '\n  <script src="assets/replica-fichas.js"></script>' + html[csp.end():]
    inline_styles = re.findall(r"<style\b[^>]*>(.*?)</style>", html, re.S | re.I)
    html = re.sub(r"<style\b[^>]*>.*?</style>", "", html, flags=re.S | re.I)
    html = replace_once(html, "</head>", '<meta name="robots" content="noindex,nofollow">\n<link rel="stylesheet" href="assets/replica-fichas.css">\n</head>', "cabeçalho")
    html = replace_once(html, "<title>", "<title>RÉPLICA PARA TESTES · ", "título")
    banner = ('<aside class="visat-aviso-replica" role="note"><strong>RÉPLICA PARA TESTES</strong>'
              f'<p>{escape(MESSAGE)}</p><a href="../conteudo/index.html">← Voltar ao portal de testes</a></aside>')
    html = replace_once(html, "<body>", "<body>\n" + banner, "início da página")
    bundle["consulta-sites.html"] = html.encode()
    bundle["assets/replica-fichas.js"] = BOOTSTRAP.encode()
    bundle["assets/replica-fichas.css"] = (REPLICA_CSS + "\n".join(inline_styles)).encode()
    bundle["README.md"] = (
        "# Fichas da réplica VISAT\n\n"
        "Saída gerada por `python3 ferramentas/preparar-replica.py`. Não editar aqui. "
        "A fonte dos formulários e tabelas continua em `site-visat/`.\n\n"
        "Preenchimento, validações e PDF funcionam nesta cópia. O modo de homologação "
        "é obrigatório e o envio está desativado: o código de envio, a chave e seu "
        "endereço não são copiados. O PDF recebe título e rodapé de homologação.\n\n"
        "Os arquivos de execução locais estão incluídos; isto não é uma aplicação "
        "totalmente offline. Dependências externas preservadas:\n\n" +
        "".join(f"- {item}\n" for item in EXTERNAL) +
        "\nA tabela empresarial rastreada é preservada; a geração recusa padrão de CPF "
        "nos campos de nome/razão social. Não incluir fichas preenchidas nesta pasta.\n\n"
        "Verificação sem alterar arquivos: `python3 ferramentas/preparar-replica.py --check`.\n"
    ).encode()
    # Normaliza apenas espaços de formatação da cópia de código, sem alterar
    # tabelas JSON ou imagens. A fonte oficial permanece byte a byte intacta.
    for name, data in list(bundle.items()):
        if name.endswith((".html", ".js", ".css")):
            lines = [line.rstrip(" \t\r") for line in data.decode().splitlines()]
            bundle[name] = ("\n".join(lines).rstrip("\n") + "\n").encode()
    manifest = {
        "formato": 1, "origem": "site-visat/", "modo": "replica-sem-envio",
        "fontes_sha256": {f"site-visat/{name}": sha(data) for name, data in sorted(sources.items())},
        "arquivos_sha256": {name: sha(data) for name, data in sorted(bundle.items())},
        "dependencias_externas": EXTERNAL,
    }
    bundle["manifesto-replica.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
    validate_bundle(bundle)
    return bundle


def check_directory(destination: Path, expected: dict[str, bytes]) -> None:
    if destination.is_symlink() or not destination.is_dir():
        raise ReplicaError("A cópia portal/fichas/ ainda não existe ou não é um diretório regular.")
    actual = {}
    for file in destination.rglob("*"):
        if file.is_symlink():
            raise ReplicaError("Link simbólico inesperado na cópia das fichas.")
        if file.is_file():
            actual[file.relative_to(destination).as_posix()] = file.read_bytes()
    validate_bundle(actual)
    changed = sorted(name for name in set(actual) | set(expected) if actual.get(name) != expected.get(name))
    if changed:
        raise ReplicaError("Cópia desatualizada ou divergente: " + ", ".join(changed[:12]))


def install_bundle(destination: Path, bundle: dict[str, bytes]) -> None:
    """Valida antes de substituir. Se a instalação falhar, restaura a cópia anterior."""
    validate_bundle(bundle)
    if destination.is_symlink() or (destination.exists() and not destination.is_dir()):
        raise ReplicaError("O destino deve ser um diretório regular.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".fichas-stage-", dir=destination.parent))
    backup = destination.with_name(".fichas-backup-" + uuid.uuid4().hex)
    installed = False
    try:
        for name, data in bundle.items():
            file = staging / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(data)
        check_directory(staging, bundle)
        if destination.exists():
            destination.rename(backup)
        try:
            staging.rename(destination)
            installed = True
        except BaseException:
            if backup.exists() and not destination.exists():
                backup.rename(destination)
            raise
    finally:
        if staging.exists():
            shutil.rmtree(staging)
        if installed and backup.exists():
            shutil.rmtree(backup)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="confere a cópia sem escrever")
    args = parser.parse_args()
    try:
        bundle = prepare_bundle()
        destination = ROOT / "portal" / "fichas"
        if args.check:
            check_directory(destination, bundle)
            print(f"OK: {len(bundle)} arquivos da réplica correspondem à fonte; envio desativado.")
        else:
            install_bundle(destination, bundle)
            size = sum(map(len, bundle.values()))
            print(f"OK: portal/fichas/ gerado ({len(bundle)} arquivos, {size:,} bytes); site-visat/ preservado.")
        return 0
    except (ReplicaError, OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f"ERRO: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
