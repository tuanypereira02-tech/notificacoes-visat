# Atualização conjunta do Portal VISAT

## Fonte editável

O repositório tuanypereira02-tech/notificacoes-visat, branch main, reúne as fontes:

- portal/conteudo/: páginas do portal. A mesma página atende ao Sites e à réplica.
- portal/assets/: estilos e navegação compartilhados.
- site-visat/: fonte das fichas já utilizadas no Google Sites.
- portal/fichas/: cópia gerada das fichas para teste; não editar diretamente.

As dez páginas de conteúdo partem da réplica com os ajustes visuais recuperados
do Google Sites. “Como notificar” é uma rota para as fichas. O Início conserva os
cartões, logos e seis blocos de ajustes identificados no HTML publicado do Sites.
Os logos foram extraídos para arquivos separados, sem alteração das imagens.

As observações da equipe, o plano de melhorias, arquivos preenchidos e backups
não fazem parte deste pacote público. O sistema anterior de comentários permanece
no ambiente de revisão existente; não será sincronizado por este pacote.

## Implantação inicial

### GitHub Pages

Preservar a publicação existente do repositório inteiro. Não trocar a raiz do
Pages para portal/, pois site-visat/ e os outros endereços existentes precisam
continuar disponíveis.

Base: https://tuanypereira02-tech.github.io/notificacoes-visat/portal/

### Google Sites

Em cada página existente, a incorporação deve apontar para a URL correspondente,
com o parâmetro modo=oficial. Menu, permissões e publicação do Google Sites
continuam próprios do Sites. Conferir a substituição no rascunho.

| Página | Arquivo depois de portal/ |
| --- | --- |
| Início | conteudo/index.html?modo=oficial |
| Como notificar | Manter a incorporação atual de site-visat/consulta-sites.html e seus parâmetros |
| Acidentes de trabalho | conteudo/acidentes.html?modo=oficial |
| Doenças do trabalho | conteudo/doencas.html?modo=oficial |
| Denúncias | conteudo/denuncias.html?modo=oficial |
| Inspeções | conteudo/inspecoes.html?modo=oficial |
| Legislação | conteudo/legislacao.html?modo=oficial |
| Materiais e cursos | conteudo/materiais.html?modo=oficial |
| Contatos | conteudo/contatos.html?modo=oficial |
| Dados e indicadores | conteudo/dados.html?modo=oficial |
| Conheça a VISAT | conteudo/conheca.html?modo=oficial |

O modo oficial oculta o menu e o aviso da réplica. A pesquisa aponta para as
páginas do Google Sites. O parâmetro é de apresentação, não de controle de acesso.

Conferir altura e rodapé no editor. O conteúdo tem um rodapé com a ponte;
conservar apenas um rodapé no resultado. CSS interno não controla a altura
externa do Google Sites. A navegação na mesma aba depende das permissões do
quadro; quando bloqueada, o link oficial deve oferecer abertura em nova aba.

Após substituir a incorporação por URL e publicar, alterações nos arquivos
hospedados passam a aparecer sem nova publicação do Sites. Mudanças na estrutura
do próprio Sites continuam exigindo publicação.

### Posit Connect Cloud

Configuração pretendida do item de réplica:

| Campo | Valor |
| --- | --- |
| Framework | Static Document / Static Files |
| Repository | tuanypereira02-tech/notificacoes-visat |
| Branch | main |
| Primary file | portal/index.html |
| Automatically publish on push | Ativado |

A pasta portal/ inclui páginas, assets e fichas de teste. Funciona servida como
raiz, mantendo /conteudo/acidentes.html, e sob /portal/ no Pages. O GitHub App do
Connect precisa ter acesso ao repositório para republicação automática.

Inspecionar primeiro o item existente e suas opções de Source. Republicar um
item mantém seu endereço. A possibilidade de converter a fonte de upload para
GitHub precisa ser confirmada na interface. Não apagar a publicação anterior
para testar. O painel de dados/indicadores continua na publicação própria.

## Atualização cotidiana

No início do trabalho, com a cópia local limpa:

    git switch main
    git pull --ff-only

Editar portal/conteudo/, portal/assets/ ou site-visat/, conforme o componente.
Para preparar a réplica, conferir os arquivos e enviar:

    bash publicar.sh "Descrição da alteração"

Requisitos: Git, Python 3.10 ou superior e, no Windows, Git Bash. Node executa a
verificação adicional de navegação quando instalado. O script não muda horários,
identidades do Git ou configurações de hospedagem. Datas dos commits continuam
fazendo parte do histórico.

O comando exige main e staging inicialmente vazio, recusa envio quando o remoto
tem mudanças ainda não conciliadas e só prepara arquivos já rastreados. Novos
arquivos exigem adição explícita após conferência.

Para conferir sem enviar:

    python3 ferramentas/preparar-replica.py --check
    python3 ferramentas/verificar-portal.py
    node ferramentas/testar-navegacao.cjs
    python3 ferramentas/testar-replica.py

As implantações são independentes; não há garantia de atualização no mesmo
segundo. Conferir o campo versao em:

- Pages: https://tuanypereira02-tech.github.io/notificacoes-visat/portal/versao.json
- Connect: endereço da réplica seguido de /versao.json.

Valores iguais indicam o mesmo conjunto preparado. Também conferir conclusão
da publicação em cada host e eventual cache do navegador.

## Fichas de teste

A geração usa site-visat/ como fonte, remove o canal de envio e força
homologação. A cópia permite preencher, validar e baixar PDF de homologação.
Não envia fichas por e-mail, mesmo alterando a query string. Use dados fictícios.

O fluxo oficial existente não foi alterado pela unificação. Recebimento
institucional, protocolo, acesso, registros e guarda dos dados precisam de
validação própria; a organização das páginas não substitui essa análise.

A cópia contém formulários, PDF e tabelas locais, mas ainda depende de serviços
externos para certas consultas opcionais de CBO, CID, CEP e CNPJ, fontes e
referências. Ver portal/fichas/README.md. Não é totalmente offline.

## Importação pontual

montar-portal.py importa uma réplica antiga para conferência. Não é o comando
cotidiano de publicação. Exige origem completa e destino novo:

    python3 ferramentas/montar-portal.py --origem CAMINHO/site --output CAMINHO/importacao-nova

Recusa destino existente e nunca substitui portal/. Comparar antes de integrar
para evitar reintroduzir textos antigos.

## Referências de configuração

- [Connect — publicação pelo GitHub](https://docs.posit.co/connect-cloud/user/publish/github.html)
- [Connect — Source e configurações](https://docs.posit.co/connect-cloud/user/manage/content_settings.html)
- [Connect — republicação](https://docs.posit.co/connect-cloud/user/manage/portfolio.html)
- [Google Sites — incorporar por URL](https://support.google.com/sites/answer/90569?hl=pt-BR)
