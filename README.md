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
- Homologação: acrescentar ?homologacao=1 ao endereço marca a tela, o PDF e o assunto do e-mail como HOMOLOGAÇÃO (usar só dados fictícios).
- notificacao.html: liberação, na regra de segurança, das consultas de CEP (ViaCEP) e CNPJ (BrasilAPI e CNPJ.ws).
