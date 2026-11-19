#!/usr/bin/env python3
"""
Base local de estabelecimentos para o localizador do bloco "Empresa ou empregador".

Fonte: Receita Federal — Dados abertos do CNPJ (licença CC-BY), arquivos
Estabelecimentos0..9.zip, Empresas0..9.zip e Municipios.zip do mês mais recente.

Saída: data/empresas-locais/{ibge6}.json (um arquivo por município) e
data/empresas-locais/indice.json (municípios disponíveis).

Recorte (minimização de dados):
  - municípios de MUNICIPIOS (UF SC);
  - situação cadastral ativa (02), suspensa (03) ou inapta (04); baixadas e nulas ficam de fora;
  - campos: CNPJ, nome fantasia, razão social (sem CPF ao final, comum no MEI), CNAE principal e
    secundários, CEP, bairro, logradouro, número, complemento, matriz/filial e situação.
  - telefone e e-mail NÃO entram na base pública; o telefone vem da consulta online do CNPJ escolhido.

Uso:
  python scripts/gerar-base-empresas.py                 # baixa do repositório da Receita
  python scripts/gerar-base-empresas.py --pasta PASTA   # usa zips já baixados (mesmos nomes)
"""
import argparse, csv, io, json, os, re, sys, time, unicodedata, zipfile
from datetime import date
from xml.etree import ElementTree

MUNICIPIOS = ['FLORIANOPOLIS', 'SAO JOSE', 'PALHOCA', 'BIGUACU', 'SANTO AMARO DA IMPERATRIZ', 'GOVERNADOR CELSO RAMOS']
UF = 'SC'
SITUACOES = {'02': 'A', '03': 'S', '04': 'I'}  # ativa, suspensa, inapta

SHARE = os.environ.get('RFB_SHARE_TOKEN', 'gn672Ad4CF8N6TK')
BASE_DAV = 'https://arquivos.receitafederal.gov.br/public.php/webdav/Dados/Cadastros/CNPJ'
BASE_ARQ = 'https://arquivos.receitafederal.gov.br/public.php/dav/files/{share}/Dados/Cadastros/CNPJ/{mes}/{arq}'

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, 'data', 'empresas-locais')
csv.field_size_limit(10 ** 8)


def norm(t):
    t = unicodedata.normalize('NFD', str(t or '')).encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', t.upper()).strip()


def limpar(t):
    return re.sub(r'\s+', ' ', str(t or '')).strip()


CPF_FINAL = re.compile(r'[\s\-]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\s*$')


def sem_cpf(razao):
    return CPF_FINAL.sub('', razao).strip()


def mes_recente():
    import requests
    r = requests.request('PROPFIND', BASE_DAV + '/', auth=(SHARE, ''), headers={'Depth': '1'}, timeout=60)
    r.raise_for_status()
    ns = {'d': 'DAV:'}
    meses = sorted(m.group(1) for h in ElementTree.fromstring(r.content).findall('d:response', ns)
                   for m in [re.search(r'(\d{4}-\d{2})/?$', h.find('d:href', ns).text)] if m)
    if not meses:
        raise SystemExit('Nenhum mês encontrado no repositório da Receita.')
    return meses[-1]


def baixar(mes, arq, pasta):
    import requests
    destino = os.path.join(pasta, arq)
    if os.path.exists(destino) and os.path.getsize(destino) > 0:
        return destino
    url = BASE_ARQ.format(share=SHARE, mes=mes, arq=arq)
    for tentativa in range(5):
        try:
            with requests.get(url, stream=True, timeout=120) as r:
                r.raise_for_status()
                with open(destino + '.part', 'wb') as f:
                    for bloco in r.iter_content(1 << 20):
                        f.write(bloco)
            os.replace(destino + '.part', destino)
            print('baixado', arq, os.path.getsize(destino) // (1 << 20), 'MB', flush=True)
            return destino
        except Exception as erro:  # noqa: BLE001
            print('falha', arq, tentativa + 1, erro, flush=True)
            time.sleep(10 * (tentativa + 1))
    raise SystemExit('Não foi possível baixar ' + arq)


def linhas(caminho):
    with zipfile.ZipFile(caminho) as z:
        for nome in z.namelist():
            with z.open(nome) as f:
                yield from csv.reader(io.TextIOWrapper(f, encoding='latin-1', newline=''), delimiter=';', quotechar='"')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pasta', help='pasta com os zips já baixados')
    ap.add_argument('--mes', help='AAAA-MM (padrão: mais recente)')
    a = ap.parse_args()

    pasta = a.pasta or os.path.join(RAIZ, '.cache-rfb')
    os.makedirs(pasta, exist_ok=True)
    mes = a.mes or (None if a.pasta else mes_recente())
    obter = (lambda arq: os.path.join(pasta, arq)) if a.pasta else (lambda arq: baixar(mes, arq, pasta))
    print('mês de referência:', mes or 'arquivos locais', flush=True)

    # Município: código da Receita (TOM/SIAFI) -> IBGE pela tabela local do projeto.
    ibge_por_nome = {}
    for cod, nome, uf in json.load(open(os.path.join(RAIZ, 'data', 'municipios.json'), encoding='utf-8')):
        if uf == UF:
            ibge_por_nome[norm(nome)] = (cod, nome)
    alvos = {}
    for cod, nome in linhas(obter('Municipios.zip')):
        n = norm(nome)
        if n in MUNICIPIOS and n in ibge_por_nome:
            alvos[cod] = ibge_por_nome[n]
    # nomes repetidos em outras UFs são resolvidos depois pela UF do estabelecimento
    print('municípios:', {k: v[1] for k, v in alvos.items()}, flush=True)

    # Correspondência subclasse (Receita) -> classe da TB_CNAE do Sinan.
    corr = json.load(open(os.path.join(RAIZ, 'data', 'cnae-correspondencias.json'), encoding='utf-8'))['subclasses']

    por_mun = {k: [] for k in alvos}
    basicos = set()
    for i in range(10):
        for c in linhas(obter('Estabelecimentos%d.zip' % i)):
            if len(c) < 21 or c[19] != UF or c[20] not in alvos or c[5] not in SITUACOES:
                continue
            basicos.add(c[0])
            sec = [s for s in c[12].split(',') if s.strip()] if c[12] else []
            log = limpar((c[13] + ' ' + c[14]) if c[13] and not c[14].upper().startswith(c[13].upper()) else c[14])
            por_mun[c[20]].append([c[0] + c[1] + c[2], limpar(c[4]), c[0], c[11], sec, re.sub(r'\D', '', c[18]),
                                   limpar(c[17]), log, limpar(c[15]), limpar(c[16]), 1 if c[3] == '1' else 2,
                                   SITUACOES[c[5]]])
        print('estabelecimentos', i, sum(map(len, por_mun.values())), flush=True)

    razoes = {}
    for i in range(10):
        for c in linhas(obter('Empresas%d.zip' % i)):
            if c and c[0] in basicos:
                razoes[c[0]] = sem_cpf(limpar(c[1]))
        print('empresas', i, len(razoes), flush=True)

    os.makedirs(SAIDA, exist_ok=True)
    indice = []
    for cod, registros in por_mun.items():
        ibge, nome = alvos[cod]
        cnaes, bairros, logs = {}, {}, {}

        def idx(d, v):
            if v not in d:
                d[v] = len(d)
            return d[v]

        saida = []
        for cnpj, fant, basico, cnae, sec, cep, bairro, log, num, comp, mf, sit in registros:
            razao = razoes.get(basico, '')
            fant = sem_cpf(fant)
            saida.append([cnpj, fant if fant and fant != razao else '', razao, idx(cnaes, cnae),
                          [idx(cnaes, s) for s in sec], cep, idx(bairros, bairro), idx(logs, log), num, comp, mf, sit])
        saida.sort(key=lambda r: (r[1] or r[2]))
        lista_cnae = list(cnaes)
        doc = {
            'versao': 1,
            'fonte': 'Receita Federal — Dados abertos do CNPJ (CC-BY)',
            'referencia': mes or 'local',
            'gerado': date.today().isoformat(),
            'municipio': nome, 'uf': UF, 'ibge': ibge,
            'situacoes': {'A': 'Ativa', 'S': 'Suspensa', 'I': 'Inapta'},
            'campos': ['cnpj', 'fantasia', 'razao', 'cnae', 'secundarios', 'cep', 'bairro', 'logradouro',
                       'numero', 'complemento', 'matrizFilial', 'situacao'],
            'cnaes': lista_cnae,
            'cnaeSinan': [(corr.get(s.zfill(7)) or {}).get('codigos', []) for s in lista_cnae],
            'bairros': list(bairros), 'logradouros': list(logs),
            'registros': saida,
        }
        destino = os.path.join(SAIDA, ibge + '.json')
        with open(destino, 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        tam = os.path.getsize(destino)
        print(nome, len(saida), 'registros', tam // (1 << 20), 'MB', flush=True)
        if tam > 95 * (1 << 20):
            raise SystemExit('Arquivo acima do limite do GitHub: ' + destino)
        indice.append({'ibge': ibge, 'municipio': nome, 'uf': UF, 'registros': len(saida), 'bytes': tam})

    with open(os.path.join(SAIDA, 'indice.json'), 'w', encoding='utf-8') as f:
        json.dump({'referencia': mes or 'local', 'gerado': date.today().isoformat(),
                   'fonte': 'Receita Federal — Dados abertos do CNPJ (CC-BY)', 'municipios': indice},
                  f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
