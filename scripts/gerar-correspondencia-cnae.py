"""Gera o mapa auditável IBGE → TB_CNAE. Uso: python script.py PASTA_FONTES.
Dependências: pandas, xlrd, openpyxl. Fontes e hashes ficam no JSON gerado.
Não escolhe arbitrariamente entre atividades e não corrige códigos da TB_CNAE.
"""
import collections
import hashlib
import json
import pathlib
import re
import sys
import pandas as pd

root = pathlib.Path(__file__).resolve().parents[1]
fontes = pathlib.Path(sys.argv[1])
urls = {'classes20-correspondencias.xls': 'https://concla.ibge.gov.br/images/concla/downloads/revisao2007/PropCNAE20/CNAE20_Correspondencias.xls', 'subclasses23.xlsx': 'https://concla.ibge.gov.br/images/concla/documentacao/CNAE_Subclasses_2_3_Estrutura_Detalhada.xlsx', 'correspondencias23.xlsx': 'https://concla.ibge.gov.br/images/concla/documentacao/CNAE_Subclasses_2_3_Tabelas_de_correspond%C3%AAncia.xlsx', 'correspondencias22.xls': 'https://concla.ibge.gov.br/images/concla/downloads/corresp-cnae-sub-2-2x2-1--2-1x2-2-preferenciais.xls', 'correspondencias21.xls': 'https://concla.ibge.gov.br/images/concla/downloads/revisao2007/prop_cnae21/cnae21_correspondencias.xls', 'correspondencias20.xls': 'https://concla.ibge.gov.br/images/concla/downloads/revisao2007/PropCNAE20/CNAE20_Subclasses_Correspondencias.xls', 'classes10.xls': 'https://concla.ibge.gov.br/images/concla/downloads/CNAE1.0.xls'}

def codigo(valor, tamanho):
    s = str(valor).strip()
    if not re.fullmatch(r'[\d./\-]+', s):
        return None
    n = re.sub(r'\D', '', s)
    return n if len(n) == tamanho else None

def ler(nome, folha, origem, destino, tamanho):
    mapa = collections.defaultdict(set)
    for _, row in pd.read_excel(fontes / nome, folha, header=None).fillna('').iterrows():
        a, b = codigo(row[origem], tamanho), codigo(row[destino], tamanho)
        if a:
            mapa[a]  # preserva subclasses explicitamente sem antecedente
            if b:
                mapa[a].add(b)
    return mapa

etapas = [ler('correspondencias23.xlsx',0,0,1,7),
          ler('correspondencias22.xls',0,1,3,7),
          ler('correspondencias21.xls',3,1,3,7),
          ler('correspondencias20.xls',0,1,3,7)]
classes = ler('classes20-correspondencias.xls',0,1,3,5)
estrutura = {codigo(r[4],7) for _,r in pd.read_excel(fontes/'subclasses23.xlsx',header=None).fillna('').iterrows()}
estrutura.discard(None)
# A estrutura XLSX termina antes da última subclasse. União com a tabela oficial.
# A API oficial vigente exclui dois códigos excedentes nas planilhas históricas.
api = json.loads((fontes/'subclasses-api.json').read_text())
universo = {str(r['id']).zfill(7) for r in api}
assert universo <= estrutura | set(etapas[0])
urls['subclasses-api.json'] = 'https://servicodados.ibge.gov.br/api/v2/cnae/subclasses'
tb = json.loads((root/'data/cnae-sinan.json').read_text())
permitidos = {r[0] for r in tb['classes']}
registros = {}
for origem in sorted(universo):
    atuais = {origem}
    completo = True
    for etapa in etapas:
        if any(not etapa.get(n) for n in atuais):
            completo = False
        atuais = set().union(*(etapa.get(n, set()) for n in atuais)) if atuais else set()
    antigos = {n[:5] for n in atuais}
    metodo = 'subclasses_2.3_2.2_2.1_2.0_fiscal1.1'
    if not completo:
        # Classe é mais ampla: apenas sugestão para revisão, nunca autopreenchimento.
        antigos |= classes.get(origem[:5], set())
        metodo = 'classe_2.0_1.0_revisao'
    validos = sorted(antigos & permitidos)
    ausentes = sorted(antigos - permitidos)
    registros[origem] = {'codigos': validos, 'ausentes': ausentes,
                         'automatico': completo and len(antigos)==1 and not ausentes,
                         'metodo': metodo}
assert all(set(r['codigos']) <= permitidos for r in registros.values())
assert registros['8531700']['codigos'] == ['80314']
assert registros['8532500']['codigos'] == ['80322']
assert not registros['6201501']['automatico']
assert registros['1621800']['ausentes'] == ['20214']
assert registros['9900800']['ausentes'] == ['99007']
resultado = {
 'versao':'20261117-correspondencia-ibge',
 'destino':'TB_CNAE extraída do SQL fornecido, sem alteração dos códigos',
 'fontes': [{'arquivo':p.name,'url':urls.get(p.name), 'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(list(fontes.glob('*.xls*')) + [fontes/'subclasses-api.json'])],
 'ressalvas':[
 'Composição de correspondências pode ampliar candidatos. Casos múltiplos exigem seleção da atividade.',
 'Lacunas das planilhas de subclasses usam a classe oficial apenas como sugestão, sem preenchimento automático.',
 'CNAE 1.0 20214 está ausente da TB_CNAE fornecida. O código 16218 nela possui descrição semelhante, mas não foi tratado como equivalente sem confirmação.',
 'CNAE 1.0 99007 está ausente da TB_CNAE fornecida.'
 ],
 'resumo':{'subclasses':len(registros),'automaticas':sum(r['automatico'] for r in registros.values()),'revisao':sum(not r['automatico'] for r in registros.values())},
 'subclasses':registros
}
(root/'data/cnae-correspondencias.json').write_text(json.dumps(resultado,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(resultado['resumo']))
