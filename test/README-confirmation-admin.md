# Homologação administrativa isolada

A suíte executa o frontend real no Chromium, os controllers e guards Nest,
Prisma/PostgreSQL e o classificador Python existente. Apenas a fonte de agenda e
a identificação visual são fixtures. Não importa o AppModule completo, não
consulta Saúde Vianet e não possui remetente nem dispatcher.

## Pré-requisitos

- Docker com as imagens locais `postgres:16-alpine` e `appointments_backend-app`.
- Container `appointments-api-dev` existente, usado apenas para seus mounts de
  código e dependências; ele não é iniciado. Pode ser substituído pelo argumento
  `--dependency-container`.
- Repositórios backend e frontend como diretórios irmãos.
- Python do `.venv` de `saudevianet_mcp_py`, com o pacote instalado.
- Node e npm; no frontend, executar `npm ci` e `npx playwright install chromium`.
- Portas locais 5548, 3105, 8877 e 5178 livres.

## Execução

A partir do repositório Python:

```sh
.venv/bin/python ../CAMINHO_DO_BACKEND/test/run-confirmation-admin-homologation.py \
  --node /caminho/absoluto/para/node
```

O argumento do script deve apontar ao backend real do checkout. Por exemplo,
quando os repositórios estiverem nos caminhos deste workspace:

```sh
.venv/bin/python /home/paulodt/repos/appointments/appointments_backend/test/run-confirmation-admin-homologation.py \
  --node /home/paulodt/.nvm/versions/node/v24.20.0/bin/node
```

O runner cria um PostgreSQL em tmpfs com o banco exclusivo
`appointments_homolog_fixture`, aplica as migrations nele e compila o backend em
tmpfs. As dependências são copiadas para um volume temporário; o Prisma é gerado
nessa cópia para acompanhar o schema atual, sem alterar o volume dos serviços.
Acrescentar `--backend-checks` para executar Jest administrativo/simulação e o
typecheck nessa cópia antes da homologação. O script do backend rejeita qualquer
outro nome de banco, host ou porta.
O backend é publicado somente em loopback. Python e Vite também escutam em
loopback; no Docker Desktop, o backend acessa o Python via `host.docker.internal`.
O runner isola o `.env` Python e desabilita os arquivos `.env` do Prisma e Vite.
O Vite usa configuração temporária com API fictícia explícita. As credenciais e referências usadas são
exclusivamente fictícias. Os arquivos locais de configuração são preservados.

As fixtures incluem dois horários do mesmo adulto, contato apenas informado,
contato verificado sem autorização, menor sem responsável verificado, autorização
expirada/revogada, telefone divergente e falha técnica separada dos agendamentos.
Todos os fundamentos e evidências usam `fixture-only`, sem validade jurídica real.

O navegador exercita login, criação, resolução de pendências, revisão, aprovação,
pesquisa de contatos, revogação e reabertura. Também verifica permissões HTTP,
auditoria, falha do registro e `dispatchEnabled: false`.

## Evidências e limpeza

Capturas e resultado JSON ficam em `/tmp/higia-admin-homologation`. Em falha, os
diagnósticos fictícios ficam em `/tmp/higia-admin-homologation-runtime.log`.
Não há tokens nas evidências do navegador. O token temporário do registro fica
em arquivo 0600 dentro de `/tmp/higia-admin-homolog-fixture`, removido ao finalizar.

O runner encerra os próprios processos, containers e volume de dependências em `finally`; o banco em
memória é removido. Uma interrupção forçada pode impedir a limpeza. Nesse caso,
inspecionar exclusivamente os containers com label
`higia.homologation=fixture-only` e o diretório temporário antes de repetir.
Não apagar containers ou registros dos ambientes de desenvolvimento/produção.

## Resultado de 04/11/2026

Homologação concluída com 11 grupos de verificação aprovados no Chromium:

- Login e fronteiras de acesso: sem autenticação, profissional sem permissão e
  escrita com token de leitura são rejeitados.
- Criação pela interface, duplicidade rejeitada e falha técnica separada dos
  sete agendamentos válidos.
- Número apenas informado permanece pendente; procedimento obrigatório.
- Uma verificação do adulto reclassifica seus dois horários, mantendo itens distintos.
- Ausência de autorização, expiração, revogação e telefone divergente bloqueiam.
- Menor exige responsável legal com vínculo verificado.
- Indisponibilidade do registro retira a elegibilidade e impede resolução pela recepção.
- Revisão e aprovação mantêm bloqueios individuais e `dispatchEnabled: false`.
- Autorização expirada aparece como pendente, sem alegar revogação inexistente.
- Pesquisa, revogação, auditoria e reabertura de campanha aprovada funcionam.
- Nenhuma requisição externa pelo navegador ou erro de execução no navegador.

A homologação revelou e corrigiu a apresentação incorreta de autorizações
expiradas como revogadas no frontend. Os quatro testes de regressão dessa
situação, build/TypeScript do frontend, 27 testes administrativos Jest e typecheck
TypeScript do backend passaram. Os scripts Python tiveram sintaxe validada;
não há typechecker Python configurado, e sintaxe não substitui typecheck.

Ao finalizar, foi confirmada a remoção dos containers e arquivos de sessão da
execução. Nenhum dado de paciente real foi consultado ou alterado.

Esta suíte não homologa leitura real da agenda, WhatsApp, confirmação no legado,
dispatcher nem implantação.
