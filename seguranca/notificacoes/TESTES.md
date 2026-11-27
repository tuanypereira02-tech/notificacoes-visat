# Plano de testes de segurança — recebimento VISAT

Executar exclusivamente em HOMOLOGAÇÃO e com dados fictícios.

## Testes funcionais

- [ ] As dez fichas geram PDF localmente.
- [ ] O cliente envia somente o slug do agravo, unidade, CNES, e-mail de recibo, PDF e token antirobô.
- [ ] O servidor retorna protocolo de homologação.
- [ ] O protocolo repetido com a mesma chave de idempotência não gera um segundo protocolo.
- [ ] O comprovante de homologação informa que não houve armazenamento nem envio.

## Testes negativos

- [ ] Token Turnstile ausente, inválido, expirado ou reutilizado: rejeitar.
- [ ] Hostname ou action divergente: rejeitar.
- [ ] Agravo fora da lista permitida: rejeitar.
- [ ] CNES com formato inválido: rejeitar.
- [ ] E-mail inválido: rejeitar.
- [ ] Chave de idempotência inválida: rejeitar.
- [ ] PDF que não começa com `%PDF-`: rejeitar.
- [ ] PDF acima do limite: rejeitar.
- [ ] Corpo acima do limite: rejeitar.
- [ ] Mais de dez envios/dia por e-mail no controle provisório: rejeitar e revisar limite com a TI.
- [ ] Propriedades obrigatórias ausentes: falhar de forma fechada.
- [ ] Em `AMBIENTE=HOMOLOGACAO`: nenhuma gravação em Drive/Sheets e nenhum e-mail.
- [ ] Em `AMBIENTE=PRODUCAO` com `PRODUCAO_LIBERADA=false`: bloquear todos os recebimentos.
- [ ] Pasta ou planilha com compartilhamento amplo: bloquear.
- [ ] Falha ao gravar registro após criar PDF: colocar o arquivo órfão na lixeira.
- [ ] Falha no envio do comprovante após o recebimento: preservar o registro e marcar comprovante como pendente.

## Privacidade e rastreabilidade

- [ ] Nenhum nome, CPF, CNS, data de nascimento ou diagnóstico aparece na planilha de controle.
- [ ] Nenhum PDF é anexado ao e-mail do profissional.
- [ ] O e-mail do profissional não é armazenado na planilha.
- [ ] Logs de execução não contêm corpo da requisição, PDF, e-mail ou identificadores do paciente.
- [ ] Arquivos ficam acessíveis somente ao grupo institucional autorizado.
- [ ] A consulta de protocolo não expõe dados da ficha.
- [ ] Prazo de guarda e descarte aprovados pela gestão documental.

## Integração

- [ ] Testar POST a partir da origem real do Google Sites e verificar CORS.
- [ ] Testar Chrome/Edge e celular.
- [ ] Confirmar cotas e limite de payload na conta institucional.
- [ ] Confirmar o comportamento com o administrador do Google Workspace.
- [ ] Testar indisponibilidade e recuperação sem duplicar protocolo.

A homologação não deve usar dados reais de pacientes. O sucesso destes testes não substitui auditoria de segurança, validação institucional ou RIPD quando aplicável.
