#!/usr/bin/env bash
# Atualização conjunta dos arquivos servidos por Pages/Sites e Connect.
set -euo pipefail
cd "$(dirname "$0")"

if [ "$#" -ne 1 ] || [ -z "$1" ]; then
  echo 'Uso: bash publicar.sh "Descrição da alteração"' >&2
  exit 1
fi
if [ "$(git branch --show-current)" != "main" ]; then
  echo 'Execute na branch main após conferir e integrar as alterações.' >&2
  exit 1
fi
if ! git diff --cached --quiet; then
  echo 'Há alterações já preparadas no Git. Conclua esse trabalho antes de publicar o portal.' >&2
  exit 1
fi
if command -v python3 >/dev/null 2>&1; then
  visat_python=python3
elif command -v python >/dev/null 2>&1; then
  visat_python=python
else
  echo 'Python 3.10 ou superior é necessário para preparar e conferir a cópia.' >&2
  exit 1
fi
git fetch origin main
if ! git merge-base --is-ancestor origin/main HEAD; then
  echo 'O GitHub tem alterações novas. Concilie-as antes de publicar; nenhum envio foi feito.' >&2
  exit 1
fi
"$visat_python" ferramentas/preparar-replica.py
"$visat_python" ferramentas/verificar-portal.py --atualizar-versao
if [ -n "$(git ls-files --others --exclude-standard -- portal site-visat ferramentas publicar.sh)" ]; then
  echo 'Há arquivos novos. Confira-os e faça a primeira inclusão com git add/commit antes da rotina automática.' >&2
  echo 'Nenhum commit ou envio foi feito.' >&2
  exit 1
fi
if command -v node >/dev/null 2>&1; then
  node ferramentas/testar-navegacao.cjs
fi
# Somente arquivos já rastreados das fontes conhecidas. Novos arquivos precisam
# ser conferidos e adicionados explicitamente; não usar git add -A.
git add -u -- portal site-visat ferramentas publicar.sh
if git diff --cached --quiet; then
  echo 'Nenhuma alteração para publicar.'
  exit 0
fi
git diff --cached --check
git commit -m "$1"
git push origin HEAD:main
echo 'Arquivos enviados ao GitHub. Confira a conclusão das duas publicações e compare versao.json.'
