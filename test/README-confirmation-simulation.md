# Campanhas aprovadas → dispatcher em simulação

A campanha administrativa continua sendo a origem da aprovação. O Bridge usa o
dispatcher existente em uma fila PGlite privada em memória, sem conexão com a
fila operacional. O remetente da simulação não possui cliente de rede. Resultados
persistidos no Higia usam `mode: simulation`, `dispatchEnabled: false` e o resultado
`simulated`; não representam mensagens enviadas.

## Contrato

As rotas de execução exigem exclusivamente token de serviço com o novo escopo
`CONFIRMATION_SIMULATE`. `CLINIC_REGISTRY_READ` permanece somente para leitura do
registro e não executa simulações. Tokens de colaboradores não executam essas
rotas; recepção/administração consultam o histórico pela rota administrativa.

| Rota, relativa a `/api` | Função |
| --- | --- |
| `POST /confirmation-simulations/campaigns/:id` | Reserva a versão aprovada e retorna referências opacas |
| `POST /confirmation-simulations/:runId/items/:itemId/check` | Consulta independente da agenda e do registro |
| `POST /confirmation-simulations/:runId/result` | Persiste exclusivamente o resultado simulado |
| `GET /confirmation-campaigns/:id/simulations` | Histórico para colaboradores, com indicação de aprovação vigente |

As duas rotas de uma execução reservada exigem também `X-Simulation-Claim`,
emitido somente ao processo que obteve a reserva. O hash dessa reserva fica no
banco; o valor não entra em logs, relatórios ou na interface.

A exportação não retorna identificação administrativa, número de telefone,
identificador do agendamento no legado ou dados do paciente. Os campos dos itens
são `itemId`, `appointmentRef`, `recipientRef`, `phoneRef`, `appointmentTime` e
`recipientState`. Não é necessário inverter HMACs: a revalidação recorre à fonte
`AppointmentSource` e compara as referências da consulta nova.

Só campanhas `APPROVED`, com consulta `READY`, podem iniciar uma execução.
Campanhas parciais, vazias, desconectadas ou com falha são recusadas. Itens
pendentes não podem constar como simulados. A revisão não autoriza destinatários.

## Versão, repetição e falhas

- Uma revisão é identificada por SHA-256 dos dados relevantes, itens e eventos
  administrativos. Reabrir/reaprovar produz nova revisão, mesmo com relógio igual.
- Há uma única execução por campanha/revisão. Repetições retornam o resultado
  existente; outra instância não executa uma reserva ativa.
- A reserva expira em 15 minutos e é renovada a cada consulta válida. O mesmo
  token de serviço pode retomá-la após expirar; o token de reserva anterior deixa
  de valer. Isso é recuperação de simulação, não repetição de envio real.
- Resultados de uma revisão alterada são registrados como `INVALIDATED`.
  O histórico mostra quando a aprovação já não está vigente.
- Falha técnica retém o item; divergência de agenda, contato ou autorização
  impede o resultado simulado. Há uma nova consulta imediatamente antes da
  tentativa fictícia, além das verificações anteriores do dispatcher.
- Os limites de horário/feriados do dispatcher e o bloqueio de telefone
  compartilhado são preservados. Dois horários do mesmo contato continuam como
  itens separados e podem ser bloqueados pela regra conservadora de telefone
  compartilhado. Esta entrega não define uma nova regra de agrupamento.
- Uma execução concluída é imutável. Para repetir após mudanças externas que
  não alteraram os itens persistidos, reabrir/reaprovar administrativamente; não
  apagar relatórios nem reutilizar resultados como evidência de envio.

## Preparação futura do ambiente

A migration `20261104190000_confirmation_simulations` adiciona o escopo e a tabela
de simulações. Após integração do código, é necessário aplicar a migration e
regenerar Prisma no ambiente escolhido antes de iniciar os novos componentes.
Isso não foi feito em `appointments_dev` nem em produção nesta entrega.

Para o Bridge, configurar em arquivo local ignorado ou secret store:

- `HIGIA_CONFIRMATION_SIMULATION_URL`: base da API Higia incluindo `/api`;
- `HIGIA_CONFIRMATION_SIMULATION_TOKEN`: token exclusivo com `CONFIRMATION_SIMULATE`.

HTTP só é aceito em loopback; ambientes remotos exigem HTTPS. Não reutilizar o
token do registro nem chaves HMAC. Nenhum token real foi criado ou rotacionado
nesta entrega.

O comando, dentro de `higia-chat/agent-bridge`, é:

```sh
npm run confirmations:simulate -- --campaign-id ID
```

Não há cron, envio real nem chamada ao remetente WhatsApp. O comando
`confirmations:dispatch` continua recusando execução real.

## Validação reproduzível com dados fictícios

Pré-requisitos: Docker Desktop/WSL com imagens locais `appointments_backend-app`
e `postgres:16-alpine`; container `appointments-api-dev` existente apenas como
fonte de mounts; dependências instaladas no Bridge e frontend; Python do `.venv`
do projeto Saúde Vianet. Os três repositórios devem manter os caminhos irmãos
deste workspace. As portas 5549, 3106 e 5179 precisam estar livres.

No repositório Python:

```sh
.venv/bin/python /home/paulodt/repos/appointments/appointments_backend/test/run-confirmation-simulation.py \
  --node /home/paulodt/.nvm/versions/node/v24.20.0/bin/node
```

Para incluir os nove cenários do histórico no navegador, instalar Playwright e
Chromium no frontend ou em um diretório temporário de tooling. Por exemplo:

```sh
npm install --prefix /tmp/higia-simulation-browser-tools playwright
/tmp/higia-simulation-browser-tools/node_modules/.bin/playwright install chromium
```

Acrescentar ao runner:

```sh
--browser --playwright-module /tmp/higia-simulation-browser-tools/node_modules/playwright/index.mjs
```

O runner copia dependências para volume exclusivo, gera Prisma nessa cópia,
cria PostgreSQL com tmpfs (`appointments_simulation_fixture`), aplica as migrations
somente nele e sobe uma API autenticada com fonte de agenda fictícia. Não importa
o AppModule completo nem carrega `.env`. Os tokens temporários têm arquivo 0600.
Nenhum cadastro, autorização ou paciente real é usado.

O teste HTTP comprova reserva, bloqueio dos outros tokens, resultado persistido,
repetição idempotente, itens administrativos preservados e reabertura. O teste de
navegador começa consultando o relatório real dessa execução; depois simula as
respostas de histórico para estados em andamento, interrompido, invalidado,
bloqueado, vazio e indisponível. A campanha continua utilizável em falha do histórico.

Capturas e resultado do navegador ficam em `/tmp/higia-simulation-browser`.
O runner remove seus containers, volume de dependências e arquivo de sessão
em `finally`. Interrupção forçada pode impedir a limpeza: inspecionar apenas
recursos com label `higia.simulation=fixture-only` e `/tmp/higia-simulation-fixture`.

## Resultado desta entrega

Em 04/11/2026: contrato HTTP integrado e nove verificações de navegador aprovados;
a migration foi aplicada apenas em bancos descartáveis. A suíte geral do Bridge
passou com 365 testes e um teste integrado intencionalmente pulado sem fixture;
esse teste integrado passou em execução dedicada. Typecheck do Bridge e build
do frontend passaram. Os 47 testes administrativos/simulação e o typecheck do
backend passaram. O runner Python teve sintaxe validada, sem typechecker Python
configurado; sintaxe não substitui typecheck.
