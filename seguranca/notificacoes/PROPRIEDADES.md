# Configuração de propriedades do Apps Script

Configurar no painel **Configurações do projeto → Propriedades do script**. Não inserir valores reais neste arquivo, no GitHub ou em mensagens.

| Propriedade | HOMOLOGAÇÃO | PRODUÇÃO |
|---|---|---|
| `AMBIENTE` | `HOMOLOGACAO` | `PRODUCAO` |
| `PRODUCAO_LIBERADA` | `false` | `false` até aprovação |
| `TURNSTILE_SECRET` | segredo exclusivo de teste | segredo exclusivo de produção |
| `TURNSTILE_HOSTNAME` | hostname de homologação | hostname oficial validado |
| `PASTA_PDF_ID` | não usada | ID da pasta restrita |
| `PLANILHA_CONTROLE_ID` | não usada | ID da planilha restrita |

Na homologação, o código valida o token e simula o protocolo em cache. Não grava PDFs, não cria linhas em planilhas e não envia e-mails.

Na produção, o serviço permanece bloqueado enquanto `PRODUCAO_LIBERADA` não for exatamente `true`. Não habilitar essa propriedade sem aprovação formal.

A configuração deve ser feita em **projetos Apps Script separados**. As Script Properties pertencem ao projeto e não devem ser compartilhadas entre homologação e produção.
