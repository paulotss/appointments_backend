# Entrega 4B — respostas e pendências

Implementação iniciada em 04/11/2026 e homologada em 05/11/2026. A base 4A foi
integrada nas PRs [Python #13](https://github.com/paulotss/saudevianet_mcp/pull/13),
[Backend #52](https://github.com/paulotss/appointments_backend/pull/52) e
[Bridge #6](https://github.com/paulotss/higia-chat/pull/6). A 4B não altera o Python.

## Campanha e prazo

`PUT /api/confirmation-campaigns/:id/response-deadline` recebe somente
`responseDeadlineAt`, UTC canônico com segundos e milissegundos opcionais.
O campo é nullable para preservar campanhas antigas. Só pode ser editado antes
da aprovação ou após reabertura. Aprovar exige prazo futuro anterior ao primeiro
horário elegível em America/Sao_Paulo, além de horários elegíveis válidos.
A interface edita/exibe o horário de São Paulo, independentemente do fuso do navegador.

O prazo integra a revisão aprovada e a seleção operacional. Aprovação e edição
do prazo são serializadas por bloqueio da campanha. Cada aprovação armazena um
retrato imutável dos vínculos elegíveis e prazo, sem nome ou telefone. Isso permite
auditar resultados históricos após reabertura ou substituição de itens.
Campanhas antigas sem prazo continuam legíveis e não podem iniciar transporte
operacional. O hash anterior é preservado quando o prazo é nulo; relatórios de
simulação permanecem históricos e separados dos resultados operacionais.

## Processamento no Bridge

`createApp()` continua sem integração de campanhas. A composição explícita
`createCampaignReplyWebhook` liga o processador à fila existente por conversa,
cancela respostas automáticas pendentes e preserva a prioridade humana local e
consultada novamente no Chatwoot. Não há factory de ambiente para ativação real.
A composição recebe a porta de revalidação de 4A (`ApprovedRecipientGate`),
cliente de resultados e adaptador do canal. O telefone resolvido é transitório.

Depois da autenticação existente por assinatura/timestamp, a inbox explicitamente
habilitada consulta conta/inbox/conversa e persiste o evento antes do HTTP 200.
Falha de persistência ou contexto incompleto retorna 503. Sem vínculo com campanha,
o atendimento comum permanece; eventos correlacionados não entram no menu/Hermes.
Remetente deve ser o contato vinculado à tentativa e à conversa atual. Referência
à mensagem respondida só aceita ID técnico exato. Vários candidatos sem seleção
inequívoca geram pendência, sem escolher um horário por nome ou telefone.

Classificação determinística: `confirmo`, `confirmo presença`, `confirmo minha
presença`, `sim, confirmo`; alteração: `quero remarcar`, `preciso remarcar`, `quero
alterar`, `não posso comparecer`, `quero cancelar`, `preciso cancelar`. Normaliza
caixa, acentos, espaços e pontuação terminal. Outros textos, dígitos e anexos sem
texto pedem análise. Cancelamento é pedido de alteração, nunca execução no legado.

Atendimento humano, resposta tardia, revalidação negativa, remetente incompatível
e conversa indisponível não produzem confirmação automática. Uma resposta posterior
conflitante preserva a manifestação anterior e gera pendência com histórico.
Nenhuma resposta gera mensagem automática ao paciente.

## Persistência, recuperação e encaminhamento

Migração Bridge 004: seleção operacional sem telefone, eventos deduplicados,
projeção de resposta, fila de saída e tarefas de encaminhamento. Não grava texto
livre, source_id do contato, credenciais nem corpo bruto do webhook.

O worker exclusivo usa lease de 15 minutos e renovação durante o processamento.
A composição habilitada inicia recuperação e verifica tarefas a cada 30 segundos;
após interrupção abrupta, outra instância aguarda o lease vencer. Falhas mantêm
os eventos e a fila de saída para recuperação. A publicação é sequencial por
tentativa; o Higia aceita repetição idêntica e rejeita sequências incompatíveis.
Um erro em uma tentativa não avança sua sequência nem bloqueia outras tentativas.

Alteração, ambiguidade e resposta tardia preparam recepção ID 1 e atributos
`categoria_atendimento=agendamento`, `estado_do_atendimento=aguardando_colaborador`,
`modo_roteamento=human`. O adaptador consulta novamente, revalida e preserva outro
atendimento humano. Escritas ambíguas são reconciliadas por leitura antes de nova
escrita; não cria conversa nem envia mensagem. Falha de autorização/revalidação
permanece como pendência interna sem encaminhamento ao destinatário.

Entrega, leitura, resposta e conclusão administrativa são estados distintos.
Resultado desconhecido nunca autoriza reenvio. Falha de entrega não vira silêncio
do paciente; eventos antigos não regridem um comprovante de leitura.

## Contratos administrativos

`POST /api/confirmation-results` exige exclusivamente o escopo de serviço
`CONFIRMATION_RESULTS_WRITE`. Recebe evento, execução/revisão/item, sequência,
referência opaca, conta/inbox/conversa, estados, motivo, prazo e instante.
Rejeita campos adicionais, vínculo incompatível, eventos divergentes e regressão
de entrega/transporte. O escopo de leitura de contatos e usuários administrativos
não podem escrever esses resultados. Nenhum token foi provisionado no ambiente real.

`GET /api/confirmation-campaigns/:id/responses` retorna projeções, pendências,
eventos e ações. `POST .../responses/pending/:pendingId/assign` recebe `version`;
`POST .../complete` recebe `version` e resultado administrativo obrigatório:
`CONTACT_HANDLED`, `CHANGE_REVIEWED`, `NO_ACTION_REQUIRED`, `TECHNICAL_REVIEWED`.
Somente o responsável pode concluir. A função atual do usuário é reconsultada.
Assunção e conclusão são auditadas e serializadas com a chegada de resultados.
Uma nova ocorrência sobre pendência aberta avança sua versão e invalida uma
conclusão baseada em dados antigos. Nova ocorrência após conclusão abre outra
pendência, sem apagar o histórico.

A página da campanha separa transporte/entrega, resposta e pendências; oferece
filtros, responsável, histórico e ações. Links de conversa são opcionais e gerados
somente a partir de `CONFIRMATION_CHATWOOT_UI_URL` com origem HTTPS sem credenciais,
query ou fragmento. Essa configuração não foi alterada no ambiente real.

## Expiração manual

`engine.expire(now)` usa relógio injetável, processa eventos pendentes primeiro e
registra prazo vencido somente para tentativa aceita sem resposta. Resultado de
transporte desconhecido e entrega falha mantêm diagnóstico técnico. É idempotente;
não envia lembretes nem instala cron de expiração.

`npm run confirmations:responses-expire` é fechado por padrão. Sua futura execução
exige `CONFIRMATION_REPLIES_MAINTENANCE_ENABLED=true` e URL exclusiva em
`CONFIRMATION_REPLIES_DATABASE_URL`. Não foi habilitado nesta entrega. A rotina
manual só escreve metadados e fila de saída: bloqueia worker ativo e eventos ainda
não tratados, e não consulta serviços externos. O worker normal sincroniza depois.

## Homologação isolada

No repositório Python, com Docker integrado ao WSL e Node instalado:

```
PYTHON_DOTENV_DISABLED=1 .venv/bin/python /home/paulodt/repos/appointments/appointments_backend/test/run-confirmation-replies.py --node /home/paulodt/.nvm/versions/node/v24.20.0/bin/node --browser --playwright-module /tmp/higia-admin-browser/node_modules/playwright/index.mjs
```

Playwright deve estar disponível no caminho informado; o runner não instala
pacotes. Usa PostgreSQL descartável na porta 5551, API Nest/Auth real em 3111,
Vite em 5181, PGlite privado no Bridge e serviços de canal fictícios. Não carrega
AppModule, .env da clínica ou clientes de legado. Portas ocupadas e diretório de
fixture preexistente bloqueiam o runner. Containers, banco, dependências copiadas
e sessão com tokens fictícios são removidos em `finally`. Evidências de navegador
sem sessão ficam em `/tmp/higia-replies-browser`.

Testes cobrem escopos, prazo, persistência antes do aceite, duplicação, reinício,
fila de saída, ambiguidade, conflito, expiração, concorrência administrativa e
interface. Adaptador de recepção é testado em HTTP loopback, inclusive perda da
resposta após atribuição; nenhuma chamada a `/messages` ocorre nesse fluxo.

A instalação local continua apenas com WebWidget. Provedor WhatsApp, inbox,
template/texto e janela reais permanecem pendentes para o piloto. Não houve envio,
confirmação no Saúde Vianet, deploy ou migração em banco de uso normal. Não foi
criada política de autorização configurável. Publicação de 4B requer autorização
própria; a autorização recebida nesta etapa foi para os merges de 4A.

### Resultado final da validação

- Backend: 62 testes Jest em 5 suítes e typecheck sem emissão aprovados.
- Bridge: 392 testes encontrados, 390 aprovados e 2 integrações opcionais ignoradas
  na execução comum; typecheck aprovado. A integração opcional de respostas foi
  executada separadamente pelo runner e passou.
- Homologação: autenticação real, PostgreSQL descartável, webhook assinado,
  concorrência entre responsáveis e chegada de resposta durante conclusão aprovados;
  7 verificações de navegador aprovadas com fuso UTC.
- Frontend: build/TypeScript aprovado. Permanece o aviso de tamanho dos bundles,
  que não impediu o build.
- Migrações: aplicadas somente em bancos descartáveis; fixture e sessão removidas.
  Nenhuma configuração, mensagem ou agendamento real foi alterado.
