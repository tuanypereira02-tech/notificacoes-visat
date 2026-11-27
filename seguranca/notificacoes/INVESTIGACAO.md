# Investigação do serviço Apps Script de envio — VISAT

Data da conferência: 27/11/2026.

## Conclusões confirmadas

1. O arquivo `Codigo.gs` incluído no ZIP enviado é o backend de **Observações da réplica do portal**. O seu `doGet` retorna a lista de observações e o `doPost` trata ações de criar, mover e editar comentários. Ele não contém `MailApp.sendEmail` e não é o serviço de envio das fichas.
2. O projeto Apps Script chamado **VISAT - Observações da réplica** é distinto do serviço de envio de fichas.
3. O projeto **Projeto sem título**, criado em 27/11, foi aberto no editor e contém apenas a função padrão `myFunction()`. Não é o serviço de envio.
4. A lista de projetos da conta Google atualmente conectada também mostra um projeto de 15/10 associado a uma planilha chamada **Cópia de Acidente de Trabalho - TODOS OS ANOS (Não mudar o nome da Planilha)**. O conteúdo desse projeto/planilha não foi aberto nem alterado; não há evidência suficiente para classificá-lo como serviço de envio.
5. Não foi localizado o código-fonte do serviço de e-mail nos ZIPs enviados, na branch `main`, nas branches de trabalho inspecionadas, nem nos arquivos do Drive pesquisados.
6. O JavaScript público de envio em `site-visat/js/envio-ficha.js` contém uma URL de implantação Apps Script e uma chave compartilhada no cliente. A chave deve ser considerada comprometida. Ela continua presente na `main`; não foi revogada porque o projeto proprietário da implantação não foi identificado e não há acesso administrativo confirmado.
7. Foram encontrados e-mails de teste enviados ao endereço de recebimento configurado no JavaScript, com cópia ao endereço do profissional. Foram conferidos apenas os metadados; o conteúdo dos PDFs/anexos não foi aberto.

## O que isso significa

O serviço de envio pode pertencer a outra conta Google, possivelmente à conta que administra o endereço de recebimento, ou a um projeto não compartilhado com a conta atualmente conectada. Isso é uma hipótese, não uma confirmação.

Não é seguro substituir, revogar ou editar o endpoint existente sem localizar o projeto proprietário e validar a continuidade do recebimento.

## Caminho sem interromper o portal

- Manter a versão atual publicada sem mudanças durante a investigação.
- Obter acesso administrativo ao projeto que publicou a URL de implantação atual, ou autorização da TI para um serviço institucional novo.
- Preparar o novo backend em projeto Apps Script separado para homologação e produção, com credenciais distintas.
- Validar dez fichas com dados fictícios, geração de PDF, protocolo, acesso restrito, recibo e bloqueio de homologação.
- Só então combinar a troca de endpoint com uma janela de implantação e plano de retorno.

## Correção paralela da busca de empresas

A busca de CNPJ/empregador foi tratada separadamente em uma PR draft: [PR #13 — Corrige busca de CNPJ e empregador nas fichas VISAT](https://github.com/tuanypereira02-tech/notificacoes-visat/pull/13).

A PR resolve os arquivos JSON de apoio a partir da URL do próprio script, aplica cache-busting e mantém a consulta online mesmo quando a base local não carrega. Está em rascunho e não foi mesclada. O teste real no Posit Connect e no formulário de Acidente de Trabalho ainda é obrigatório.

## Restrições mantidas

- Nenhuma alteração na branch `main`.
- Nenhuma publicação no Google Sites.
- Nenhuma republicação no Posit Connect.
- Nenhuma alteração ou exclusão em planilhas históricas.
- Nenhuma revogação da implantação existente sem confirmação de propriedade e plano de continuidade.
