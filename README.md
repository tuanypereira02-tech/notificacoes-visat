# Notificações compulsórias — VISAT Florianópolis

Cópia do site de direcionamento de notificações compulsórias (notificacao-sms.onrender.com), desenvolvido por Luana Lenzi, mantida pela VISAT/SMS Florianópolis com preenchimento automático e regras de qualidade dos formulários de Saúde do Trabalhador.

Encaminhamento das fichas identificadas: PDF final enviado ao e-mail institucional saudetrab.sms.pmf@floripa.sc.gov.br.

## Alterações em relação ao original

- js/autopreenchimento.js e js/autopreenchimento-listas.js: idade, CEP, CNPJ, unidade (CNES), município, CBO e CNAE.
- js/cid-qualificado.js (modelo VISAT 2026.11-1):
  - doenças relacionadas ao trabalho: o diagnóstico específico aceita somente CID do escopo da ficha
    (câncer C00–C97 e D00–D48; dermatose L00–L99; LER/DORT M00–M99 e G50–G59; PAIR H83.3, H90, H91 e H93;
    pneumoconiose J60–J65 e J92; transtorno mental F00–F99 e Z73.0);
    CID que consta da LDRT (Portaria GM/MS nº 5.674/2024) mostra capítulo, página e agentes;
    CID do escopo fora da LDRT é aceito com aviso; CID fora do escopo impede o PDF final;
  - acidente de trabalho: CID da lesão pela CID-10 cap. XIX (S00–T98) e CID da causa externa pelo cap. XX (V01–Y98).
- data/cid-dart.json e data/cid-at.json: gerados da Lista-base CID LDRT/CELK VISAT 2024–2026 v3 e da tabela CID-10 do DATASUS.
- js/formulario-acidente.js: o PDF final exige os campos básicos aplicáveis e é bloqueado por data impossível ou incoerente,
  agravo incompatível, CPF/CNPJ inválido e CID fora do escopo; a prévia sai com a marca "PRÉVIA — NÃO ENCAMINHAR";
  o PDF final traz título, agravo, CID do agravo e versão do modelo; campos condicionais ocultos não são impressos.
- CNAE (P12): lista e conferência pela tabela CNAE do Sinan (data/cnae-sinan.json, classe com 5 dígitos);
  ao lado de cada campo, "Consultar CNAE no IBGE" abre a busca do IBGE na CNAE 1.0 (versão 3.0.1) ou na CNAE 2.0,
  conforme a origem do código; a conversão CNPJ -> Sinan segue a planilha Tabelas_codigos_Sinan_VISAT.
- P01: o contador de "Como notificar" usa o total selecionável calculado da lista (106 na versão auditada);
  a conferência de integridade fica no console.
- P13: atalhos validados junto ao rótulo (CBO/MTE, CNAE/IBGE, CNPJ/Receita, códigos IBGE, CNES, CAT/INSS), em nova aba, sem perder o preenchimento.
- P14: município (tabela local data/municipios.json) e unidade (CNES) confirmados por escolha na lista, por texto ou código digitado e saída do campo;
  o campo informa se o código foi validado na tabela, se o preenchimento ficou manual ou se há mais de uma opção.
- P16: o nome completo bloqueia o PDF apenas sem conteúdo útil (letra única, só iniciais, números ou símbolos,
  letra repetida, termo genérico como "teste" ou "ignorado"); nome de uma só palavra ou com abreviação gera aviso.
- Catálogo da VISAT (?escopo=visat): agravos numerados de 1 a 10, com o código da lista geral (1.a…) como referência;
  a busca aceita o novo número e o código antigo.
- P22: a busca de CID usa a tabela CID-10 (DATASUS) incorporada; se a tabela não carregar, o campo orienta digitar o código.
- Homologação: acrescentar ?homologacao=1 ao endereço marca a tela, o PDF e o assunto do e-mail como HOMOLOGAÇÃO (usar só dados fictícios).
- notificacao.html: liberação, na regra de segurança, das consultas de CEP (ViaCEP) e CNPJ (BrasilAPI e CNPJ.ws).
- Envio por e-mail (16/11/2026): a tela "Ficha concluída" tem 1. Enviar por e-mail e 2. Baixar ficha em PDF.
  O PDF é gerado no navegador (js/vendor/pdf-lib.min.js, licença MIT) e o envio usa o app da Web do Google Apps Script
  "VISAT - Envio de fichas por e-mail" (conta saudetrab.sms.pmf@gmail.com), pela janela de e-mail da página (js/envio-ficha.js):
  destinatário fixo, assunto com agravo, unidade notificadora e CNES (sem dados do paciente), cópia e resposta para o e-mail
  informado pelo profissional. Em teste, o destino é saudetrab.sms.pmf@gmail.com com o prefixo [TESTE VISAT];
  após a homologação, trocar para saudetrab.sms.pmf@floripa.sc.gov.br e [VISAT] (instruções no topo de js/envio-ficha.js).
- Busca de CEP (16/11/2026, como no rascunho VISAT): "Buscar CEP pelo endereço" abaixo do CEP de residência e do local de trabalho
  (UF, município e logradouro no ViaCEP, com filtro pelo bairro); o CEP escolhido completa o endereço.
- Busca da empresa pelo nome (16/11/2026, como no rascunho VISAT): o nome da empresa fica antes do CNPJ; as sugestões vêm da base
  data/empresas-visat.json e do cadastro online (fichario.app); a escolha preenche o CNPJ, que consulta e completa CNAE e endereço.
- Trabalho e empregador (16/11/2026): três blocos — Trabalho da pessoa notificada (ocupação, situação, tempo, ocupação anterior,
  plataformas digitais), Empregador (UF e município do local de trabalho, com Florianópolis/SC editável como ponto de partida,
  nome da empresa com busca, CNPJ/CPF, CNAE, terceirizada e, se Sim, empresa principal) e Endereço do local de trabalho
  (CEP com busca pelo endereço, logradouro, número, complemento, bairro, referência e telefone). Para Aposentado ou Desempregado,
  aviso para informar o empregador da época da exposição ou do acidente. O campo Distrito saiu da residência.


### Correspondência Receita → TB_CNAE (17/11/2026)

`data/cnae-correspondencias.json` utiliza as correspondências oficiais CONCLA/IBGE,
por subclasse, de 2.3 → 2.2 → 2.1 → 2.0 → Fiscal 1.1 e classe CNAE 1.0.
O universo foi conferido com as 1.332 subclasses da API oficial do IBGE.
1.220 têm destino único presente na TB_CNAE fornecida e permitem preenchimento
inicial automático. As outras 112 exigem revisão: o formulário oferece os
candidatos disponíveis e nunca escolhe arbitrariamente entre eles.
A composição histórica pode ampliar candidatos; a seleção deve refletir a
atividade do local de trabalho. A consulta CNPJ continua usando as APIs existentes.

Os códigos antigos 20214 e 99007 estão ausentes da TB_CNAE fornecida. O código
16218 dessa tabela tem descrição semelhante à classe antiga 20214, mas não foi
considerado equivalente automaticamente. As 580 linhas originais permanecem
inalteradas. Lacunas nas planilhas de subclasses utilizam correspondência de
classe apenas como sugestão para revisão. Fontes, hashes e método de cada
correspondência constam no JSON.

Para reproduzir, baixar as fontes indicadas no JSON em uma pasta e executar
`python scripts/gerar-correspondencia-cnae.py PASTA_FONTES` (pandas, xlrd e openpyxl).
A fonte da API deve ser salva como `subclasses-api.json`. Executar
`node scripts/testar-correspondencia-cnae.cjs` para conferir os invariantes e
casos de regressão. Falha de carregamento do mapa mantém o preenchimento manual.

### Página de teste do rascunho de colunas (17/11/2026)

`notificacao-teste.html` leva ao repositório o rascunho VISAT v22, para conferência antes de substituir `notificacao.html`
(a página incorporada no Google Sites, que não foi alterada). Usa arquivos próprios em `js/teste/`, `css/teste/` e
`formularios-inline-teste.html`; o envio por e-mail (`js/envio-ficha.js`), o PDF e os dados (`data/`) são os mesmos da página principal.

- Grade única de 4 colunas: caixas alinhadas entre as linhas; linhas com 2 a 4 campos, sem campo sozinho;
  rótulo sempre em uma linha (o campo ganha 1/2 da linha ou a linha inteira quando o texto não cabe).
- Ordem dos campos do SINAN em Dados gerais, Pessoa, Residência (com Geo campo 1 e 2), Empresa contratante e Acidente;
  atendimento médico logo após "Houve atendimento médico?"; CAT emitida na conclusão.
- Listas (município, unidade, CBO, CNAE, CID, empresa, CEP, agravos): setas destacam, Enter ou Espaço escolhem e fecham a lista, clique também escolhe.
- CEP buscado automaticamente pelo endereço, sem botão; Ocupação anterior com a lista da CBO.
- Material biológico: Paciente fonte — Anti-HBc e esquemas AZT+3TC, AZT+3TC+Indinavir e AZT+3TC+Nelfinavir na conduta.
- Explicações abaixo dos campos reduzidas; uma mensagem por campo.
- Para promover: trocar em `notificacao.html` as referências de CSS/JS pelas de `notificacao-teste.html` (ou copiar os arquivos de `js/teste/`
  e `css/teste/` sobre os originais) e aplicar os modelos de `formularios-inline-teste.html`.


### Ajustes da ficha (17/11/2026)

- Nome completo e Nome da mãe em CAIXA ALTA (tela, PDF e e-mail).
- Sem preenchimento automático do navegador ("As informações foram salvas", "Usado pela última vez"): os campos usam
  `autocomplete="visat-sem-preenchimento"`, porque o Edge/Chrome ignora `off` em nome e endereço. As listas próprias continuam.
- Fundo único na ficha, sem o painel branco que terminava no meio da rolagem e sem faixas cinzas laterais.
- No quadro do Sites, a ficha rola até o fim e, depois, a rolagem passa para a página do Sites (sem trava no final).
- Unidade de tempo (Anos/Meses/Dias) sempre inteira.
- Fim da ficha como no SINAN: bloco "Informações complementares e observações" com dois espaços. Na ficha de acidente,
  "Descrição sumária de como ocorreu o acidente/ atividade/ causas/ condições/ objeto/ agentes..." reúne a atividade e a
  máquina/equipamento/substância (campo `maquina` retirado); o segundo espaço é "Outras informações". O antigo bloco
  "O que aconteceu" fica só com "Fatores que contribuíram".


## Modelo único VISAT (17/11/2026)

Decisões da comparação entre VISAT via Link, site de Notificações da VE, Google Sites e fichas oficiais do Sinan:

- **PDF:** regra única: campo sem valor não sai na ficha (nem com traço); tempo e idade por extenso ("1 ano", "37 anos", "11 meses").
- **Notificador:** função e e-mail do profissional ao lado do profissional responsável, em todas as fichas; o e-mail preenche "Seu e-mail" na janela de envio (editável). "Seu e-mail" continua obrigatório para enviar.
- **Campos retirados:** Número da notificação e Geo campo 1 e 2.
- **Situação no mercado de trabalho:** as 13 opções do Sinan também na ficha de acidente (estatutário e celetista separados).
- **Servidor público:** "Local de atuação (unidade, setor ou órgão)" aparece para servidor estatutário ou celetista; o CNPJ continua o do órgão (condição `data-show-in`, com mais de um valor).
- **Aplicativo:** só nas fichas de acidente (inclui óbito), LER/DORT e transtornos mentais; com "Sim", abrem "Tipo de aplicativo" (tipos do IBGE) e "Qual aplicativo?".
- **CAT = Não:** orientação com o caminho oficial (gov.br/Meu INSS), sem prazo para o trabalhador e outros legitimados (Lei 8.213/1991, art. 22, § 2º).
- **Troca de CNPJ:** ao mudar um CNPJ já consultado, o CNAE da empresa anterior sai, inclusive quando digitado ou escolhido à mão; falha na consulta: "Não foi possível consultar o CNPJ agora. Tente novamente ou preencha manualmente."
- Implementação em `aplicarAjustesVisat()` (js/teste/formulario-acidente.js), comum a todas as fichas.
- **Distúrbio de voz:** "CAT emitida?" antes das informações complementares, com a mesma orientação quando a resposta é Não.
- **CID no formato da ficha oficial:** código digitado sem descrição é ajustado para letra, dois números, ponto e 4º caractere (ex.: "m545" → "M54.5") antes da busca na tabela.
- **Faixas de CID por ficha:** segue a ficha oficial do Sinan onde ela define a faixa — LER/DORT passa a aceitar também G90–G99; Transtornos mentais, também Y90–Y91, R40–R46, Z55–Z65, Y96 e X60–X84 (títulos da CID-10 DATASUS 2008, fora da LDRT entram com aviso). Onde a ficha não define faixa (câncer, dermatoses, PAIR, pneumoconioses), mantém a base LDRT.
