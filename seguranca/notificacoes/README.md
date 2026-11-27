# Segurança do recebimento das notificações VISAT — versão isolada

**Estado:** rascunho técnico para homologação. Não implantado. Não conectado ao Google Sites nem à réplica.

## Por que esta pasta foi criada

A revisão do branch `main` identificou que `site-visat/js/envio-ficha.js` contém uma URL de Apps Script e uma chave compartilhada no JavaScript público. O arquivo é servido por GitHub Pages, portanto qualquer pessoa que abra a página pode inspecionar o código. A chave deve ser considerada comprometida e revogada no servidor; apagar o texto do repositório não invalida uma credencial já exposta.

O código `portal/fichas/js/envio-ficha.js` é uma cópia de homologação que gera PDF localmente e não envia e-mails. Ela deve continuar sendo a implementação da réplica.

O arquivo `backups/status-planilha-20261127/Codigo.gs` do ZIP enviado é o backend das observações da réplica, não o serviço de recebimento das fichas. O código do serviço de e-mail ainda precisa ser identificado e auditado.

## Arquitetura proposta

1. O profissional preenche uma das dez fichas no navegador.
2. O navegador mantém as validações existentes e gera o PDF localmente.
3. O navegador obtém um token Turnstile de uso único.
4. O cliente envia PDF, agravo, unidade/CNES, e-mail de recibo e chave de idempotência ao serviço institucional por HTTPS. Nenhum segredo de API fica no JavaScript.
5. O servidor valida o token no Siteverify, valida novamente os campos e verifica o limite de tamanho.
6. Em produção, o servidor grava o PDF em pasta restrita, gera protocolo e registra somente metadados operacionais na planilha de controle.
7. O profissional recebe somente o comprovante com protocolo, sem PDF e sem dados clínicos.
8. A equipe acompanha a situação da digitação no SINAN por acesso institucional restrito.

## Separação obrigatória dos ambientes

Criar **dois projetos Apps Script distintos**, sob titularidade institucional aprovada pela TI:

- `VISAT — Recebimento — HOMOLOGAÇÃO`: simula o protocolo, não armazena PDF, não envia e-mail e não recebe dados reais.
- `VISAT — Recebimento — PRODUÇÃO`: somente após aprovação, com pasta e planilha restritas, segredo Turnstile próprio e propriedade `PRODUCAO_LIBERADA=true`.

Não usar dois deployments do mesmo projeto para separar ambientes: as Script Properties são do projeto e podem ser compartilhadas entre deployments. Não reutilizar sitekey/secret Turnstile entre homologação e produção.

## Propriedades do Script

Configurar em **Project Settings → Script Properties**, nunca no código:

| Propriedade | Uso |
|---|---|
| `AMBIENTE` | `HOMOLOGACAO` ou `PRODUCAO` |
| `PRODUCAO_LIBERADA` | Manter `false` até aprovação formal |
| `TURNSTILE_SECRET` | Segredo do widget do ambiente |
| `TURNSTILE_HOSTNAME` | Hostname exato autorizado |
| `PASTA_PDF_ID` | Pasta restrita de PDFs; apenas produção |
| `PLANILHA_CONTROLE_ID` | Planilha restrita de metadados; apenas produção |

Restringir editores do projeto e proprietários dos recursos. A pasta e a planilha não podem ter compartilhamento por link, acesso público ou acesso amplo por domínio. A validação do código também verifica o nível geral de compartilhamento e falha de forma fechada.

## Metadados registrados

A planilha de controle contém somente: protocolo, data/hora de recebimento, slug do agravo, unidade, CNES, situação, ID interno do arquivo, hash de idempotência, situação do comprovante e código de correlação.

Não registrar nome, CPF, CNS, data de nascimento, diagnóstico, PDF, conteúdo da ficha ou e-mail do profissional nessa planilha. O PDF permanece em pasta restrita. O e-mail é usado somente para enviar o comprovante e não é gravado no registro de controle.

O prazo de guarda e a eliminação dos PDFs precisam seguir a tabela de temporalidade e a orientação da gestão documental/encarregado. Este rascunho **não implementa exclusão automática**.

## Limitações que precisam ser avaliadas pela TI

- O Apps Script Web App pode ser configurado para executar como a conta implantadora e permitir acesso anônimo. Isso dá ao serviço autoridade sobre os recursos dessa conta. A TI precisa aprovar a conta institucional, o escopo OAuth e o nível de acesso antes de qualquer deployment.
- A submissão externa pode exigir acesso anônimo; se a política do domínio não permitir, usar uma API institucional aprovada (preferencialmente Cloud Run/API Gateway com identidade de serviço, controles de rede e logs sem payload).
- Apps Script não oferece os mesmos controles de WAF, limites por IP, observabilidade e governança de infraestrutura de uma API institucional. Turnstile e limite por e-mail são camadas complementares, não substituem proteção de borda.
- Confirmar limites de tamanho, cotas e comportamento CORS com teste real no domínio do Google Sites. Se houver restrição, não contornar reduzindo controles; migrar o endpoint para infraestrutura institucional adequada.
- A planilha não deve ser usada como repositório clínico. O PDF é o registro sensível e deve permanecer no armazenamento institucional com ACL mínima.
- O código não autentica o profissional externo por identidade civil. O protocolo comprova recebimento técnico, não valida autoria, veracidade ou vínculo clínico da notificação.

## Estado do que não foi alterado

- Branch `main`: intacto.
- Google Sites: sem publicação e sem alteração nesta etapa.
- Posit Connect: sem alteração.
- Endpoint Apps Script atual: não revogado nem modificado porque o projeto de envio ainda não foi identificado.
- Sistema de observações da réplica: preservado.

## Bloqueios para implantação

1. Identificar e abrir o projeto Apps Script que publica o endpoint atual.
2. Exportar o código completo do projeto e seu manifesto.
3. Revogar a chave atualmente exposta e substituir a implantação atual, após validar a estratégia de contingência.
4. Confirmar com TI a conta institucional, armazenamento, planilha, grupo de acesso, domínio, cotas e política de retenção.
5. Criar e configurar os dois projetos separados.
6. Executar os testes de `TESTES.md` com dados fictícios.
7. Obter validação formal da TI, gestão VISAT e encarregado de dados.
8. Só então preparar a troca do endpoint de produção e a publicação oficial.

**Este pacote é código de preparação, não uma declaração de conformidade LGPD nem uma implantação em produção.**
