# Fichas da réplica VISAT

Saída gerada por `python3 ferramentas/preparar-replica.py`. Não editar aqui. A fonte dos formulários e tabelas continua em `site-visat/`.

Preenchimento, validações e PDF funcionam nesta cópia. O modo de homologação é obrigatório e o envio está desativado: o código de envio, a chave e seu endereço não são copiados. O PDF recebe título e rodapé de homologação.

Os arquivos de execução locais estão incluídos; isto não é uma aplicação totalmente offline. Dependências externas preservadas:

- Google Fonts: tipografia, com fallback Roboto/Arial/sans-serif.
- raw.githubusercontent.com: CSV de CBO e consulta genérica de CID-10.
- ViaCEP: consulta opcional de CEP/endereço.
- BrasilAPI, publica.cnpj.ws e fichario.app: consultas cadastrais opcionais de empresas.
- Links de referência (SINAN, CELK e demais serviços) abrem serviços externos.

A tabela empresarial rastreada é preservada; a geração recusa padrão de CPF nos campos de nome/razão social. Não incluir fichas preenchidas nesta pasta.

Verificação sem alterar arquivos: `python3 ferramentas/preparar-replica.py --check`.
