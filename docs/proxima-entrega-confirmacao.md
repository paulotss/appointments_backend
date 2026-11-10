# Próxima entrega: transporte e correlação de respostas

Preparação em 04/11/2026. Esta é a etapa seguinte à homologação administrativa e
à integração do dispatcher em simulação. Reutilizar os cinco repositórios e os
contratos atuais; não criar outra arquitetura de campanhas.

## Entrega 4A — Adaptador do canal e correlação, com testes isolados

Implementação isolada registrada em [transporte-correlacao-confirmacao.md](transporte-correlacao-confirmacao.md).
O ambiente local oferece apenas WebWidget; a homologação do provedor WhatsApp
real permanece pendente para o piloto. O dispatch continua bloqueado.

O resultado esperado é um adaptador testável do canal WhatsApp usado pela clínica,
com identificação persistente da tentativa e da conversa, mantendo a ativação
real bloqueada. A entrada é uma campanha aprovada; o resultado diferencia aceite
do transporte, rejeição e resultado desconhecido, sem confundir isso com resposta
ou confirmação do paciente.

### 1. Fechar a seleção operacional do agendamento

- O Higia exporta `appointmentRef`, e o resolvedor atual recebe data, `agenda_id`
  e `appointment_id`. Implementar a tradução em uma fronteira interna autenticada
  da fonte, com consulta nova e correspondência única do HMAC. Não inverter HMAC,
  correlacionar por nome ou telefone nem expor IDs do legado ao Hermes.
- Preservar `AppointmentSource`. O fluxo operacional deve estar vinculado à
  revisão aprovada e revalidar agenda, titularidade, autorização e revogação antes
  da tentativa. Reabertura ou alteração invalidante bloqueia a execução.
- Não converter a simulação em produção trocando um sinalizador: a fila em memória,
  os telefones fictícios e os relatórios `ConfirmationSimulation` são exclusivos
  da simulação. A execução operacional precisa de vínculo próprio com a aprovação.
- O telefone real só chega ao componente autorizado que realizará a tentativa,
  com retenção transitória e remoção ao finalizar, como na fila atual.

### 2. Implementar a porta do transporte

- Partir de `higia-chat/agent-bridge/src/confirmations/sender.ts` e da integração
  existente em `src/chatwoot.ts`. Injetar o cliente HTTP para testes, sem acesso
  a serviços reais.
- Conferir os recursos de mensagem, botões e templates do canal efetivamente
  configurado antes de fixar o contrato. Não presumir provedor, inbox ou template.
- O helper atual `sendChatwootMessage` descarta o corpo da resposta e recebe uma
  conversa já existente. A campanha precisa obter e validar os identificadores
  da conversa e mensagem; esse helper sozinho não fornece a correlação necessária.
- Reutilizar ou criar contato/conversa de forma idempotente, preservando o
  atendimento humano existente. Não abrir outra conversa para a mesma tentativa
  em repetição ou concorrência.
- Diferenciar mensagem aceita pelo Chatwoot de entrega confirmada pelo canal.
  Timeout, resposta ambígua ou falha de persistência após o aceite permanecem
  desconhecidos, com reconciliação e sem repetição automática.
- Preservar `confirmations:dispatch` bloqueado e não criar cron de envio nesta
  entrega. Testes usam servidor HTTP fictício e remetentes simulados.

### 3. Persistir a correlação da tentativa

Definir uma chave idempotente ligada à revisão aprovada e ao item, além de
identificadores de conta/inbox, conversa, mensagem e eventos do canal. Usar
referências opacas nos dados de campanha. Não registrar telefone, texto clínico
ou credenciais nos logs.

Uma resposta precisa corresponder inequivocamente a uma tentativa ativa. Dois
horários do mesmo paciente permanecem distintos. A regra conservadora atual de
telefone compartilhado não deve ser removida sem definir e testar a seleção do
horário ou o agrupamento de solicitações.

### Critérios de aceite de 4A

1. Campanha sem aprovação vigente ou com revalidação negativa não alcança a porta
   de transporte, mesmo após reserva prévia.
2. Número apenas informado, contato revogado, autorização ausente/expirada e
   menor sem responsável verificado permanecem bloqueados.
3. Repetição e concorrência não duplicam tentativa, contato ou conversa.
4. Aceite, rejeição e resultado desconhecido têm estados e metadados coerentes.
   Um HTTP 2xx não vira prova de entrega nem confirmação do paciente.
5. Mensagem e conversa do canal ficam correlacionadas à tentativa correta.
6. Telefone transitório é removido; logs e respostas administrativas não o expõem.
7. Nenhum teste acessa canal, paciente ou agendamento real. Os bloqueios de envio
   continuam ativos após executar toda a suíte.

## Entrega 4B — Respostas e pendências, usando a correlação

Após 4A, conectar a correlação ao webhook existente:

- Preservar a autenticação de assinatura/timestamp e a deduplicação de eventos
  já existentes em `src/index.ts` e no processamento da fila de mensagens.
- Em `src/processWebhook.ts`, reconhecer a resposta da campanha antes de `menu`
  e `awaiting_subject`, preservando a precedência do atendimento humano.
- Reconhecer confirmação e pedido de alteração somente quando o contexto for
  inequívoco. Não reinterpretar automaticamente os dígitos 1, 2 e 3 do menu atual.
- Mensagem sem correlação ou ambígua mantém o atendimento normal ou produz
  pendência humana, sem atualizar um horário por aproximação.
- Preparar o encaminhamento idempotente à recepção ID 1 com
  `categoria_atendimento=agendamento`,
  `estado_do_atendimento=aguardando_colaborador` e `modo_roteamento=human`.
- Contato não autorizado ou falha técnica produz pendência interna, sem mensagem
  ao número não verificado. Ausência de resposta usa um prazo explícito.

A atualização do agendamento no Saúde Vianet pertence à etapa seguinte, com
validação própria e autorização explícita para qualquer operação real.

## Definições para o piloto

Ainda precisam ser definidos horário e janela da campanha, prazo de resposta,
texto final e recursos do canal (template/botões, se aplicáveis). Esses valores
não bloqueiam a implementação técnica de 4A com fixtures, mas precisam estar
fechados antes do piloto. Os valores usados em testes devem permanecer
identificados como fictícios.

Não criar tela nem mecanismo de política de autorização configurável. Permanecem
os registros individuais e os controles de titularidade, autorização, revogação e
responsável legal já implementados.

## Validação e sequência de Git

- Backend: Jest relevante, typecheck sem emissão e migrations somente em banco
  descartável durante testes.
- Bridge: testes de fila, transporte, webhook, concorrência e privacidade com
  serviços fictícios; `tsc --noEmit`.
- Frontend: build/TypeScript e homologação dos estados administrativos afetados.
- Python, se alterado: unittest isolado do `.env`; não há typechecker configurado.
- Antes de iniciar 4A, integrar a consolidação pendente e sincronizar `main` por
  fast-forward; então criar branches novas. As branches anteriores ficam preservadas.
- Push, PR, merge, configuração do ambiente, envio real e deploy têm autorizações
  próprias; a preparação deste documento não os executa.

## Situação da entrega 4B

Implementação e homologação isolada documentadas em
[respostas-pendencias-confirmacao.md](respostas-pendencias-confirmacao.md).
Respostas e pendências têm acompanhamento no Higia, com processamento persistente
no webhook e prazo por campanha. A integração permanece desligada por padrão.
A etapa seguinte deve validar a confirmação no legado em ambiente fictício e
fechar os requisitos do piloto; qualquer atualização ou envio real exige
validação e autorização específicas.

## Confirmação no legado em homologação — 10/11/2026

A integração da resposta validada com a escrita simulada e o resultado no Higia
está documentada em [confirmacao-legado.md](confirmacao-legado.md). A composição
continua explícita e inativa por padrão. Não houve envio, confirmação real,
provisionamento de credencial ou migração em banco de uso normal. A composição
operacional, a reconciliação de resultados desconhecidos e a homologação do canal
continuam pendentes para o piloto.
